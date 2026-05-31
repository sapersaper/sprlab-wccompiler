/**
 * Pure extraction functions for parsing .ts/.js component source files.
 *
 * These functions have NO Node.js-specific imports (no fs, path, or esbuild)
 * and can be used in both Node.js and browser environments.
 *
 * Extracts:
 * - defineComponent({ tag, template, styles }) metadata
 * - signal() declarations
 * - computed() declarations
 * - effect() declarations
 * - Top-level function declarations
 * - Props and emits definitions
 * - Lifecycle hooks
 * - Template refs
 * - Constants
 */

/** @import { ReactiveVar, ComputedDef, EffectDef, MethodDef, PropDef, LifecycleHook, RefDeclaration } from '../types.js' */

export { camelToKebab, escapeRegex } from '../utils.js';

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

// ── Name conversion ─────────────────────────────────────────────────

/**
 * Convert a kebab-case tag name to PascalCase class name.
 * e.g. "wcc-counter" → "WccCounter"
 *
 * @param {string} tagName
 * @returns {string}
 */
export function toClassName(tagName) {
  return tagName
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

// ── camelCase to kebab-case ─────────────────────────────────────────


// ── Props extraction (generic form — BEFORE type strip) ─────────────

/**
 * Extract prop names from the TypeScript generic form:
 * defineProps<{ label: string, count: number }>({...})
 * or defineProps<{ label: string }>()
 *
 * Must be called BEFORE stripTypes() since esbuild removes generics.
 *
 * @param {string} source
 * @returns {string[]}
 */
export function extractPropsGeneric(source) {
  const m = source.match(/defineProps\s*<\s*\{([^}]*)\}\s*>/);
  if (!m) return [];

  const body = m[1];
  const props = [];
  const re = /(\w+)\s*[?]?\s*:/g;
  let match;
  while ((match = re.exec(body)) !== null) {
    props.push(match[1]);
  }
  return props;
}

// ── Props extraction (array form — AFTER type strip) ────────────────

/**
 * Extract prop names from the array form:
 * defineProps(['label', 'count'])
 *
 * Called AFTER type stripping.
 *
 * @param {string} source
 * @returns {string[]}
 */
export function extractPropsArray(source) {
  const m = source.match(/defineProps\(\s*\[([^\]]*)\]\s*\)/);
  if (!m) return [];

  const body = m[1];
  const props = [];
  const re = /['"]([^'"]+)['"]/g;
  let match;
  while ((match = re.exec(body)) !== null) {
    props.push(match[1]);
  }
  return props;
}

// ── Props defaults extraction (AFTER type strip) ────────────────────

/**
 * Extract default values from the defineProps argument object.
 * After type stripping, the generic form becomes defineProps({...}).
 * The array form is defineProps([...]) — no defaults.
 *
 * Uses parenthesis depth counting to handle nested objects/arrays.
 *
 * @param {string} source
 * @returns {Record<string, string>}
 */
export function extractPropsDefaults(source) {
  const idx = source.indexOf('defineProps(');
  if (idx === -1) return {};

  const start = idx + 'defineProps('.length;
  // Check what the argument starts with (skip whitespace)
  let argStart = start;
  while (argStart < source.length && /\s/.test(source[argStart])) argStart++;

  // If it starts with '[', it's the array form — no defaults
  if (source[argStart] === '[') return {};

  // If it doesn't start with '{', no defaults (e.g., empty call)
  if (source[argStart] !== '{') return {};

  // Use depth counting to extract the full object literal
  let depth = 0;
  let i = argStart;
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

  const objLiteral = source.slice(argStart, i).trim();
  // Remove outer braces
  const inner = objLiteral.slice(1, -1).trim();
  if (!inner) return {};

  // Parse key: value pairs using depth counting
  /** @type {Record<string, string>} */
  const defaults = {};
  let pos = 0;
  while (pos < inner.length) {
    // Skip whitespace
    while (pos < inner.length && /\s/.test(inner[pos])) pos++;
    if (pos >= inner.length) break;

    // Extract key
    const keyMatch = inner.slice(pos).match(/^(\w+)\s*:\s*/);
    if (!keyMatch) break;
    const key = keyMatch[1];
    pos += keyMatch[0].length;

    // Extract value using depth counting
    let valDepth = 0;
    let valStart = pos;
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

    const value = inner.slice(valStart, pos).trim();
    defaults[key] = value;

    // Skip comma
    if (pos < inner.length && inner[pos] === ',') pos++;
  }

  return defaults;
}

