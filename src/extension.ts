'use strict';
import * as VscodePython from "@vscode/python-extension";
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

export async function activate(context: vscode.ExtensionContext) {
    const activeEditor = vscode.window.activeTextEditor;
    const pythonExtension = await VscodePython.PythonExtension.api()

    activeEditor && await onActiveTextEditorChange(activeEditor, pythonExtension, context);

    let disposable = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        editor && await onActiveTextEditorChange(editor, pythonExtension, context)
    });

    context.subscriptions.push(disposable);

    const testConfigurationCommand = vscode.commands.registerCommand('smarter-pyenv-monorepo.setTestConfiguration', () => {
        const tomlPath = context.workspaceState.get<string>('tomlPath');
        const interpreterPath = context.workspaceState.get<string>('interpreterPath');
        if (!tomlPath) {
            vscode.window.showErrorMessage("No tomlPath found");
            return
        }
        if (!interpreterPath) {
            vscode.window.showErrorMessage("No interpreterPath found");
            return
        }

        const testFolder = path.join(tomlPath, "tests");
        if (fs.existsSync(testFolder)) {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(tomlPath))?.uri.fsPath
            if (!workspaceFolder) {
                return
            }

            const pyTestPath = path.join(path.dirname(interpreterPath), "pytest");
            vscode.workspace.getConfiguration('python').update('testing.pytestEnabled', false, vscode.ConfigurationTarget.Global);
            fs.rm(path.join(workspaceFolder, ".pytest_cache"), { recursive: true, force: true }, () => {});
            setTimeout(() => {
                vscode.window.showInformationMessage(`Testing the folder ${tomlPath}`);
                vscode.workspace.getConfiguration('python').update('testing.pytestPath', pyTestPath, vscode.ConfigurationTarget.Global);
                vscode.workspace.getConfiguration('python').update('testing.cwd', tomlPath, vscode.ConfigurationTarget.Global);
                vscode.workspace.getConfiguration('python').update('testing.pytestEnabled', true, vscode.ConfigurationTarget.Global);

            }, 1000)
        }
    });

    context.subscriptions.push(testConfigurationCommand);

    const clearTestConfigurationCommand = vscode.commands.registerCommand('smarter-pyenv-monorepo.clearTestConfiguration', () => {
        vscode.workspace.getConfiguration('python').update('testing.pytestPath', undefined, vscode.ConfigurationTarget.Global);
        vscode.workspace.getConfiguration('python').update('testing.pytestEnabled', undefined, vscode.ConfigurationTarget.Global);
        vscode.workspace.getConfiguration('python').update('testing.pytestArgs', undefined, vscode.ConfigurationTarget.Global);
        vscode.workspace.getConfiguration('python').update('testing.cwd', undefined, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage("Cleared test configuration")
    });

    context.subscriptions.push(clearTestConfigurationCommand);
}

async function onActiveTextEditorChange(editor: vscode.TextEditor | undefined, pythonExtension: VscodePython.PythonExtension, context: vscode.ExtensionContext) {
    if (!editor || editor.document.languageId !== 'python') return;

    const pythonFile = editor.document.uri.fsPath;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(pythonFile));
    if (!workspaceFolder) return;

    const tomlPath = FindClosestPyProjectTomlInPath(pythonFile, workspaceFolder.uri.fsPath);
    if (!tomlPath) return;

    setPythonInterpreter(tomlPath, pythonExtension, context);
}

function FindClosestPyProjectTomlInPath(pythonFile: string, workspaceRoot: string) {
    let currentDir = pythonFile;
    let prevDir;
    do {
        currentDir = path.dirname(currentDir);
        const pyprojectTomlPath = path.join(currentDir, 'pyproject.toml');
        if (fs.existsSync(pyprojectTomlPath)) {
            return currentDir;
        }
        prevDir = currentDir;
    } while (currentDir !== workspaceRoot)
    return undefined;
}

async function getPyEnvInterpreterPath(poetryPath: string, pyEnvNamePath: string) {
    const pyEnvName = fs.readFileSync(pyEnvNamePath, 'utf-8').trim();

    try {
        return await new Promise<string>((resolve, reject) => {
            exec(`pyenv prefix ${pyEnvName}`, { cwd: poetryPath }, (error, stdout, stderr) => {
                if (error) {
                    reject(`Error executing pyenv which: ${stderr}`);
                } else {
                    resolve(path.join(stdout.trim(), "bin", "python"));
                }
            });
        });
    } catch (e) {
        return null;
    }
}

async function setPythonInterpreter(tomlPath: string, pythonExtension: VscodePython.PythonExtension, context: vscode.ExtensionContext) {
    const pyEnvNamePath = path.join(tomlPath, '.python-version');
    if (!fs.existsSync(pyEnvNamePath)) {
        return
    }

    const pythonInterpreterPath = await getPyEnvInterpreterPath(tomlPath, pyEnvNamePath);
    const currentInterpreter = pythonExtension.environments.getActiveEnvironmentPath().path
    if (pythonInterpreterPath && pythonInterpreterPath !== currentInterpreter && fs.existsSync(pythonInterpreterPath)) {
        context.workspaceState.update('tomlPath', tomlPath);
        context.workspaceState.update('interpreterPath', pythonInterpreterPath);
        await pythonExtension.environments.updateActiveEnvironmentPath(pythonInterpreterPath);
    }
}

export function deactivate() { }
