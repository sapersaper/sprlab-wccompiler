import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { scopeCSS } from '../../lib/css-scoper.js';

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

describe('css-scoper — @scope mode', () => {
  describe('basic @scope output', () => {
    it('wraps CSS in @scope with boundaries', () => {
      const result = scopeCSS('.title { color: red }', 'wcc-card', ['wcc-button', 'wcc-badge']);
      expect(result).toBe('@scope (wcc-card) to (wcc-button, wcc-badge) {\n.title { color: red }\n}');
    });

    it('works with a single boundary', () => {
      const result = scopeCSS('.foo { color: red }', 'wcc-card', ['wcc-button']);
      expect(result).toBe('@scope (wcc-card) to (wcc-button) {\n.foo { color: red }\n}');
    });
  });

  describe(':host transformation', () => {
    it('transforms :host to :scope', () => {
      const result = scopeCSS(':host { display: block }', 'wcc-card', ['wcc-button']);
      expect(result).toContain(':scope { display: block }');
      expect(result).not.toContain(':host');
    });

    it('transforms :host(.class) to :scope(.class)', () => {
      const result = scopeCSS(':host(.active) { border: 2px }', 'wcc-card', ['wcc-button']);
      expect(result).toContain(':scope(.active)');
      expect(result).not.toContain(':host');
    });
  });

  describe('statement at-rules extracted outside @scope', () => {
    it('@import is extracted before @scope', () => {
      const result = scopeCSS("@import url('reset.css');\n.foo { color: red }", 'wcc-card', ['wcc-button']);
      expect(result).toContain("@import url('reset.css');");
      expect(result).toContain('@scope (wcc-card)');
    });

    it('@charset is extracted before @scope', () => {
      const result = scopeCSS('@charset "UTF-8";\n.foo { color: red }', 'wcc-card', ['wcc-button']);
      expect(result).toContain('@charset "UTF-8";');
      expect(result).toContain('@scope (wcc-card)');
    });
  });

  describe('@media and @keyframes inside @scope', () => {
    it('@media stays inside @scope', () => {
      const css = '.foo { color: red }\n@media (max-width: 600px) {\n  .foo { font-size: 14px }\n}';
      const result = scopeCSS(css, 'wcc-card', ['wcc-button']);
      expect(result).toContain('@media (max-width: 600px)');
      expect(result).toContain('@scope (wcc-card)');
    });

    it('@keyframes stays inside @scope', () => {
      const css = '@keyframes spin {\n  from { transform: rotate(0deg) }\n  to { transform: rotate(360deg) }\n}';
      const result = scopeCSS(css, 'wcc-card', ['wcc-button']);
      expect(result).toContain('@keyframes spin');
      expect(result).toContain('@scope (wcc-card)');
    });

    it('@supports stays inside @scope', () => {
      const css = '@supports (display: grid) {\n  .grid { display: grid }\n}';
      const result = scopeCSS(css, 'wcc-card', ['wcc-button']);
      expect(result).toContain('@supports (display: grid)');
      expect(result).toContain('@scope (wcc-card)');
    });
  });

  describe('CSS nesting', () => {
    it('nested & works inside @scope', () => {
      const css = '.parent {\n  color: red;\n  & .child { color: blue }\n}';
      const result = scopeCSS(css, 'wcc-card', ['wcc-button']);
      expect(result).toContain('& .child');
      expect(result).toContain('@scope (wcc-card)');
    });
  });

  describe('no boundaries — legacy fallback', () => {
    it('falls back to tag prefixing when no boundaries', () => {
      const result = scopeCSS('.foo { color: red }', 'wcc-card');
      expect(result).toBe('wcc-card .foo{ color: red }');
    });

    it('legacy fallback handles comma-separated selectors', () => {
      const result = scopeCSS('h1, h2 { color: blue }', 'wcc-card');
      expect(result).toBe('wcc-card h1, wcc-card h2{ color: blue }');
    });

    it('legacy fallback preserves @import', () => {
      const css = "@import url('reset.css');\n.foo { color: red }";
      const result = scopeCSS(css, 'wcc-card');
      expect(result).toContain("@import url('reset.css');");
      expect(result).toContain('wcc-card .foo');
    });
  });

  describe(':is() and :where() with commas (Bug 2 fixed)', () => {
    it(':is() no longer splits by internal commas in legacy mode', () => {
      const result = scopeCSS(':is(h1, h2) { color: blue }', 'wcc-card');
      expect(result).toBe('wcc-card :is(h1, h2){ color: blue }');
    });

    it(':where() no longer splits by internal commas in legacy mode', () => {
      const result = scopeCSS(':where(.a, .b) { margin: 0 }', 'wcc-card');
      expect(result).toBe('wcc-card :where(.a, .b){ margin: 0 }');
    });

    it(':not() with multiple args no longer splits by internal commas in legacy mode', () => {
      const result = scopeCSS(':not(.a, .b) { color: red }', 'wcc-card');
      expect(result).toBe('wcc-card :not(.a, .b){ color: red }');
    });
  });
});
