/**
 * Property-based tests for codegen.js — dynamic component code generation
 *
 * Property 4: Swap effect structural correctness
 * For any `DynamicComponentBinding`, the codegen output SHALL contain a reactive
 * `__effect` that: (a) evaluates the transformed `:is` expression, (b) compares
 * it to the stored previous tag name, (c) returns early if unchanged, (d) calls
 * `.remove()` on the current element when it exists, (e) calls
 * `document.createElement(__tag)` and `insertBefore` with the anchor when the new
 * tag is truthy, and (f) stores the new element as the current element.
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 10.2, 10.3**
 *
 * Property 5: Prop bindings emit nested reactive effects
 * For any `DynamicComponentBinding` with P prop bindings (P ≥ 1), the codegen
 * output SHALL contain exactly P nested `__effect` calls with `setAttribute` for
 * each prop.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 10.4**
 *
 * Property 6: Event bindings emit addEventListener calls
 * For any `DynamicComponentBinding` with E event bindings (E ≥ 1), the codegen
 * output SHALL contain exactly E `addEventListener` calls with correct event names.
 *
 * **Validates: Requirements 5.1, 5.3, 10.5**
 *
 * Property 7: Arbitrary expressions compile without error
 * For any valid JavaScript expression string used as the `:is` value (including
 * ternaries, function calls, property access, and template literals), the compiler
 * SHALL not throw an error and SHALL produce valid output.
 *
 * **Validates: Requirements 9.1, 9.2, 9.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateComponent } from './codegen.js';
import { parseHTML } from 'linkedom';
import { processDynamicComponents } from './tree-walker.js';

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Build a minimal ParseResult with the given dynamicComponents array.
 */
function makeParseResult(dynamicComponents, processedTemplate = '<!-- dynamic -->') {
  return {
    tagName: 'test-component',
    className: 'TestComponent',
    style: null,
    signals: [],
    computeds: [],
    effects: [],
    methods: [],
    bindings: [],
    events: [],
    processedTemplate,
    propDefs: [],
    propsObjectName: null,
    emits: [],
    emitsObjectName: null,
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
    childImports: [],
    exposeNames: [],
    modelDefs: [],
    dynamicComponents,
  };
}

/**
 * Create a root element from HTML using linkedom.
 */
function makeRoot(html) {
  const { document } = parseHTML(`<div id="__root">${html}</div>`);
  return document.getElementById('__root');
}

// ── Arbitraries ──────────────────────────────────────────────────────

/**
 * Generate a valid identifier (lowercase letters, starting with a letter).
 */
const identifier = fc
  .tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.array(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
      { minLength: 1, maxLength: 8 }
    )
  )
  .map(([first, rest]) => first + rest.join(''));

/**
 * Generate valid JS expression strings for the :is attribute.
 * Includes ternaries, function calls, property access, and combinations.
 */
const jsExpression = fc.oneof(
  // Simple function call: foo()
  identifier.map((name) => `${name}()`),
  // Property access: obj.prop
  fc.tuple(identifier, identifier).map(([obj, prop]) => `${obj}.${prop}`),
  // Method call: obj.method()
  fc.tuple(identifier, identifier).map(([obj, method]) => `${obj}.${method}()`),
  // Ternary with function calls: a() ? 'x' : 'y'
  fc.tuple(identifier, identifier, identifier).map(
    ([cond, a, b]) => `${cond}() ? '${a}' : '${b}'`
  ),
  // Nested property access: a.b.c
  fc.tuple(identifier, identifier, identifier).map(
    ([a, b, c]) => `${a}.${b}.${c}`
  ),
  // Function call with property access: obj.method().prop
  fc.tuple(identifier, identifier, identifier).map(
    ([obj, method, prop]) => `${obj}.${method}().${prop}`
  ),
  // Ternary with property access: obj.flag ? 'x' : 'y'
  fc.tuple(identifier, identifier, identifier, identifier).map(
    ([obj, flag, a, b]) => `${obj}.${flag} ? '${a}' : '${b}'`
  )
);

// ── Arbitraries for Property 4 ────────────────────────────────────────

/**
 * Generate a DynamicComponentBinding record with varying expressions,
 * props, and events for testing swap effect structural correctness.
 */
const dynamicComponentBinding = fc
  .tuple(
    jsExpression,
    fc.array(
      fc.tuple(
        identifier.filter((n) => n !== 'is'),
        identifier.map((name) => `${name}()`)
      ).map(([attr, expression]) => ({ attr, expression })),
      { minLength: 0, maxLength: 3 }
    ).filter((props) => {
      const names = props.map((p) => p.attr);
      return new Set(names).size === names.length;
    }),
    fc.array(
      fc.tuple(identifier, identifier).map(([event, handler]) => ({ event, handler })),
      { minLength: 0, maxLength: 3 }
    ).filter((events) => {
      const names = events.map((e) => e.event);
      return new Set(names).size === names.length;
    })
  )
  .map(([isExpr, props, events]) => ({
    varName: '__dyn0',
    isExpression: isExpr,
    props,
    events,
    anchorPath: ['childNodes[0]'],
  }));

// ── Property 4 Tests ─────────────────────────────────────────────────

