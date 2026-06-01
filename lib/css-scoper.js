/**
 * CSS Scoper — scopes CSS selectors to a component subtree using the native
 * @scope at-rule.
 *
 * Primary output:
 *   @scope (wcc-card) to (wcc-button, wcc-badge) {
 *     .title { color: red }
 *   }
 *
 * Falls back to tag-name prefixing when boundaries are empty:
 *   wcc-card .title { color: red }
 *
 * Handles:
 * - Statement at-rules (@import, @charset, @namespace) extracted outside @scope
 * - :host / :host(...) transformed to :scope / :scope(...)
 * - @keyframes preserved inside @scope (valid in all modern browsers)
 * - @media, @supports, @layer, @container — passed through inside @scope
 * - CSS nesting (&) — works naturally inside @scope
 */

const STATEMENT_AT_RULES = new Set(['@import', '@charset', '@namespace']);

/**
 * Scope CSS to a component using the native @scope at-rule.
 *
 * @param {string} css - Raw CSS string
 * @param {string} tagName - Component tag name (e.g. "wcc-card")
 * @param {string[]} [boundaries] - Child component tags for @scope limit (e.g. ["wcc-button", "wcc-badge"])
 * @returns {string} Scoped CSS string
 */
export function scopeCSS(css, tagName, boundaries = []) {
  if (!css || !css.trim()) return '';

  if (boundaries.length === 0) {
    return legacyScopeCSS(css, tagName);
  }

  const { statements, body } = extractStatementAtRules(css);
  const transformedBody = transformHostToScope(body).trim();

  if (!transformedBody) return statements;

  const boundaryStr = ` to (${boundaries.join(', ')})`;
  const scoped = `@scope (${tagName})${boundaryStr} {\n${transformedBody}\n}`;

  return statements ? `${statements}\n\n${scoped}` : scoped;
}

/**
 * Transform :host and :host(...) to :scope and :scope(...).
 * Does NOT match :host-context, :host has-part, etc.
 *
 * @param {string} css
 * @returns {string}
 */
function transformHostToScope(css) {
  return css.replace(/:host(?![-\w])(\([^)]*\))?/g, (match, args) => {
    return args ? `:scope${args}` : ':scope';
  });
}

/**
 * Extract statement at-rules (@import, @charset, @namespace) that must stay
 * at the top level and cannot be nested inside @scope.
 *
 * @param {string} css
 * @returns {{ statements: string, body: string }}
 */
function extractStatementAtRules(css) {
  const statements = [];
  const bodyParts = [];
  let i = 0;

  while (i < css.length) {
    // Skip whitespace
    if (/\s/.test(css[i])) {
      bodyParts.push(css[i]);
      i++;
      continue;
    }

    if (css[i] === '@') {
      const atResult = tryConsumeStatementAtRule(css, i);
      if (atResult) {
        statements.push(atResult.text);
        i = atResult.end;
        continue;
      }
    }

    bodyParts.push(css[i]);
    i++;
  }

  return {
    statements: statements.join('\n').trim(),
    body: bodyParts.join(''),
  };
}

/**
 * Try to consume a statement at-rule (@import, @charset, @namespace) ending
 * with ';'. Returns null if the at-rule at position i is not a statement
 * at-rule.
 *
 * @param {string} css
 * @param {number} start - Index of '@'
 * @returns {{ text: string, end: number } | null}
 */
function tryConsumeStatementAtRule(css, start) {
  // Read the at-rule name
  let i = start + 1;
  let name = '@';
  while (i < css.length && !/\s/.test(css[i]) && css[i] !== '{' && css[i] !== ';') {
    name += css[i];
    i++;
  }

  if (!STATEMENT_AT_RULES.has(name)) return null;

  // Skip whitespace after name
  while (i < css.length && /\s/.test(css[i])) i++;

  // Consume until ';'
  let text = css.slice(start, i);
  while (i < css.length && css[i] !== ';') {
    text += css[i];
    i++;
  }
  if (i < css.length) {
    text += ';';
    i++;
  }

  return { text, end: i };
}

/**
 * Legacy fallback: scope CSS by prefixing each selector with the tag name.
 * Used when no boundaries are provided (no child components).
 *
 * @param {string} css - Raw CSS string
 * @param {string} tagName - Component tag name
 * @returns {string} Prefixed CSS string
 */
