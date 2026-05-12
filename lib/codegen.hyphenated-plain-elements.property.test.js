/**
 * Property-Based Tests for codegen.js — Hyphenated tags without imports are plain elements
 *
 * Feature: explicit-component-imports
 * Property 6: Hyphenated tags without imports are plain elements
 *
 * For any hyphenated tag name in the template that does not correspond to a named
 * `.wcc` import, the compiled output SHALL NOT contain any import statement or
 * `customElements.define` call for that tag.
 *
 * **Validates: Requirements 5.1, 5.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateComponent } from './codegen.js';

// ── Arbitraries ──────────────────────────────────────────────────────

/**
 * Generate a valid kebab-case tag name (at least two segments separated by hyphen).
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
 * Generate a valid PascalCase identifier.
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
 * Generate a valid relative `.js` import path.
 */
const relativeJsPath = fc
  .tuple(
    fc.constantFrom('./', '../', '../../'),
    fc.array(
      fc.stringMatching(/^[a-z][a-z0-9-]{0,6}$/),
      { minLength: 0, maxLength: 2 }
    ),
    fc.stringMatching(/^[a-z][a-z0-9-]{1,10}$/)
  )
  .map(([prefix, middleSegments, fileName]) => {
    const middle = middleSegments.length > 0 ? middleSegments.join('/') + '/' : '';
    return `${prefix}${middle}${fileName}.js`;
  });

/**
 * Build a minimal parseResult for generateComponent.
 */
function buildParseResult(tagName, className, processedTemplate, childImports = []) {
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
    processedTemplate,
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

describe('Feature: explicit-component-imports, Property 6: Hyphenated tags without imports are plain elements', () => {
  /**
   * **Validates: Requirements 5.1, 5.3**
   *
   * When a template contains a hyphenated tag and childImports is empty,
   * the output should NOT contain any import or customElements.define for that tag.
   */
  it('hyphenated tags in template with no childImports produce no import or registration', () => {
    fc.assert(
      fc.property(
        kebabTagName, // host component tag
        kebabTagName, // hyphenated tag used in template (plain element)
        (hostTag, plainTag) => {
          // Ensure the plain tag is different from the host tag
          fc.pre(plainTag !== hostTag);

          const hostClass = hostTag
            .split('-')
            .filter((s) => s.length > 0)
            .map((s) => s[0].toUpperCase() + s.slice(1))
            .join('');

          // Template uses the hyphenated tag as a plain custom element
          const processedTemplate = `<div><${plainTag}>content</${plainTag}></div>`;

          // No childImports — the hyphenated tag is NOT imported
          const parseResult = buildParseResult(hostTag, hostClass, processedTemplate, []);
          const output = generateComponent(parseResult);

          // Output MUST NOT contain any import statement for the plain tag
          const lines = output.split('\n');
          const importLines = lines.filter((l) => l.trimStart().startsWith('import '));
          for (const line of importLines) {
            // No import line should reference the plain tag name
            expect(line).not.toContain(plainTag);
          }

          // Output MUST NOT contain any customElements.define call for the plain tag
          const defineLines = lines.filter((l) => l.includes('customElements.define'));
          for (const line of defineLines) {
            expect(line).not.toContain(`'${plainTag}'`);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 5.1, 5.3**
   *
   * When a template contains multiple hyphenated tags and none are in childImports,
   * the output should not contain imports or registrations for any of them.
   */
  it('multiple hyphenated tags without imports produce no import or registration for any', () => {
    fc.assert(
      fc.property(
        kebabTagName, // host tag
        fc.array(kebabTagName, { minLength: 1, maxLength: 4 }),
        (hostTag, plainTags) => {
          // Ensure all tags are unique and different from host
          const allTags = [hostTag, ...plainTags];
          fc.pre(new Set(allTags).size === allTags.length);

          const hostClass = hostTag
            .split('-')
            .filter((s) => s.length > 0)
            .map((s) => s[0].toUpperCase() + s.slice(1))
            .join('');

          // Template uses multiple hyphenated tags as plain custom elements
          const tagHtml = plainTags.map((t) => `<${t}></${t}>`).join('');
          const processedTemplate = `<div>${tagHtml}</div>`;

          const parseResult = buildParseResult(hostTag, hostClass, processedTemplate, []);
          const output = generateComponent(parseResult);

          const lines = output.split('\n');
          const importLines = lines.filter((l) => l.trimStart().startsWith('import '));
          const defineLines = lines.filter((l) => l.includes('customElements.define'));

          for (const plainTag of plainTags) {
            // No import references the plain tag
            for (const line of importLines) {
              expect(line).not.toContain(plainTag);
            }
            // No customElements.define references the plain tag
            for (const line of defineLines) {
              expect(line).not.toContain(`'${plainTag}'`);
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 5.1, 5.3**
   *
   * When childImports contains a named import for one tag, but the template also
   * contains OTHER hyphenated tags not in childImports, only the imported tag
   * gets an import/registration — the unimported hyphenated tags remain plain.
   */
  it('only imported tags get import/registration; unimported hyphenated tags remain plain', () => {
    fc.assert(
      fc.property(
        kebabTagName, // host tag
        kebabTagName, // plain tag (not imported)
        kebabTagName, // imported child tag
        pascalCaseIdentifier,
        relativeJsPath,
        (hostTag, plainTag, importedTag, identifier, importPath) => {
          // Ensure all tags are distinct
          fc.pre(
            hostTag !== plainTag &&
            hostTag !== importedTag &&
            plainTag !== importedTag
          );

          const hostClass = hostTag
            .split('-')
            .filter((s) => s.length > 0)
            .map((s) => s[0].toUpperCase() + s.slice(1))
            .join('');

          // Template uses both the imported tag and the plain tag
          const processedTemplate = `<div><${importedTag}></${importedTag}><${plainTag}></${plainTag}></div>`;

          // Only the importedTag is in childImports
          const childImports = [
            { tag: importedTag, identifier, importPath, sideEffect: false },
          ];

          const parseResult = buildParseResult(hostTag, hostClass, processedTemplate, childImports);
          const output = generateComponent(parseResult);

          const lines = output.split('\n');

          // The imported tag SHOULD have an import statement
          expect(output).toContain(`import ${identifier} from '${importPath}';`);

          // The imported tag SHOULD have a customElements.define call
          expect(output).toContain(`customElements.define(${identifier}.__meta.tag, ${identifier})`);

          // The plain tag MUST NOT appear in any import statement
          const importLines = lines.filter((l) => l.trimStart().startsWith('import '));
          for (const line of importLines) {
            expect(line).not.toContain(plainTag);
          }

          // The plain tag MUST NOT appear in any customElements.define call
          const defineLines = lines.filter((l) => l.includes('customElements.define'));
          for (const line of defineLines) {
            expect(line).not.toContain(`'${plainTag}'`);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
