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

    const myCommand = vscode.commands.registerCommand('smarter-pyenv-monorepo.setTestConfiguration', () => {
        const poetryPath = context.workspaceState.get<string>('poetryPath');
        if (!poetryPath) {
            vscode.window.showErrorMessage("No workspace folder found");
            return
        }

        const testFolder = path.join(poetryPath, "tests");
        if (fs.existsSync(testFolder)) {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(poetryPath))?.uri.fsPath
            if (!workspaceFolder) {
                return
            }

            const testFolderRelative = testFolder.replace(workspaceFolder + '/', '');
            vscode.workspace.getConfiguration('python').update('testing.pytestEnabled', false, vscode.ConfigurationTarget.Global);
            setTimeout(() => {
                vscode.workspace.getConfiguration('python').update('testing.pytestArgs', [testFolderRelative], vscode.ConfigurationTarget.Global);
                vscode.workspace.getConfiguration('python').update('testing.pytestEnabled', true, vscode.ConfigurationTarget.Global);
            }, 2000)

        }
    });

    context.subscriptions.push(myCommand);
}

async function onActiveTextEditorChange(editor: vscode.TextEditor | undefined, pythonExtension: VscodePython.PythonExtension, context: vscode.ExtensionContext) {
    if (!editor || editor.document.languageId !== 'python') return;

    const pythonFile = editor.document.uri.fsPath;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(pythonFile));
    if (!workspaceFolder) return;

    const poetryPath = FindClosestPyProjectTomlInPath(pythonFile, workspaceFolder.uri.fsPath);
    if (!poetryPath) return;

    setPythonInterpreter(poetryPath, pythonExtension, context);
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

async function setPythonInterpreter(poetryPath: string, pythonExtension: VscodePython.PythonExtension, context: vscode.ExtensionContext) {
    const pyEnvNamePath = path.join(poetryPath, '.python-version');
    if (!fs.existsSync(pyEnvNamePath)) {
        return
    }

    const pythonInterpreterPath = await getPyEnvInterpreterPath(poetryPath, pyEnvNamePath);
    const currentInterpreter = pythonExtension.environments.getActiveEnvironmentPath().path
    if (pythonInterpreterPath && pythonInterpreterPath !== currentInterpreter && fs.existsSync(pythonInterpreterPath)) {
        context.workspaceState.update('poetryPath', poetryPath);
        await pythonExtension.environments.updateActiveEnvironmentPath(pythonInterpreterPath);
    }
}

export function deactivate() { }