// ── Props object name extraction ────────────────────────────────────

/**
 * Extract the variable name from a props object binding.
 * Pattern: const/let/var <identifier> = defineProps<...>(...) or defineProps(...)
 *
 * @param {string} source
 * @returns {string | null}
 */
export function extractPropsObjectName(source) {
  const m = source.match(/(?:const|let|var)\s+([$\w]+)\s*=\s*defineProps\s*[<(]/);
  return m ? m[1] : null;
}

// ── Emits extraction (call signatures form — BEFORE type strip) ─────

/**
 * Extract event names from the TypeScript call signatures form:
 * defineEmits<{ (e: 'change', value: number): void; (e: 'reset'): void }>()
 *
 * Must be called BEFORE stripTypes() since esbuild removes generics.
 *
 * @param {string} source
 * @returns {string[]}
 */
export function extractEmitsFromCallSignatures(source) {
  const m = source.match(/defineEmits\s*<\s*\{([\s\S]*?)\}\s*>\s*\(\s*\)/);
  if (!m) return [];

  const body = m[1];
  const emits = [];
  const re = /\(\s*\w+\s*:\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = re.exec(body)) !== null) {
    emits.push(match[1]);
  }
  return emits;
}

// ── Emits extraction (array form — AFTER type strip) ────────────────

/**
 * Extract event names from the array form:
 * defineEmits(['change', 'reset'])
 *
 * Called AFTER type stripping.
 *
 * @param {string} source
 * @returns {string[]}
 */
export function extractEmits(source) {
  const m = source.match(/defineEmits\(\[([^\]]*)\]\)/);
  if (!m) return [];

  const body = m[1];
  const emits = [];
  const re = /['"]([^'"]+)['"]/g;
  let match;
  while ((match = re.exec(body)) !== null) {
    emits.push(match[1]);
  }
  return emits;
}

// ── Emits object name extraction ────────────────────────────────────

/**
 * Extract the variable name from an emits object binding (AFTER type strip).
 * Pattern: const/let/var <identifier> = defineEmits(...)
 *
 * @param {string} source
 * @returns {string | null}
 */
export function extractEmitsObjectName(source) {
  const m = source.match(/(?:const|let|var)\s+([$\w]+)\s*=\s*defineEmits\s*\(/);
  return m ? m[1] : null;
}

/**
 * Extract the variable name from an emits object binding (BEFORE type strip, generic form).
 * Pattern: const/let/var <identifier> = defineEmits<{...}>()
 *
 * @param {string} source
 * @returns {string | null}
 */
export function extractEmitsObjectNameFromGeneric(source) {
  const m = source.match(/(?:const|let|var)\s+([$\w]+)\s*=\s*defineEmits\s*<\s*\{/);
  return m ? m[1] : null;
}


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

// ── Constant extraction ─────────────────────────────────────────────

/**
 * Known macro/reactive call patterns that should NOT be treated as constants.
 */
export const REACTIVE_CALLS = /\b(?:signal|computed|effect|watch|defineProps|defineEmits|defineModel|defineComponent|templateRef|defineExpose|onMount|onDestroy)\s*[<(]/;

/**
 * Extract plain const/let/var declarations that are NOT reactive calls.
 * Only extracts root-level declarations (depth 0).
 *
 * @param {string} source
 * @returns {import('../types.js').ConstantVar[]}
 */
export function extractConstants(source) {
  /** @type {import('../types.js').ConstantVar[]} */
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
 * @returns {import('../types.js').WatcherDef[]}
 */
export function extractWatchers(source) {
  /** @type {import('../types.js').WatcherDef[]} */
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
