/**
 * Exploratory tests for nested directives inside `each` loops.
 *
 * These tests verify the bug condition is now fixed:
 * - walkBranch() detects nested `each` and `if`/`else` inside loop bodies
 * - generateComponent() produces correct nested forEach and per-item conditional code
 *
 * Also includes preservation tests (5.5) verifying single-level `each` behavior
 * is unchanged by the nested directives fix.
 */

import { describe, it, expect } from 'vitest';
import { walkBranch } from './tree-walker.js';
import { generateComponent } from './codegen.js';

// ── 4.1: Nested each inside each — walkBranch returns non-empty forBlocks ──

describe('4.1 nested each inside each — walkBranch returns forBlocks', () => {
  it('walkBranch detects nested each directive and returns non-empty forBlocks array', () => {
    const html = '<li><span each="item in cat.items">{{item.name}}</span></li>';
    const signalNames = new Set();
    const computedNames = new Set();
    const propNames = new Set();

    const result = walkBranch(html, signalNames, computedNames, propNames);

    // The nested each should be detected and stored in forBlocks
    expect(result.forBlocks).toBeDefined();
    expect(result.forBlocks.length).toBeGreaterThan(0);

    // Verify the nested forBlock has the correct structure
    const nestedFor = result.forBlocks[0];
    expect(nestedFor.itemVar).toBe('item');
    expect(nestedFor.source).toBe('cat.items');
    expect(nestedFor.templateHtml).toBeDefined();
    expect(nestedFor.anchorPath).toBeDefined();
  });

  it('walkBranch detects nested each with index variable', () => {
    const html = '<div><ul each="item in cat.items"><li>{{item.name}}</li></ul></div>';
    const signalNames = new Set();
    const computedNames = new Set();
    const propNames = new Set();

    const result = walkBranch(html, signalNames, computedNames, propNames);

    expect(result.forBlocks).toBeDefined();
    expect(result.forBlocks.length).toBeGreaterThan(0);
    expect(result.forBlocks[0].itemVar).toBe('item');
    expect(result.forBlocks[0].source).toBe('cat.items');
  });
});

// ── 4.2: if/else inside each — walkBranch returns non-empty ifBlocks ──

describe('4.2 if/else inside each — walkBranch returns ifBlocks', () => {
  it('walkBranch detects if/else chain and returns non-empty ifBlocks array', () => {
    const html = '<li><span if="item.active">Yes</span><span else>No</span></li>';
    const signalNames = new Set();
    const computedNames = new Set();
    const propNames = new Set();

    const result = walkBranch(html, signalNames, computedNames, propNames);

    // The nested if/else should be detected and stored in ifBlocks
    expect(result.ifBlocks).toBeDefined();
    expect(result.ifBlocks.length).toBeGreaterThan(0);

    // Verify the ifBlock has the correct structure
    const ifBlock = result.ifBlocks[0];
    expect(ifBlock.branches).toBeDefined();
    expect(ifBlock.branches.length).toBe(2);
    expect(ifBlock.branches[0].type).toBe('if');
    expect(ifBlock.branches[0].expression).toBe('item.active');
    expect(ifBlock.branches[1].type).toBe('else');
    expect(ifBlock.anchorPath).toBeDefined();
  });

  it('walkBranch detects if/else-if/else chain inside each body', () => {
    const html = '<li><span if="item.status === \'a\'">A</span><span else-if="item.status === \'b\'">B</span><span else>C</span></li>';
    const signalNames = new Set();
    const computedNames = new Set();
    const propNames = new Set();

    const result = walkBranch(html, signalNames, computedNames, propNames);

    expect(result.ifBlocks).toBeDefined();
    expect(result.ifBlocks.length).toBeGreaterThan(0);

    const ifBlock = result.ifBlocks[0];
    expect(ifBlock.branches.length).toBe(3);
    expect(ifBlock.branches[0].type).toBe('if');
    expect(ifBlock.branches[1].type).toBe('else-if');
    expect(ifBlock.branches[2].type).toBe('else');
  });
});

