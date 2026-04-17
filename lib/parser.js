/**
 * Parser for .html source files with <template>, <script>, <style> blocks.
 *
 * Extracts:
 * - Block contents (template, script, style)
 * - defineProps declarations
 * - Root-level reactive variables
 * - Computed properties
 * - Watchers
 * - Function declarations
 *
 * Tree walking (bindings, events, slots, processedTemplate) is NOT handled
 * here — that's the responsibility of tree-walker.js (task 3).
 */

// ── Block extraction ────────────────────────────────────────────────

/**
 * Extract the content of a named block from the HTML source.
 * Returns the inner content string, or null if the block is not found.
 */
function extractBlock(html, blockName) {
  const re = new RegExp(`<${blockName}>([\\s\\S]*?)<\\/${blockName}>`);
  const m = html.match(re);
  return m ? m[1] : null;
}

// ── Name derivation ─────────────────────────────────────────────────

/**
 * Derive tagName from fileName (strip .html extension if present).
 * e.g. "spr-hi.html" → "spr-hi", "spr-hi" → "spr-hi"
 */
function deriveTagName(fileName) {
  return fileName.replace(/\.html$/, '');
}

/**
 * Convert a kebab-case tag name to PascalCase class name.
 * e.g. "spr-hi" → "SprHi"
 */
function toClassName(tagName) {
  return tagName
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

// ── Props extraction ────────────────────────────────────────────────

/**
 * Extract props from defineProps([...]) call.
 * Detects duplicates and throws DUPLICATE_PROPS error.
 * Returns an empty array if no defineProps is found.
 */
function extractProps(script, fileName) {
  const m = script.match(/defineProps\(\[([^\]]*)\]\)/);
  if (!m) return [];

  const raw = m[1];
  const props = [];
  const re = /'([^']+)'/g;
  let match;
  while ((match = re.exec(raw)) !== null) {
    props.push(match[1]);
  }

  // Detect duplicates
  const seen = new Set();
  const duplicates = new Set();
  for (const p of props) {
    if (seen.has(p)) duplicates.add(p);
    seen.add(p);
  }
  if (duplicates.size > 0) {
    const names = [...duplicates].join(', ');
    const error = new Error(
      `Error en '${fileName}': props duplicados: ${names}`
    );
    error.code = 'DUPLICATE_PROPS';
    throw error;
  }

  return props;
}

// ── Root-level reactive variables ───────────────────────────────────

/**
 * Extract root-level variable declarations (const/let/var with literal value).
 * Tracks brace depth to skip variables inside functions or nested blocks.
 * Excludes lines that use computed(...) or watch(...).
 */
function extractRootVars(script) {
  const vars = [];
  let depth = 0;

  for (const line of script.split('\n')) {
    // Track brace depth
    for (const ch of line) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
    }

    // Only extract at root level (depth === 0)
    if (depth !== 0) continue;

    // Skip computed, watch, and defineProps assignments
    if (/computed\s*\(/.test(line) || /watch\s*\(/.test(line) || /defineProps\s*\(/.test(line)) continue;

    const m = line.match(/^\s*(?:const|let|var)\s+(\w+)\s*=\s*(.+?);?\s*$/);
    if (m) {
      vars.push({ name: m[1], value: m[2] });
    }
  }

  return vars;
}

// ── Computed properties ─────────────────────────────────────────────

/**
 * Extract computed property declarations.
 * Pattern: const name = computed(() => expr)
 */
function extractComputeds(script) {
  const out = [];
  const re = /(?:const|let|var)\s+(\w+)\s*=\s*computed\(\s*\(\)\s*=>\s*([\s\S]*?)\)/g;
  let m;
  while ((m = re.exec(script)) !== null) {
    out.push({ name: m[1], body: m[2].trim() });
  }
  return out;
}

// ── Watchers ────────────────────────────────────────────────────────

/**
 * Extract watcher declarations.
 * Pattern: watch('target', (newParam, oldParam) => { body })
 */
function extractWatchers(script) {
  const out = [];
  const re = /watch\(\s*'(\w+)'\s*,\s*\((\w+)\s*,\s*(\w+)\)\s*=>\s*\{([\s\S]*?)\}\s*\)/g;
  let m;
  while ((m = re.exec(script)) !== null) {
    out.push({
      target: m[1],
      newParam: m[2],
      oldParam: m[3],
      body: m[4].trim(),
    });
  }
  return out;
}

// ── Function declarations ───────────────────────────────────────────

/**
 * Extract top-level function declarations.
 * Pattern: function name(params) { body }
 * Uses brace tracking to capture the full function body.
 */
function extractFunctions(script) {
  const functions = [];
  const lines = script.split('\n');
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

// ── Main parse function ─────────────────────────────────────────────

/**
 * Parse an HTML source string into a ParseResult IR.
 *
 * @param {string} html - The full HTML source content
 * @param {string} fileName - The file name (e.g. "spr-hi.html" or "spr-hi")
 * @returns {ParseResult}
 */
export function parse(html, fileName) {
  const tagName = deriveTagName(fileName);
  const className = toClassName(tagName);

  // Extract blocks
  const template = extractBlock(html, 'template');
  if (template === null) {
    const error = new Error(
      `Error en '${fileName}': el bloque <template> es obligatorio`
    );
    error.code = 'MISSING_TEMPLATE';
    throw error;
  }

  const script = extractBlock(html, 'script') ?? '';
  const style = extractBlock(html, 'style') ?? '';
  const trimmedScript = script.trim();

  // Extract script-level constructs
  const props = extractProps(trimmedScript, fileName);
  const reactiveVars = extractRootVars(trimmedScript);
  const computeds = extractComputeds(trimmedScript);
  const watchers = extractWatchers(trimmedScript);
  const methods = extractFunctions(trimmedScript);

  return {
    tagName,
    className,
    template,
    script: trimmedScript,
    style: style.trim(),
    props,
    reactiveVars,
    computeds,
    watchers,
    methods,
    // Tree walker fields — populated by tree-walker.js (task 3)
    bindings: [],
    events: [],
    slots: [],
    processedTemplate: null,
  };
}
