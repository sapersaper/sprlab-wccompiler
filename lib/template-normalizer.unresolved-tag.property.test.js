/**
 * Property-based tests for template-normalizer.js
 *
 * Property 7: Unresolved PascalCase tag error
 *
 * For any PascalCase tag in the template (including inside `if`/`else-if`/`else`
 * branches and `each` blocks) that does not match any named `.wcc` import identifier,
 * the compiler SHALL throw an error whose message contains both the unresolved tag
 * name and the source file path.
 *
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { normalizeTemplate } from './template-normalizer.js';

// ── Arbitraries ──────────────────────────────────────────────────────

/**
 * Generate a valid PascalCase tag name:
 * - Starts with an uppercase letter
 * - Contains at least one more uppercase letter (word boundary)
 * - Only alphanumeric characters
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
  .map(([first, mid, upper, tail]) => first + mid.join('') + upper + tail.join(''));

/**
 * Generate a file name for error messages.
 */
const fileName = fc
  .tuple(
    fc.constantFrom('src/', 'lib/', 'components/', './'),
    fc.array(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-'.split('')),
      { minLength: 1, maxLength: 15 }
    )
  )
  .map(([prefix, chars]) => `${prefix}${chars.join('')}.wcc`);

/**
 * Generate an import map that does NOT contain the given tag.
 * We create a small map with different PascalCase keys.
 */
const importMapWithout = (excludeTag) =>
  fc
    .array(
      fc.tuple(
        pascalCaseTag,
        fc.stringOf(
          fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-'.split('')),
          { minLength: 3, maxLength: 12 }
        )
      ),
      { minLength: 0, maxLength: 3 }
    )
    .map((entries) => {
      const map = new Map();
      for (const [key, val] of entries) {
        if (key !== excludeTag) {
          map.set(key, val);
        }
      }
      return map;
    });

// ── Property 7 Tests ─────────────────────────────────────────────────

describe('Feature: explicit-component-imports, Property 7: Unresolved PascalCase tag error', () => {
  it('throws UNRESOLVED_COMPONENT error for PascalCase tags not in the import map', () => {
    fc.assert(
      fc.property(
        pascalCaseTag,
        fileName,
        (tag, file) => {
          // Create an empty import map (tag is guaranteed not to be in it)
          const importMap = new Map();
          const html = `<${tag}></${tag}>`;

          expect(() => normalizeTemplate(html, { importMap, fileName: file })).toThrow();

          try {
            normalizeTemplate(html, { importMap, fileName: file });
          } catch (error) {
            // Error must have the correct code
            expect(error.code).toBe('UNRESOLVED_COMPONENT');
            // Error message must contain the unresolved tag name
            expect(error.message).toContain(tag);
            // Error message must contain the source file path
            expect(error.message).toContain(file);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('throws UNRESOLVED_COMPONENT error for self-closing PascalCase tags not in the import map', () => {
    fc.assert(
      fc.property(
        pascalCaseTag,
        fileName,
        (tag, file) => {
          const importMap = new Map();
          const html = `<${tag} />`;

          expect(() => normalizeTemplate(html, { importMap, fileName: file })).toThrow();

          try {
            normalizeTemplate(html, { importMap, fileName: file });
          } catch (error) {
            expect(error.code).toBe('UNRESOLVED_COMPONENT');
            expect(error.message).toContain(tag);
            expect(error.message).toContain(file);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('throws UNRESOLVED_COMPONENT when tag is not in a non-empty import map', () => {
    fc.assert(
      fc.property(
        pascalCaseTag,
        fileName,
        (tag, file) => {
          // Build an import map that explicitly does NOT contain the generated tag
          const importMap = new Map([
            ['OtherWidget', 'other-widget'],
            ['AnotherComp', 'another-comp'],
          ]);
          // Ensure our generated tag is not accidentally one of the map keys
          fc.pre(!importMap.has(tag));

          const html = `<div><${tag} label="test"></${tag}></div>`;

          expect(() => normalizeTemplate(html, { importMap, fileName: file })).toThrow();

          try {
            normalizeTemplate(html, { importMap, fileName: file });
          } catch (error) {
            expect(error.code).toBe('UNRESOLVED_COMPONENT');
            expect(error.message).toContain(tag);
            expect(error.message).toContain(file);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('throws UNRESOLVED_COMPONENT for PascalCase tags inside conditional/each blocks', () => {
    fc.assert(
      fc.property(
        pascalCaseTag,
        fileName,
        fc.constantFrom(
          (tag) => `{#if condition}<${tag} />{/if}`,
          (tag) => `{#if x}text{:else}<${tag} />{/if}`,
          (tag) => `{#each items as item}<${tag} />{/each}`,
          (tag) => `{#if a}<${tag}></${tag}>{:else if b}text{/if}`
        ),
        (tag, file, templateFn) => {
          const importMap = new Map();
          const html = templateFn(tag);

          expect(() => normalizeTemplate(html, { importMap, fileName: file })).toThrow();

          try {
            normalizeTemplate(html, { importMap, fileName: file });
          } catch (error) {
            expect(error.code).toBe('UNRESOLVED_COMPONENT');
            expect(error.message).toContain(tag);
            expect(error.message).toContain(file);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
