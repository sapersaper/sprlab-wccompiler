/**
 * Property-based tests for codegen.js
 *
 * Property 4: Guarded child registration for matched imports
 * For any named `.wcc` import that is used as a PascalCase tag in the template,
 * the compiled output SHALL contain both a named ES import statement
 * (`import Identifier from './path.js'`) and a guarded `customElements.define`
 * call using `Identifier.__meta.tag`.
 *
 * **Validates: Requirements 2.2, 3.2, 3.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateComponent } from './codegen.js';

// ── Arbitraries ──────────────────────────────────────────────────────

/**
 * Generate a valid PascalCase identifier (used as the import name).
 * Starts with uppercase, followed by mixed-case alphanumeric chars.
 */
const pascalCaseIdentifier = fc
  .tuple(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    fc.array(
      fc.oneof(
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
        fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
        fc.constantFrom(...'0123456789'.split(''))
      ),
      { minLength: 2, maxLength: 12 }
    )
  )
  .map(([first, rest]) => first + rest.join(''));

/**
 * Generate a valid kebab-case tag name (at least two segments separated by hyphen).
 */
const kebabCaseTag = fc
  .tuple(
    fc.stringMatching(/^[a-z][a-z0-9]{1,6}$/),
    fc.stringMatching(/^[a-z][a-z0-9]{1,6}$/)
  )
  .map(([prefix, suffix]) => `${prefix}-${suffix}`);

/**
 * Generate a valid relative .js import path.
 */
const relativeJsPath = fc
  .tuple(
    fc.constantFrom('./', '../', '../../'),
    fc.array(
      fc.stringMatching(/^[a-z][a-z0-9-]{0,8}$/),
      { minLength: 0, maxLength: 2 }
    ),
    fc.stringMatching(/^[a-z][a-z0-9-]{1,10}$/)
  )
  .map(([prefix, middleSegments, fileName]) => {
    const middle = middleSegments.length > 0 ? middleSegments.join('/') + '/' : '';
    return `${prefix}${middle}${fileName}.js`;
  });

/**
 * Generate a minimal parseResult with a single named child import (sideEffect: false).
 */
const arbNamedChildImport = fc
  .tuple(pascalCaseIdentifier, kebabCaseTag, relativeJsPath)
  .map(([identifier, tag, importPath]) => ({
    identifier,
    tag,
    importPath,
  }));

/**
 * Build a minimal parseResult suitable for generateComponent with childImports.
 */
function buildParseResult(childImports) {
  return {
    tagName: 'wcc-test',
    className: 'WccTest',
    template: '<div></div>',
    style: '',
    signals: [],
    computeds: [],
    effects: [],
    methods: [],
    bindings: [],
    events: [],
    processedTemplate: '<div></div>',
    propDefs: [],
    emits: [],
    ifBlocks: [],
    showBindings: [],
    forBlocks: [],
    onMountHooks: [],
    onDestroyHooks: [],
    onAdoptHooks: [],
    modelBindings: [],
    modelPropBindings: [],
    attrBindings: [],
    slots: [],
    constantVars: [],
    watchers: [],
    refs: [],
    refBindings: [],
    childComponents: [],
    childImports: childImports.map((ci) => ({
      tag: ci.tag,
      identifier: ci.identifier,
      importPath: ci.importPath,
      sideEffect: false,
    })),
    exposeNames: [],
    modelDefs: [],
  };
}

// ── Property Tests ───────────────────────────────────────────────────

describe('Feature: explicit-component-imports, Property 4: Guarded child registration', () => {
  it('compiled output contains a named import statement for each named child import', () => {
    fc.assert(
      fc.property(arbNamedChildImport, ({ identifier, tag, importPath }) => {
        const parseResult = buildParseResult([{ identifier, tag, importPath }]);
        const output = generateComponent(parseResult);

        // Must contain: import Identifier from './path.js';
        const expectedImport = `import ${identifier} from '${importPath}';`;
        expect(output).toContain(expectedImport);
      }),
      { numRuns: 20 }
    );
  });

  it('compiled output contains a guarded customElements.define using Identifier.__meta.tag', () => {
    fc.assert(
      fc.property(arbNamedChildImport, ({ identifier, tag, importPath }) => {
        const parseResult = buildParseResult([{ identifier, tag, importPath }]);
        const output = generateComponent(parseResult);

        // Must contain: if (!customElements.get(Identifier.__meta.tag)) customElements.define(Identifier.__meta.tag, Identifier);
        const expectedGuard = `if (!customElements.get(${identifier}.__meta.tag)) customElements.define(${identifier}.__meta.tag, ${identifier});`;
        expect(output).toContain(expectedGuard);
      }),
      { numRuns: 20 }
    );
  });

  it('compiled output contains both named import AND guarded registration for every named child import', () => {
    fc.assert(
      fc.property(
        fc.array(arbNamedChildImport, { minLength: 1, maxLength: 4 }).filter(
          (imports) => new Set(imports.map((i) => i.identifier)).size === imports.length
        ),
        (childImports) => {
          const parseResult = buildParseResult(childImports);
          const output = generateComponent(parseResult);

          for (const { identifier, importPath } of childImports) {
            // Named import statement present
            const expectedImport = `import ${identifier} from '${importPath}';`;
            expect(output).toContain(expectedImport);

            // Guarded registration present
            const expectedGuard = `if (!customElements.get(${identifier}.__meta.tag)) customElements.define(${identifier}.__meta.tag, ${identifier});`;
            expect(output).toContain(expectedGuard);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('the guarded registration line immediately follows the named import line', () => {
    fc.assert(
      fc.property(arbNamedChildImport, ({ identifier, tag, importPath }) => {
        const parseResult = buildParseResult([{ identifier, tag, importPath }]);
        const output = generateComponent(parseResult);

        const importLine = `import ${identifier} from '${importPath}';`;
        const guardLine = `if (!customElements.get(${identifier}.__meta.tag)) customElements.define(${identifier}.__meta.tag, ${identifier});`;

        const lines = output.split('\n');
        const importIdx = lines.indexOf(importLine);
        const guardIdx = lines.indexOf(guardLine);

        // Both lines must exist
        expect(importIdx).toBeGreaterThanOrEqual(0);
        expect(guardIdx).toBeGreaterThanOrEqual(0);

        // Guard immediately follows import
        expect(guardIdx).toBe(importIdx + 1);
      }),
      { numRuns: 20 }
    );
  });
});
