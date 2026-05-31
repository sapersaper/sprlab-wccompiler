/**
 * Emit extraction functions for parsing .ts/.js component source files.
 *
 * Extracts:
 * - Call-signature-form emits (defineEmits<{...}>)
 * - Array-form emits (defineEmits([...]))
 * - Emits object name
 */

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