// ── 4.3: Nested each codegen — generated code contains nested forEach ──

describe('4.3 nested each codegen — generates nested forEach with proper variable scoping', () => {
  it('generates nested forEach when forBlock has nested forBlocks', () => {
    const parseResult = {
      tagName: 'test-nested',
      className: 'TestNested',
      style: '',
      signals: [{ name: 'categories', value: '[]' }],
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
      forBlocks: [{
        varName: '__for0',
        itemVar: 'cat',
        indexVar: null,
        source: 'categories',
        keyExpr: null,
        templateHtml: '<li><!-- each --></li>',
        anchorPath: ['childNodes[0]'],
        bindings: [],
        events: [],
        showBindings: [],
        attrBindings: [],
        modelBindings: [],
        slots: [],
        childComponents: [],
        forBlocks: [{
          varName: '__for1',
          itemVar: 'item',
          indexVar: null,
          source: 'cat.items',
          keyExpr: null,
          templateHtml: '<span></span>',
          anchorPath: ['childNodes[0]'],
          bindings: [{ varName: '__b0', name: 'item.name', type: 'method', path: [] }],
          events: [],
          showBindings: [],
          attrBindings: [],
          modelBindings: [],
          slots: [],
          childComponents: [],
        }],
        ifBlocks: [],
      }],
    };

    const output = generateComponent(parseResult);

    // Should contain a nested forEach with the inner item variable
    expect(output).toContain('__for1_iter.forEach((item');

    // Should contain the inner template creation
    expect(output).toContain('__for1_tpl');

    // Should contain the inner anchor reference
    expect(output).toContain('__for1_anchor');

    // Inner loop variable should be defined (item.name binding)
    expect(output).toContain("item.name ?? ''");

    // Outer loop variable (cat) should be accessible in inner source expression
    expect(output).toContain('cat.items');
  });

  it('generates proper variable scoping — outer var accessible in inner scope', () => {
    const parseResult = {
      tagName: 'test-scope',
      className: 'TestScope',
      style: '',
      signals: [{ name: 'categories', value: '[]' }],
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
      forBlocks: [{
        varName: '__for0',
        itemVar: 'cat',
        indexVar: null,
        source: 'categories',
        keyExpr: null,
        templateHtml: '<div><!-- each --></div>',
        anchorPath: ['childNodes[0]'],
        bindings: [],
        events: [],
        showBindings: [],
        attrBindings: [],
        modelBindings: [],
        slots: [],
        childComponents: [],
        forBlocks: [{
          varName: '__for1',
          itemVar: 'item',
          indexVar: null,
          source: 'cat.items',
          keyExpr: null,
          templateHtml: '<p></p>',
          anchorPath: ['childNodes[0]'],
          bindings: [{ varName: '__b0', name: 'cat.name', type: 'method', path: [] }],
          events: [],
          showBindings: [],
          attrBindings: [],
          modelBindings: [],
          slots: [],
          childComponents: [],
        }],
        ifBlocks: [],
      }],
    };

    const output = generateComponent(parseResult);

    // Outer variable (cat.name) should be used directly (static binding) in inner scope
    expect(output).toContain("cat.name ?? ''");

    // cat.name should NOT be transformed to this._cat() since it's a loop variable
    // (note: this._categories is fine — we check specifically for this._cat() with parens)
    expect(output).not.toMatch(/this\._cat\(\)/);
  });
});

// ── 4.4: if/else inside each codegen — generates per-item conditional logic ──

