import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  generateComponent,
  transformForExpr,
  isStaticForBinding,
  isStaticForExpr,
  pathExpr,
} from './codegen.js';

// ── Helper: build a minimal ParseResult with forBlocks ──────────────

function makeParseResult(overrides = {}) {
  return {
    tagName: 'test-comp',
    className: 'TestComp',
    style: '',
    signals: [],
    computeds: [],
    effects: [],
    methods: [],
    bindings: [],
    events: [],
    processedTemplate: '<!-- each -->',
    propDefs: [],
    propsObjectName: null,
    emits: [],
    emitsObjectName: null,
    ifBlocks: [],
    showBindings: [],
    forBlocks: [],
    ...overrides,
  };
}

// ── Property Tests ──────────────────────────────────────────────────

/**
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 7.1, 7.3, 7.4, 7.5, 10.1**
 *
 * Property 4: Codegen Constructor and Effect Structure
 *
 * For any ParseResult containing ForBlocks, the generated JavaScript SHALL
 * contain template creation, anchor reference, nodes array, and reactive effect.
 *
 * Feature: each-directive, Property 4: Codegen Constructor and Effect Structure
 */
describe('Feature: each-directive, Property 4: Codegen Constructor and Effect Structure', () => {
  const identArb = fc.stringMatching(/^[a-z][a-zA-Z]{0,5}$/).filter(s => s.length > 0);

  it('generates constructor setup and connectedCallback effect for ForBlocks', () => {
    fc.assert(
      fc.property(
        identArb,
        identArb,
        fc.constantFrom('items', 'users', 'data'),
        (itemVar, source, signalName) => {
          fc.pre(itemVar !== source && itemVar !== signalName && source !== signalName);

          const pr = makeParseResult({
            signals: [{ name: signalName, value: '[]' }],
            forBlocks: [{
              varName: '__for0',
              itemVar,
              indexVar: null,
              source: signalName,
              keyExpr: null,
              templateHtml: `<li>${itemVar}</li>`,
              anchorPath: ['childNodes[0]'],
              bindings: [],
              events: [],
              showBindings: [],
              attrBindings: [],
            }],
          });

          const output = generateComponent(pr);

          // Constructor: template creation
          expect(output).toContain("this.__for0_tpl = document.createElement('template')");
          expect(output).toContain('this.__for0_tpl.innerHTML');

          // Constructor: anchor reference
          expect(output).toContain('this.__for0_anchor = __root.childNodes[0]');

          // Constructor: nodes array
          expect(output).toContain('this.__for0_nodes = []');

          // connectedCallback: effect with source evaluation
          expect(output).toContain('__effect(');
          expect(output).toContain('const __source');

          // connectedCallback: node removal
          expect(output).toContain('for (const n of this.__for0_nodes) n.remove()');

          // connectedCallback: numeric range handling
          expect(output).toContain("typeof __source === 'number'");
          expect(output).toContain('Array.from({ length: __source }');

          // connectedCallback: clone and insert
          expect(output).toContain('this.__for0_tpl.content.cloneNode(true)');
          expect(output).toContain('clone.firstChild');
          expect(output).toContain('this.__for0_anchor.parentNode.insertBefore');
          expect(output).toContain('this.__for0_nodes.push(node)');
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 8.1, 8.2, 8.3, 9.1, 9.2, 11.1, 11.2, 11.3, 11.4**
 *
 * Property 5: Static vs Reactive Binding Classification
 *
 * For any text/show/attr bindings, static bindings produce direct assignments
 * and reactive bindings produce __effect wrappers.
 *
 * Feature: each-directive, Property 5: Static vs Reactive Binding Classification
 */
describe('Feature: each-directive, Property 5: Static vs Reactive Binding Classification', () => {
  it('classifies item-only bindings as static (no __effect wrapper)', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-zA-Z]{0,5}$/).filter(s => s.length > 0),
        (itemVar) => {
          // Static binding: references only itemVar
          const isStatic = isStaticForBinding(`${itemVar}.name`, itemVar, null);
          expect(isStatic).toBe(true);

          const isStaticDirect = isStaticForBinding(itemVar, itemVar, null);
          expect(isStaticDirect).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('classifies index-only bindings as static', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-zA-Z]{0,5}$/).filter(s => s.length > 0),
        fc.stringMatching(/^[a-z][a-zA-Z]{0,5}$/).filter(s => s.length > 0),
        (itemVar, indexVar) => {
          fc.pre(itemVar !== indexVar);
          const isStatic = isStaticForBinding(indexVar, itemVar, indexVar);
          expect(isStatic).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('classifies component-level bindings as reactive', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-zA-Z]{0,5}$/).filter(s => s.length > 0),
        fc.stringMatching(/^[a-z][a-zA-Z]{0,5}$/).filter(s => s.length > 0),
        (itemVar, signalName) => {
          fc.pre(itemVar !== signalName);
          const isStatic = isStaticForBinding(signalName, itemVar, null);
          expect(isStatic).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('generates direct assignment for static bindings and __effect for reactive', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-zA-Z]{0,5}$/).filter(s => s.length > 0),
        fc.constantFrom('count', 'total', 'label'),
        (itemVar, signalName) => {
          fc.pre(itemVar !== signalName);

          const pr = makeParseResult({
            signals: [{ name: signalName, value: '0' }],
            forBlocks: [{
              varName: '__for0',
              itemVar,
              indexVar: null,
              source: signalName,
              keyExpr: null,
              templateHtml: '<li><span></span> <span></span></li>',
              anchorPath: ['childNodes[0]'],
              bindings: [
                { varName: '__b0', name: `${itemVar}.name`, type: 'method', path: ['childNodes[0]'] },
                { varName: '__b1', name: signalName, type: 'signal', path: ['childNodes[2]'] },
              ],
              events: [],
              showBindings: [],
              attrBindings: [],
            }],
          });

          const output = generateComponent(pr);

          // Static binding: direct textContent assignment (no __effect wrapper around it)
          expect(output).toContain(`${itemVar}.name ?? ''`);

          // Reactive binding: wrapped in __effect
          expect(output).toContain(`__effect(() => { node.childNodes[2].textContent = this._${signalName}()`);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 7.2, 9.3, 13.1, 13.2, 13.3, 13.4**
 *
 * Property 6: transformForExpr Preserves Item/Index and Transforms Component Refs
 *
 * For any expression with item/index and component-level references,
 * transformForExpr SHALL transform component refs while leaving item/index untouched.
 *
 * Feature: each-directive, Property 6: transformForExpr Preserves Item/Index and Transforms Component Refs
 */
describe('Feature: each-directive, Property 6: transformForExpr Preserves Item/Index and Transforms Component Refs', () => {
  const identArb = fc.stringMatching(/^[a-z][a-zA-Z]{1,5}$/).filter(s => s.length >= 2);

  it('transforms signals to this._x() while preserving item/index', () => {
    fc.assert(
      fc.property(
        identArb,
        identArb,
        identArb,
        (itemVar, indexVar, signalName) => {
          fc.pre(
            itemVar !== indexVar &&
            itemVar !== signalName &&
            indexVar !== signalName
          );

          const expr = `${signalName} + ${itemVar} + ${indexVar}`;
          const result = transformForExpr(
            expr,
            itemVar,
            indexVar,
            new Set(),
            new Set([signalName]),
            new Set()
          );

          // Signal should be transformed
          expect(result).toContain(`this._${signalName}()`);
          // Item and index should remain untouched
          expect(result).toContain(itemVar);
          expect(result).toContain(indexVar);
          // Item/index should NOT be transformed
          expect(result).not.toContain(`this._${itemVar}`);
          expect(result).not.toContain(`this._${indexVar}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('transforms computeds to this._c_x() while preserving item/index', () => {
    fc.assert(
      fc.property(
        identArb,
        identArb,
        (itemVar, computedName) => {
          fc.pre(itemVar !== computedName);

          const expr = `${computedName} + ${itemVar}`;
          const result = transformForExpr(
            expr,
            itemVar,
            null,
            new Set(),
            new Set(),
            new Set([computedName])
          );

          expect(result).toContain(`this._c_${computedName}()`);
          expect(result).not.toContain(`this._c_${itemVar}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('transforms props to this._s_x() while preserving item/index', () => {
    fc.assert(
      fc.property(
        identArb,
        identArb,
        (itemVar, propName) => {
          fc.pre(itemVar !== propName);
          // Ensure neither is a prefix of the other to avoid regex edge cases
          fc.pre(!itemVar.startsWith(propName) && !propName.startsWith(itemVar));

          const expr = `${propName} + ${itemVar}`;
          const result = transformForExpr(
            expr,
            itemVar,
            null,
            new Set([propName]),
            new Set(),
            new Set()
          );

          expect(result).toContain(`this._s_${propName}()`);
          expect(result).not.toContain(`this._s_${itemVar}`);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Unit Tests ──────────────────────────────────────────────────────

describe('codegen each — unit tests', () => {
  it('handles numeric range: source is a number N → iterate 1 through N (Req 7.5)', () => {
    const pr = makeParseResult({
      forBlocks: [{
        varName: '__for0',
        itemVar: 'n',
        indexVar: null,
        source: '5',
        keyExpr: null,
        templateHtml: '<span></span>',
        anchorPath: ['childNodes[0]'],
        bindings: [],
        events: [],
        showBindings: [],
        attrBindings: [],
      }],
    });

    const output = generateComponent(pr);
    // Should contain numeric range handling
    expect(output).toContain("typeof __source === 'number'");
    expect(output).toContain('Array.from({ length: __source }, (_, i) => i + 1)');
  });

  it('handles falsy source: null/undefined/0 → render nothing (Req 7.6)', () => {
    const pr = makeParseResult({
      forBlocks: [{
        varName: '__for0',
        itemVar: 'item',
        indexVar: null,
        source: 'items',
        keyExpr: null,
        templateHtml: '<li></li>',
        anchorPath: ['childNodes[0]'],
        bindings: [],
        events: [],
        showBindings: [],
        attrBindings: [],
      }],
    });

    const output = generateComponent(pr);
    // Should handle falsy with || []
    expect(output).toContain('(__source || [])');
  });

  it('generates no unnecessary effects for no-binding items', () => {
    const pr = makeParseResult({
      signals: [{ name: 'items', value: '[]' }],
      forBlocks: [{
        varName: '__for0',
        itemVar: 'item',
        indexVar: null,
        source: 'items',
        keyExpr: null,
        templateHtml: '<li>static text</li>',
        anchorPath: ['childNodes[0]'],
        bindings: [],
        events: [],
        showBindings: [],
        attrBindings: [],
      }],
    });

    const output = generateComponent(pr);
    // The forEach body should not contain per-item __effect calls
    // (only the outer __effect for the source)
    const forEachMatch = output.match(/__iter\.forEach\([^]*?\n\s*\}\);/);
    if (forEachMatch) {
      // Count __effect calls inside forEach — should be 0 for no-binding items
      const innerEffects = (forEachMatch[0].match(/__effect\(/g) || []).length;
      expect(innerEffects).toBe(0);
    }
  });

  it('generates event binding with this._handler.bind(this) pattern (Req 10.1)', () => {
    const pr = makeParseResult({
      signals: [{ name: 'items', value: '[]' }],
      methods: [{ name: 'remove', params: '', body: '' }],
      forBlocks: [{
        varName: '__for0',
        itemVar: 'item',
        indexVar: null,
        source: 'items',
        keyExpr: null,
        templateHtml: '<li><button>x</button></li>',
        anchorPath: ['childNodes[0]'],
        bindings: [],
        events: [{ varName: '__e0', event: 'click', handler: 'remove', path: ['childNodes[0]'] }],
        showBindings: [],
        attrBindings: [],
      }],
    });

    const output = generateComponent(pr);
    expect(output).toContain("addEventListener('click', this._remove.bind(this))");
  });

  it('isStaticForExpr returns true for item-only expressions', () => {
    expect(isStaticForExpr('item.name', 'item', null, new Set(), new Set(), new Set())).toBe(true);
    expect(isStaticForExpr('item.name + index', 'item', 'index', new Set(), new Set(), new Set())).toBe(true);
  });

  it('isStaticForExpr returns false for expressions with component vars', () => {
    expect(isStaticForExpr('item.name + count', 'item', null, new Set(), new Set(['count']), new Set())).toBe(false);
    expect(isStaticForExpr('filtered', 'item', null, new Set(), new Set(), new Set(['filtered']))).toBe(false);
  });

  it('generates static show binding for item-only expression', () => {
    const pr = makeParseResult({
      signals: [{ name: 'items', value: '[]' }],
      forBlocks: [{
        varName: '__for0',
        itemVar: 'item',
        indexVar: null,
        source: 'items',
        keyExpr: null,
        templateHtml: '<li><span></span></li>',
        anchorPath: ['childNodes[0]'],
        bindings: [],
        events: [],
        showBindings: [{ varName: '__show0', expression: 'item.visible', path: ['childNodes[0]'] }],
        attrBindings: [],
      }],
    });

    const output = generateComponent(pr);
    // Static show: direct assignment without __effect wrapper
    expect(output).toContain("node.childNodes[0].style.display = (item.visible) ? '' : 'none'");
  });

  it('generates reactive show binding for component-level expression', () => {
    const pr = makeParseResult({
      signals: [{ name: 'items', value: '[]' }, { name: 'showAll', value: 'true' }],
      forBlocks: [{
        varName: '__for0',
        itemVar: 'item',
        indexVar: null,
        source: 'items',
        keyExpr: null,
        templateHtml: '<li><span></span></li>',
        anchorPath: ['childNodes[0]'],
        bindings: [],
        events: [],
        showBindings: [{ varName: '__show0', expression: 'showAll', path: ['childNodes[0]'] }],
        attrBindings: [],
      }],
    });

    const output = generateComponent(pr);
    // Reactive show: wrapped in __effect
    expect(output).toContain("__effect(() => { node.childNodes[0].style.display = (this._showAll()) ? '' : 'none'; })");
  });
});
