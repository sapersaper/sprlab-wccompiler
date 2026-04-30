/**
 * CSS Scoper — prefixes CSS selectors with the component tag name.
 *
 * Handles:
 * - Simple selectors (.class, #id, element)
 * - Comma-separated selectors
 * - At-rules (@media, @keyframes) — preserved without prefixing
 * - Nested selectors inside at-rules — still prefixed
 */

/**
 * Scope CSS by prefixing each selector with the component tag name.
 *
 * @param {string} css - Raw CSS string
 * @param {string} tagName - Component tag name (e.g. "wcc-hi")
 * @returns {string} Scoped CSS string
 */
export function scopeCSS(css, tagName) {
  if (!css || !css.trim()) return '';

  const result = [];
  let i = 0;

  while (i < css.length) {
    // Skip whitespace
    if (/\s/.test(css[i])) {
      result.push(css[i]);
      i++;
      continue;
    }

    // Detect at-rules
    if (css[i] === '@') {
      const atResult = consumeAtRule(css, i, tagName);
      result.push(atResult.text);
      i = atResult.end;
      continue;
    }

    // Detect closing brace (end of a block)
    if (css[i] === '}') {
      result.push('}');
      i++;
      continue;
    }

    // Otherwise, it's a selector — read until '{'
    const selectorEnd = css.indexOf('{', i);
    if (selectorEnd === -1) {
      // No more blocks, append remaining text as-is
      result.push(css.slice(i));
      break;
    }

    const rawSelector = css.slice(i, selectorEnd);
    const scopedSelector = prefixSelectors(rawSelector, tagName);
    result.push(scopedSelector);

    // Now consume the declaration block (until matching '}')
    const blockResult = consumeBlock(css, selectorEnd);
    result.push(blockResult.text);
    i = blockResult.end;
  }

  return result.join('');
}


/**
 * Prefix comma-separated selectors with the tag name.
 * e.g. ".foo, .bar" → "tag .foo, tag .bar"
 *
 * @param {string} raw - Raw selector string (may be comma-separated)
 * @param {string} tagName - Component tag name to prefix
 * @returns {string} Prefixed selector string
 */
function prefixSelectors(raw, tagName) {
  return raw
    .split(',')
    .map(s => {
      const trimmed = s.trim();
      if (!trimmed) return s;
      // Preserve the leading whitespace from the original
      const leadingWs = s.match(/^(\s*)/)[1];
      return `${leadingWs}${tagName} ${trimmed}`;
    })
    .join(',');
}

/**
 * Consume a { ... } block starting at the opening brace.
 * Returns the text (including braces) and the position after the closing brace.
 *
 * @param {string} css - Full CSS string
 * @param {number} start - Index of the opening brace
 * @returns {{text: string, end: number}} Consumed block text and position after closing brace
 */
function consumeBlock(css, start) {
  let depth = 0;
  let i = start;
  const chars = [];

  while (i < css.length) {
    chars.push(css[i]);
    if (css[i] === '{') depth++;
    if (css[i] === '}') {
      depth--;
      if (depth === 0) {
        return { text: chars.join(''), end: i + 1 };
      }
    }
    i++;
  }

  // Unclosed block — return what we have
  return { text: chars.join(''), end: i };
}

/**
 * Consume an at-rule starting at '@'.
 * Handles both block at-rules (@media { ... }) and statement at-rules (@import ...).
 * For block at-rules, recursively scopes selectors inside.
 *
 * @param {string} css - Full CSS string
 * @param {number} start - Index of the '@' character
 * @param {string} tagName - Component tag name for scoping nested selectors
 * @returns {{text: string, end: number}} Consumed at-rule text and position after it
 */
function consumeAtRule(css, start, tagName) {
  // Read the at-rule prelude (everything up to '{' or ';')
  let i = start;
  const prelude = [];

  while (i < css.length && css[i] !== '{' && css[i] !== ';') {
    prelude.push(css[i]);
    i++;
  }

  if (i >= css.length) {
    // Unterminated at-rule
    return { text: prelude.join(''), end: i };
  }

  if (css[i] === ';') {
    // Statement at-rule (e.g. @import, @charset)
    prelude.push(';');
    return { text: prelude.join(''), end: i + 1 };
  }

  // Block at-rule — css[i] === '{'
  const preludeStr = prelude.join('');
  const atName = preludeStr.trim().split(/\s/)[0]; // e.g. "@media", "@keyframes"

  // @keyframes: don't scope inner selectors (they're keyframe stops, not CSS selectors)
  if (atName === '@keyframes' || atName === '@-webkit-keyframes') {
    const block = consumeBlock(css, i);
    return { text: preludeStr + block.text, end: block.end };
  }

  // For @media and other nesting at-rules: scope the inner selectors
  // We need to parse the inner content recursively
  const innerStart = i + 1; // after '{'
  let depth = 1;
  let j = innerStart;

  // Find the matching closing brace
  while (j < css.length && depth > 0) {
    if (css[j] === '{') depth++;
    if (css[j] === '}') depth--;
    if (depth > 0) j++;
  }

  const innerCSS = css.slice(innerStart, j);
  const scopedInner = scopeCSS(innerCSS, tagName);

  return {
    text: `${preludeStr}{${scopedInner}}`,
    end: j + 1,
  };
}
