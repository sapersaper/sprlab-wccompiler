/**
 * Reactive declaration extraction functions for parsing .ts/.js component source files.
 *
 * Extracts:
 * - signal() declarations
 * - computed() declarations
 * - effect() declarations
 * - watch() declarations
 * - Constant declarations
 */

/** @import { ReactiveVar, ComputedDef, EffectDef } from '../../types.js' */

import { REACTIVE_CALLS } from './lifecycle.js';

// ── Signal extraction ───────────────────────────────────────────────

/**
 * Extract the argument of a `signal(...)` call starting at a given position.
 * Uses parenthesis depth counting to correctly handle nested parentheses,
 * e.g. `signal([1, 2, 3])` or `signal((a + b) * c)`.
 * Also handles string literals so that parentheses inside strings are not counted.
 *
 * @param {string} source - Source code starting from after `signal(`
 * @param {number} startIdx - Index right after `signal(`
 * @returns {string} The trimmed argument string, or 'undefined' if empty
 */
export function extractSignalArgument(source, startIdx) {
  let depth = 0;
  let i = startIdx;
  /** @type {string | null} */
  let inString = null;

  for (; i < source.length; i++) {
    const ch = source[i];

    // Handle string literal boundaries
    if (inString) {
      if (ch === '\\') {
        i++; // skip escaped character
        continue;
      }
      if (ch === inString) {
        inString = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }

    if (ch === '(') depth++;
    if (ch === ')') {
      if (depth === 0) break;
      depth--;
    }
  }

  return source.slice(startIdx, i).trim() || 'undefined';
}

/**
 * Extract signal declarations from source.
 * Pattern: const/let/var name = signal(value)
 *
 * @param {string} source
 * @returns {ReactiveVar[]}
 */
export function extractSignals(source) {
  /** @type {ReactiveVar[]} */
  const signals = [];
  const re = /(?:const|let|var)\s+([$\w]+)\s*=\s*signal\(/g;
  let m;

  while ((m = re.exec(source)) !== null) {
    const name = m[1];
    const argStart = m.index + m[0].length;
    const value = extractSignalArgument(source, argStart);
    signals.push({ name, value });
  }

  return signals;
}

// ── Computed extraction ─────────────────────────────────────────────

/**
 * Extract computed declarations from source.
 * Pattern: const/let/var name = computed(() => expr)
 * Uses parenthesis depth counting to handle expressions containing parens,
 * e.g. `computed(() => count() * 2)`.
 *
 * @param {string} source
 * @returns {ComputedDef[]}
 */
export function extractComputeds(source) {
  /** @type {ComputedDef[]} */
  const out = [];
  const re = /(?:const|let|var)\s+(\w+)\s*=\s*computed\(\s*\(\)\s*=>\s*/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const name = m[1];
    const bodyStart = m.index + m[0].length;
    // Use depth counting: we're inside `computed(` so depth starts at 1
    // We need to find the matching `)` for the outer `computed(` call
    let depth = 1;
    let i = bodyStart;
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

      if (ch === '(') depth++;
      if (ch === ')') {
        depth--;
        if (depth === 0) break;
      }
    }

    const body = source.slice(bodyStart, i).trim();
    if (body) {
      out.push({ name, body });
    }
  }
  return out;
}

// ── Effect extraction ───────────────────────────────────────────────

/**
 * Extract effect declarations from source.
 * Pattern: effect(() => { body })
 * Uses brace depth tracking to capture multi-line bodies.
 *
 * @param {string} source
 * @returns {EffectDef[]}
 */
export function extractEffects(source) {
  /** @type {EffectDef[]} */
  const effects = [];
  const lines = source.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const effectMatch = line.match(/\beffect\s*\(\s*\(\s*\)\s*=>\s*\{/);

    if (effectMatch) {
      // Collect body by tracking brace depth
      let depth = 0;
      let bodyLines = [];
      let started = false;

      for (let j = i; j < lines.length; j++) {
        const l = lines[j];
        for (const ch of l) {
          if (ch === '{') {
            if (started) depth++;
            else { depth = 1; started = true; }
          }
          if (ch === '}') depth--;
        }

        if (j === i) {
          // First line: capture everything after the opening brace
          const braceIdx = l.indexOf('{');
          const afterBrace = l.substring(braceIdx + 1);
          if (afterBrace.trim()) bodyLines.push(afterBrace);
        } else if (depth <= 0) {
          // Last line: capture everything before the closing brace
          const lastBraceIdx = l.lastIndexOf('}');
          const before = l.substring(0, lastBraceIdx);
          if (before.trim()) bodyLines.push(before);
          i = j;
          break;
        } else {
          bodyLines.push(l);
        }
      }

      // Dedent body lines
      const nonEmptyLines = bodyLines.filter(l => l.trim().length > 0);
      let minIndent = Infinity;
      for (const bl of nonEmptyLines) {
        const leadingSpaces = bl.match(/^(\s*)/)[1].length;
        if (leadingSpaces < minIndent) minIndent = leadingSpaces;
      }
      if (minIndent === Infinity) minIndent = 0;
      const dedentedLines = bodyLines.map(bl => bl.substring(minIndent));
      const body = dedentedLines.join('\n').trim();

      effects.push({ body });
    }
    i++;
  }

  return effects;
}

// ── Watcher extraction ──────────────────────────────────────────────

/**
 * Extract watch() declarations from source.
 * Supports two forms:
 *   Form 1 — Signal direct: watch(count, (newVal, oldVal) => { body })
 *   Form 2 — Getter function: watch(() => expr, (newVal, oldVal) => { body })
 * Uses brace depth tracking to capture multi-line bodies.
 *
 * @param {string} source
 * @returns {import('../../types.js').WatcherDef[]}
 */
export function extractWatchers(source) {
  /** @type {import('../../types.js').WatcherDef[]} */
  const watchers = [];
  const lines = source.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Form 2 — Getter function: watch(() => expr, (newVal, oldVal) => {  OR  watch(() => expr, (newVal) => { OR watch(() => expr, () => {
    const mGetter = line.match(/\bwatch\s*\(\s*\(\)\s*=>\s*(.+?)\s*,\s*\((\w*)(?:\s*,\s*(\w+))?\)\s*=>\s*\{/);
    // Form 1 — Signal direct: watch(identifier, (newVal, oldVal) => {  OR  watch(identifier, (newVal) => { OR watch(identifier, () => {
    const mSignal = !mGetter ? line.match(/\bwatch\s*\(\s*(\w+)\s*,\s*\((\w*)(?:\s*,\s*(\w+))?\)\s*=>\s*\{/) : null;

    const m = mGetter || mSignal;

    if (m) {
      const kind = mGetter ? 'getter' : 'signal';
      const target = m[1];
      const newParam = m[2] || 'newVal';  // default when callback has no params
      const oldParam = m[3];

      // Collect body by tracking brace depth
      let depth = 0;
      let bodyLines = [];
      let started = false;

      for (let j = i; j < lines.length; j++) {
        const l = lines[j];
        for (const ch of l) {
          if (ch === '{') {
            if (started) depth++;
            else { depth = 1; started = true; }
          }
          if (ch === '}') depth--;
        }

        if (j === i) {
          const braceIdx = l.indexOf('{');
          const afterBrace = l.substring(braceIdx + 1);
          if (depth <= 0) {
            const lastBraceIdx = l.lastIndexOf('}');
            const inner = l.substring(braceIdx + 1, lastBraceIdx);
            if (inner.trim()) bodyLines.push(inner);
            i = j;
            break;
          }
          if (afterBrace.trim()) bodyLines.push(afterBrace);
        } else if (depth <= 0) {
          const lastBraceIdx = l.lastIndexOf('}');
          const before = l.substring(0, lastBraceIdx);
          if (before.trim()) bodyLines.push(before);
          i = j;
          break;
        } else {
          bodyLines.push(l);
        }
      }

      // Dedent
      const nonEmpty = bodyLines.filter(l => l.trim().length > 0);
      let minIndent = Infinity;
      for (const bl of nonEmpty) {
        const leading = bl.match(/^(\s*)/)[1].length;
        if (leading < minIndent) minIndent = leading;
      }
      if (minIndent === Infinity) minIndent = 0;
      const body = bodyLines.map(bl => bl.substring(minIndent)).join('\n').trim();

      watchers.push({ kind, target, newParam, oldParam, body });
    }
    i++;
  }

  return watchers;
}

// ── Constant extraction ─────────────────────────────────────────────

/**
 * Extract plain const/let/var declarations that are NOT reactive calls.
 * Only extracts root-level declarations (depth 0).
 *
 * @param {string} source
 * @returns {import('../../types.js').ConstantVar[]}
 */
export function extractConstants(source) {
  /** @type {import('../../types.js').ConstantVar[]} */
  const constants = [];
  let depth = 0;
  let pendingConst = null; // Track multi-line constant being collected
  let pendingValue = '';
  let pendingDepth = 0;

  for (const line of source.split('\n')) {
    // If we're collecting a multi-line constant value
    if (pendingConst) {
      pendingValue += '\n' + line;
      for (const ch of line) {
        if (ch === '{' || ch === '[') pendingDepth++;
        if (ch === '}' || ch === ']') pendingDepth--;
      }
      if (pendingDepth <= 0) {
        // Multi-line constant is complete
        constants.push({ name: pendingConst, value: pendingValue.trim().replace(/;$/, '') });
        pendingConst = null;
        pendingValue = '';
      }
      // Update overall depth tracking
      for (const ch of line) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
      }
      continue;
    }

    // Track brace depth to skip nested blocks (functions, etc.)
    const prevDepth = depth;
    for (const ch of line) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
    }

    // Only process declarations at root level (depth was 0 before this line)
    if (prevDepth > 0) continue;

    // Detect multi-line constant declarations: const name = { or const name = [
    const multiLineMatch = line.match(/^\s*(?:const|let|var)\s+([$\w]+)\s*=\s*([{\[])(.*)$/);
    if (multiLineMatch) {
      const name = multiLineMatch[1];
      const opener = multiLineMatch[2];
      const rest = multiLineMatch[3];
      // Check if it closes on the same line
      let localDepth = 1;
      for (const ch of rest) {
        if (ch === '{' || ch === '[') localDepth++;
        if (ch === '}' || ch === ']') localDepth--;
      }
      if (localDepth <= 0) {
        // Single-line object/array: treat as normal constant
        const value = (opener + rest).trim().replace(/;$/, '');
        if (!REACTIVE_CALLS.test(value) && !/^\s*export\s+default/.test(line)) {
          constants.push({ name, value });
        }
      } else {
        // Multi-line: start collecting
        if (!REACTIVE_CALLS.test(opener) && !/^\s*export\s+default/.test(line)) {
          pendingConst = name;
          pendingValue = opener + rest;
          pendingDepth = localDepth;
        }
      }
      continue;
    }

    // Skip if we're inside a block after processing
    if (depth > 0) continue;

    // Match const/let/var name = value at root level (single line)
    const m = line.match(/^\s*(?:const|let|var)\s+([$\w]+)\s*=\s*(.+?);?\s*$/);
    if (!m) continue;

    const value = m[2].trim();
    // Skip reactive/macro calls
    if (REACTIVE_CALLS.test(value)) continue;
    // Skip export default
    if (/^\s*export\s+default/.test(line)) continue;

    constants.push({ name: m[1], value });
  }

  return constants;
}
