'use strict';

const fs   = require('fs-extra');
const path = require('path');

// ─── Babel dynamic-require helper ──────────────────────────────────────────
//  @babel/traverse ships as both CJS and ESM-compat. We need the CJS default.
function requireBabel() {
  const parser   = require('@babel/parser');
  const traverseModule = require('@babel/traverse');
  // CommonJS interop: the default export may be nested under `.default`
  const traverse = traverseModule.default || traverseModule;
  return { parser, traverse };
}

// ─── Patterns we detect ─────────────────────────────────────────────────────
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'request'];

/**
 * Read a source file and return its lines (1-indexed via [0] = undefined trick).
 */
function readLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return ['', ...content.split('\n')]; // index 1 = line 1
}

/**
 * Determine if a node's argument is a plain hardcoded string
 * (i.e. not a template literal, not an identifier, not a binary expression).
 */
function isPlainStringLiteral(node) {
  return node && node.type === 'StringLiteral';
}

/**
 * Extract the string value of a node if it is a plain literal.
 */
function extractStringValue(node) {
  if (isPlainStringLiteral(node)) return node.value;
  return null;
}

/**
 * Check if the URL looks like an absolute localhost/IP URL we should fix.
 */
function isHardcodedLocalUrl(url) {
  return (
    url.startsWith('http://localhost') ||
    url.startsWith('http://127.0.0.1') ||
    url.startsWith('http://0.0.0.0')   ||
    // Intentionally leave https:// localhost combos — less common but still flag
    url.startsWith('https://localhost')
  );
}

/**
 * Build a context-rich finding object from an AST node.
 */
function buildFinding({ filePath, lines, node, url, library }) {
  const line   = node.loc.start.line;
  const before = lines[line - 1] || '';
  const target = lines[line]     || '';
  const after  = lines[line + 1] || '';

  return {
    filePath,
    line,
    url,
    library,
    context: { before, target, after },
    // Will be populated in the fix phase
    fixable: true,
    skipReason: null,
  };
}

/**
 * Mark a finding as non-fixable with a clear reason.
 */
function markNotFixable(finding, reason) {
  finding.fixable = false;
  finding.skipReason = reason;
  return finding;
}

/**
 * Parse a single JS/JSX/TS file and return all findings.
 */
function parseFile(filePath) {
  const { parser, traverse } = requireBabel();
  const source = fs.readFileSync(filePath, 'utf8');
  const lines  = readLines(filePath);
  const findings = [];

  let ast;
  try {
    ast = parser.parse(source, {
      sourceType:  'unambiguous',
      plugins: [
        'jsx',
        'typescript',
        'classProperties',
        'decorators-legacy',
        'optionalChaining',
        'nullishCoalescingOperator',
      ],
    });
  } catch (err) {
    return { filePath, error: err.message, findings: [] };
  }

  traverse(ast, {
    // ── axios.get("http://...") ─────────────────────────────────────────────
    CallExpression(nodePath) {
      const { node } = nodePath;

      // ----- axios.<method>(url) -----
      if (
        node.callee.type === 'MemberExpression' &&
        node.callee.object.type === 'Identifier' &&
        node.callee.object.name === 'axios' &&
        HTTP_METHODS.includes(node.callee.property.name)
      ) {
        const arg = node.arguments[0];
        if (!arg) return;

        const finding = buildFinding({ filePath, lines, node, url: null, library: 'axios' });

        if (!isPlainStringLiteral(arg)) {
          finding.url = '<dynamic>';
          markNotFixable(finding, getDynamicReason(arg));
          findings.push(finding);
          return;
        }

        const url = extractStringValue(arg);
        finding.url = url;

        if (!isHardcodedLocalUrl(url)) return; // not our concern

        checkMultiline(node, finding);
        findings.push(finding);
        return;
      }

      // ----- axios({ url: "http://..." }) -----
      if (
        node.callee.type === 'Identifier' &&
        node.callee.name === 'axios' &&
        node.arguments[0]?.type === 'ObjectExpression'
      ) {
        const urlProp = node.arguments[0].properties.find(
          (p) => p.key && (p.key.name === 'url' || p.key.value === 'url')
        );
        if (!urlProp) return;

        const finding = buildFinding({ filePath, lines, node, url: null, library: 'axios' });

        if (!isPlainStringLiteral(urlProp.value)) {
          finding.url = '<dynamic>';
          markNotFixable(finding, getDynamicReason(urlProp.value));
          findings.push(finding);
          return;
        }

        const url = extractStringValue(urlProp.value);
        finding.url = url;
        if (!isHardcodedLocalUrl(url)) return;

        checkMultiline(node, finding);
        findings.push(finding);
        return;
      }

      // ----- fetch("http://...") -----
      if (
        node.callee.type === 'Identifier' &&
        node.callee.name === 'fetch'
      ) {
        const arg = node.arguments[0];
        if (!arg) return;

        const finding = buildFinding({ filePath, lines, node, url: null, library: 'fetch' });

        if (!isPlainStringLiteral(arg)) {
          finding.url = '<dynamic>';
          markNotFixable(finding, getDynamicReason(arg));
          findings.push(finding);
          return;
        }

        const url = extractStringValue(arg);
        finding.url = url;
        if (!isHardcodedLocalUrl(url)) return;

        checkMultiline(node, finding);
        findings.push(finding);
      }
    },
  });

  return { filePath, findings, error: null };
}

/**
 * Check if the call spans multiple lines and mark as not fixable if so.
 */
function checkMultiline(node, finding) {
  if (node.loc.start.line !== node.loc.end.line) {
    markNotFixable(finding, 'Multi-line call expression — cannot safely auto-fix');
  }
}

/**
 * Return a human-readable reason for why a dynamic expression is skipped.
 */
function getDynamicReason(node) {
  if (!node) return 'Null argument';
  switch (node.type) {
    case 'TemplateLiteral':      return 'Template literal — may already use env variables';
    case 'Identifier':           return `Dynamic variable: ${node.name}`;
    case 'BinaryExpression':     return 'String concatenation expression — complex, skip to avoid partial fix';
    case 'ConditionalExpression':return 'Ternary expression — cannot determine intent';
    case 'CallExpression':       return 'Result of a function call — cannot determine value statically';
    default:                     return `Dynamic expression (${node.type}) — not safe to auto-fix`;
  }
}

/**
 * Collect all JS/JSX/TS/TSX source files in a directory, skipping node_modules etc.
 */
function collectSourceFiles(dir) {
  const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'out']);
  const EXT       = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
  const found     = [];

  function walk(current) {
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (EXT.has(path.extname(entry.name))) {
        found.push(full);
      }
    }
  }

  walk(dir);
  return found;
}

/**
 * Scan an entire directory and return all findings across all files.
 */
function scanDirectory(dir) {
  const files   = collectSourceFiles(dir);
  const results = [];

  for (const file of files) {
    const result = parseFile(file);
    if (result.findings.length > 0 || result.error) {
      results.push(result);
    }
  }

  return { files: files.length, results };
}

module.exports = { scanDirectory, parseFile, collectSourceFiles };
