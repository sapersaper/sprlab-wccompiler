import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { scopeCSS } from './css-scoper.js';

// ── Generators ──────────────────────────────────────────────────────

// Valid custom element tag names (must contain a hyphen)
const tagNameArb = fc.stringMatching(/^[a-z][a-z]+-[a-z][a-z]+$/).filter((s) => s.length >= 3);

// Simple CSS class selectors
const classSelectorArb = fc.stringMatching(/^\.[a-z][a-zA-Z0-9]{0,8}$/);

// Simple CSS id selectors
const idSelectorArb = fc.stringMatching(/^#[a-z][a-zA-Z0-9]{0,8}$/);

// Simple element selectors
const elementSelectorArb = fc.constantFrom('div', 'span', 'p', 'button', 'h1', 'h2', 'section', 'article', 'ul', 'li');

// Any simple selector
const simpleSelectorArb = fc.oneof(classSelectorArb, idSelectorArb, elementSelectorArb);

// CSS property-value pairs
const cssDeclArb = fc.constantFrom(
  'color: red',
  'display: flex',
  'padding: 8px',
  'margin: 0',
  'font-size: 14px',
  'background: blue',
  'border: 1px solid black',
  'opacity: 0.5'
);

// A single CSS rule: selector { declarations }
function cssRuleArb() {
  return fc.tuple(simpleSelectorArb, fc.array(cssDeclArb, { minLength: 1, maxLength: 3 })).map(
    ([selector, decls]) => `${selector} { ${decls.join('; ')}; }`
  );
}

// Comma-separated selectors rule
function commaRuleArb() {
  return fc.tuple(
    fc.array(simpleSelectorArb, { minLength: 2, maxLength: 4 }),
    fc.array(cssDeclArb, { minLength: 1, maxLength: 2 })
  ).map(([selectors, decls]) => `${selectors.join(', ')} { ${decls.join('; ')}; }`);
}

// ── Property Tests ──────────────────────────────────────────────────

/**
 * **Validates: Requirements 4.1, 4.2**
 *
 * Property 8: CSS Selector Prefixing
 *
 * For any non-empty CSS string containing simple selectors (.class, #id, element)
 * and comma-separated selectors, and any valid tag name, the CSS Scoper SHALL
 * prefix every selector with the tag name.
 *
 * Feature: core, Property 8: CSS Selector Prefixing
 */
describe('css-scoper — property: CSS Selector Prefixing', () => {
  it('every selector in the output is prefixed with the tag name', () => {
    fc.assert(
      fc.property(
        tagNameArb,
        fc.array(
          fc.oneof(cssRuleArb(), commaRuleArb()),
          { minLength: 1, maxLength: 5 }
        ),
        (tagName, rules) => {
          const css = rules.join('\n');
          const result = scopeCSS(css, tagName);

          // Extract all selectors from the original CSS
          // Each rule has selectors before the '{'
          for (const rule of rules) {
            const braceIdx = rule.indexOf('{');
            const selectorPart = rule.slice(0, braceIdx);
            const selectors = selectorPart.split(',').map((s) => s.trim()).filter(Boolean);

            for (const sel of selectors) {
              // The output should contain "tagName selector"
              expect(result).toContain(`${tagName} ${sel}`);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 4.3**
 *
 * Property 9: CSS @media Recursive Scoping
 *
 * For any CSS string containing @media blocks with nested selectors, and any
 * valid tag name, the CSS Scoper SHALL prefix every selector inside the @media
 * block with the tag name while preserving the @media rule itself.
 *
 * Feature: core, Property 9: CSS @media Recursive Scoping
 */
describe('css-scoper — property: CSS @media Recursive Scoping', () => {
  // Generator for @media queries
  const mediaQueryArb = fc.constantFrom(
    '@media (max-width: 600px)',
    '@media (min-width: 768px)',
    '@media screen',
    '@media print',
    '@media (prefers-color-scheme: dark)'
  );

  it('selectors inside @media are prefixed while @media rule is preserved', () => {
    fc.assert(
      fc.property(
        tagNameArb,
        mediaQueryArb,
        fc.array(cssRuleArb(), { minLength: 1, maxLength: 4 }),
        (tagName, mediaQuery, innerRules) => {
          const innerCSS = innerRules.join('\n  ');
          const css = `${mediaQuery} {\n  ${innerCSS}\n}`;
          const result = scopeCSS(css, tagName);

          // The @media rule itself should be preserved
          expect(result).toContain(mediaQuery);

          // Each inner selector should be prefixed
          for (const rule of innerRules) {
            const braceIdx = rule.indexOf('{');
            const selector = rule.slice(0, braceIdx).trim();

            expect(result).toContain(`${tagName} ${selector}`);
          }

          // The @media rule should NOT be prefixed with the tag name
          expect(result).not.toContain(`${tagName} ${mediaQuery}`);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Unit Tests for Edge Cases ───────────────────────────────────────

describe('css-scoper — edge cases', () => {
  it('@keyframes preservation: keyframe stops are not prefixed', () => {
    const css = `@keyframes fadeIn {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}`;
    const result = scopeCSS(css, 'my-comp');

    expect(result).toContain('@keyframes fadeIn');
    // "from" and "to" should NOT be prefixed
    expect(result).not.toContain('my-comp from');
    expect(result).not.toContain('my-comp to');
    expect(result).toContain('from');
    expect(result).toContain('to');
  });

  it('@keyframes with percentage stops are not prefixed', () => {
    const css = `@keyframes slide {\n  0% { left: 0; }\n  50% { left: 50px; }\n  100% { left: 100px; }\n}`;
    const result = scopeCSS(css, 'x-tag');

    expect(result).toContain('@keyframes slide');
    expect(result).not.toContain('x-tag 0%');
    expect(result).not.toContain('x-tag 50%');
    expect(result).not.toContain('x-tag 100%');
  });

  it('statement at-rules (@import) are preserved without modification', () => {
    const css = `@import url('reset.css');`;
    const result = scopeCSS(css, 'my-comp');

    expect(result).toBe(`@import url('reset.css');`);
  });

  it('statement at-rules (@charset) are preserved without modification', () => {
    const css = `@charset "UTF-8";`;
    const result = scopeCSS(css, 'my-comp');

    expect(result).toBe(`@charset "UTF-8";`);
  });

  it('empty input returns empty string', () => {
    expect(scopeCSS('', 'x-tag')).toBe('');
  });

  it('whitespace-only input returns empty string', () => {
    expect(scopeCSS('   \n\t  ', 'x-tag')).toBe('');
  });
});
