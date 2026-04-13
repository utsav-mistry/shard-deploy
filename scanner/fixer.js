'use strict';

const fs     = require('fs-extra');
const path   = require('path');
const chalk  = require('chalk');
const logger = require('../utils/logger');

/**
 * Produce a env-variable replacement for a hardcoded URL.
 * e.g. "http://localhost:5000/api/users" → process.env.REACT_APP_API_URL + "/api/users"
 */
function buildReplacement(url) {
  try {
    const parsed  = new URL(url);
    const envVar  = 'REACT_APP_API_URL';
    const suffix  = parsed.pathname + (parsed.search || '') + (parsed.hash || '');
    const suffixStr = suffix && suffix !== '/' ? `" + ${suffix}"` : '"';

    if (suffix && suffix !== '/') {
      return `process.env.${envVar} + "${suffix}"`;
    } else {
      return `process.env.${envVar}`;
    }
  } catch {
    return `process.env.REACT_APP_API_URL`;
  }
}

/**
 * Print a unified-diff-style view for a finding.
 */
function printDiff(finding) {
  const rel   = path.relative(process.cwd(), finding.filePath);
  const { before, target, after } = finding.context;
  const lineNo = finding.line;

  console.log('');
  console.log(chalk.bold.underline(`  File: ${rel}`));
  console.log('');

  const pad = (n) => String(n).padStart(4);

  if (before) {
    console.log(chalk.gray(`${pad(lineNo - 1)}   ${before}`));
  }

  const replacement = buildReplacement(finding.url);

  // --- old line
  console.log(chalk.red(`${pad(lineNo)} - ${target}`));
  // +++ new line: replace the hardcoded URL string with the env expression
  const fixed = target.replace(
    new RegExp(`(['"\`])${escapeRegex(finding.url)}\\1`),
    replacement
  );
  console.log(chalk.green(`${pad(lineNo)} + ${fixed}`));

  if (after) {
    console.log(chalk.gray(`${pad(lineNo + 1)}   ${after}`));
  }

  console.log('');
}

/**
 * Apply the fix to a file in-place.
 * Creates a .bak backup first.
 */
function applyFix(finding) {
  const { filePath, url, line } = finding;

  // Backup
  const bakPath = filePath + '.bak';
  fs.copySync(filePath, bakPath);

  // Read + modify
  const lines   = fs.readFileSync(filePath, 'utf8').split('\n');
  const lineIdx = line - 1; // 0-indexed
  const original = lines[lineIdx];

  const replacement = buildReplacement(url);

  // Replace the first occurrence of the quoted URL on this line
  const fixed = original.replace(
    new RegExp(`(['"\`])${escapeRegex(url)}\\1`),
    replacement
  );

  if (fixed === original) {
    throw new Error(`Could not apply fix: pattern not found on line ${line}`);
  }

  lines[lineIdx] = fixed;
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');

  return { bakPath, original, fixed };
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Print a non-fixable finding with its reason.
 */
function printSkipped(finding) {
  const rel = path.relative(process.cwd(), finding.filePath);
  logger.warn(
    `Skipped ${chalk.underline(rel)}:${finding.line} — ${finding.skipReason}`
  );
  logger.detail(`  URL: ${chalk.gray(finding.url)}`);
}

module.exports = { buildReplacement, printDiff, applyFix, printSkipped };
