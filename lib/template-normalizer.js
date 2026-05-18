/**
 * Template Normalizer — pre-processes WCC template HTML before DOM parsing.
 *
 * Handles two transformations:
 * 1. PascalCase tags → kebab-case (e.g. <WccBadge> → <wcc-badge>)
 * 2. Self-closing custom elements → open+close (e.g. <wcc-badge /> → <wcc-badge></wcc-badge>)
 *
 * Must run BEFORE linkedom/jsdom parsing because HTML parsers:
 * - Lowercase all tag names (losing PascalCase word boundaries)
 * - Don't recognize self-closing syntax for non-void elements
 */

// HTML void elements that are legitimately self-closing
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * Convert a PascalCase tag name to kebab-case.
 * e.g. "WccBadge" → "wcc-badge", "WccCardHeader" → "wcc-card-header"
 *
 * Only converts if the name starts with an uppercase letter (PascalCase).
 *
 * @param {string} name
 * @returns {string}
 */
export function pascalToKebab(name) {
  // Insert hyphen before each uppercase letter that follows a lowercase letter or digit
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Check if a tag name is PascalCase (starts with uppercase, has at least
 * one more uppercase letter indicating a word boundary).
 *
 * @param {string} name
 * @returns {boolean}
 */
export function isPascalCase(name) {
  return /^[A-Z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*$/.test(name);
}

/**
 * Normalize a WCC template string:
 * 1. Convert Mustache-style key bindings to :key syntax (BUG-0013 fix)
 * 2. Convert PascalCase tags to kebab-case (validated against importMap if provided)
 * 3. Expand self-closing custom elements to open+close pairs
 *
 * @param {string} html — Raw template HTML
 * @param {object} [options]
 * @param {Map<string, string>} [options.importMap] — PascalCase identifier → kebab-case tag
 * @param {string} [options.fileName] — Source file for error messages
 * @returns {string} — Normalized HTML ready for DOM parsing
 * @throws {Error} with code 'UNRESOLVED_COMPONENT' if PascalCase tag has no matching import
 */
export function normalizeTemplate(html, options) {
  const { importMap, fileName } = options || {};

  // BUG-0013 FIX: Pre-process Mustache-style key bindings before HTML parser sees them
  // Convert key={{ expr }} or key="{{ expr }}" to :key="expr"
  // This prevents the HTML parser from breaking unquoted Mustache expressions into malformed attributes
  
  // Pattern 1: key="{{ expr }}" (with quotes)
  html = html.replace(/\bkey\s*=\s*"\{\{([^}]+)\}\}"/g, ':key="$1"');
  
  // Pattern 2: key={{ expr }} (without quotes) - must handle carefully
  // Match key={{ followed by expression and closing }}
  html = html.replace(/\bkey\s*=\s*\{\{([^}]+)\}\}/g, ':key="$1"');

  // Match opening tags (including self-closing): <TagName ...> or <TagName ... />
  // Also match closing tags: </TagName>
  //
  // Regex breakdown:
  //   <           — opening angle bracket
  //   (\/?)?      — optional slash (closing tag)
  //   ([A-Za-z][\w-]*)  — tag name
  //   ((?:\s[^>]*)?)    — attributes (anything that's not >)
  //   (\s*\/)?    — optional self-closing slash
  //   >           — closing angle bracket
  const TAG_RE = /<(\/?)([A-Za-z][\w-]*)((?:\s[^>]*?)?)(\/?)>/g;

  return html.replace(TAG_RE, (match, closingSlash, tagName, attrs, selfClosing) => {
    // Guard: preserve <component> tags as-is — this is a compiler directive, not a custom element
    if (tagName.toLowerCase() === 'component') {
      return match;
    }

    let normalizedTag = tagName;

    // Step 1: Convert PascalCase to kebab-case
    if (isPascalCase(tagName)) {
      if (importMap) {
        // Validate against the import map
        if (importMap.has(tagName)) {
          normalizedTag = importMap.get(tagName);
        } else {
          const error = new Error(
            `Unresolved component '<${tagName}>' in '${fileName || 'unknown'}'. Did you forget to import it?`
          );
          error.code = 'UNRESOLVED_COMPONENT';
          throw error;
        }
      } else {
        // Backward compatible: convert all PascalCase to kebab-case
        normalizedTag = pascalToKebab(tagName);
      }
    }

    // Step 2: Handle self-closing tags
    if (selfClosing === '/') {
      // If it's a void element, keep it self-closing
      if (VOID_ELEMENTS.has(normalizedTag.toLowerCase())) {
        return `<${closingSlash}${normalizedTag}${attrs} />`;
      }
      // Otherwise expand to open+close pair (trim trailing whitespace from attrs)
      const trimmedAttrs = attrs.trimEnd();
      return `<${normalizedTag}${trimmedAttrs}></${normalizedTag}>`;
    }

    // Regular open or close tag — just replace the name
    return `<${closingSlash}${normalizedTag}${attrs}>`;
  });
}