describe('4.4 if/else inside each codegen — generates per-item conditional logic', () => {
  it('generates per-item conditional when forBlock has nested ifBlocks', () => {
    const parseResult = {
      tagName: 'test-if-each',
      className: 'TestIfEach',
      style: '',
      signals: [{ name: 'items', value: '[]' }],
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
      forBlocks: [{
        varName: '__for0',
        itemVar: 'item',
        indexVar: null,
        source: 'items',
        keyExpr: null,
        templateHtml: '<li><!-- if --></li>',
        anchorPath: ['childNodes[0]'],
        bindings: [],
        events: [],
        showBindings: [],
        attrBindings: [],
        modelBindings: [],
        slots: [],
        childComponents: [],
        forBlocks: [],
        ifBlocks: [{
          varName: '__if0',
          anchorPath: ['childNodes[0]'],
          branches: [
            { type: 'if', expression: 'item.active', templateHtml: '<span>Yes</span>', bindings: [], events: [], showBindings: [], attrBindings: [], modelBindings: [] },
            { type: 'else', expression: null, templateHtml: '<span>No</span>', bindings: [], events: [], showBindings: [], attrBindings: [], modelBindings: [] },
          ],
        }],
      }],
    };

    const output = generateComponent(parseResult);

    // Should contain per-item conditional evaluation using item variable
    expect(output).toContain('if (item.active)');

    // Should contain branch selection logic
    expect(output).toContain('__if0_branch');

    // Should contain template creation for each branch
    expect(output).toContain('__if0_t0');
    expect(output).toContain('__if0_t1');

    // Should contain anchor reference for the if block
    expect(output).toContain('__if0_anchor');

    // Should contain insertBefore to insert matching branch
    expect(output).toContain('__if0_anchor.parentNode.insertBefore');
  });

  it('generates else branch logic using item variable', () => {
    const parseResult = {
      tagName: 'test-else-each',
      className: 'TestElseEach',
      style: '',
      signals: [{ name: 'items', value: '[]' }],
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
      forBlocks: [{
        varName: '__for0',
        itemVar: 'item',
        indexVar: null,
        source: 'items',
        keyExpr: null,
        templateHtml: '<li><!-- if --></li>',
        anchorPath: ['childNodes[0]'],
        bindings: [],
        events: [],
        showBindings: [],
        attrBindings: [],
        modelBindings: [],
        slots: [],
        childComponents: [],
        forBlocks: [],
        ifBlocks: [{
          varName: '__if0',
          anchorPath: ['childNodes[0]'],
          branches: [
            { type: 'if', expression: "item.status === 'a'", templateHtml: '<span>A</span>', bindings: [], events: [], showBindings: [], attrBindings: [], modelBindings: [] },
            { type: 'else-if', expression: "item.status === 'b'", templateHtml: '<span>B</span>', bindings: [], events: [], showBindings: [], attrBindings: [], modelBindings: [] },
            { type: 'else', expression: null, templateHtml: '<span>C</span>', bindings: [], events: [], showBindings: [], attrBindings: [], modelBindings: [] },
          ],
        }],
      }],
    };

    const output = generateComponent(parseResult);

    // Should contain if/else-if/else chain using item variable
    expect(output).toContain("if (item.status === 'a')");
    expect(output).toContain("else if (item.status === 'b')");
    expect(output).toContain('else { __if0_branch = 2; }');

    // Should create templates for all 3 branches
    expect(output).toContain('__if0_t0');
    expect(output).toContain('__if0_t1');
    expect(output).toContain('__if0_t2');
  });
});


// ── 5.5: Preservation — single-level each with bindings/events/show/attr/model ──

