/**
 * Tests for constant variable interpolation in templates.
 *
 * Bug fix: const variables declared in the script were not interpolated
 * correctly in templates when used directly with {{VARIABLE}} syntax.
 * The tree-walker classified them as 'method' type, causing the codegen
 * to call them as functions (this._const_NAME) instead of reading
 * them as properties (this._const_NAME).
 *
 * These tests verify:
 * - tree-walker correctly classifies constants as type 'constant'
 * - codegen generates non-reactive direct assignment for constants
 * - codegen generates correct code for constants inside if-blocks
 * - transformForExpr handles constants inside each-loops
 * - full integration: component with constants compiles correctly
 */

import { describe, it, expect } from 'vitest';
import { parseHTML } from 'linkedom';
import { walkTree, walkBranch } from '../lib/tree-walker.js';
import { generateComponent, transformExpr, transformForExpr } from '../lib/codegen.js';

// ── Helpers ─────────────────────────────────────────────────────────

function makeRoot(html) {
  const { document } = parseHTML(`<div id="__root">${html}</div>`);
  return document.getElementById('__root');
}

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
    processedTemplate: '<div></div>',
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
    dynamicComponents: [],
    ...overrides,
  };
}

// ── tree-walker: constant binding type classification ────────────────

describe('walkTree — constant binding type', () => {
  it('assigns type "constant" when variable is in constantNames set', () => {
    const root = makeRoot('<div>{{APP_NAME}}</div>');
    const { bindings } = walkTree(root, new Set(), new Set(), new Set(), new Set(['APP_NAME']));

    expect(bindings).toHaveLength(1);
    expect(bindings[0].name).toBe('APP_NAME');
    expect(bindings[0].type).toBe('constant');
  });

  it('assigns type "constant" for multiple constants', () => {
    const root = makeRoot('<div>{{APP_NAME}}</div><div>{{VERSION}}</div>');
    const { bindings } = walkTree(root, new Set(), new Set(), new Set(), new Set(['APP_NAME', 'VERSION']));

    expect(bindings).toHaveLength(2);
    expect(bindings[0].type).toBe('constant');
    expect(bindings[1].type).toBe('constant');
  });

  it('correctly classifies mixed signals, computeds, constants, and methods', () => {
    const root = makeRoot(
      '<div>{{count}}</div><div>{{doubled}}</div><div>{{APP_NAME}}</div><div>{{unknown}}</div>'
    );
    const { bindings } = walkTree(
      root,
      new Set(['count']),
      new Set(['doubled']),
      new Set(),
      new Set(['APP_NAME'])
    );

    expect(bindings).toHaveLength(4);
    expect(bindings[0].type).toBe('signal');
    expect(bindings[1].type).toBe('computed');
    expect(bindings[2].type).toBe('constant');
    expect(bindings[3].type).toBe('method');
  });

  it('prioritizes prop over constant when name exists in both sets', () => {
    const root = makeRoot('<div>{{name}}</div>');
    const { bindings } = walkTree(
      root,
      new Set(),
      new Set(),
      new Set(['name']),
      new Set(['name'])
    );

    expect(bindings[0].type).toBe('prop');
  });

  it('prioritizes signal over constant when name exists in both sets', () => {
    const root = makeRoot('<div>{{value}}</div>');
    const { bindings } = walkTree(
      root,
      new Set(['value']),
      new Set(),
      new Set(),
      new Set(['value'])
    );

    expect(bindings[0].type).toBe('signal');
  });

  it('classifies constant in mixed text and interpolations (span case)', () => {
    const root = makeRoot('<div>App: {{APP_NAME}} v{{VERSION}}</div>');
    const { bindings } = walkTree(root, new Set(), new Set(), new Set(), new Set(['APP_NAME', 'VERSION']));

    expect(bindings).toHaveLength(2);
    expect(bindings[0].name).toBe('APP_NAME');
    expect(bindings[0].type).toBe('constant');
    expect(bindings[1].name).toBe('VERSION');
    expect(bindings[1].type).toBe('constant');
  });
});

// ── walkBranch: constant type propagation in if-blocks ──────────────

describe('walkBranch — constant binding type in branches', () => {
  it('classifies constants correctly inside branch HTML', () => {
    const html = '<div>{{APP_NAME}}</div>';
    const result = walkBranch(html, new Set(), new Set(), new Set(), new Set(['APP_NAME']));

    expect(result.bindings).toHaveLength(1);
    expect(result.bindings[0].name).toBe('APP_NAME');
    expect(result.bindings[0].type).toBe('constant');
  });

  it('classifies mixed types correctly inside branch HTML', () => {
    const html = '<div>{{count}}</div><div>{{APP_NAME}}</div>';
    const result = walkBranch(html, new Set(['count']), new Set(), new Set(), new Set(['APP_NAME']));

    expect(result.bindings).toHaveLength(2);
    expect(result.bindings[0].type).toBe('signal');
    expect(result.bindings[1].type).toBe('constant');
  });
});

