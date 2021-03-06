const Generator = require('yeoman-generator');
const meta = require('../../package.json');

const axios = require('axios');
const mkdirp = require('mkdirp');
const slugify = require('@sindresorhus/slugify');
const spdxLicenseList = require('spdx-license-list/full');
const terminalLink = require('terminal-link');
const updateNotifier = require('update-notifier');
const yosay = require('yosay');
const { join } = require('path');

// Create array of license choices
const spdxCodes = Object.getOwnPropertyNames(spdxLicenseList).sort();
const licenseChoices = spdxCodes.map(obj => {
  const licenses = {};
  licenses['name'] = terminalLink(obj, `https://spdx.org/licenses/${obj}.html`, {
    fallback() {
      return obj;
    }
  });
  licenses['value'] = obj;

  return licenses;
});

// Is there a newer version of this generator?
updateNotifier({ pkg: meta }).notify();

module.exports = class extends Generator {
  constructor(args, opts) {
    super(args, opts);

    // Use long flags to discourage usage
    this.option(
      'allow-atom-prefix',
      {
        desc: `Allows naming the package with "atom-" prefix`,
        default: false,
        type: Boolean
      }
    );
    this.option(
      'allow-empty-description',
      {
        desc: `Allows empty packag description`,
        default: false,
        type: Boolean
      }
    );
    this.option(
      'clear',
      {
        desc: `Doesn't clear the console on startup`,
        default: true,
        type: Boolean
      }
    );
    this.option(
      'debug',
      {
        desc: `Displays debug information`,
        default: false,
        type: Boolean
      }
    );

    this.allowAtomPrefix = (this.options.allowAtomPrefix ? true : false);
    this.allowEmptyDescription = (this.options.allowEmptyDescription ? true : false);
    this.clear = (this.options.clear ? true : false);
    this.debugMode = (this.options.debug ? true : false);
  }

  inquirer() {
    if (this.clear) console.clear();
    console.log(yosay('Let me help you build an Atom package'));

    return this.prompt([
      {
        name: 'name',
        message: 'What do you want to name your package?',
        default: slugify(this.appname),
        store: true,
        validate: (str) => {
          if (str.startsWith('atom-') && this.allowAtomPrefix === false) {
            return 'Your package name shouldn\'t be prefixed with "atom-"';
          } else if (str.length > 214) {
            return 'The name must be less than or equal to 214 characters';
          }

          return true;
        }
      },
      {
        name: 'description',
        message: 'What is your package description?',
        default: '',
        store: true,
        validate: (str) => {
          return (str.length === 0 && this.allowEmptyDescription === false) ? 'Please provide a short description for your package' : true;
        }
      },
      {
        name: 'author',
        message: 'What\'s your GitHub username?',
        default: async () => {
          let username;

          try {
            username = await this.user.github.username();
          } catch (error) {
            username = '';
          }

          return username;
        },
        store: true,
        validate: x => x.length > 0 ? true : 'You have to provide a username',
        when: () => !this.options.org
      },
      {
        type: 'list',
        name: 'license',
        message: 'Choose a license',
        default: 'MIT',
        store: true,
        choices: licenseChoices,
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Package Features',
        store: true,
        choices: [
          {
            name: 'Grammars',
            value: 'grammars',
            checked: false
          },
          {
            name: 'Keymaps',
            value: 'keymaps',
            checked: false
          },
          {
            name: 'Menus',
            value: 'menus',
            checked: false
          },
          {
            name: 'Snippets',
            value: 'snippets',
            checked: false
          },
          {
            name: 'Styles',
            value: 'styles',
            checked: false
          }
        ]
      },
      {
        type: 'confirm',
        name: 'activationCommands',
        message: 'Add activation command?',
        default: true
      },
      {
        type: 'checkbox',
        name: 'activationHooks',
        message: 'Add activation hooks?',
        store: true,
        choices: [
          {
            name: 'Loaded Shell Environment',
            value: 'core:loaded-shell-environment',
            checked: false
          },
          {
            name: 'Root Scope Used',
            value: 'root-scope-used',
            checked: false
          },
          {
            name: 'Grammar Used',
            value: 'grammar-used',
            checked: false
          }
        ]
      },
      {
        name: 'rootScopeUsed',
        message: 'Activation Hooks: Specify root scope used',
        store: true,
        when: answers => answers.activationHooks.includes('root-scope-used'),
        validate: str => str.endsWith(':root-scope-used') && str.length > ':root-scope-used'.length ? true : 'You need to specify a valid root scope'
      },
      {
        name: 'grammarUsed',
        message: 'Activation Hooks: Specify grammar used',
        store: true,
        when: answers => answers.activationHooks.includes('grammar-used'),
        validate: str => str.startsWith('language-') && str.length > 'language-'.length ? true : 'You need to specify a valid language package'
      },
      {
        type: 'confirm',
        name: 'workspaceOpeners',
        message: 'Add workspace openers?',
        store: true,
        default: false,
      },
      {
        name: 'workspaceOpenerURIs',
        message: 'Workspace Openers: Specify workspace URIs (comma-separated)',
        store: true,
        when: answers => answers.workspaceOpeners,
        validate: str => {
          if (str.trim().length === 0) {
            return 'You need to specify at least one URI';
          }

          const workspaceOpeners = str.split(',') || [str];

          workspaceOpeners.forEach(workspaceOpener => {
            if (!workspaceOpener.startsWith('atom://')) {
              throw 'You need to specify a valid workspace URI, prefixed with atom://';
            }
          });

          return true;
        }
      },
      {
        type: 'confirm',
        name: 'atomDependenciesQuestion',
        message: 'Depend on other Atom packages?',
        default: false,
        store: true
      },
      {
        name: 'atomDependencies',
        message: 'Specify Atom packages (comma-separated)',
        store: true,
        when: answers => answers.atomDependenciesQuestion ? true : false,
        validate: async str => {
          if (str.trim().length === 0) {
            return 'You need to specify at least one package';
          }

          const packages = str.split(',');
          const promises = [];

          for (var pkg of packages) {
            promises.push(axios.get(`https://atom.io/api/packages/${pkg}`));
          }

          try {
            await Promise.all(promises); // responses will be an array
          } catch (err) {
            return `The package '${pkg}' could not be found`;
          }

          return true;
        }
      },
      {
        type: 'confirm',
        name: 'buildWithWebpack',
        message: 'Build with Webpack',
        default: true,
        store: true
      },
      {
        type: 'list',
        name: 'buildScript',
        message: 'Build Script',
        default: 'prepublishOnly',
        store: true,
        choices: [
          {
            name: 'postinstall',
            value: 'postinstall',
          },
          {
            name: 'prepublishOnly',
            value: 'prepublishOnly',
          }
        ]
      },
      {
        type: 'list',
        name: 'linterHook',
        message: 'Linter Hook',
        default: 'pre-commit',
        store: true,
        choices: [
          {
            name: 'pre-commit',
            value: 'pre-commit',
          },
          {
            name: 'pre-push',
            value: 'pre-push',
          }
        ]
      },
      {
        type: 'checkbox',
        name: 'addConfig',
        message: 'Add CI configuration',
        store: true,
        choices: [
          {
            name: terminalLink('Circle CI', 'https://circleci.com/', {
              fallback() {
                return 'Circle CI';
              }
            }),
            value: 'circleCI',
            checked: false
          },
          {
            name: terminalLink('Travis CI', 'https://travis-ci.org/', {
              fallback() {
                return 'Travis CI';
              }
            }),
            value: 'travisCI',
            checked: false
          }
        ]
      },
      {
        type: 'list',
        name: 'stylelintConfig',
        message: 'Stylelint Configuration',
        default: 'Recommended',
        store: true,
        when: answers => answers.features.includes('styles'),
        choices: [
          {
            name: terminalLink('Airbnb', 'https://www.npmjs.com/package/stylelint-config-airbnb', {
              fallback() {
                return 'Airbnb';
              }
            }),
            value: 'airbnb',
          },
          {
            name: terminalLink('Idiomatic', 'https://www.npmjs.com/package/stylelint-config-idiomatic', {
              fallback() {
                return 'Idiomatic';
              }
            }),
            value: 'idiomatic',
          },
          {
            name: terminalLink('Prettier', 'https://www.npmjs.com/package/stylelint-config-prettier', {
              fallback() {
                return 'Prettier';
              }
            }),
            value: 'prettier',
          },
          {
            name: terminalLink('Primer', 'https://www.npmjs.com/package/stylelint-config-primer', {
              fallback() {
                return 'Primer';
              }
            }),
            value: 'primer',
          },
          {
            name: terminalLink('Recommended', 'https://www.npmjs.com/package/stylelint-config-recommended', {
              fallback() {
                return 'Recommended';
              }
            }),
            value: 'recommended',
          },
          {
            name: terminalLink('Shopify', 'https://www.npmjs.com/package/stylelint-config-shopify', {
              fallback() {
                return 'Shopify';
              }
            }),
            value: 'shopify',
          },
          {
            name: terminalLink('Standard', 'https://www.npmjs.com/package/stylelint-config-standard', {
              fallback() {
                return 'Standard';
              }
            }),
            value: 'standard',
          },
          {
            name: terminalLink('WordPress', 'https://www.npmjs.com/package/stylelint-config-wordpress', {
              fallback() {
                return 'WordPress';
              }
            }),
            value: 'wordpress',
          },
          {
            name: terminalLink('XO', 'https://www.npmjs.com/package/stylelint-config-xo', {
              fallback() {
                return 'XO';
              }
            }),
            value: 'xo',
          }
        ]
      },
      {
        type: 'confirm',
        name: 'initGit',
        message: 'Initialize Git repository?',
        default: this.fs.exists(join(process.cwd(), '.git', 'config')) ? false : true
      },
      {
        type: 'confirm',
        name: 'linkDevPackage',
        message: 'Link as developer package?',
        default: 'true',
        store: true
      },
      {
        type: 'confirm',
        name: 'openInEditor',
        message: 'Open in default editor?',
        default: 'true',
        store: true,
        when: () => {
          return (process.env.EDITOR) ? true : false;
        }
      },
    ]).then(props => {
      if (this.debugMode) console.log(props);

      props.licenseURL = spdxLicenseList[props.license].url;
      props.licenseName = spdxLicenseList[props.license].name;
      props.licenseText = spdxLicenseList[props.license].licenseText.replace(/\n{3,}/g, '\n\n');
      props.repositoryName = (props.name.startsWith('atom-')) ? props.name : `atom-${props.name}`;
      props.lintScript = (props.features.includes('styles')) ? "npm run lint:ts && npm run lint:styles" : "npm run lint:ts";

      if (typeof props.atomDependencies !== 'undefined') {
        props.atomDependencies = props.atomDependencies.split(',');
        props.atomDependencies.map(dependency => dependency.trim());
      }

      // Copying files
      props.features.forEach( feature => {
        mkdirp(feature);
      });

      if (props.features.includes('keymaps')) {
        this.fs.copyTpl(
          this.templatePath('keymaps/keymap.json.ejs'),
          this.destinationPath(`keymaps/${props.name}.json`),
          {
            pkg: props
          }
        );
      }

      if (props.features.includes('menus')) {
        this.fs.copyTpl(
          this.templatePath('menus/menu.json.ejs'),
          this.destinationPath(`menus/${props.name}.json`),
          {
            pkg: props
          }
        );
      }

      if (props.features.includes('styles')) {
        this.fs.copyTpl(
          this.templatePath('styles/style.less.ejs'),
          this.destinationPath(`styles/${props.name}.less`),
          {
            pkg: props
          }
        );
      }

      mkdirp('src');
      this.fs.copyTpl(
        this.templatePath('src/index.ts.ejs'),
        this.destinationPath(`src/${props.name}.ts`),
        {
          pkg: props
        }
      );

      this.fs.copyTpl(
        this.templatePath('src/config.ts.ejs'),
        this.destinationPath(`src/config.ts`),
        {
          pkg: props
        }
      );

      this.fs.copyTpl(
        this.templatePath('src/hello-world.ts.ejs'),
        this.destinationPath(`src/hello-world.ts`),
        {
          pkg: props
        }
      );

     this.fs.copyTpl(
        this.templatePath('README.md.ejs'),
        this.destinationPath('README.md'),
        {
          pkg: props
        }
      );

      this.fs.copyTpl(
        this.templatePath('LICENSE.ejs'),
        this.destinationPath('LICENSE'),
        {
          licenseText: props.licenseText
        }
      );

      props.scriptBuild = (props.buildWithWebpack) ? 'webpack --mode production' : 'tsc --pretty --project ./';
      props.scriptDev = (props.buildWithWebpack) ? 'webpack --mode none --watch' : 'tsc --watch --pretty --project ./';

      if (props.buildWithWebpack) {
        this.fs.copyTpl(
          this.templatePath('webpack.config.js.ejs'),
          this.destinationPath(`webpack.config.js`),
          {
            pkg: props
          }
        );
      }

      this.fs.copyTpl(
        this.templatePath('package.json.ejs'),
        this.destinationPath('package.json'),
        {
          pkg: props
        }
      );

      if (props.addConfig.includes('circleCI')) {
        mkdirp('.circleci');
        this.fs.copyTpl(
          this.templatePath('_circleci/config.yml'),
          this.destinationPath('.circleci/config.yml')
        );
      }

      if (props.addConfig.includes('travisCI')) {
        this.fs.copy(
          this.templatePath('_travis.yml'),
          this.destinationPath('.travis.yml')
        );
      }

      this.fs.copy(
        this.templatePath('_editorconfig'),
        this.destinationPath('.editorconfig')
      );

      this.fs.copyTpl(
        this.templatePath('_gitignore'),
        this.destinationPath('.gitignore'),
        {
          pkg: props
        }
      );

      if (props.features.includes('styles')) {
        this.fs.copyTpl(
          this.templatePath('_stylelintrc.ejs'),
          this.destinationPath(`.stylelintrc`),
          {
            pkg: props
          }
        );
      }

      this.fs.copy(
        this.templatePath('tsconfig.json'),
        this.destinationPath(`tsconfig.json`)
      );

      this.fs.copy(
        this.templatePath('.eslintrc'),
        this.destinationPath(`.eslintrc`)
      );

      // Install latest versions of dependencies
      const dependencies = ['@types/atom', '@types/node', 'typescript'];
      let devDependencies =[
        '@typescript-eslint/eslint-plugin',
        '@typescript-eslint/eslint-plugin-tslint',
        '@typescript-eslint/parser',
        'concurrently',
        'eslint',
        'husky',
        'tslint'
      ];

      if (props.features.includes('styles')) {
        devDependencies.push(
          'stylelint',
          `stylelint-config-${props.stylelintConfig}`
        );
      }

      if (props.buildWithWebpack) {
        devDependencies.push('ts-loader','webpack', 'webpack-cli');
      }

      if (props.buildScript === 'prepublishOnly') {
        devDependencies = devDependencies.concat(dependencies)
        if (typeof props.atomDependencies !== 'undefined' && props.atomDependencies.length > 0) {
          this.yarnInstall(['atom-package-deps'], { ignoreScripts: true });
        }
      } else {
        if (typeof props.atomDependencies !== 'undefined' && props.atomDependencies.length > 0) {
          dependencies.push('atom-package-deps');
        }
        this.yarnInstall(dependencies, { ignoreScripts: true });
      }
      this.yarnInstall(devDependencies, { 'dev': true });

      // Initialize git repository
      if (props.initGit) {
        this.spawnCommandSync('git', ['init']);
      }

      // Link to ~/.atom/dev/packages
      if (props.linkDevPackage === true) {
        this.spawnCommand('apm', ['link', '--dev']);
      }

      // Open in Editor
      if (props.openInEditor === true) {
        this.spawnCommand(process.env.EDITOR, [ '.' ]);
      }
    });
  }
};
