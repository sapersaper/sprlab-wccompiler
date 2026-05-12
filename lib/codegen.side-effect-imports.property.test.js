/**
 * Property-Based Tests for codegen.js — Side-effect import handling
 *
 * Feature: explicit-component-imports
 * Property 10: Side-effect import handling
 *
 * For any side-effect `.wcc` import (`import './child.wcc'`), the compiled output
 * SHALL contain `import './child.js'` (with `.wcc` → `.js` rewrite) and SHALL NOT
 * contain any `customElements.define` call for that import, regardless of whether
 * a named import or PascalCase tag also exists in the same file.
 *
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 9.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateComponent } from './codegen.js';

// ── Arbitraries ──────────────────────────────────────────────────────

/**
 * Generate a valid path segment (lowercase letters, digits, hyphens, underscores).
 */
const pathSegment = fc
  .tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.array(
      fc.oneof(
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
        fc.constantFrom(...'0123456789'.split('')),
        fc.constant('-'),
        fc.constant('_')
      ),
      { minLength: 0, maxLength: 12 }
    )
  )
  .map(([first, rest]) => first + rest.join(''));

/**
 * Generate a valid relative `.js` import path (already compiled).
 */
const relativeJsPath = fc
  .tuple(
    fc.oneof(
      fc.constant('./'),
      fc.constant('../'),
      fc.constant('../../')
    ),
    fc.array(pathSegment, { minLength: 0, maxLength: 2 }),
    pathSegment
  )
  .map(([prefix, middleSegments, fileName]) => {
    const middle = middleSegments.length > 0 ? middleSegments.join('/') + '/' : '';
    return `${prefix}${middle}${fileName}.js`;
  });

/**
 * Generate a valid PascalCase identifier for named imports.
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
      { minLength: 2, maxLength: 10 }
    )
  )
  .map(([first, rest]) => first + rest.join(''));

/**
 * Generate a valid kebab-case tag name (at least one hyphen, no trailing/leading hyphens).
 * Each segment starts with a letter and contains only lowercase alphanumeric chars.
 */
const tagSegment = fc
  .tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.array(
      fc.oneof(
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
        fc.constantFrom(...'0123456789'.split(''))
      ),
      { minLength: 0, maxLength: 6 }
    )
  )
  .map(([first, rest]) => first + rest.join(''));

const kebabTagName = fc
  .tuple(tagSegment, tagSegment)
  .map(([a, b]) => `${a}-${b}`);

/**
 * Build a minimal parseResult for generateComponent with the given childImports.
 */
function buildParseResult(tagName, className, childImports) {
  return {
    tagName,
    className,
    style: '',
    signals: [],
    computeds: [],
    effects: [],
    methods: [],
    bindings: [],
    events: [],
    processedTemplate: '<div>test</div>',
    propDefs: [],
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
    childImports,
    exposeNames: [],
    modelDefs: [],
  };
}

// ── Property Tests ───────────────────────────────────────────────────

describe('Feature: explicit-component-imports, Property 10: Side-effect import handling', () => {
  /**
   * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 9.2**
   *
   * For any side-effect import, the compiled output contains `import './path.js';`
   * and does NOT contain any `customElements.define` call referencing that path.
   */
  it('side-effect imports emit bare import statement with no customElements.define call', () => {
    fc.assert(
      fc.property(
        kebabTagName,
        relativeJsPath,
        (hostTag, importPath) => {
          const hostClass = hostTag
            .split('-')
            .filter((s) => s.length > 0)
            .map((s) => s[0].toUpperCase() + s.slice(1))
            .join('');

          const childImports = [
            { tag: '', identifier: '', importPath, sideEffect: true },
          ];

          const parseResult = buildParseResult(hostTag, hostClass, childImports);
          const output = generateComponent(parseResult);

          // Output MUST contain the side-effect import statement
          expect(output).toContain(`import '${importPath}';`);

          // Output MUST NOT contain any customElements.define call referencing this path
          // Since side-effect imports have no identifier, there should be no define call for them
          const importFileName = importPath.split('/').pop().replace('.js', '');
          // Check that no customElements.define line references the import path
          const lines = output.split('\n');
          const defineLines = lines.filter((l) => l.includes('customElements.define'));
          for (const line of defineLines) {
            // The define line should not reference the side-effect import path
            expect(line).not.toContain(importPath);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 8.4, 8.3**
   *
   * Side-effect imports coexist with named imports in the same file.
   * The named import gets a define call, but the side-effect import does not.
   */
  it('side-effect imports coexist with named imports without getting define calls', () => {
    fc.assert(
      fc.property(
        kebabTagName,
        relativeJsPath,
        pascalCaseIdentifier,
        relativeJsPath,
        (hostTag, sideEffectPath, namedIdentifier, namedPath) => {
          // Ensure paths are different
          fc.pre(sideEffectPath !== namedPath);

          const hostClass = hostTag
            .split('-')
            .filter((s) => s.length > 0)
            .map((s) => s[0].toUpperCase() + s.slice(1))
            .join('');

          const childImports = [
            { tag: '', identifier: '', importPath: sideEffectPath, sideEffect: true },
            { tag: 'child-comp', identifier: namedIdentifier, importPath: namedPath, sideEffect: false },
          ];

          const parseResult = buildParseResult(hostTag, hostClass, childImports);
          const output = generateComponent(parseResult);

          // Side-effect import is present as bare import
          expect(output).toContain(`import '${sideEffectPath}';`);

          // Named import is present with identifier
          expect(output).toContain(`import ${namedIdentifier} from '${namedPath}';`);

          // Named import has a customElements.define call
          expect(output).toContain(`customElements.define(${namedIdentifier}.__meta.tag, ${namedIdentifier})`);

          // No customElements.define call references the side-effect path
          const lines = output.split('\n');
          const defineLines = lines.filter((l) => l.includes('customElements.define'));
          for (const line of defineLines) {
            expect(line).not.toContain(sideEffectPath);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 8.1, 9.2**
   *
   * Multiple side-effect imports all appear in the output as bare imports
   * with no define calls for any of them.
   */
  it('multiple side-effect imports all emit bare import statements', () => {
    fc.assert(
      fc.property(
        kebabTagName,
        fc.array(relativeJsPath, { minLength: 1, maxLength: 4 }),
        (hostTag, paths) => {
          // Ensure all paths are unique
          fc.pre(new Set(paths).size === paths.length);

          const hostClass = hostTag
            .split('-')
            .filter((s) => s.length > 0)
            .map((s) => s[0].toUpperCase() + s.slice(1))
            .join('');

          const childImports = paths.map((p) => ({
            tag: '',
            identifier: '',
            importPath: p,
            sideEffect: true,
          }));

          const parseResult = buildParseResult(hostTag, hostClass, childImports);
          const output = generateComponent(parseResult);

          // Each side-effect import appears as a bare import
          for (const p of paths) {
            expect(output).toContain(`import '${p}';`);
          }

          // The only customElements.define call should be the self-registration
          const lines = output.split('\n');
          const defineLines = lines.filter((l) => l.includes('customElements.define'));
          // All define lines should reference the host component's own tag, not any import path
          for (const line of defineLines) {
            for (const p of paths) {
              expect(line).not.toContain(p);
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