// ── transformExpr: constant transformation ──────────────────────────

describe('transformExpr — constants', () => {
  it('transforms constant references to this._const_name (no parentheses)', () => {
    const result = transformExpr('APP_NAME', [], [], null, new Set(), null, ['APP_NAME']);
    expect(result).toBe('this._const_APP_NAME');
  });

  it('transforms multiple constants in the same expression', () => {
    const result = transformExpr('APP_NAME + " v" + VERSION', [], [], null, new Set(), null, ['APP_NAME', 'VERSION']);
    expect(result).toContain('this._const_APP_NAME');
    expect(result).toContain('this._const_VERSION');
  });

  it('does not add () to constant references', () => {
    const result = transformExpr('APP_NAME', [], [], null, new Set(), null, ['APP_NAME']);
    expect(result).toContain('this._const_APP_NAME');
    expect(result).not.toContain('this._const_APP_NAME()');
  });

  it('transforms constants alongside signals and computeds', () => {
    const result = transformExpr(
      'count + MAX_ITEMS',
      ['count'],
      [],
      null,
      new Set(),
      null,
      ['MAX_ITEMS']
    );
    expect(result).toContain('this._state.count');
    expect(result).toContain('this._const_MAX_ITEMS');
  });
});

// ── transformForExpr: constants inside each-loops ───────────────────

describe('transformForExpr — constants', () => {
  it('transforms constant references to this._const_name inside for expressions', () => {
    const result = transformForExpr(
      'MAX_ITEMS',
      'item',
      'index',
      new Set(),
      new Set(),
      new Set(),
      [],
      ['MAX_ITEMS']
    );
    expect(result).toBe('this._const_MAX_ITEMS');
  });

  it('does not transform constants that match itemVar', () => {
    const result = transformForExpr(
      'item',
      'item',
      null,
      new Set(),
      new Set(),
      new Set(),
      [],
      ['item']
    );
    // item is the loop variable, should not be transformed
    expect(result).toBe('item');
  });

  it('transforms constants alongside signals in for expressions', () => {
    const result = transformForExpr(
      'count + MAX_ITEMS + item.name',
      'item',
      null,
      new Set(),
      new Set(['count']),
      new Set(),
      [],
      ['MAX_ITEMS']
    );
    expect(result).toContain('this._state.count');
    expect(result).toContain('this._const_MAX_ITEMS');
    expect(result).toContain('item.name');
  });

  it('does not add () to constant references in for expressions', () => {
    const result = transformForExpr(
      'MAX_ITEMS',
      'item',
      null,
      new Set(),
      new Set(),
      new Set(),
      [],
      ['MAX_ITEMS']
    );
    expect(result).toContain('this._const_MAX_ITEMS');
    expect(result).not.toContain('this._const_MAX_ITEMS()');
  });
});

// ── codegen: constant text binding generation ───────────────────────

