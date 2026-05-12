/**
 * Property-based tests for template-normalizer.js
 *
 * Property 2: PascalCase tag exact-case resolution
 * For any set of named `.wcc` imports and any PascalCase tag in the template,
 * the tag SHALL resolve to an import if and only if the tag name exactly matches
 * (case-sensitive) one of the import identifiers.
 *
 * **Validates: Requirements 2.1, 2.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { normalizeTemplate, pascalToKebab } from './template-normalizer.js';

// ── Arbitraries ──────────────────────────────────────────────────────

/**
 * Generate a valid PascalCase identifier that satisfies isPascalCase():
 * - Starts with an uppercase letter
 * - Contains at least one more uppercase letter (word boundary)
 * - Only alphanumeric characters
 */
const pascalCaseIdentifier = fc
  .tuple(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    fc.array(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
      { minLength: 1, maxLength: 8 }
    ),
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    fc.array(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
      { minLength: 1, maxLength: 8 }
    )
  )
  .map(([first, mid, upper, tail]) => first + mid.join('') + upper + tail.join(''));

/**
 * Generate a kebab-case tag name (lowercase with hyphens).
 */
const kebabCaseTag = fc
  .tuple(
    fc.array(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
      { minLength: 2, maxLength: 6 }
    ),
    fc.array(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
      { minLength: 2, maxLength: 6 }
    )
  )
  .map(([first, second]) => first.join('') + '-' + second.join(''));

/**
 * Generate an import map entry: [PascalCase identifier, kebab-case tag].
 */
const importMapEntry = fc
  .tuple(pascalCaseIdentifier, kebabCaseTag)
  .filter(([id, tag]) => id.length >= 4 && tag.length >= 5);

/**
 * Generate a non-empty import map (Map<string, string>).
 */
const importMapArb = fc
  .array(importMapEntry, { minLength: 1, maxLength: 5 })
  .filter((entries) => {
    const ids = entries.map(([id]) => id);
    return new Set(ids).size === ids.length;
  })
  .map((entries) => new Map(entries));

// ── Property Tests ───────────────────────────────────────────────────

describe('Feature: explicit-component-imports, Property 2: PascalCase tag exact-case resolution', () => {
  it('a PascalCase tag resolves when it exactly matches an import map key (case-sensitive)', () => {
    fc.assert(
      fc.property(
        importMapArb,
        (importMap) => {
          // Pick a random key from the import map
          const entries = [...importMap.entries()];
          const [tagName, expectedKebab] = entries[0];

          const html = `<${tagName}></${tagName}>`;
          const result = normalizeTemplate(html, { importMap, fileName: 'test.wcc' });

          // The tag should be resolved to the kebab-case form from the import map
          expect(result).toContain(`<${expectedKebab}>`);
          expect(result).toContain(`</${expectedKebab}>`);
          // The original PascalCase tag should NOT appear in the output
          expect(result).not.toContain(`<${tagName}>`);
          expect(result).not.toContain(`</${tagName}>`);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('a PascalCase tag that does NOT match any import key throws UNRESOLVED_COMPONENT', () => {
    fc.assert(
      fc.property(
        importMapArb,
        pascalCaseIdentifier,
        (importMap, extraTag) => {
          // Ensure the extra tag is NOT in the import map
          fc.pre(!importMap.has(extraTag));

          const html = `<${extraTag}></${extraTag}>`;

          expect(() => normalizeTemplate(html, { importMap, fileName: 'test.wcc' })).toThrow();

          try {
            normalizeTemplate(html, { importMap, fileName: 'test.wcc' });
          } catch (error) {
            expect(error.code).toBe('UNRESOLVED_COMPONENT');
            expect(error.message).toContain(extraTag);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('resolution is case-sensitive: changing case of a matching tag causes UNRESOLVED_COMPONENT', () => {
    fc.assert(
      fc.property(
        importMapArb,
        (importMap) => {
          const entries = [...importMap.entries()];
          const [tagName] = entries[0];

          // Flip the case of one character to create a mismatch
          // Find the first lowercase char and uppercase it, or vice versa
          let mutated = '';
          let flipped = false;
          for (const ch of tagName) {
            if (!flipped && ch >= 'a' && ch <= 'z') {
              mutated += ch.toUpperCase();
              flipped = true;
            } else if (!flipped && ch >= 'A' && ch <= 'Z' && mutated.length > 0) {
              mutated += ch.toLowerCase();
              flipped = true;
            } else {
              mutated += ch;
            }
          }

          // Only test if we actually mutated and the mutated version is not in the map
          // and the mutated version is still PascalCase (starts with uppercase, has another uppercase)
          fc.pre(flipped);
          fc.pre(mutated !== tagName);
          fc.pre(!importMap.has(mutated));
          fc.pre(/^[A-Z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*$/.test(mutated));

          const html = `<${mutated}></${mutated}>`;

          expect(() => normalizeTemplate(html, { importMap, fileName: 'test.wcc' })).toThrow();

          try {
            normalizeTemplate(html, { importMap, fileName: 'test.wcc' });
          } catch (error) {
            expect(error.code).toBe('UNRESOLVED_COMPONENT');
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('tag resolves if and only if it exactly matches an import key (biconditional)', () => {
    fc.assert(
      fc.property(
        importMapArb,
        pascalCaseIdentifier,
        (importMap, tag) => {
          const html = `<${tag}></${tag}>`;

          if (importMap.has(tag)) {
            // Tag matches → should resolve without error
            const result = normalizeTemplate(html, { importMap, fileName: 'test.wcc' });
            const expectedKebab = importMap.get(tag);
            expect(result).toContain(`<${expectedKebab}>`);
          } else {
            // Tag does NOT match → should throw UNRESOLVED_COMPONENT
            try {
              normalizeTemplate(html, { importMap, fileName: 'test.wcc' });
              // If it didn't throw, fail the test
              expect.fail('Expected UNRESOLVED_COMPONENT error but normalizeTemplate succeeded');
            } catch (error) {
              expect(error.code).toBe('UNRESOLVED_COMPONENT');
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
