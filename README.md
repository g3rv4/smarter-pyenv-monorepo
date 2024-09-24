# Smarter Pyenv Monorepo

Simplify working on python monorepos that use pyenv.

## What does it do?

* Automatically select the python interpreter when you open a file
* Adds a command to the palette so that you can set pytest to use the tests of the current active project (better results are achieved by setting the `testpaths` on the `[tool.pytest.ini_options]` section of `pyproject.toml`)

## When is this useful?

* If you use `pyenv` to manage you virtual environments
* If you use `poetry` to manage your dependencies
* If you use `pytest` to manage your tests

### Can you support my specific use case?

I don't mind reviewing a PR adding more scenarios as long as they don't break mine :)

## License

This extension is licensed under the [MIT License](LICENSE).

## Acknowledgments

Special thanks to @ihsan-96 for building the [Poetry Monorepo](https://marketplace.visualstudio.com/items?itemName=ameenahsanma.poetry-monorepo) extension (and licensing it as MIT). I used that as the base of this work.