describe('5.5 Preservation — single-level each with bindings/events/show/attr/model produces correct output', () => {
  /**
   * Helper: build a minimal ParseResult with forBlocks for preservation tests.
   */
  function makeParseResult(overrides = {}) {
    return {
      tagName: 'test-preserve',
      className: 'TestPreserve',
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

  it('single-level each with text binding produces correct output without nested forEach', () => {
    const pr = makeParseResult({
      signals: [{ name: 'items', value: '[]' }],
      forBlocks: [{
        varName: '__for0',
        itemVar: 'item',
        indexVar: null,
        source: 'items',
        keyExpr: null,
        templateHtml: '<li></li>',
        anchorPath: ['childNodes[0]'],
        bindings: [{ varName: '__b0', name: 'item.name', type: 'method', path: [] }],
        events: [],
        showBindings: [],
        attrBindings: [],
        modelBindings: [],
        slots: [],
        childComponents: [],
        forBlocks: [],
        ifBlocks: [],
      }],
    });

    const output = generateComponent(pr);

    // Should contain the text binding
    expect(output).toContain("item.name ?? ''");

    // Should NOT contain any nested forEach (only the outer __iter.forEach)
    const forEachMatches = output.match(/__for\d+_iter\.forEach/g);
    expect(forEachMatches).toBeNull();

    // Should NOT contain any per-item conditional logic
    expect(output).not.toContain('__if0_branch');
    expect(output).not.toContain('__if0_anchor');
  });

  it('single-level each with event binding produces correct output without nested logic', () => {
    const pr = makeParseResult({
      signals: [{ name: 'items', value: '[]' }],
      methods: [{ name: 'handleClick', params: '', body: '' }],
      forBlocks: [{
        varName: '__for0',
        itemVar: 'item',
        indexVar: null,
        source: 'items',
        keyExpr: null,
        templateHtml: '<li><button>Click</button></li>',
        anchorPath: ['childNodes[0]'],
        bindings: [],
        events: [{ varName: '__e0', event: 'click', handler: 'handleClick', path: ['childNodes[0]'] }],
        showBindings: [],
        attrBindings: [],
        modelBindings: [],
        slots: [],
        childComponents: [],
        forBlocks: [],
        ifBlocks: [],
      }],
    });

    const output = generateComponent(pr);

    // Should contain the event listener
    expect(output).toContain("addEventListener('click', this._handleClick.bind(this))");

    // Should NOT contain nested forEach or conditional logic
    const forEachMatches = output.match(/__for\d+_iter\.forEach/g);
    expect(forEachMatches).toBeNull();
    expect(output).not.toContain('__if0_branch');
  });

  it('single-level each with show binding produces correct output without nested logic', () => {
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
        modelBindings: [],
        slots: [],
        childComponents: [],
        forBlocks: [],
        ifBlocks: [],
      }],
    });

    const output = generateComponent(pr);

    // Should contain the show binding (static since it only references item)
    expect(output).toContain("node.childNodes[0].style.display = (item.visible) ? '' : 'none'");

    // Should NOT contain nested forEach or conditional logic
    const forEachMatches = output.match(/__for\d+_iter\.forEach/g);
    expect(forEachMatches).toBeNull();
    expect(output).not.toContain('__if0_branch');
  });

  it('single-level each with attr binding produces correct output without nested logic', () => {
    const pr = makeParseResult({
      signals: [{ name: 'items', value: '[]' }],
      forBlocks: [{
        varName: '__for0',
        itemVar: 'item',
        indexVar: null,
        source: 'items',
        keyExpr: null,
        templateHtml: '<li><a></a></li>',
        anchorPath: ['childNodes[0]'],
        bindings: [],
        events: [],
        showBindings: [],
        attrBindings: [{ varName: '__attr0', attr: 'href', expression: 'item.url', path: ['childNodes[0]'] }],
        modelBindings: [],
        slots: [],
        childComponents: [],
        forBlocks: [],
        ifBlocks: [],
      }],
    });

    const output = generateComponent(pr);

    // Should contain the attr binding (static since it only references item)
    expect(output).toContain('item.url');
    expect(output).toContain("setAttribute('href'");

    // Should NOT contain nested forEach or conditional logic
    const forEachMatches = output.match(/__for\d+_iter\.forEach/g);
    expect(forEachMatches).toBeNull();
    expect(output).not.toContain('__if0_branch');
  });

  it('single-level each with model binding produces correct output without nested logic', () => {
    const pr = makeParseResult({
      signals: [{ name: 'items', value: '[]' }, { name: 'selected', value: "''" }],
      forBlocks: [{
        varName: '__for0',
        itemVar: 'item',
        indexVar: null,
        source: 'items',
        keyExpr: null,
        templateHtml: '<li><input type="text" /></li>',
        anchorPath: ['childNodes[0]'],
        bindings: [],
        events: [],
        showBindings: [],
        attrBindings: [],
        modelBindings: [{ varName: '__model0', signal: 'selected', prop: 'value', event: 'input', path: ['childNodes[0]'], coerce: false, radioValue: null }],
        slots: [],
        childComponents: [],
        forBlocks: [],
        ifBlocks: [],
      }],
    });

    const output = generateComponent(pr);

    // Should contain the model binding (reactive effect + event listener)
    expect(output).toContain("this._selected()");
    expect(output).toContain("addEventListener('input'");
    expect(output).toContain("this._selected(e.target.value)");

    // Should NOT contain nested forEach or conditional logic
    const forEachMatches = output.match(/__for\d+_iter\.forEach/g);
    expect(forEachMatches).toBeNull();
    expect(output).not.toContain('__if0_branch');
  });

  it('single-level each with ALL directive types combined produces correct output without nested logic', () => {
    const pr = makeParseResult({
      signals: [{ name: 'items', value: '[]' }, { name: 'query', value: "''" }],
      methods: [{ name: 'remove', params: '', body: '' }],
      forBlocks: [{
        varName: '__for0',
        itemVar: 'item',
        indexVar: 'idx',
        source: 'items',
        keyExpr: null,
        templateHtml: '<li><span></span><button>x</button><input type="text" /><a></a></li>',
        anchorPath: ['childNodes[0]'],
        bindings: [{ varName: '__b0', name: 'item.label', type: 'method', path: ['childNodes[0]'] }],
        events: [{ varName: '__e0', event: 'click', handler: 'remove', path: ['childNodes[1]'] }],
        showBindings: [{ varName: '__show0', expression: 'item.active', path: [] }],
        attrBindings: [{ varName: '__attr0', attr: 'href', expression: 'item.link', path: ['childNodes[3]'] }],
        modelBindings: [{ varName: '__model0', signal: 'query', prop: 'value', event: 'input', path: ['childNodes[2]'], coerce: false, radioValue: null }],
        slots: [],
        childComponents: [],
        forBlocks: [],
        ifBlocks: [],
      }],
    });

    const output = generateComponent(pr);

    // Text binding
    expect(output).toContain("item.label ?? ''");

    // Event binding
    expect(output).toContain("addEventListener('click', this._remove.bind(this))");

    // Show binding (static — references item.active)
    expect(output).toContain("style.display = (item.active) ? '' : 'none'");

    // Attr binding (static — references item.link)
    expect(output).toContain('item.link');
    expect(output).toContain("setAttribute('href'");

    // Model binding (reactive — references signal)
    expect(output).toContain("this._query()");
    expect(output).toContain("addEventListener('input'");

    // Should NOT contain any nested forEach
    const forEachMatches = output.match(/__for\d+_iter\.forEach/g);
    expect(forEachMatches).toBeNull();

    // Should NOT contain any per-item conditional logic from nested if blocks
    expect(output).not.toContain('__if0_branch');
    expect(output).not.toContain('__if0_anchor');
    expect(output).not.toContain('__if0_t0');

    // Should contain the standard each structure
    expect(output).toContain("this.__for0_tpl = document.createElement('template')");
    expect(output).toContain('this.__for0_anchor');
    expect(output).toContain('this.__for0_nodes = []');
    expect(output).toContain('__effect(');
    expect(output).toContain('__iter.forEach((item, idx)');
  });
});
