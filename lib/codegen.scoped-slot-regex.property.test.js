/**
 * Property-Based Tests for scoped slot interpolation regex.
 *
 * Feature: Cross-Framework Scoped Slots
 * Property: Interpolation equivalence — for any valid prop name and value,
 * both {{prop}} and {%prop%} produce identical output.
 *
 * **Validates: Requirements 5.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Build the same regex the generated code uses for a given prop name.
 * Mirrors the pattern emitted by codegen.js:
 *   new RegExp('(?:\\{\\{|\\{%)\\s*' + k + '(\\(\\))?\\s*(?:\\}\\}|%\\})', 'g')
 */
function buildSlotPropRegex(propName) {
  return new RegExp('(?:\\{\\{|\\{%)\\s*' + propName + '(\\(\\))?\\s*(?:\\}\\}|%\\})', 'g');
}

/**
 * Simulate the runtime replacement loop for a template string with given props.
 */
function replaceSlotProps(template, props) {
  let html = template;
  for (const [k, v] of Object.entries(props)) {
    html = html.replace(buildSlotPropRegex(k), v ?? '');
  }
  return html;
}

// ── Generators ──────────────────────────────────────────────────────

/**
 * Generator for valid prop names: starts with a letter, followed by
 * alphanumeric characters or underscores. Length 1–20.
 */
const arbPropName = fc
  .tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    fc.array(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'.split('')),
      { minLength: 0, maxLength: 19 }
    )
  )
  .map(([first, rest]) => first + rest.join(''));

/**
 * Generator for prop values: any string that doesn't contain sequences
 * that look like interpolation tokens (to avoid nested replacement issues)
 * or dollar-sign patterns ($&, $`, $', $1, etc.) which are special
 * replacement patterns in String.prototype.replace().
 */
const arbPropValue = fc.string({ minLength: 0, maxLength: 100 }).map((s) =>
  s.replace(/\{\{/g, '').replace(/\}\}/g, '').replace(/\{%/g, '').replace(/%\}/g, '').replace(/\$/g, '')
);

/**
 * Generator for surrounding template content that doesn't contain
 * interpolation tokens.
 */
const arbSurrounding = fc.string({ minLength: 0, maxLength: 50 }).map((s) =>
  s.replace(/\{\{/g, '').replace(/\}\}/g, '').replace(/\{%/g, '').replace(/%\}/g, '')
);

// ── Property Tests ──────────────────────────────────────────────────

describe('Feature: Cross-Framework Scoped Slots, Property: Interpolation Equivalence', () => {
  /**
   * **Validates: Requirements 5.5**
   *
   * For any valid prop name and any string value, replacing {{propName}} in a
   * template produces the same result as replacing {%propName%} in an equivalent
   * template.
   */
  it('{{prop}} and {%prop%} produce identical output for any prop name and value', () => {
    fc.assert(
      fc.property(
        arbPropName,
        arbPropValue,
        arbSurrounding,
        arbSurrounding,
        (propName, propValue, before, after) => {
          const templateMustache = `${before}{{${propName}}}${after}`;
          const templateEscape = `${before}{%${propName}%}${after}`;

          const props = { [propName]: propValue };

          const resultMustache = replaceSlotProps(templateMustache, props);
          const resultEscape = replaceSlotProps(templateEscape, props);

          expect(resultMustache).toBe(resultEscape);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 5.5**
   *
   * For any valid prop name and value, both syntaxes with internal whitespace
   * produce identical output.
   */
  it('{{ prop }} and {% prop %} (with whitespace) produce identical output', () => {
    fc.assert(
      fc.property(
        arbPropName,
        arbPropValue,
        arbSurrounding,
        arbSurrounding,
        (propName, propValue, before, after) => {
          const templateMustache = `${before}{{ ${propName} }}${after}`;
          const templateEscape = `${before}{% ${propName} %}${after}`;

          const props = { [propName]: propValue };

          const resultMustache = replaceSlotProps(templateMustache, props);
          const resultEscape = replaceSlotProps(templateEscape, props);

          expect(resultMustache).toBe(resultEscape);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 5.5**
   *
   * For any valid prop name and value, both syntaxes with parentheses
   * (method-style) produce identical output.
   */
  it('{{prop()}} and {%prop()%} produce identical output', () => {
    fc.assert(
      fc.property(
        arbPropName,
        arbPropValue,
        arbSurrounding,
        arbSurrounding,
        (propName, propValue, before, after) => {
          const templateMustache = `${before}{{${propName}()}}${after}`;
          const templateEscape = `${before}{%${propName}()%}${after}`;

          const props = { [propName]: propValue };

          const resultMustache = replaceSlotProps(templateMustache, props);
          const resultEscape = replaceSlotProps(templateEscape, props);

          expect(resultMustache).toBe(resultEscape);
        }
      ),
      { numRuns: 200 }
    );
  });
});
