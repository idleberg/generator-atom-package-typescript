# generator-atom-package-typescript

[![npm](https://flat.badgen.net/npm/license/generator-atom-package-typescript)](https://www.npmjs.org/package/generator-atom-package-typescript)
[![npm](https://flat.badgen.net/npm/v/generator-atom-package-typescript)](https://www.npmjs.org/package/generator-atom-package-typescript)
[![CircleCI](https://flat.badgen.net/circleci/github/idleberg/generator-atom-package-typescript)](https://circleci.com/gh/idleberg/generator-atom-package-typescript)
[![David](https://flat.badgen.net/david/dep/idleberg/generator-atom-package-typescript)](https://david-dm.org/idleberg/generator-atom-package-typescript)

## Description

A [Yeoman](http://yeoman.io/authoring/user-interactions.html) generator for Atom packages written in any version of TypeScript.

**Features**

- adds any [SPDX](https://spdx.org/licenses/) license
- adds [CircleCI](https://circleci.com) configuration
- adds [Travis CI](https://travis-ci.org/) configuration
- adds [ESLint](https://github.com/typescript-eslint/typescript-eslint) configuration
- adds [stylelint](https://stylelint.io/) configuration
- adds [Atom package dependencies](https://www.npmjs.com/package/atom-package-deps)

## Prerequisites

You need [Node.js](https://nodejs.org/en/) installed and available in your `PATH` [environment variable](http://superuser.com/a/284351/195953). Use your preferred Node package manager to install the Yeoman CLI tool.

```sh
npm install -g yo
```

## Installation

Use your preferred [Node](https://nodejs.org/) package manager to install the CLI tool

```sh
npm i generator-atom-package-typescript -g
```

## Usage

Create a new directory for your package and change into it:

```sh
cd ~/.atom/packages
mkdir my-package
cd my-package
```

Next, run the generator and follow its instructions. Use `--help`to list available flags.

```sh
yo atom-package-typescript
```

*“That's all Folks!”*

## Related

- [generator-atom-package-coffeescript](https://www.npmjs.org/package/generator-atom-package-coffeescript)
- [generator-atom-package-webpack](https://www.npmjs.org/package/generator-atom-package-webpack)

## License

This work is licensed under the [MIT License](https://opensource.org/licenses/MIT)
