'use strict';

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');

const logger = require('../utils/logger');
const { requireNode, execSafe } = require('../utils/shell');
const { readPackageJson, detectPort, isFrontendProject } = require('../utils/detect');
const { detectEntrypoint } = require('../core/detectors/entrypoint');
const {
  dockerfileTemplate,
  dockerComposeTemplate,
  dockerComposeNginxTemplate,
  nginxConfTemplate,
  dockerignoreTemplate,
} = require('../templates');

// ─── File write helper ───────────────────────────────────────────────────────

function writeFile(filePath, content, overwrite = false) {
  if (fs.existsSync(filePath) && !overwrite) {
    logger.warn(`${path.basename(filePath)} already exists — skipping (use --force to overwrite)`);
    return false;
  }
  fs.outputFileSync(filePath, content);
  logger.success(`${path.basename(filePath)} created at ${path.relative(process.cwd(), filePath)}`);
  return true;
}

// ─── Command Handler ─────────────────────────────────────────────────────────

async function initCommand(options) {
  logger.banner();

  const cwd = process.cwd();

  // ── 1. Node.js check ─────────────────────────────────────────────────────
  requireNode();
  const nodeVersion = execSafe('node --version')?.replace('v', '') || '20';
  const nodeMajor = nodeVersion.split('.')[0] || '20';
  logger.info(`Node.js ${nodeVersion} detected`);

  // ── 2. Read package.json ─────────────────────────────────────────────────
  const pkg = readPackageJson(cwd);
  if (!pkg) {
    logger.error(
      'No package.json found in the current directory. Run this command from your project root.'
    );
    process.exit(1);
  }
  logger.success(`package.json read — project: ${chalk.bold(pkg.name || 'unnamed')}`);

  // ── 3. Frontend check ────────────────────────────────────────────────────
  if (isFrontendProject(pkg) && !options.force) {
    logger.warn(
      'This looks like a frontend project (React/Vue/Angular detected).'
    );
    logger.info(
      'Backend init is designed for server-side apps. Use --fix-frontend for frontend scanning.'
    );
    logger.detail('Run with --force to generate backend files anyway.');
    process.exit(0);
  }

  // ── 4. Determine values ───────────────────────────────────────────────────
  const port = options.port || detectPort(pkg);
  const appName = (pkg.name || 'app').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  let entrypoint;

  try {
    entrypoint = detectEntrypoint(cwd);
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }

  logger.blank();
  logger.step('Configuration summary');
  logger.detail(`App name  : ${chalk.cyan(appName)}`);
  logger.detail(`Port      : ${chalk.cyan(port)}`);
  logger.detail(`Entry     : ${chalk.cyan(entrypoint.label)}`);
  logger.detail(`Node      : ${chalk.cyan(nodeMajor)}`);
  logger.detail(`Nginx     : ${chalk.cyan(options.nginx ? 'yes' : 'no')}`);
  logger.info(`Detected entrypoint: ${entrypoint.label}`);
  logger.blank();

  // ── 5. Generate files ────────────────────────────────────────────────────
  const spinner = ora({ text: 'Generating deployment files…', color: 'cyan' }).start();
  await sleep(300);

  const force = !!options.force;

  spinner.stop();

  writeFile(
    path.join(cwd, 'Dockerfile'),
    dockerfileTemplate({ port, entrypoint, nodeVersion: nodeMajor }),
    force
  );

  if (options.nginx) {
    writeFile(
      path.join(cwd, 'docker-compose.yml'),
      dockerComposeNginxTemplate({ appName, port }),
      force
    );
    writeFile(
      path.join(cwd, 'nginx.conf'),
      nginxConfTemplate({ appName, port }),
      force
    );
  } else {
    writeFile(
      path.join(cwd, 'docker-compose.yml'),
      dockerComposeTemplate({ appName, port }),
      force
    );
  }

  writeFile(path.join(cwd, '.dockerignore'), dockerignoreTemplate(), force);

  // ── 6. Final tips ────────────────────────────────────────────────────────
  logger.divider();
  logger.success('Deployment files ready!');
  logger.blank();
  logger.info('Next steps:');
  logger.detail(`  ${chalk.cyan('shard-deploy deploy')}          — build & start containers`);
  logger.detail(`  ${chalk.cyan('docker compose up --build')}    — manual alternative`);
  if (!options.nginx) {
    logger.detail(`  ${chalk.cyan('shard-deploy init --nginx')}    — enable nginx reverse proxy`);
  }
  logger.blank();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { initCommand };
