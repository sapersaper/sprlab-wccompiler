/**
 * Ref, expose, model, and batch extraction functions for parsing .ts/.js
 * component source files.
 *
 * Extracts:
 * - Template refs (templateRef())
 * - defineExpose() declarations
 * - defineModel() declarations
 * - batch() usage detection
 */

/** @import { RefDeclaration } from '../../types.js' */

// ── Ref extraction ───────────────────────────────────────────────────

/**
 * Extract templateRef('name') declarations from component source.
 * Pattern: const/let/var varName = templateRef('refName') or templateRef("refName")
 *
 * @param {string} source — Stripped source code
 * @returns {RefDeclaration[]}
 */
export function extractRefs(source) {
  /** @type {RefDeclaration[]} */
  const refs = [];
  const re = /(?:const|let|var)\s+([$\w]+)\s*=\s*templateRef\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    refs.push({ varName: m[1], refName: m[2] });
  }
  return refs;
}

// ── defineModel extraction ───────────────────────────────────────────

/**
 * Extract defineModel() declarations from source.
 * Pattern: const/let/var varName = defineModel({ name: 'propName', default: value })
 *          const/let/var varName = defineModel({ name: 'propName', required: true })
 *
 * @param {string} source
 * @returns {{ varName: string, name: string, default: string, required: boolean }[]}
 */
export function extractModels(source) {
  /** @type {{ varName: string, name: string, default: string, required: boolean }[]} */
  const models = [];
  const re = /(?:const|let|var)\s+(\w+)\s*=\s*defineModel\(\s*\{/g;
  let m;

  while ((m = re.exec(source)) !== null) {
    const varName = m[1];
    const objStart = m.index + m[0].length - 1; // position of '{'

    // Use depth counting to extract the full object literal
    let depth = 0;
    let i = objStart;
    /** @type {string | null} */
    let inString = null;

    for (; i < source.length; i++) {
      const ch = source[i];

      if (inString) {
        if (ch === '\\') { i++; continue; }
        if (ch === inString) inString = null;
        continue;
      }

      if (ch === '"' || ch === "'" || ch === '`') {
        inString = ch;
        continue;
      }

      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) { i++; break; }
      }
    }

    const objLiteral = source.slice(objStart, i).trim();
    // Remove outer braces
    const inner = objLiteral.slice(1, -1).trim();

    // Extract 'name' property
    const nameMatch = inner.match(/name\s*:\s*['"]([^'"]+)['"]/);
    const propName = nameMatch ? nameMatch[1] : '';

    // Extract 'default' property using depth counting
    let defaultValue = 'undefined';
    const defaultIdx = inner.search(/\bdefault\s*:\s*/);
    if (defaultIdx !== -1) {
      const afterDefault = inner.slice(defaultIdx);
      const colonMatch = afterDefault.match(/^default\s*:\s*/);
      if (colonMatch) {
        const valStart = defaultIdx + colonMatch[0].length;
        let valDepth = 0;
        let pos = valStart;
        /** @type {string | null} */
        let valInString = null;

        for (; pos < inner.length; pos++) {
          const ch = inner[pos];

          if (valInString) {
            if (ch === '\\') { pos++; continue; }
            if (ch === valInString) valInString = null;
            continue;
          }

          if (ch === '"' || ch === "'" || ch === '`') {
            valInString = ch;
            continue;
          }

          if (ch === '(' || ch === '[' || ch === '{') valDepth++;
          if (ch === ')' || ch === ']' || ch === '}') valDepth--;

          if (valDepth === 0 && ch === ',') {
            break;
          }
        }

        defaultValue = inner.slice(valStart, pos).trim();
      }
    }

    // Extract 'required' property
    const requiredMatch = inner.match(/required\s*:\s*true/);
    const required = !!requiredMatch;

    models.push({ varName, name: propName, default: defaultValue, required });
  }

  return models;
}

// ── defineExpose extraction ─────────────────────────────────────────

/**
 * Extract property names from defineExpose({ key1, key2, ... }).
 * Supports shorthand properties: defineExpose({ doubled, handleUpdate })
 *
 * @param {string} source — Source code (after type stripping)
 * @returns {string[]} Array of exposed property names
 */
export function extractExpose(source) {
  const m = source.match(/defineExpose\(\s*\{([^}]*)\}\s*\)/);
  if (!m) return [];

  const body = m[1];
  const names = [];
  const re = /\b(\w+)\b/g;
  let match;
  while ((match = re.exec(body)) !== null) {
    names.push(match[1]);
  }
  return names;
}

/**
 * Detect if the source code uses the batch() function.
 *
 * @param {string} source - The script source code
 * @returns {boolean} True if batch() is used
 */
export function detectBatchUsage(source) {
  // Look for batch( pattern (function call)
  // This will match: batch(() => {...}), batch(function() {...}), etc.
  return /\bbatch\s*\(/.test(source);
}
