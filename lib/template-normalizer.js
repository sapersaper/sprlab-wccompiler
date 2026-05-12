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
 * 1. Convert PascalCase tags to kebab-case
 * 2. Expand self-closing custom elements to open+close pairs
 *
 * @param {string} html — Raw template HTML
 * @returns {string} — Normalized HTML ready for DOM parsing
 */
export function normalizeTemplate(html) {
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
    let normalizedTag = tagName;

    // Step 1: Convert PascalCase to kebab-case
    if (isPascalCase(tagName)) {
      normalizedTag = pascalToKebab(tagName);
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
