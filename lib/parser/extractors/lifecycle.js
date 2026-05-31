/**
 * Lifecycle, function, and component extraction functions for parsing
 * .ts/.js component source files.
 *
 * Extracts:
 * - defineComponent({ tag, template, styles }) metadata
 * - Top-level function declarations
 * - Lifecycle hooks (onMount, onDestroy, onAdopt)
 * - Macro import stripping utility
 * - REACTIVE_CALLS constant for detecting reactive patterns
 */

/** @import { MethodDef, LifecycleHook } from '../../types.js' */

// ── Macro import stripping ───────────────────────────────────────────

/**
 * Remove `import { ... } from 'wcc'` and `import { ... } from '@sprlab/wccompiler'`
 * statements from source content. These imports are purely cosmetic (for IDE DX)
 * and must be stripped before any further processing.
 *
 * @param {string} source - Raw source content
 * @returns {string} Source with macro imports removed
 */
export function stripMacroImport(source) {
  return source.replace(
    /import\s*\{[^}]*\}\s*from\s*['"](?:wcc|@sprlab\/wccompiler)['"]\s*;?/g,
    ''
  );
}

// ── Known macro/reactive call patterns ──────────────────────────────

/**
 * Known macro/reactive call patterns that should NOT be treated as constants.
 */
export const REACTIVE_CALLS = /\b(?:signal|computed|effect|watch|defineProps|defineEmits|defineModel|defineComponent|templateRef|defineExpose|onMount|onDestroy)\s*[<(]/;

// ── defineComponent extraction ──────────────────────────────────────

/**
 * Extract defineComponent({ tag, template, styles }) from source.
 *
 * @param {string} source
 * @returns {{ tag: string, template: string, styles: string | null }}
 */
export function extractDefineComponent(source) {
  const m = source.match(/defineComponent\(\s*\{([^}]*)\}\s*\)/);
  if (!m) return null;

  const body = m[1];

  const tagMatch = body.match(/tag\s*:\s*['"]([^'"]+)['"]/);
  const templateMatch = body.match(/template\s*:\s*['"]([^'"]+)['"]/);
  const stylesMatch = body.match(/styles\s*:\s*['"]([^'"]+)['"]/);

  if (!tagMatch || !templateMatch) return null;

  return {
    tag: tagMatch[1],
    template: templateMatch[1],
    styles: stylesMatch ? stylesMatch[1] : null,
  };
}

// ── Function extraction ─────────────────────────────────────────────

/**
 * Extract top-level function declarations from source.
 * Pattern: [async] function name(params) { body }
 * Uses brace depth tracking to capture the full function body.
 *
 * @param {string} source
 * @returns {MethodDef[]}
 */
export function extractFunctions(source) {
  /** @type {MethodDef[]} */
  const functions = [];
  const lines = source.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^\s*(async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*\{/);
    if (m) {
      const isAsync = !!m[1];
      const name = m[2];
      const params = m[3].trim();
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
          const afterBrace = l.substring(l.indexOf('{') + 1);
          // Single-line function: depth already closed on first line
          if (depth <= 0) {
            const lastBraceIdx = afterBrace.lastIndexOf('}');
            const inner = lastBraceIdx >= 0 ? afterBrace.substring(0, lastBraceIdx) : afterBrace;
            if (inner.trim()) bodyLines.push(inner);
            i = j;
            break;
          }
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

      functions.push({
        name,
        params,
        body: bodyLines.join('\n').trim(),
        async: isAsync,
      });
    }
    i++;
  }

  return functions;
}

// ── Lifecycle hook extraction ────────────────────────────────────────

/**
 * Extract lifecycle hooks from the script.
 * Patterns: onMount(() => { body }) and onDestroy(() => { body })
 * Supports multiple calls of each type.
 * Uses brace depth tracking to capture multi-line bodies.
 * Only extracts top-level calls (brace depth === 0 when the call is encountered).
 *
 * @param {string} script - The script content (after type stripping)
 * @returns {{ onMountHooks: LifecycleHook[], onDestroyHooks: LifecycleHook[], onAdoptHooks: LifecycleHook[] }}
 */
export function extractLifecycleHooks(script) {
  /** @type {LifecycleHook[]} */
  const onMountHooks = [];
  /** @type {LifecycleHook[]} */
  const onDestroyHooks = [];
  /** @type {LifecycleHook[]} */
  const onAdoptHooks = [];
  const lines = script.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const mountMatch = line.match(/\bonMount\s*\(\s*(?:async\s*)?\(\s*\)\s*=>\s*\{/);
    const destroyMatch = line.match(/\bonDestroy\s*\(\s*(?:async\s*)?\(\s*\)\s*=>\s*\{/);
    const adoptMatch = line.match(/\bonAdopt\s*\(\s*(?:async\s*)?\(\s*\)\s*=>\s*\{/);

    if (mountMatch || destroyMatch || adoptMatch) {
      // Detect if the callback is async
      const isAsync = /\basync\s*\(/.test(line);

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
          // If depth already closed on the first line (single-line hook)
          if (depth <= 0) {
            // Extract content between first { and last }
            const lastBraceIdx = l.lastIndexOf('}');
            const inner = l.substring(braceIdx + 1, lastBraceIdx);
            if (inner.trim()) bodyLines.push(inner);
            i = j;
            break;
          }
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

      // Dedent body lines: remove common leading whitespace
      const nonEmptyLines = bodyLines.filter(l => l.trim().length > 0);
      let minIndent = Infinity;
      for (const bl of nonEmptyLines) {
        const leadingSpaces = bl.match(/^(\s*)/)[1].length;
        if (leadingSpaces < minIndent) minIndent = leadingSpaces;
      }
      if (minIndent === Infinity) minIndent = 0;
      const dedentedLines = bodyLines.map(bl => bl.substring(minIndent));
      const body = dedentedLines.join('\n').trim();

      if (mountMatch) {
        onMountHooks.push({ body, async: isAsync });
      } else if (destroyMatch) {
        onDestroyHooks.push({ body, async: isAsync });
      } else {
        onAdoptHooks.push({ body, async: isAsync });
      }
    }
    i++;
  }

  return { onMountHooks, onDestroyHooks, onAdoptHooks };
}
