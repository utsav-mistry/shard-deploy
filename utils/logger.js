'use strict';

const chalk = require('chalk');

const SYMBOLS = {
  success: '✔',
  warning: '⚠',
  error:   '✖',
  info:    'ℹ',
  arrow:   '→',
  bullet:  '•',
};

const logger = {
  success(msg) {
    console.log(chalk.green(`  ${SYMBOLS.success} ${msg}`));
  },

  warn(msg) {
    console.log(chalk.yellow(`  ${SYMBOLS.warning} ${msg}`));
  },

  error(msg) {
    console.error(chalk.red(`  ${SYMBOLS.error} ${msg}`));
  },

  info(msg) {
    console.log(chalk.cyan(`  ${SYMBOLS.info} ${msg}`));
  },

  step(msg) {
    console.log(chalk.bold(`\n  ${SYMBOLS.arrow} ${msg}`));
  },

  detail(msg) {
    console.log(chalk.gray(`     ${msg}`));
  },

  blank() {
    console.log('');
  },

  divider() {
    console.log(chalk.gray('  ' + '─'.repeat(56)));
  },

  banner() {
    const lines = [
      '',
      chalk.bold.hex('#6C63FF')('  ███████╗██╗  ██╗ █████╗ ██████╗ ██████╗ '),
      chalk.bold.hex('#6C63FF')('  ██╔════╝██║  ██║██╔══██╗██╔══██╗██╔══██╗'),
      chalk.bold.hex('#6C63FF')('  ███████╗███████║███████║██████╔╝██║  ██║'),
      chalk.bold.hex('#6C63FF')('  ╚════██║██╔══██║██╔══██║██╔══██╗██║  ██║'),
      chalk.bold.hex('#6C63FF')('  ███████║██║  ██║██║  ██║██║  ██║██████╔╝'),
      chalk.bold.hex('#6C63FF')('  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ '),
      '',
      chalk.hex('#A8A5FF')('  shard-deploy') + chalk.gray(' — production-grade deployment CLI'),
      chalk.gray('  v1.0.0 · github.com/utsav-mistry/shard-deploy'),
      '',
    ];
    console.log(lines.join('\n'));
  },

  experimentalWarning() {
    console.log('');
    console.log(chalk.yellow('  ┌' + '─'.repeat(54) + '┐'));
    console.log(chalk.yellow('  │') + chalk.bold.yellow('  ⚠️  EXPERIMENTAL MODE                                ') + chalk.yellow('│'));
    console.log(chalk.yellow('  │') + '                                                      ' + chalk.yellow('│'));
    console.log(chalk.yellow('  │') + chalk.yellow('  Frontend fix mode may alter your source files.      ') + chalk.yellow('│'));
    console.log(chalk.yellow('  │') + chalk.yellow('  Review ALL changes carefully before committing.     ') + chalk.yellow('│'));
    console.log(chalk.yellow('  │') + chalk.yellow('  Backup files (.bak) will be created automatically. ') + chalk.yellow('│'));
    console.log(chalk.yellow('  └' + '─'.repeat(54) + '┘'));
    console.log('');
  },
};

module.exports = logger;
module.exports.SYMBOLS = SYMBOLS;