function legacyScopeCSS(css, tagName) {
  const result = [];
  let i = 0;

  while (i < css.length) {
    if (/\s/.test(css[i])) {
      result.push(css[i]);
      i++;
      continue;
    }

    if (css[i] === '@') {
      const atResult = legacyConsumeAtRule(css, i, tagName);
      result.push(atResult.text);
      i = atResult.end;
      continue;
    }

    if (css[i] === '}') {
      result.push('}');
      i++;
      continue;
    }

    const selectorEnd = css.indexOf('{', i);
    if (selectorEnd === -1) {
      result.push(css.slice(i));
      break;
    }

    const rawSelector = css.slice(i, selectorEnd);
    const scopedSelector = legacyPrefixSelectors(rawSelector, tagName);
    result.push(scopedSelector);

    const blockResult = legacyConsumeBlock(css, selectorEnd);
    result.push(blockResult.text);
    i = blockResult.end;
  }

  return result.join('');
}

/**
 * Prefix comma-separated selectors with the tag name (legacy mode).
 * Also transforms :host / :host(...) to the tag name.
 *
 * @param {string} raw - Raw selector string
 * @param {string} tagName - Component tag name
 * @returns {string} Prefixed selector string
 */
function legacyPrefixSelectors(raw, tagName) {
  return splitTopLevelCommas(raw)
    .map(s => {
      const trimmed = s.trim();
      if (!trimmed) return s;
      const leadingWs = s.match(/^(\s*)/)[1];

      // :host / :host(...) → tagName / tagName(...)
      if (trimmed === ':host') return `${leadingWs}${tagName}`;
      if (trimmed.startsWith(':host(')) {
        const inner = trimmed.slice(6, -1);
        return `${leadingWs}${tagName}${inner}`;
      }

      return `${leadingWs}${tagName} ${trimmed}`;
    })
    .join(',');
}

/**
 * Split a string by commas that are at the top level (not inside parentheses,
 * brackets, or quotes).
 *
 * @param {string} str
 * @returns {string[]}
 */
function splitTopLevelCommas(str) {
  const parts = [];
  let depthParen = 0;
  let depthBracket = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let start = 0;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === "'" && !inDoubleQuote) inSingleQuote = !inSingleQuote;
    else if (ch === '"' && !inSingleQuote) inDoubleQuote = !inDoubleQuote;
    else if (!inSingleQuote && !inDoubleQuote) {
      if (ch === '(') depthParen++;
      else if (ch === ')') depthParen--;
      else if (ch === '[') depthBracket++;
      else if (ch === ']') depthBracket--;
      else if (ch === ',' && depthParen === 0 && depthBracket === 0) {
        parts.push(str.slice(start, i));
        start = i + 1;
      }
    }
  }
  parts.push(str.slice(start));
  return parts;
}

/**
 * Consume a { ... } block starting at the opening brace.
 *
 * @param {string} css
 * @param {number} start - Index of the opening brace
 * @returns {{text: string, end: number}}
 */
function legacyConsumeBlock(css, start) {
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

  return { text: chars.join(''), end: i };
}

/**
 * Consume an at-rule for the legacy fallback path.
 *
 * @param {string} css
 * @param {number} start - Index of '@'
 * @param {string} tagName
 * @returns {{text: string, end: number}}
 */
function legacyConsumeAtRule(css, start, tagName) {
  let i = start;
  const prelude = [];

  while (i < css.length && css[i] !== '{' && css[i] !== ';') {
    prelude.push(css[i]);
    i++;
  }

  if (i >= css.length) {
    return { text: prelude.join(''), end: i };
  }

  if (css[i] === ';') {
    prelude.push(';');
    return { text: prelude.join(''), end: i + 1 };
  }

  const preludeStr = prelude.join('');
  const atName = preludeStr.trim().split(/\s/)[0];

  if (atName === '@keyframes' || atName === '@-webkit-keyframes') {
    const block = legacyConsumeBlock(css, i);
    return { text: preludeStr + block.text, end: block.end };
  }

  const innerStart = i + 1;
  let depth = 1;
  let j = innerStart;

  while (j < css.length && depth > 0) {
    if (css[j] === '{') depth++;
    if (css[j] === '}') depth--;
    if (depth > 0) j++;
  }

  const innerCSS = css.slice(innerStart, j);
  const scopedInner = legacyScopeCSS(innerCSS, tagName);

  return {
    text: `${preludeStr}{${scopedInner}}`,
    end: j + 1,
  };
}