describe('generateComponent — constant text bindings', () => {
  it('generates non-reactive direct assignment for constant bindings', () => {
    const pr = makeParseResult({
      constantVars: [{ name: 'APP_NAME', value: "'WCC Tester'" }],
      bindings: [
        { varName: '__text_APP_NAME_0', name: 'APP_NAME', type: 'constant', path: ['childNodes[0]'] },
      ],
      processedTemplate: '<p></p>',
    });

    const output = generateComponent(pr);

    // Should assign directly without __effect wrapper
    expect(output).toContain("this.__text_APP_NAME_0.textContent = this._const_APP_NAME ?? '';");
    // Should NOT wrap in __effect (constants are not reactive)
    expect(output).not.toMatch(/this\.__disposers\.push\(__effect\(\(\) => \{\s*\n\s*this\.__text_APP_NAME_0/);
  });

  it('generates __effect for signal bindings but not for constants', () => {
    const pr = makeParseResult({
      signals: [{ name: 'count', value: '0' }],
      constantVars: [{ name: 'APP_NAME', value: "'WCC Tester'" }],
      bindings: [
        { varName: '__text_count_0', name: 'count', type: 'signal', path: ['childNodes[0]'] },
        { varName: '__text_APP_NAME_1', name: 'APP_NAME', type: 'constant', path: ['childNodes[1]'] },
      ],
      processedTemplate: '<p></p><p></p>',
    });

    const output = generateComponent(pr);

    // Signal should be wrapped in __effect
    expect(output).toContain('this.__text_count_0.textContent = this._state.count');
    // Constant should be direct assignment
    expect(output).toContain("this.__text_APP_NAME_1.textContent = this._const_APP_NAME ?? '';");
  });

  it('initializes constants in constructor', () => {
    const pr = makeParseResult({
      constantVars: [
        { name: 'APP_NAME', value: "'WCC Tester'" },
        { name: 'VERSION', value: "'1.0.0'" },
      ],
      bindings: [
        { varName: '__text_APP_NAME_0', name: 'APP_NAME', type: 'constant', path: ['childNodes[0]'] },
      ],
      processedTemplate: '<p></p>',
    });

    const output = generateComponent(pr);

    expect(output).toContain("this._const_APP_NAME = 'WCC Tester'");
    expect(output).toContain("this._const_VERSION = '1.0.0'");
  });

  it('generates correct code for constants inside if-block branches', () => {
    const pr = makeParseResult({
      constantVars: [{ name: 'TITLE', value: "'Hello'" }],
      ifBlocks: [{
        varName: '__if0',
        branches: [
          {
            type: 'if',
            expression: 'true',
            templateHtml: '<p></p>',
            bindings: [
              { varName: '__text_TITLE_0', name: 'TITLE', type: 'constant', path: ['childNodes[0]'] },
            ],
            events: [],
            showBindings: [],
            attrBindings: [],
            modelBindings: [],
            slots: [],
            childComponents: [],
            forBlocks: [],
            ifBlocks: [],
          },
        ],
        anchorType: 'each', anchorIndex: 0,
        anchorPath: ['childNodes[0]'],
      }],
      processedTemplate: '<div><!-- if --></div>',
    });

    const output = generateComponent(pr);

    // Phase 2: constant is initialized in constructor
    expect(output).toContain("this._const_TITLE = 'Hello'");
    // Constant bindings in if-blocks are static: should NOT be wrapped in __effect
    expect(output).not.toMatch(/__effect\(\(\) => \{[^}]*__text_TITLE_0/);
  });
});

// ── Full integration: compile component with constants ──────────────

describe('generateComponent — full constant interpolation integration', () => {
  it('compiles a component with constants, signals, and methods correctly', () => {
    const pr = makeParseResult({
      signals: [{ name: 'count', value: '0' }],
      computeds: [{ name: 'fullVersion', body: '`${APP_NAME} v${VERSION}`' }],
      constantVars: [
        { name: 'APP_NAME', value: "'WCC Tester'" },
        { name: 'VERSION', value: "'1.0.0'" },
        { name: 'MAX_ITEMS', value: '100' },
      ],
      methods: [{ name: 'calculatePercentage', params: 'value', body: 'return ((value / MAX_ITEMS) * 100).toFixed(1)' }],
      bindings: [
        { varName: '__text_APP_NAME_0', name: 'APP_NAME', type: 'constant', path: ['childNodes[0]'] },
        { varName: '__text_VERSION_1', name: 'VERSION', type: 'constant', path: ['childNodes[1]'] },
        { varName: '__text_fullVersion_2', name: 'fullVersion', type: 'computed', path: ['childNodes[2]'] },
        { varName: '__text_count_3', name: 'count', type: 'signal', path: ['childNodes[3]'] },
      ],
      processedTemplate: '<p></p><p></p><p></p><p></p>',
    });

    const output = generateComponent(pr);

    // Constants: direct assignment, no __effect
    expect(output).toContain("this.__text_APP_NAME_0.textContent = this._const_APP_NAME ?? '';");
    expect(output).toContain("this.__text_VERSION_1.textContent = this._const_VERSION ?? '';");

    // Computed: handled in __invalidate (Phase 2) with _state access
    expect(output).toContain('this.__text_fullVersion_2.textContent = this._state.fullVersion ?? \'\';');

    // Signal: handled in __invalidate
    expect(output).toContain('this.__text_count_3.textContent = this._state.count ?? \'\';');

    // Constants initialized in constructor
    expect(output).toContain("this._const_APP_NAME = 'WCC Tester'");
    expect(output).toContain("this._const_VERSION = '1.0.0'");
    expect(output).toContain('this._const_MAX_ITEMS = 100');

    // Method body uses this._const_MAX_ITEMS
    expect(output).toContain('this._const_MAX_ITEMS');
  });
});
