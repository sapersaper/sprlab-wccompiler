/**
 * Property-based tests for template-normalizer.js
 *
 * Property 3: Self-closing equivalence
 * For any valid component usage in a template, the compiled output produced from
 * a self-closing tag (`<Badge />`) SHALL be identical to the compiled output
 * produced from the equivalent open/close pair (`<Badge></Badge>`).
 *
 * **Validates: Requirements 2.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { normalizeTemplate } from './template-normalizer.js';

// ── Arbitraries ──────────────────────────────────────────────────────

/**
 * Generate a valid PascalCase identifier (at least two uppercase letters
 * to satisfy the isPascalCase check in template-normalizer).
 */
const pascalCaseTag = fc
  .tuple(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    fc.array(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
      { minLength: 1, maxLength: 8 }
    ),
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    fc.array(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
      { minLength: 1, maxLength: 8 }
    )
  )
  .map(([first, mid, second, tail]) => first + mid.join('') + second + tail.join(''));

/**
 * Generate a kebab-case tag name corresponding to a PascalCase identifier.
 * We generate the pair together to ensure the importMap is consistent.
 */
const componentPair = pascalCaseTag.map((pascal) => {
  // Convert PascalCase to kebab-case
  const kebab = pascal
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
  return { pascal, kebab };
});

/**
 * Generate a simple HTML attribute (e.g., `label="hello"`, `count="5"`).
 */
const htmlAttribute = fc
  .tuple(
    fc.constantFrom('label', 'count', 'name', 'title', 'value', 'id', 'class', 'type'),
    fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-zA-Z0-9 _-]+$/.test(s))
  )
  .map(([key, val]) => `${key}="${val}"`);

/**
 * Generate a list of 0-3 HTML attributes.
 */
const htmlAttributes = fc
  .array(htmlAttribute, { minLength: 0, maxLength: 3 })
  .map((attrs) => (attrs.length > 0 ? ' ' + attrs.join(' ') : ''));

// ── Property Tests ───────────────────────────────────────────────────

describe('Feature: explicit-component-imports, Property 3: Self-closing equivalence', () => {
  it('self-closing PascalCase tag produces identical output to open/close pair (with importMap)', () => {
    fc.assert(
      fc.property(
        componentPair,
        htmlAttributes,
        ({ pascal, kebab }, attrs) => {
          const importMap = new Map([[pascal, kebab]]);
          const options = { importMap, fileName: 'test.wcc' };

          // Self-closing form
          const selfClosingInput = `<${pascal}${attrs} />`;
          const selfClosingOutput = normalizeTemplate(selfClosingInput, options);

          // Open/close pair form
          const openCloseInput = `<${pascal}${attrs}></${pascal}>`;
          const openCloseOutput = normalizeTemplate(openCloseInput, options);

          // Both forms must produce identical output
          expect(selfClosingOutput).toBe(openCloseOutput);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('self-closing PascalCase tag produces identical output to open/close pair (without importMap)', () => {
    fc.assert(
      fc.property(
        pascalCaseTag,
        htmlAttributes,
        (tag, attrs) => {
          // Without importMap, all PascalCase tags are converted to kebab-case
          const options = { fileName: 'test.wcc' };

          // Self-closing form
          const selfClosingInput = `<${tag}${attrs} />`;
          const selfClosingOutput = normalizeTemplate(selfClosingInput, options);

          // Open/close pair form
          const openCloseInput = `<${tag}${attrs}></${tag}>`;
          const openCloseOutput = normalizeTemplate(openCloseInput, options);

          // Both forms must produce identical output
          expect(selfClosingOutput).toBe(openCloseOutput);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('self-closing tag with attributes produces same normalized output as open/close with same attributes', () => {
    fc.assert(
      fc.property(
        componentPair,
        fc.array(htmlAttribute, { minLength: 1, maxLength: 3 }),
        ({ pascal, kebab }, attrList) => {
          const importMap = new Map([[pascal, kebab]]);
          const options = { importMap, fileName: 'test.wcc' };
          const attrsStr = ' ' + attrList.join(' ');

          // Self-closing form
          const selfClosingOutput = normalizeTemplate(
            `<${pascal}${attrsStr} />`,
            options
          );

          // Open/close pair form
          const openCloseOutput = normalizeTemplate(
            `<${pascal}${attrsStr}></${pascal}>`,
            options
          );

          // Both must produce identical output
          expect(selfClosingOutput).toBe(openCloseOutput);

          // Output should contain the kebab-case tag (not PascalCase)
          expect(selfClosingOutput).toContain(`<${kebab}`);
          expect(selfClosingOutput).toContain(`</${kebab}>`);
          expect(selfClosingOutput).not.toContain(pascal);
        }
      ),
      { numRuns: 20 }
    );
  });
});