describe('Feature: dynamic-component, Property 4: Swap effect structural correctness', () => {
  it('codegen output contains a reactive __effect wrapping the swap logic', () => {
    fc.assert(
      fc.property(dynamicComponentBinding, (binding) => {
        const parseResult = makeParseResult([binding]);
        const output = generateComponent(parseResult);

        // (a) The output must contain a reactive __effect
        expect(output).toContain('__effect');
      }),
      { numRuns: 20 }
    );
  });

  it('codegen output evaluates the :is expression and compares to stored tag (idempotence)', () => {
    fc.assert(
      fc.property(dynamicComponentBinding, (binding) => {
        const parseResult = makeParseResult([binding]);
        const output = generateComponent(parseResult);

        // (a) Evaluates the transformed :is expression into __tag
        expect(output).toContain('const __tag =');

        // (b) Compares to the stored previous tag name
        expect(output).toContain('__dyn0_tag');
        expect(output).toMatch(/__tag === this\.__dyn0_tag/);

        // (c) Returns early if unchanged — the comparison followed by return
        expect(output).toMatch(/if \(__tag === this\.__dyn0_tag\) return/);
      }),
      { numRuns: 20 }
    );
  });

  it('codegen output calls .remove() on the current element when it exists', () => {
    fc.assert(
      fc.property(dynamicComponentBinding, (binding) => {
        const parseResult = makeParseResult([binding]);
        const output = generateComponent(parseResult);

        // (d) Calls .remove() on the current element
        expect(output).toContain('.remove()');
        expect(output).toContain('__dyn0_current');
      }),
      { numRuns: 20 }
    );
  });

  it('codegen output calls document.createElement(__tag) and insertBefore with anchor', () => {
    fc.assert(
      fc.property(dynamicComponentBinding, (binding) => {
        const parseResult = makeParseResult([binding]);
        const output = generateComponent(parseResult);

        // (e) Calls document.createElement(__tag) and insertBefore with the anchor
        expect(output).toContain('document.createElement(__tag)');
        expect(output).toContain('insertBefore');
        expect(output).toContain('__dyn0_anchor');
      }),
      { numRuns: 20 }
    );
  });

  it('codegen output stores the new element as the current element and updates the tag', () => {
    fc.assert(
      fc.property(dynamicComponentBinding, (binding) => {
        const parseResult = makeParseResult([binding]);
        const output = generateComponent(parseResult);

        // (f) Stores the new element as the current element
        expect(output).toContain('this.__dyn0_current = el');

        // Stores the new tag name after swap
        expect(output).toContain('this.__dyn0_tag = __tag');
      }),
      { numRuns: 20 }
    );
  });
});

// ── Property 7 Tests ─────────────────────────────────────────────────

describe('Feature: dynamic-component, Property 7: Arbitrary expressions compile without error', () => {
  it('the compiler does not throw and produces non-empty output for any valid JS expression in :is', () => {
    fc.assert(
      fc.property(
        jsExpression,
        (expr) => {
          // Build a <component :is="expr"> element and process it through the tree-walker
          const html = `<component :is="${expr}"></component>`;
          const root = makeRoot(html);
          const dynamicComponents = processDynamicComponents(root, []);

          // Build a ParseResult with the extracted dynamic component binding
          const parseResult = makeParseResult(dynamicComponents, root.innerHTML);

          // generateComponent should NOT throw
          let output;
          expect(() => {
            output = generateComponent(parseResult);
          }).not.toThrow();

          // Output should be non-empty
          expect(output).toBeDefined();
          expect(output.length).toBeGreaterThan(0);

          // Output should contain the dynamic component effect structure
          expect(output).toContain('__effect');
          expect(output).toContain('document.createElement');
        }
      ),
      { numRuns: 20 }
    );
  });

  it('ternary expressions with string literals compile correctly', () => {
    fc.assert(
      fc.property(
        fc.tuple(identifier, identifier, identifier),
        ([cond, tagA, tagB]) => {
          const expr = `${cond}() ? '${tagA}-comp' : '${tagB}-comp'`;
          const html = `<component :is="${expr}"></component>`;
          const root = makeRoot(html);
          const dynamicComponents = processDynamicComponents(root, []);

          const parseResult = makeParseResult(dynamicComponents, root.innerHTML);

          let output;
          expect(() => {
            output = generateComponent(parseResult);
          }).not.toThrow();

          expect(output).toBeDefined();
          expect(output.length).toBeGreaterThan(0);
          // The ternary should appear in the output (transformed)
          expect(output).toContain('?');
          expect(output).toContain(':');
        }
      ),
      { numRuns: 20 }
    );
  });

  it('complex property access and method call expressions compile without error', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Deep property access: a.b.c.d
          fc.tuple(identifier, identifier, identifier, identifier).map(
            ([a, b, c, d]) => `${a}.${b}.${c}.${d}`
          ),
          // Chained method calls: a().b()
          fc.tuple(identifier, identifier).map(
            ([a, b]) => `${a}().${b}()`
          ),
          // Function call with argument-like patterns: getTag(state)
          fc.tuple(identifier, identifier).map(
            ([fn, arg]) => `${fn}(${arg})`
          )
        ),
        (expr) => {
          const html = `<component :is="${expr}"></component>`;
          const root = makeRoot(html);
          const dynamicComponents = processDynamicComponents(root, []);

          const parseResult = makeParseResult(dynamicComponents, root.innerHTML);

          let output;
          expect(() => {
            output = generateComponent(parseResult);
          }).not.toThrow();

          expect(output).toBeDefined();
          expect(output.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 20 }
    );
  });
});
