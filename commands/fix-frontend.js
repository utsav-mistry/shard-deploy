'use strict';

const path     = require('path');
const chalk    = require('chalk');
const inquirer = require('inquirer');
const ora      = require('ora');

const logger = require('../utils/logger');
const { scanDirectory } = require('../scanner');
const { printDiff, applyFix, printSkipped } = require('../scanner/fixer');

// ─── Command Handler ─────────────────────────────────────────────────────────

async function fixFrontendCommand(options) {
  logger.banner();

  // ── Always show experimental warning ─────────────────────────────────────
  logger.experimentalWarning();

  const cwd = options.dir ? path.resolve(options.dir) : process.cwd();
  logger.info(`Target directory: ${chalk.cyan(cwd)}`);
  logger.blank();

  // ── 1. Scan ───────────────────────────────────────────────────────────────
  const spinner = ora({ text: 'Scanning source files…', color: 'yellow' }).start();

  let scanResult;
  try {
    scanResult = scanDirectory(cwd);
  } catch (err) {
    spinner.fail('Scan failed');
    logger.error(`Scanner error: ${err.message}`);
    process.exit(1);
  }

  spinner.succeed(`Scanned ${chalk.bold(scanResult.files)} source files`);
  logger.blank();

  // ── 2. Collect findings ───────────────────────────────────────────────────
  const allFindings = [];
  const parseErrors = [];

  for (const result of scanResult.results) {
    if (result.error) {
      parseErrors.push(result);
    } else {
      allFindings.push(...result.findings);
    }
  }

  if (parseErrors.length > 0) {
    logger.warn(`${parseErrors.length} file(s) could not be parsed:`);
    for (const e of parseErrors) {
      logger.detail(`  ${path.relative(cwd, e.filePath)}: ${e.error}`);
    }
    logger.blank();
  }

  const fixable = allFindings.filter((f) => f.fixable);
  const skipped = allFindings.filter((f) => !f.fixable);

  if (allFindings.length === 0) {
    logger.success('No hardcoded localhost API URLs found. Nothing to fix! 🎉');
    logger.blank();
    return;
  }

  // ── 3. Show skipped first ─────────────────────────────────────────────────
  if (skipped.length > 0) {
    logger.step(`${chalk.bold.yellow(skipped.length)} finding(s) skipped (cannot auto-fix):`);
    logger.blank();
    for (const f of skipped) {
      printSkipped(f);
    }
    logger.blank();
    logger.divider();
  }

  if (fixable.length === 0) {
    logger.info('No automatically fixable findings. Review the skipped items manually.');
    logger.blank();
    return;
  }

  // ── 4. Check apply-all shortcut ───────────────────────────────────────────
  logger.step(`${chalk.bold.green(fixable.length)} fixable finding(s) found`);
  logger.blank();

  let applyAll = options.yes || false;

  if (!options.yes && fixable.length > 1) {
    const { bulk } = await inquirer.prompt([
      {
        type:    'confirm',
        name:    'bulk',
        message: `Apply all ${fixable.length} fixes at once?`,
        default: false,
      },
    ]);
    applyAll = bulk;
  }

  // ── 5. Process each finding ───────────────────────────────────────────────
  let applied = 0;
  let userSkipped = 0;

  for (let i = 0; i < fixable.length; i++) {
    const finding = fixable[i];

    logger.blank();
    logger.info(
      `Finding ${i + 1} of ${fixable.length}  ·  ` +
      `${finding.library === 'axios' ? chalk.blue('axios') : chalk.magenta('fetch')}  ·  ` +
      `line ${chalk.bold(finding.line)}`
    );

    // Show diff
    printDiff(finding);

    if (applyAll) {
      await doApply(finding, cwd);
      applied++;
      continue;
    }

    // Per-finding prompt
    const rel = path.relative(cwd, finding.filePath);

    const { action } = await inquirer.prompt([
      {
        type:    'list',
        name:    'action',
        message: `Apply fix to ${chalk.underline(rel)}:${finding.line}?`,
        choices: [
          { name: chalk.green('Yes — apply this fix'),     value: 'yes' },
          { name: chalk.yellow('Skip — leave unchanged'), value: 'skip' },
          { name: chalk.cyan('Apply all remaining fixes'), value: 'all' },
        ],
      },
    ]);

    if (action === 'all') {
      applyAll = true;
      await doApply(finding, cwd);
      applied++;
    } else if (action === 'yes') {
      await doApply(finding, cwd);
      applied++;
    } else {
      logger.warn(`Skipped ${path.relative(cwd, finding.filePath)}:${finding.line}`);
      userSkipped++;
    }
  }

  // ── 6. Summary ────────────────────────────────────────────────────────────
  logger.blank();
  logger.divider();
  logger.success(`Applied ${chalk.bold(applied)} fix(es)`);
  if (userSkipped > 0) logger.info(`Skipped ${userSkipped} finding(s) by user choice`);
  if (skipped.length > 0) logger.warn(`${skipped.length} finding(s) were not auto-fixable — review manually`);

  if (applied > 0) {
    logger.blank();
    logger.info('Backup files (.bak) created alongside modified files.');
    logger.info(`Set ${chalk.cyan('REACT_APP_API_URL')} in your .env before running the app.`);
  }
  logger.blank();
}

// ─── Apply helper with error handling ───────────────────────────────────────

async function doApply(finding, cwd) {
  try {
    const { bakPath } = applyFix(finding);
    const rel = path.relative(cwd, finding.filePath);
    logger.success(`Fixed ${chalk.underline(rel)}:${finding.line}`);
    logger.detail(`  Backup saved at ${path.relative(cwd, bakPath)}`);
  } catch (err) {
    logger.error(`Failed to fix ${path.relative(cwd, finding.filePath)}:${finding.line} — ${err.message}`);
    logger.info('This finding was NOT modified. Review it manually.');
  }
}

module.exports = { fixFrontendCommand };
