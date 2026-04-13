#!/usr/bin/env node
'use strict';

const { program } = require('commander');
const chalk       = require('chalk');
const pkg         = require('../package.json');

const { initCommand }        = require('../commands/init');
const { deployCommand }      = require('../commands/deploy');
const { scanCommand }        = require('../commands/scan');
const { fixFrontendCommand } = require('../commands/fix-frontend');

// ─── Global meta ─────────────────────────────────────────────────────────────

program
  .name('shard-deploy')
  .description(
    chalk.bold('shard-deploy') + ' — production-grade deployment CLI for Node.js apps\n' +
    chalk.gray('  Containerize, configure, and deploy your backend in under 5 minutes.')
  )
  .version(pkg.version, '-v, --version', 'Output the current version')
  .helpOption('-h, --help', 'Display help for command')
  .addHelpText('after', `
${chalk.bold('Examples:')}
  ${chalk.cyan('$ shard-deploy init')}              Analyze project and generate deployment files
  ${chalk.cyan('$ shard-deploy init --nginx')}      Generate files with nginx reverse-proxy config
  ${chalk.cyan('$ shard-deploy deploy')}            Build image and start containers
  ${chalk.cyan('$ shard-deploy deploy -d')}         Run containers in detached (background) mode
  ${chalk.cyan('$ shard-deploy scan')}              Scan frontend for hardcoded localhost URLs
  ${chalk.cyan('$ shard-deploy fix-frontend')}      Interactively fix hardcoded URLs (EXPERIMENTAL)

${chalk.bold('Author:')}
  Utsav — ${chalk.underline('https://github.com/utsav-mistry')}

${chalk.bold('Support:')}
  ⭐ Star on GitHub: ${chalk.underline('https://github.com/utsav-mistry/shard-deploy')}
`);

// ─── init ────────────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Analyze your Node.js project and generate deployment files (Dockerfile, docker-compose.yml, nginx.conf)')
  .option('--port <number>', 'Override the application port (default: auto-detected or 3000)')
  .option('--nginx',         'Generate an nginx.conf and configure docker-compose to use it as a reverse proxy')
  .option('--force',         'Overwrite existing deployment files')
  .addHelpText('after', `
${chalk.bold('What this does:')}
  1. Detects your Node.js version and project entry point
  2. Reads package.json to extract port and scripts
  3. Generates a multi-stage Dockerfile optimised for production
  4. Generates docker-compose.yml with health checks
  5. Optionally generates nginx.conf as a reverse proxy

${chalk.bold('Examples:')}
  ${chalk.cyan('$ shard-deploy init')}
  ${chalk.cyan('$ shard-deploy init --port 8080')}
  ${chalk.cyan('$ shard-deploy init --nginx')}
  ${chalk.cyan('$ shard-deploy init --nginx --force')}
`)
  .action((opts) => runAsync(() => initCommand(opts)));

// ─── deploy ──────────────────────────────────────────────────────────────────

program
  .command('deploy')
  .description('Build the Docker image and start containers via docker compose')
  .option('-d, --detach',    'Run containers in detached (background) mode')
  .option('--no-cache',      'Build Docker image without using layer cache')
  .option('--rebuild',       'Stop and remove existing containers before starting')
  .addHelpText('after', `
${chalk.bold('Prerequisites:')}
  - Docker installed and running
  - Dockerfile and docker-compose.yml present (run shard-deploy init first)

${chalk.bold('Examples:')}
  ${chalk.cyan('$ shard-deploy deploy')}            Build and start (foreground)
  ${chalk.cyan('$ shard-deploy deploy -d')}         Build and start (background)
  ${chalk.cyan('$ shard-deploy deploy --no-cache')} Force full rebuild
  ${chalk.cyan('$ shard-deploy deploy --rebuild')}  Tear down then rebuild
`)
  .action((opts) => runAsync(() => deployCommand(opts)));

// ─── scan ────────────────────────────────────────────────────────────────────

program
  .command('scan')
  .description('Scan frontend source files for hardcoded localhost API URLs (read-only)')
  .option('--dir <path>', 'Directory to scan (default: current directory)')
  .addHelpText('after', `
${chalk.bold('What this detects:')}
  - axios.get("http://localhost:...")
  - fetch("http://localhost:...")
  - axios({ url: "http://localhost:..." })

${chalk.bold('What this skips (with explanation):')}
  - Template literals (may already use env vars)
  - Dynamic variables
  - Multi-line call expressions

${chalk.bold('Examples:')}
  ${chalk.cyan('$ shard-deploy scan')}
  ${chalk.cyan('$ shard-deploy scan --dir ./src')}
`)
  .action((opts) => runAsync(() => scanCommand(opts)));

// ─── fix-frontend ─────────────────────────────────────────────────────────────

program
  .command('fix-frontend')
  .description(
    chalk.yellow('[EXPERIMENTAL]') +
    ' Scan frontend source files and interactively replace hardcoded localhost URLs with env variables'
  )
  .option('--dir <path>', 'Directory to scan and fix (default: current directory)')
  .option('-y, --yes',    'Apply all fixable changes without prompting')
  .addHelpText('after', `
${chalk.bold.yellow('⚠️  EXPERIMENTAL')}
  This command modifies your source files. Always review changes before committing.
  A .bak backup file is created alongside each modified file.

${chalk.bold('What this fixes:')}
  Replaces:   axios.get("http://localhost:5000/api")
  With:       axios.get(process.env.REACT_APP_API_URL + "/api")

${chalk.bold('Examples:')}
  ${chalk.cyan('$ shard-deploy fix-frontend')}           Interactive mode
  ${chalk.cyan('$ shard-deploy fix-frontend --yes')}     Apply all fixes silently
  ${chalk.cyan('$ shard-deploy fix-frontend --dir ./src')}
`)
  .action((opts) => runAsync(() => fixFrontendCommand(opts)));

// ─── Error handling & parse ───────────────────────────────────────────────────

program.on('command:*', ([cmd]) => {
  console.error(chalk.red(`\n  ✖ Unknown command: ${cmd}\n`));
  console.log(`  Run ${chalk.cyan('shard-deploy --help')} to see available commands.\n`);
  process.exit(1);
});

program.parse(process.argv);

// If no command given, show help
if (process.argv.length < 3) {
  program.help();
}

// ─── Async wrapper ────────────────────────────────────────────────────────────

function runAsync(fn) {
  Promise.resolve().then(fn).catch((err) => {
    console.error(chalk.red(`\n  ✖ Unexpected error: ${err.message}\n`));
    if (process.env.SHARD_DEBUG) console.error(err.stack);
    process.exit(1);
  });
}
