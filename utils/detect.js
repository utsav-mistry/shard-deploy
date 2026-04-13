'use strict';

const fs = require('fs-extra');
const path = require('path');

/**
 * Read package.json from the target directory.
 * Returns parsed JSON or null if not found.
 */
function readPackageJson(dir = process.cwd()) {
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  try {
    return fs.readJsonSync(pkgPath);
  } catch {
    return null;
  }
}

/**
 * Detect the port from package.json scripts or common env patterns.
 * Returns detected port string or the default fallback.
 */
function detectPort(pkg, fallback = '3000') {
  if (!pkg) return fallback;

  const scripts = Object.values(pkg.scripts || {}).join(' ');
  const portMatch = scripts.match(/PORT[= ](\d+)/) ||
                    scripts.match(/--port[= ](\d+)/i) ||
                    scripts.match(/-p\s+(\d+)/);
  if (portMatch) return portMatch[1];

  // Check common env files
  const envFilePath = path.join(process.cwd(), '.env');
  if (require('fs').existsSync(envFilePath)) {
    const envContent = require('fs').readFileSync(envFilePath, 'utf8');
    const envMatch = envContent.match(/^PORT=(\d+)/m);
    if (envMatch) return envMatch[1];
  }

  return fallback;
}

/**
 * Detect the main entry point from package.json.
 */
function detectEntry(pkg) {
  if (!pkg) return 'index.js';
  return pkg.main || 'index.js';
}

/**
 * Detect the start/build script names.
 */
function detectScripts(pkg) {
  const scripts = pkg?.scripts || {};
  return {
    start:  scripts.start  ? 'npm start'       : 'node index.js',
    build:  scripts.build  ? 'npm run build'   : null,
    dev:    scripts.dev    ? 'npm run dev'      : null,
  };
}

/**
 * Check whether the project looks like a React / CRA / Vite frontend.
 */
function isFrontendProject(pkg) {
  if (!pkg) return false;
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return !!(deps['react'] || deps['vue'] || deps['@angular/core'] || deps['svelte']);
}

module.exports = { readPackageJson, detectPort, detectEntry, detectScripts, isFrontendProject };
