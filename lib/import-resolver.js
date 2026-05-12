/**
 * Import resolver for .wcc component imports.
 *
 * Extracts and validates `.wcc` import statements from the script block,
 * producing a structured representation of named default imports and
 * side-effect imports. Rejects invalid import forms (namespace, named exports).
 */

// ── Types ────────────────────────────────────────────────────────────

/**
 * @typedef {Object} WccNamedImport
 * @property {string} identifier  — The import name (e.g., 'WccBadge', 'MyButton')
 * @property {string} sourcePath  — Original .wcc path (e.g., './wcc-badge.wcc')
 * @property {string} compiledPath — Rewritten .js path (e.g., './wcc-badge.js')
 */

/**
 * @typedef {Object} WccSideEffectImport
 * @property {string} sourcePath   — Original .wcc path (e.g., './child.wcc')
 * @property {string} compiledPath — Rewritten .js path (e.g., './child.js')
 */

/**
 * @typedef {Object} WccImportResult
 * @property {WccNamedImport[]} named       — Named default imports
 * @property {WccSideEffectImport[]} sideEffect — Side-effect imports
 * @property {string} strippedSource        — Script source with .wcc imports removed
 */

// ── Regex patterns ───────────────────────────────────────────────────

/**
 * Matches any import statement that references a .wcc file.
 * Captures the full import line for removal and classification.
 *
 * Groups:
 *  - Full match: the entire import statement line
 *
 * We use individual patterns below for classification.
 */
const WCC_IMPORT_LINE_RE = /^[ \t]*import\s+.*?['"]([^'"]+\.wcc)['"]\s*;?[ \t]*$/gm;

/**
 * Named default import: import Identifier from './path.wcc'
 */
const NAMED_DEFAULT_RE = /^[ \t]*import\s+([$\w]+)\s+from\s+['"]([^'"]+\.wcc)['"]\s*;?[ \t]*$/;

/**
 * Side-effect import: import './path.wcc'
 */
const SIDE_EFFECT_RE = /^[ \t]*import\s+['"]([^'"]+\.wcc)['"]\s*;?[ \t]*$/;

/**
 * Namespace import: import * as Foo from './path.wcc'
 */
const NAMESPACE_RE = /^[ \t]*import\s+\*\s+as\s+\w+\s+from\s+['"][^'"]+\.wcc['"]\s*;?[ \t]*$/;

/**
 * Named exports import: import { Foo } from './path.wcc'
 * Also matches: import { Foo, Bar } from './path.wcc'
 * Also matches: import { Foo as Bar } from './path.wcc'
 */
const NAMED_EXPORTS_RE = /^[ \t]*import\s+\{[^}]*\}\s+from\s+['"][^'"]+\.wcc['"]\s*;?[ \t]*$/;

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Rewrite a .wcc path to .js by replacing the extension.
 * Preserves all relative path segments.
 *
 * @param {string} wccPath — e.g., '../shared/wcc-button.wcc'
 * @returns {string} — e.g., '../shared/wcc-button.js'
 */
function rewriteExtension(wccPath) {
  return wccPath.replace(/\.wcc$/, '.js');
}

// ── Main export ──────────────────────────────────────────────────────

/**
 * Extract all .wcc imports from a script source string.
 * Validates import forms and rejects invalid patterns.
 *
 * @param {string} source — Script block content
 * @param {string} fileName — Source file name for error messages
 * @returns {WccImportResult}
 * @throws {Error} with code 'INVALID_WCC_IMPORT' for namespace/named exports
 */
export function extractWccImports(source, fileName) {
  /** @type {WccNamedImport[]} */
  const named = [];
  /** @type {WccSideEffectImport[]} */
  const sideEffect = [];

  // Collect all .wcc import lines for processing
  const lines = source.split('\n');
  /** @type {Set<number>} */
  const linesToRemove = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line contains a .wcc import
    if (!line.match(/import\s.*\.wcc['"]/) && !line.match(/import\s+['"][^'"]+\.wcc['"]/)) {
      continue;
    }

    // Check for invalid forms first
    if (NAMESPACE_RE.test(line)) {
      const error = new Error(
        `Invalid import form in '${fileName}': .wcc files only support default imports (import Foo from './foo.wcc') or side-effect imports (import './foo.wcc')`
      );
      /** @ts-expect-error — custom error code for programmatic handling */
      error.code = 'INVALID_WCC_IMPORT';
      throw error;
    }

    if (NAMED_EXPORTS_RE.test(line)) {
      const error = new Error(
        `Invalid import form in '${fileName}': .wcc files only support default imports (import Foo from './foo.wcc') or side-effect imports (import './foo.wcc')`
      );
      /** @ts-expect-error — custom error code for programmatic handling */
      error.code = 'INVALID_WCC_IMPORT';
      throw error;
    }

    // Check for named default import
    const namedMatch = line.match(NAMED_DEFAULT_RE);
    if (namedMatch) {
      const identifier = namedMatch[1];
      const sourcePath = namedMatch[2];
      named.push({
        identifier,
        sourcePath,
        compiledPath: rewriteExtension(sourcePath),
      });
      linesToRemove.add(i);
      continue;
    }

    // Check for side-effect import
    const sideEffectMatch = line.match(SIDE_EFFECT_RE);
    if (sideEffectMatch) {
      const sourcePath = sideEffectMatch[1];
      sideEffect.push({
        sourcePath,
        compiledPath: rewriteExtension(sourcePath),
      });
      linesToRemove.add(i);
      continue;
    }
  }

  // Build stripped source by removing .wcc import lines
  const strippedLines = lines.filter((_, i) => !linesToRemove.has(i));
  const strippedSource = strippedLines.join('\n');

  return { named, sideEffect, strippedSource };
}
