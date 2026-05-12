/**
 * Property-based tests for tree-walker.js — dynamic component processing
 *
 * Property 2: Missing `:is` attribute produces compilation error
 * For any `<component>` element that has zero or more attributes but does NOT
 * have a `:is` attribute, the tree walker SHALL throw an error with code
 * `MISSING_IS_ATTRIBUTE`.
 *
 * **Validates: Requirements 1.3**
 *
 * Property 3: Binding extraction completeness
 * For any `<component :is="E">` element with N additional `:attr="expr"` bindings
 * and M `@event="handler"` bindings, the tree walker SHALL produce a
 * `DynamicComponentBinding` where: `isExpression` equals E exactly, `props` has
 * exactly N entries with correct attribute names and expressions, `events` has
 * exactly M entries with correct event names and handlers, and the processed
 * template contains a `<!-- dynamic -->` comment in place of the `<component>` element.
 *
 * **Validates: Requirements 1.1, 1.4, 4.4, 5.4, 10.1**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseHTML } from 'linkedom';
import { processDynamicComponents } from './tree-walker.js';

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Create a root element from HTML using linkedom.
 */
function makeRoot(html) {
  const { document } = parseHTML(`<div id="__root">${html}</div>`);
  return document.getElementById('__root');
}

// ── Arbitraries ──────────────────────────────────────────────────────

/**
 * Generate a valid attribute name (lowercase letters, starting with a letter).
 */
const attrName = fc
  .tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.array(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
      { minLength: 1, maxLength: 8 }
    )
  )
  .map(([first, rest]) => first + rest.join(''));

/**
 * Generate a simple expression value (alphanumeric with common expression chars).
 */
const exprValue = fc
  .array(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789._()'.split('')),
    { minLength: 1, maxLength: 15 }
  )
  .map((chars) => chars.join(''));

/**
 * Generate a plain attribute (no : or @ prefix) for <component> without :is.
 */
const plainAttribute = fc
  .tuple(attrName, exprValue)
  .map(([name, val]) => `${name}="${val}"`);

/**
 * Generate a non-:is attribute that could be a prop binding, event binding, or plain.
 * Excludes :is to ensure it's never accidentally generated.
 */
const nonIsAttribute = fc.oneof(
  // Prop binding: :attr="expr" (attr cannot be "is")
  fc.tuple(attrName.filter((n) => n !== 'is'), exprValue).map(
    ([name, val]) => `:${name}="${val}"`
  ),
  // Event binding: @event="handler"
  fc.tuple(attrName, exprValue).map(([name, val]) => `@${name}="${val}"`),
  // Plain attribute: attr="value"
  plainAttribute
);

/**
 * Generate a unique prop binding (:attr="expr") with a guaranteed unique name.
 */
const propBinding = fc
  .tuple(attrName.filter((n) => n !== 'is'), exprValue)
  .map(([name, val]) => ({ attr: name, expression: val }));

/**
 * Generate a unique event binding (@event="handler").
 */
const eventBinding = fc
  .tuple(attrName, exprValue)
  .map(([name, val]) => ({ event: name, handler: val }));

// ── Property 2 Tests ─────────────────────────────────────────────────

describe('Feature: dynamic-component, Property 2: Missing `:is` attribute produces compilation error', () => {
  it('a <component> element without :is throws MISSING_IS_ATTRIBUTE for any attribute combination', () => {
    fc.assert(
      fc.property(
        fc.array(nonIsAttribute, { minLength: 0, maxLength: 5 }),
        (attrs) => {
          // Build a <component> element without :is
          const attrStr = attrs.join(' ');
          const html = attrStr
            ? `<component ${attrStr}></component>`
            : `<component></component>`;

          const root = makeRoot(html);

          try {
            processDynamicComponents(root, []);
            // If no error was thrown, fail the test
            expect.fail(
              'Expected MISSING_IS_ATTRIBUTE error but processDynamicComponents succeeded'
            );
          } catch (error) {
            expect(error.code).toBe('MISSING_IS_ATTRIBUTE');
            expect(error.message).toContain(':is attribute is required');
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ── Property 3 Tests ─────────────────────────────────────────────────

describe('Feature: dynamic-component, Property 3: Binding extraction completeness', () => {
  it('extracts isExpression, props, and events correctly for any combination of bindings', () => {
    fc.assert(
      fc.property(
        exprValue,
        fc.array(propBinding, { minLength: 0, maxLength: 5 }).filter((props) => {
          // Ensure unique attribute names
          const names = props.map((p) => p.attr);
          return new Set(names).size === names.length;
        }),
        fc.array(eventBinding, { minLength: 0, maxLength: 5 }).filter((events) => {
          // Ensure unique event names
          const names = events.map((e) => e.event);
          return new Set(names).size === names.length;
        }),
        (isExpr, props, events) => {
          // Build the <component> element with :is, props, and events
          const attrParts = [`:is="${isExpr}"`];
          for (const p of props) {
            attrParts.push(`:${p.attr}="${p.expression}"`);
          }
          for (const e of events) {
            attrParts.push(`@${e.event}="${e.handler}"`);
          }
          const html = `<component ${attrParts.join(' ')}></component>`;
          const root = makeRoot(html);

          const result = processDynamicComponents(root, []);

          // Should produce exactly one DynamicComponentBinding
          expect(result).toHaveLength(1);
          const binding = result[0];

          // isExpression should match exactly
          expect(binding.isExpression).toBe(isExpr);

          // props should have exactly N entries with correct names and expressions
          expect(binding.props).toHaveLength(props.length);
          for (let i = 0; i < props.length; i++) {
            const found = binding.props.find((p) => p.attr === props[i].attr);
            expect(found).toBeDefined();
            expect(found.expression).toBe(props[i].expression);
          }

          // events should have exactly M entries with correct names and handlers
          expect(binding.events).toHaveLength(events.length);
          for (let i = 0; i < events.length; i++) {
            const found = binding.events.find((e) => e.event === events[i].event);
            expect(found).toBeDefined();
            expect(found.handler).toBe(events[i].handler);
          }

          // The template should contain <!-- dynamic --> comment in place of <component>
          const rootHtml = root.innerHTML;
          expect(rootHtml).toContain('<!-- dynamic -->');
          expect(rootHtml).not.toContain('<component');
        }
      ),
      { numRuns: 20 }
    );
  });

  it('produces a valid varName and anchorPath for the binding', () => {
    fc.assert(
      fc.property(
        exprValue,
        fc.array(propBinding, { minLength: 0, maxLength: 3 }).filter((props) => {
          const names = props.map((p) => p.attr);
          return new Set(names).size === names.length;
        }),
        fc.array(eventBinding, { minLength: 0, maxLength: 3 }).filter((events) => {
          const names = events.map((e) => e.event);
          return new Set(names).size === names.length;
        }),
        (isExpr, props, events) => {
          const attrParts = [`:is="${isExpr}"`];
          for (const p of props) {
            attrParts.push(`:${p.attr}="${p.expression}"`);
          }
          for (const e of events) {
            attrParts.push(`@${e.event}="${e.handler}"`);
          }
          const html = `<component ${attrParts.join(' ')}></component>`;
          const root = makeRoot(html);

          const result = processDynamicComponents(root, []);
          const binding = result[0];

          // varName should follow the __dynN pattern
          expect(binding.varName).toBe('__dyn0');

          // anchorPath should be a non-empty array
          expect(binding.anchorPath).toBeDefined();
          expect(binding.anchorPath.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 20 }
    );
  });
});
