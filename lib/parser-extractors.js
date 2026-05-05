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

/** @import { ReactiveVar, ComputedDef, EffectDef, MethodDef, PropDef, LifecycleHook, RefDeclaration } from './types.js' */

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

/**
 * Convert a camelCase identifier to kebab-case for HTML attribute names.
 * e.g. 'itemCount' → 'item-count', 'label' → 'label'
 *
 * @param {string} name
 * @returns {string}
 */
export function camelToKebab(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

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

// ── Props validation ────────────────────────────────────────────────

/**
 * Validate that defineProps is assigned to a variable (if props are accessed via object).
 * No longer throws — bare defineProps() calls are valid when props are only used in template.
 *
 * @param {string} _source
 * @param {string} _fileName
 */
export function validatePropsAssignment(_source, _fileName) {
  // No-op: bare defineProps() is valid in .wcc SFC format
  // Props are accessible in the template without needing a variable reference
}

/**
 * Validate that there are no duplicate prop names.
 *
 * @param {string[]} propNames
 * @param {string} fileName
 */
export function validateDuplicateProps(propNames, fileName) {
  const seen = new Set();
  const duplicates = new Set();
  for (const p of propNames) {
    if (seen.has(p)) duplicates.add(p);
    seen.add(p);
  }
  if (duplicates.size > 0) {
    const names = [...duplicates].join(', ');
    const error = new Error(
      `Error en '${fileName}': props duplicados: ${names}`
    );
    /** @ts-expect-error — custom error code for programmatic handling */
    error.code = 'DUPLICATE_PROPS';
    throw error;
  }
}

/**
 * Validate that the propsObjectName doesn't collide with signals, computeds, or constants.
 *
 * @param {string|null} propsObjectName
 * @param {Set<string>} signalNames
 * @param {Set<string>} computedNames
 * @param {Set<string>} constantNames
 * @param {string} fileName
 */
export function validatePropsConflicts(propsObjectName, signalNames, computedNames, constantNames, fileName) {
  if (!propsObjectName) return;

  if (signalNames.has(propsObjectName) || computedNames.has(propsObjectName) || constantNames.has(propsObjectName)) {
    const error = new Error(
      `Error en '${fileName}': '${propsObjectName}' colisiona con una declaración existente`
    );
    /** @ts-expect-error — custom error code for programmatic handling */
    error.code = 'PROPS_OBJECT_CONFLICT';
    throw error;
  }
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

// ── Emits validation ────────────────────────────────────────────────

/**
 * Validate that defineEmits is assigned to a variable.
 * Throws EMITS_ASSIGNMENT_REQUIRED if bare defineEmits() call detected.
 *
 * @param {string} source
 * @param {string} fileName
 */
export function validateEmitsAssignment(source, fileName) {
  // Check if defineEmits appears in source
  if (!/defineEmits\s*[<(]/.test(source)) return;

  // Check if it's assigned to a variable (either generic or non-generic form)
  if (extractEmitsObjectName(source) !== null) return;
  if (extractEmitsObjectNameFromGeneric(source) !== null) return;

  const error = new Error(
    `Error en '${fileName}': defineEmits() debe asignarse a una variable (const emit = defineEmits(...))`
  );
  /** @ts-expect-error — custom error code for programmatic handling */
  error.code = 'EMITS_ASSIGNMENT_REQUIRED';
  throw error;
}

/**
 * Validate that there are no duplicate event names.
 *
 * @param {string[]} emitNames
 * @param {string} fileName
 */
export function validateDuplicateEmits(emitNames, fileName) {
  const seen = new Set();
  const duplicates = new Set();
  for (const e of emitNames) {
    if (seen.has(e)) duplicates.add(e);
    seen.add(e);
  }
  if (duplicates.size > 0) {
    const names = [...duplicates].join(', ');
    const error = new Error(
      `Error en '${fileName}': emits duplicados: ${names}`
    );
    /** @ts-expect-error — custom error code for programmatic handling */
    error.code = 'DUPLICATE_EMITS';
    throw error;
  }
}

/**
 * Validate that the emitsObjectName doesn't collide with signals, computeds, constants, props, or propsObjectName.
 *
 * @param {string|null} emitsObjectName
 * @param {Set<string>} signalNames
 * @param {Set<string>} computedNames
 * @param {Set<string>} constantNames
 * @param {Set<string>} propNames
 * @param {string|null} propsObjectName
 * @param {string} fileName
 */
export function validateEmitsConflicts(emitsObjectName, signalNames, computedNames, constantNames, propNames, propsObjectName, fileName) {
  if (!emitsObjectName) return;

  if (
    signalNames.has(emitsObjectName) ||
    computedNames.has(emitsObjectName) ||
    constantNames.has(emitsObjectName) ||
    propNames.has(emitsObjectName) ||
    (propsObjectName && emitsObjectName === propsObjectName)
  ) {
    const error = new Error(
      `Error en '${fileName}': '${emitsObjectName}' colisiona con una declaración existente`
    );
    /** @ts-expect-error — custom error code for programmatic handling */
    error.code = 'EMITS_OBJECT_CONFLICT';
    throw error;
  }
}

/**
 * Escape special regex characters in a string.
 *
 * @param {string} str
 * @returns {string}
 */
export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate that all emit calls use declared event names.
 *
 * @param {string} source
 * @param {string|null} emitsObjectName
 * @param {string[]} emits
 * @param {string} fileName
 */
export function validateUndeclaredEmits(source, emitsObjectName, emits, fileName) {
  if (!emitsObjectName || emits.length === 0) return;

  const emitsSet = new Set(emits);
  const re = new RegExp(`\\b${escapeRegex(emitsObjectName)}\\(\\s*['"]([^'"]+)['"]`, 'g');
  let match;
  while ((match = re.exec(source)) !== null) {
    const eventName = match[1];
    if (!emitsSet.has(eventName)) {
      const error = new Error(
        `Error en '${fileName}': emit no declarado: '${eventName}'`
      );
      /** @ts-expect-error — custom error code for programmatic handling */
      error.code = 'UNDECLARED_EMIT';
      throw error;
    }
  }
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
export const REACTIVE_CALLS = /\b(?:signal|computed|effect|watch|defineProps|defineEmits|defineComponent|templateRef|templateBindings|onMount|onDestroy)\s*[<(]/;

/**
 * Extract plain const/let/var declarations that are NOT reactive calls.
 * Only extracts root-level declarations (depth 0).
 *
 * @param {string} source
 * @returns {import('./types.js').ConstantVar[]}
 */
export function extractConstants(source) {
  /** @type {import('./types.js').ConstantVar[]} */
  const constants = [];
  let depth = 0;

  for (const line of source.split('\n')) {
    // Track brace depth to skip nested blocks
    for (const ch of line) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
    }
    if (depth > 0) continue;

    // Match const/let/var name = value at root level
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
 * Pattern: watch('target', (newParam, oldParam) => { body })
 * Uses brace depth tracking to capture multi-line bodies.
 *
 * @param {string} source
 * @returns {import('./types.js').WatcherDef[]}
 */
export function extractWatchers(source) {
  /** @type {import('./types.js').WatcherDef[]} */
  const watchers = [];
  const lines = source.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/\bwatch\(\s*['"](\w+)['"]\s*,\s*\((\w+)\s*,\s*(\w+)\)\s*=>\s*\{/);

    if (m) {
      const target = m[1];
      const newParam = m[2];
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

      watchers.push({ target, newParam, oldParam, body });
    }
    i++;
  }

  return watchers;
}

// ── Function extraction ─────────────────────────────────────────────

/**
 * Extract top-level function declarations from source.
 * Pattern: function name(params) { body }
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
    const m = line.match(/^\s*function\s+(\w+)\s*\(([^)]*)\)\s*\{/);
    if (m) {
      const name = m[1];
      const params = m[2].trim();
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
 * @returns {{ onMountHooks: LifecycleHook[], onDestroyHooks: LifecycleHook[] }}
 */
export function extractLifecycleHooks(script) {
  /** @type {LifecycleHook[]} */
  const onMountHooks = [];
  /** @type {LifecycleHook[]} */
  const onDestroyHooks = [];
  const lines = script.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const mountMatch = line.match(/\bonMount\s*\(\s*(?:async\s*)?\(\s*\)\s*=>\s*\{/);
    const destroyMatch = line.match(/\bonDestroy\s*\(\s*(?:async\s*)?\(\s*\)\s*=>\s*\{/);

    if (mountMatch || destroyMatch) {
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
      } else {
        onDestroyHooks.push({ body, async: isAsync });
      }
    }
    i++;
  }

  return { onMountHooks, onDestroyHooks };
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
