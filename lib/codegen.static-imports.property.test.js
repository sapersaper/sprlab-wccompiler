/**
 * Property-based test for codegen: Property 8 — Static imports only
 *
 * Verifies that compiled output from generateComponent() uses only static
 * `import` declarations (no dynamic `import()` expressions) for child
 * component references.
 *
 * **Validates: Requirements 7.1, 7.4**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateComponent } from './codegen.js';

// ── Generators ───────────────────────────────────────────────────────

/** Generate a valid kebab-case tag name like 'wcc-xxx' */
const arbTagName = fc
  .tuple(
    fc.stringMatching(/^[a-z]{2,6}$/),
    fc.stringMatching(/^[a-z]{2,6}$/)
  )
  .map(([a, b]) => `${a}-${b}`);

/** Convert kebab-case to PascalCase */
function toClassName(tag) {
  return tag
    .split('-')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

/** Generate a valid PascalCase identifier for child component imports */
const arbPascalIdentifier = fc
  .tuple(
    fc.stringMatching(/^[A-Z][a-z]{1,5}$/),
    fc.stringMatching(/^[A-Z][a-z]{1,5}$/)
  )
  .map(([a, b]) => a + b);

/** Generate a relative .js import path */
const arbImportPath = fc
  .tuple(
    fc.constantFrom('./', '../', './nested/', '../shared/'),
    fc.stringMatching(/^[a-z][a-z0-9-]{1,8}$/)
  )
  .map(([prefix, name]) => `${prefix}${name}.js`);

/** Generate a named child import (non-side-effect) */
const arbNamedChildImport = fc.record({
  identifier: arbPascalIdentifier,
  tag: fc.stringMatching(/^[a-z]{2,5}-[a-z]{2,5}$/),
  importPath: arbImportPath,
  sideEffect: fc.constant(false),
});

/** Generate a side-effect child import */
const arbSideEffectChildImport = fc.record({
  importPath: arbImportPath,
  sideEffect: fc.constant(true),
});

/** Generate a mixed array of child imports (named + side-effect) */
const arbChildImports = fc
  .tuple(
    fc.array(arbNamedChildImport, { minLength: 0, maxLength: 3 }),
    fc.array(arbSideEffectChildImport, { minLength: 0, maxLength: 2 })
  )
  .map(([named, sideEffect]) => {
    // Deduplicate identifiers
    const usedIds = new Set();
    const dedupNamed = named.filter(ci => {
      if (usedIds.has(ci.identifier)) return false;
      usedIds.add(ci.identifier);
      return true;
    });
    return [...dedupNamed, ...sideEffect];
  });

/**
 * Generate a minimal valid ParseResult IR with childImports.
 * The component itself is minimal — we're testing the import output.
 */
const arbParseResultWithImports = fc
  .record({
    tagName: arbTagName,
    childImports: arbChildImports,
  })
  .map(({ tagName, childImports }) => ({
    tagName,
    className: toClassName(tagName),
    template: '<div>test</div>',
    style: '',
    signals: [],
    computeds: [],
    effects: [],
    methods: [],
    bindings: [],
    events: [],
    processedTemplate: '<div>test</div>',
    childImports,
  }));

// ── Property Tests ───────────────────────────────────────────────────

describe('Feature: explicit-component-imports, Property 8: Static imports only', () => {
  /**
   * **Validates: Requirements 7.1, 7.4**
   *
   * For all compiled outputs, child component references SHALL use only
   * static `import` declarations (no dynamic `import()` expressions).
   */
  it('compiled output contains only static import declarations, never dynamic import()', () => {
    fc.assert(
      fc.property(arbParseResultWithImports, (ir) => {
        const output = generateComponent(ir);

        // Regex to detect dynamic import() expressions:
        // Matches `import(` that is NOT preceded by the word boundary of a static import keyword
        // Dynamic imports look like: import('...') or import("...")
        // Static imports look like: import X from '...' or import '...'
        const dynamicImportPattern = /\bimport\s*\(/g;
        const matches = output.match(dynamicImportPattern);

        expect(matches).toBeNull();

        // Verify that all import statements in the output are static declarations
        // Static imports start at the beginning of a line with `import`
        const lines = output.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('import')) {
            // Must be a static import declaration, not a dynamic import()
            // Static forms: `import X from '...'` or `import '...'` or `import { X } from '...'`
            expect(trimmed).not.toMatch(/^import\s*\(/);
          }
        }

        // Additionally verify that named imports use the correct static form
        for (const ci of ir.childImports) {
          if (ci.sideEffect) {
            expect(output).toContain(`import '${ci.importPath}';`);
          } else {
            expect(output).toContain(`import ${ci.identifier} from '${ci.importPath}';`);
          }
        }
      }),
      { numRuns: 20 }
    );
  });
});
