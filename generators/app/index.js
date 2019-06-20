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
    this.debug = (this.options.debug ? true : false);
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
        name: 'activationCmd',
        message: 'Add activation command?',
        default: true
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
        when: answers => (answers.atomDependenciesQuestion) ? true : false,
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
      if (this.debug) console.log(props);

      props.licenseURL = spdxLicenseList[props.license].url;
      props.licenseName = spdxLicenseList[props.license].name;
      props.licenseText = spdxLicenseList[props.license].licenseText.replace(/\n{3,}/g, '\n\n');
      props.repositoryName = (props.name.startsWith('atom-')) ? props.name : `atom-${props.name}`;

      if (typeof props.atomDependencies !== 'undefined') {
        props.atomDependencies = props.atomDependencies.split(',');
        props.atomDependencies.map(dependency => dependency.trim());
      }

      // Copying files
      props.features.forEach( feature => {
        mkdirp(feature);
      });

      if (props.features.indexOf('keymaps') !== -1) {
        this.fs.copyTpl(
          this.templatePath('keymaps/keymap.json.ejs'),
          this.destinationPath(`keymaps/${props.name}.json`),
          {
            pkg: props
          }
        );
      }

      if (props.features.indexOf('menus') !== -1) {
        this.fs.copyTpl(
          this.templatePath('menus/menu.json.ejs'),
          this.destinationPath(`menus/${props.name}.json`),
          {
            pkg: props
          }
        );
      }

      if (props.features.indexOf('styles') !== -1) {
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

      props.scriptBuild = (props.buildWithWebpack) ? 'webpack --mode none' : 'tsc --pretty --project ./';
      props.scriptDev = (props.buildWithWebpack) ? 'webpack --mode none --watch' : 'tsc --watch --pretty --project ./';

      if (props.buildWithWebpack) {
        this.fs.copy(
          this.templatePath('webpack.config.js.ejs'),
          this.destinationPath(`webpack.config.js`),
          {
            name: props.name
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

      if (props.addConfig.indexOf('circleCI') !== -1) {
        mkdirp('.circleci');
        this.fs.copyTpl(
          this.templatePath('_circleci/config.yml'),
          this.destinationPath('.circleci/config.yml')
        );
      }

      if (props.addConfig.indexOf('travisCI') !== -1) {
        this.fs.copy(
          this.templatePath('_travis.yml'),
          this.destinationPath('.travis.yml')
        );
      }

      this.fs.copy(
        this.templatePath('_editorconfig'),
        this.destinationPath('.editorconfig')
      );

      this.fs.copy(
        this.templatePath('_gitignore'),
        this.destinationPath('.gitignore')
      );

      this.fs.copy(
        this.templatePath('tsconfig.json'),
        this.destinationPath(`tsconfig.json`)
      );

      this.fs.copy(
        this.templatePath('tslint.json'),
        this.destinationPath(`tslint.json`)
      );

      // Install latest versions of dependencies
      const dependencies = ['@types/atom', '@types/node', 'typescript'];
      let devDependencies =['tslint', 'husky'];


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
