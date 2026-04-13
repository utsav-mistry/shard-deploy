'use strict';

const fs    = require('fs-extra');
const path  = require('path');
const chalk = require('chalk');
const ora   = require('ora');

const logger = require('../utils/logger');
const { requireDocker, spawnLive, execSafe } = require('../utils/shell');

// ─── Command Handler ─────────────────────────────────────────────────────────

async function deployCommand(options) {
  logger.banner();

  const cwd = process.cwd();

  // ── 1. Docker check ───────────────────────────────────────────────────────
  requireDocker();
  const dockerVersion = execSafe('docker --version') || 'Docker (version unknown)';
  logger.info(dockerVersion);

  // ── 2. Check required files ───────────────────────────────────────────────
  const dockerfile = path.join(cwd, 'Dockerfile');
  const compose    = path.join(cwd, 'docker-compose.yml');

  if (!fs.existsSync(dockerfile)) {
    logger.error(
      'Dockerfile not found. Run `shard-deploy init` first to generate deployment files.'
    );
    process.exit(1);
  }

  if (!fs.existsSync(compose)) {
    logger.error(
      'docker-compose.yml not found. Run `shard-deploy init` first to generate deployment files.'
    );
    process.exit(1);
  }

  logger.success(`Dockerfile found at ${path.relative(cwd, dockerfile)}`);
  logger.success(`docker-compose.yml found at ${path.relative(cwd, compose)}`);

  // ── 3. Tear down existing containers if requested ─────────────────────────
  if (options.rebuild) {
    logger.step('Stopping and removing existing containers…');
    try {
      await spawnLive('docker', ['compose', 'down', '--remove-orphans']);
      logger.success('Existing containers removed');
    } catch {
      logger.warn('No existing containers to remove, continuing…');
    }
  }

  // ── 4. Build ──────────────────────────────────────────────────────────────
  logger.blank();
  logger.step('Building Docker image…');

  const buildArgs = options.noCache
    ? ['compose', 'build', '--no-cache']
    : ['compose', 'build'];

  try {
    await spawnLive('docker', buildArgs);
    logger.success('Docker image built successfully');
  } catch (err) {
    logger.error(`Build failed: ${err.message}`);
    logger.info('Tip: Run `docker compose build` manually for full error details.');
    process.exit(1);
  }

  // ── 5. Start containers ───────────────────────────────────────────────────
  logger.blank();

  if (options.detach) {
    logger.step('Starting containers in detached mode…');
    try {
      await spawnLive('docker', ['compose', 'up', '-d']);
      logger.success('Containers started in background');
      logger.blank();
      logger.info('Useful commands:');
      logger.detail(`  ${chalk.cyan('docker compose logs -f')}   — follow logs`);
      logger.detail(`  ${chalk.cyan('docker compose ps')}         — container status`);
      logger.detail(`  ${chalk.cyan('docker compose down')}       — stop containers`);
    } catch (err) {
      logger.error(`Could not start containers: ${err.message}`);
      process.exit(1);
    }
  } else {
    logger.step('Starting containers (Ctrl+C to stop)…');
    logger.blank();
    try {
      await spawnLive('docker', ['compose', 'up']);
    } catch {
      // User pressed Ctrl+C — that's fine
      logger.blank();
      logger.info('Containers stopped. Run with `-d` to run in detached mode.');
    }
  }
}

module.exports = { deployCommand };
