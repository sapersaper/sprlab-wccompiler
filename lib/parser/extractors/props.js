/**
 * Props extraction functions for parsing .ts/.js component source files.
 *
 * Extracts:
 * - Generic-form props (defineProps<{...}>)
 * - Array-form props (defineProps([...]))
 * - Props defaults
 * - Props object name
 */

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
