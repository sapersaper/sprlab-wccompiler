/**
 * Property-based tests for template-normalizer.js — dynamic component preservation
 *
 * Property 1: Template normalizer preserves `<component>` tags
 * For any template HTML string containing `<component` tags (with any combination
 * of attributes), calling `normalizeTemplate` SHALL return a string where all
 * `<component` tags remain unchanged — no kebab-case conversion, no self-closing
 * expansion, no PascalCase import resolution.
 *
 * **Validates: Requirements 1.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { normalizeTemplate } from './template-normalizer.js';

// ── Arbitraries ──────────────────────────────────────────────────────

/**
 * Generate a valid attribute name (lowercase letters and hyphens, starting with a letter).
 */
const attrName = fc
  .tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.array(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-0123456789'.split('')),
      { minLength: 1, maxLength: 8 }
    )
  )
  .map(([first, rest]) => first + rest.join(''));

/**
 * Generate a simple attribute value (alphanumeric with common expression chars).
 */
const attrValue = fc
  .array(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789._()'.split('')),
    { minLength: 1, maxLength: 15 }
  )
  .map((chars) => chars.join(''));

/**
 * Generate a single attribute string in one of these forms:
 * - :attr="expr" (prop binding)
 * - @event="handler" (event binding)
 * - plain="value" (plain attribute)
 */
const attribute = fc.oneof(
  // Prop binding: :attr="expr"
  fc.tuple(attrName, attrValue).map(([name, val]) => `:${name}="${val}"`),
  // Event binding: @event="handler"
  fc.tuple(attrName, attrValue).map(([name, val]) => `@${name}="${val}"`),
  // Plain attribute: attr="value"
  fc.tuple(attrName, attrValue).map(([name, val]) => `${name}="${val}"`)
);

/**
 * Generate a list of attributes (0 to 5) for a <component> element.
 * Always includes :is as the first attribute to keep the tag semantically valid.
 */
const attributeList = fc
  .tuple(
    attrValue, // value for :is
    fc.array(attribute, { minLength: 0, maxLength: 5 })
  )
  .map(([isVal, extras]) => {
    const attrs = [`:is="${isVal}"`, ...extras];
    return attrs.join(' ');
  });

/**
 * Generate a <component> element with arbitrary attributes.
 */
const componentTag = attributeList.map(
  (attrs) => `<component ${attrs}></component>`
);

/**
 * Generate a template containing a <component> element wrapped in a container div.
 */
const templateWithComponent = componentTag.map(
  (tag) => `<div class="wrapper">${tag}</div>`
);

// ── Property Tests ───────────────────────────────────────────────────

describe('Feature: dynamic-component, Property 1: Template normalizer preserves `<component>` tags', () => {
  it('normalizeTemplate preserves <component> tags unchanged for any attribute combination', () => {
    fc.assert(
      fc.property(
        templateWithComponent,
        (html) => {
          const result = normalizeTemplate(html);

          // The output must still contain the <component tag
          expect(result).toContain('<component ');
          // The output must still contain the closing </component> tag
          expect(result).toContain('</component>');
        }
      ),
      { numRuns: 20 }
    );
  });

  it('normalizeTemplate returns the <component> tag content exactly as provided', () => {
    fc.assert(
      fc.property(
        componentTag,
        (tag) => {
          const html = `<div>${tag}</div>`;
          const result = normalizeTemplate(html);

          // The component tag should appear in the output unchanged
          expect(result).toContain(tag);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('normalizeTemplate does not apply self-closing expansion to <component /> tags', () => {
    fc.assert(
      fc.property(
        attributeList,
        (attrs) => {
          const selfClosingTag = `<component ${attrs} />`;
          const html = `<div>${selfClosingTag}</div>`;
          const result = normalizeTemplate(html);

          // Self-closing <component /> should be preserved as-is (not expanded)
          expect(result).toContain(selfClosingTag);
        }
      ),
      { numRuns: 20 }
    );
  });
});
