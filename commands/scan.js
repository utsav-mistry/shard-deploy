'use strict';

const path  = require('path');
const chalk = require('chalk');
const ora   = require('ora');

const logger = require('../utils/logger');
const { scanDirectory } = require('../scanner');
const { printSkipped }  = require('../scanner/fixer');

// ─── Command Handler ─────────────────────────────────────────────────────────

async function scanCommand(options) {
  logger.banner();

  const cwd = options.dir ? path.resolve(options.dir) : process.cwd();

  logger.info(`Scanning: ${chalk.cyan(cwd)}`);
  logger.blank();

  // ── 1. Run scan ───────────────────────────────────────────────────────────
  const spinner = ora({ text: 'Scanning source files for hardcoded API URLs…', color: 'cyan' }).start();

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

  // ── 2. Aggregate results ──────────────────────────────────────────────────
  const allFindings   = [];
  const parseErrors   = [];

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

  // ── 3. Display results ────────────────────────────────────────────────────
  const fixable   = allFindings.filter((f) => f.fixable);
  const skipped   = allFindings.filter((f) => !f.fixable);

  if (allFindings.length === 0) {
    logger.success('No hardcoded localhost API URLs found. Your code looks clean! 🎉');
    logger.blank();
    return;
  }

  // Print fixable findings
  if (fixable.length > 0) {
    logger.step(`Found ${chalk.bold.red(fixable.length)} hardcoded URL(s) that can be fixed:`);
    logger.blank();

    for (const finding of fixable) {
      const rel = path.relative(cwd, finding.filePath);
      console.log(
        chalk.bold(`  ${finding.library === 'axios' ? chalk.blue('[axios]') : chalk.magenta('[fetch]')} `) +
        chalk.underline(rel) +
        chalk.gray(`:${finding.line}`)
      );
      logger.detail(`  URL: ${chalk.yellow(finding.url)}`);
      logger.blank();
    }
  }

  // Print skipped findings
  if (skipped.length > 0) {
    logger.step(`${chalk.bold.yellow(skipped.length)} finding(s) skipped (cannot auto-fix):`);
    logger.blank();
    for (const f of skipped) {
      printSkipped(f);
    }
    logger.blank();
  }

  // ── 4. Summary ────────────────────────────────────────────────────────────
  logger.divider();
  logger.info(`Total findings: ${chalk.bold(allFindings.length)}  |  Fixable: ${chalk.green(fixable.length)}  |  Skipped: ${chalk.yellow(skipped.length)}`);
  logger.blank();

  if (fixable.length > 0) {
    logger.info(`Run ${chalk.cyan('shard-deploy fix-frontend')} to review diffs and interactively apply fixes.`);
  }
  logger.blank();
}

module.exports = { scanCommand };
