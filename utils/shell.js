'use strict';

const { execSync, spawn } = require('child_process');
const logger = require('./logger');

/**
 * Run a shell command synchronously and return stdout.
 * Returns null on failure instead of throwing.
 */
function execSafe(cmd) {
  try {
    return execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
  } catch {
    return null;
  }
}

/**
 * Check if a CLI tool is available in PATH.
 */
function isAvailable(tool) {
  const result = execSafe(
    process.platform === 'win32' ? `where ${tool}` : `which ${tool}`
  );
  return result !== null;
}

/**
 * Assert that Docker is installed, exit with clear message if not.
 */
function requireDocker() {
  if (!isAvailable('docker')) {
    logger.error(
      'Docker not found. Please install Docker: https://docs.docker.com/get-docker/'
    );
    process.exit(1);
  }
}

/**
 * Assert that Node.js is installed, exit with clear message if not.
 */
function requireNode() {
  if (!isAvailable('node')) {
    logger.error(
      'Node.js not found. Please install Node.js: https://nodejs.org/'
    );
    process.exit(1);
  }
}

/**
 * Spawn a child process with live output piped to stdout/stderr.
 * Returns a Promise that resolves/rejects based on exit code.
 */
function spawnLive(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      stdio: 'inherit',
      shell: true,
      ...opts,
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command "${cmd} ${args.join(' ')}" exited with code ${code}`));
    });

    proc.on('error', reject);
  });
}

module.exports = { execSafe, isAvailable, requireDocker, requireNode, spawnLive };
