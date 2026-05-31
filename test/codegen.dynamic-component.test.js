import { describe, it, expect } from 'vitest';
import { generateComponent } from '../lib/codegen.js';

// ── Helper: build a minimal ParseResult with dynamicComponents ──────

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
    processedTemplate: '<div><!-- dynamic --></div>',
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

// ── Basic compiled output for <component :is="currentView()"> ───────
// Requirements: 2.1, 2.2, 2.3, 10.2, 10.3

describe('codegen dynamic component — basic swap effect', () => {
  it('emits anchor reference initialization', () => {
    const pr = makeParseResult({
      signals: [{ name: 'currentView', value: "'home-page'" }],
      dynamicComponents: [{
        varName: '__dyn0',
        isExpression: 'currentView()',
        props: [],
        events: [],
        anchorType: 'dynamic', anchorIndex: 0, anchorPath: ['childNodes[0]', 'childNodes[0]'],
      }],
    });

    const output = generateComponent(pr);

    expect(output).toContain("this.__dyn0_anchor = findAnchor(__root, 'dynamic', 0)");
    expect(output).toContain('this.__dyn0_current = null');
    expect(output).toContain('this.__dyn0_tag = null');
    expect(output).toContain('this.__dyn0_propDisposers = []');
  });

  it('emits swap reactive effect with tag comparison and early return (Phase 4: __renderDynamic_N)', () => {
    const pr = makeParseResult({
      signals: [{ name: 'currentView', value: "'home-page'" }],
      dynamicComponents: [{
        varName: '__dyn0',
        isExpression: 'currentView()',
        props: [],
        events: [],
        anchorType: 'dynamic', anchorIndex: 0, anchorPath: ['childNodes[0]', 'childNodes[0]'],
      }],
    });

    const output = generateComponent(pr);

    // Phase 4: No __effect, uses __renderDynamic_0 method
    expect(output).not.toContain('__effect(');
    expect(output).toContain('__renderDynamic_0()');
    // Transformed expression: currentView() → this._state.currentView
    expect(output).toContain('const __tag = this._state.currentView');
    // Tag comparison for early return (idempotence)
    expect(output).toContain('if (__tag === this.__dyn0_tag) return');
  });

  it('emits cleanup logic: remove old element (Phase 4: no propDisposers cleanup)', () => {
    const pr = makeParseResult({
      signals: [{ name: 'currentView', value: "'home-page'" }],
      dynamicComponents: [{
        varName: '__dyn0',
        isExpression: 'currentView()',
        props: [],
        events: [],
        anchorType: 'dynamic', anchorIndex: 0, anchorPath: ['childNodes[0]', 'childNodes[0]'],
      }],
    });

    const output = generateComponent(pr);

    expect(output).toContain('if (this.__dyn0_current) {');
    // Phase 4: No prop disposers (props handled via __invalidate and __renderDynamic_N)
    expect(output).toContain('this.__dyn0_current.remove()');
    expect(output).toContain('this.__dyn0_current = null');
  });

  it('emits element creation with document.createElement, insertBefore, and customElements.upgrade', () => {
    const pr = makeParseResult({
      signals: [{ name: 'currentView', value: "'home-page'" }],
      dynamicComponents: [{
        varName: '__dyn0',
        isExpression: 'currentView()',
        props: [],
        events: [],
        anchorType: 'dynamic', anchorIndex: 0, anchorPath: ['childNodes[0]', 'childNodes[0]'],
      }],
    });

    const output = generateComponent(pr);

    expect(output).toContain('if (__tag) {');
    expect(output).toContain('const el = document.createElement(__tag)');
    expect(output).toContain('this.__dyn0_anchor.parentNode.insertBefore(el, this.__dyn0_anchor)');
    expect(output).toContain('customElements.upgrade(el)');
    expect(output).toContain('this.__dyn0_current = el');
  });

  it('stores the new tag name after swap', () => {
    const pr = makeParseResult({
      signals: [{ name: 'currentView', value: "'home-page'" }],
      dynamicComponents: [{
        varName: '__dyn0',
        isExpression: 'currentView()',
        props: [],
        events: [],
        anchorType: 'dynamic', anchorIndex: 0, anchorPath: ['childNodes[0]', 'childNodes[0]'],
      }],
    });

    const output = generateComponent(pr);

    expect(output).toContain('this.__dyn0_tag = __tag');
  });
});

// ── Compiled output with props ──────────────────────────────────────
// Requirements: 4.1, 10.4

describe('codegen dynamic component — prop bindings', () => {
  it('emits setAttribute calls for each prop in __renderDynamic_N (Phase 4)', () => {
    const pr = makeParseResult({
      signals: [
        { name: 'routeComponent', value: "'page-a'" },
        { name: 'pageTitle', value: "'Hello'" },
        { name: 'items', value: '[]' },
      ],
      dynamicComponents: [{
        varName: '__dyn0',
        isExpression: 'routeComponent()',
        props: [
          { attr: 'title', expression: 'pageTitle()' },
          { attr: 'data', expression: 'items()' },
        ],
        events: [],
        anchorType: 'dynamic', anchorIndex: 0, anchorPath: ['childNodes[0]'],
      }],
    });

    const output = generateComponent(pr);

    // Phase 4: Props are set in __renderDynamic_0 and updated via __invalidate
    // No more propDisposers push(__effect(...))
    expect(output).not.toContain('this.__dyn0_propDisposers.push');
    expect(output).not.toContain('__effect(');
    expect(output).toContain("el.setAttribute('title', this._state.pageTitle");
    expect(output).toContain("el.setAttribute('data', this._state.items");
  });

  it('emits exactly the correct number of setAttribute calls for props (Phase 4)', () => {
    const pr = makeParseResult({
      signals: [
        { name: 'tag', value: "'x-comp'" },
        { name: 'a', value: "'1'" },
        { name: 'b', value: "'2'" },
        { name: 'c', value: "'3'" },
      ],
      dynamicComponents: [{
        varName: '__dyn0',
        isExpression: 'tag()',
        props: [
          { attr: 'alpha', expression: 'a()' },
          { attr: 'beta', expression: 'b()' },
          { attr: 'gamma', expression: 'c()' },
        ],
        events: [],
        anchorType: 'dynamic', anchorIndex: 0, anchorPath: ['childNodes[0]'],
      }],
    });

    const output = generateComponent(pr);

    // Count setAttribute calls directly (not via propDisposers)
    const setAttrCalls = output.match(/el\.setAttribute\(/g);
    expect(setAttrCalls).toHaveLength(3);
  });
});

// ── Compiled output with events ─────────────────────────────────────
// Requirements: 5.1, 10.5

describe('codegen dynamic component — event bindings', () => {
  it('emits addEventListener calls for each event binding', () => {
    const pr = makeParseResult({
      signals: [{ name: 'view', value: "'nav'" }],
      methods: [
        { name: 'onNavigate', params: '', body: '' },
        { name: 'handleClick', params: '', body: '' },
      ],
      dynamicComponents: [{
        varName: '__dyn0',
        isExpression: 'view()',
        props: [],
        events: [
          { event: 'navigate', handler: 'onNavigate' },
          { event: 'click', handler: 'handleClick' },
        ],
        anchorType: 'dynamic', anchorIndex: 0, anchorPath: ['childNodes[0]'],
      }],
    });

    const output = generateComponent(pr);

    // Event listeners are attached after element creation
    expect(output).toContain("el.addEventListener('navigate', this._onNavigate.bind(this))");
    expect(output).toContain("el.addEventListener('click', this._handleClick.bind(this))");
  });

  it('emits correct number of addEventListener calls', () => {
    const pr = makeParseResult({
      signals: [{ name: 'tag', value: "'x'" }],
      methods: [
        { name: 'a', params: '', body: '' },
        { name: 'b', params: '', body: '' },
      ],
      dynamicComponents: [{
        varName: '__dyn0',
        isExpression: 'tag()',
        props: [],
        events: [
          { event: 'foo', handler: 'a' },
          { event: 'bar', handler: 'b' },
        ],
        anchorType: 'dynamic', anchorIndex: 0, anchorPath: ['childNodes[0]'],
      }],
    });

    const output = generateComponent(pr);

    const addEventCalls = output.match(/el\.addEventListener\(/g);
    expect(addEventCalls).toHaveLength(2);
  });
});

// ── Compiled output with ternary expression ─────────────────────────
// Requirements: 9.1

describe('codegen dynamic component — ternary expression', () => {
  it('transforms ternary :is expression correctly', () => {
    const pr = makeParseResult({
      signals: [{ name: 'isAdmin', value: 'false' }],
      dynamicComponents: [{
        varName: '__dyn0',
        isExpression: "isAdmin() ? 'admin-panel' : 'user-panel'",
        props: [],
        events: [],
        anchorType: 'dynamic', anchorIndex: 0, anchorPath: ['childNodes[0]'],
      }],
    });

    const output = generateComponent(pr);

    // The ternary expression should be transformed: isAdmin() → this._state.isAdmin
    expect(output).toContain("const __tag = this._state.isAdmin ? 'admin-panel' : 'user-panel'");
  });

  it('handles ternary with prop bindings on the dynamic component (Phase 4)', () => {
    const pr = makeParseResult({
      signals: [
        { name: 'isAdmin', value: 'false' },
        { name: 'currentUser', value: "'guest'" },
      ],
      dynamicComponents: [{
        varName: '__dyn0',
        isExpression: "isAdmin() ? 'admin-panel' : 'user-panel'",
        props: [
          { attr: 'user', expression: 'currentUser()' },
        ],
        events: [],
        anchorType: 'dynamic', anchorIndex: 0, anchorPath: ['childNodes[0]'],
      }],
    });

    const output = generateComponent(pr);

    expect(output).toContain("const __tag = this._state.isAdmin ? 'admin-panel' : 'user-panel'");
    // Phase 4: setAttribute includes nullish coalescing (?? '')
    expect(output).toContain("el.setAttribute('user', this._state.currentUser");
  });
});

// ── Prop disposers are cleaned up on swap ───────────────────────────
// Requirements: 2.2, 4.1

describe('codegen dynamic component — prop disposer cleanup on swap', () => {
  it('removes old element before creating new one (Phase 4: no propDisposers)', () => {
    const pr = makeParseResult({
      signals: [
        { name: 'tag', value: "'comp-a'" },
        { name: 'title', value: "'hi'" },
      ],
      dynamicComponents: [{
        varName: '__dyn0',
        isExpression: 'tag()',
        props: [
          { attr: 'title', expression: 'title()' },
        ],
        events: [],
        anchorType: 'dynamic', anchorIndex: 0, anchorPath: ['childNodes[0]'],
      }],
    });

    const output = generateComponent(pr);

    // Extract the cleanup block inside if (this.__dyn0_current) { ... }
    const cleanupStart = output.indexOf('if (this.__dyn0_current) {');
    expect(cleanupStart).toBeGreaterThan(-1);

    // Within the cleanup block: remove → set null (no propDisposers in Phase 4)
    const cleanupSection = output.slice(cleanupStart);
    const removeIdx = cleanupSection.indexOf('this.__dyn0_current.remove()');
    const nullIdx = cleanupSection.indexOf('this.__dyn0_current = null');

    expect(removeIdx).toBeGreaterThan(-1);
    expect(nullIdx).toBeGreaterThan(-1);
    expect(removeIdx).toBeLessThan(nullIdx);
  });

  it('cleanup block is guarded by current element existence check', () => {
    const pr = makeParseResult({
      signals: [{ name: 'tag', value: "'x'" }],
      dynamicComponents: [{
        varName: '__dyn0',
        isExpression: 'tag()',
        props: [{ attr: 'a', expression: 'tag()' }],
        events: [],
        anchorType: 'dynamic', anchorIndex: 0, anchorPath: ['childNodes[0]'],
      }],
    });

    const output = generateComponent(pr);

    // The cleanup is inside an if (this.__dyn0_current) block
    const ifCurrentIdx = output.indexOf('if (this.__dyn0_current) {');
    const removeIdx = output.indexOf('this.__dyn0_current.remove()');

    expect(ifCurrentIdx).toBeGreaterThan(-1);
    expect(removeIdx).toBeGreaterThan(-1);
    expect(ifCurrentIdx).toBeLessThan(removeIdx);
  });
});

// ── Falsy expression removes element without replacement ────────────
// Requirements: 2.3

describe('codegen dynamic component — falsy expression handling', () => {
  it('new element creation is guarded by if (__tag) check', () => {
    const pr = makeParseResult({
      signals: [{ name: 'currentView', value: "''" }],
      dynamicComponents: [{
        varName: '__dyn0',
        isExpression: 'currentView()',
        props: [],
        events: [],
        anchorType: 'dynamic', anchorIndex: 0, anchorPath: ['childNodes[0]'],
      }],
    });

    const output = generateComponent(pr);

    // The createElement is inside an if (__tag) block
    expect(output).toContain('if (__tag) {');
    expect(output).toContain('const el = document.createElement(__tag)');

    // The tag is still stored even when falsy (so next comparison works)
    expect(output).toContain('this.__dyn0_tag = __tag');
  });

  it('tag assignment happens outside the if (__tag) block (after both branches)', () => {
    const pr = makeParseResult({
      signals: [{ name: 'view', value: "''" }],
      dynamicComponents: [{
        varName: '__dyn0',
        isExpression: 'view()',
        props: [],
        events: [],
        anchorType: 'dynamic', anchorIndex: 0, anchorPath: ['childNodes[0]'],
      }],
    });

    const output = generateComponent(pr);

    // The tag assignment should come after the closing brace of if (__tag) { ... }
    // and before the closing of the effect
    const ifTagIdx = output.indexOf('if (__tag) {');
    const tagAssignIdx = output.indexOf('this.__dyn0_tag = __tag');
    const createElementIdx = output.indexOf('document.createElement(__tag)');

    expect(ifTagIdx).toBeGreaterThan(-1);
    expect(tagAssignIdx).toBeGreaterThan(-1);
    expect(createElementIdx).toBeGreaterThan(-1);

    // createElement is inside if (__tag), tag assignment is after it
    expect(createElementIdx).toBeGreaterThan(ifTagIdx);
    expect(tagAssignIdx).toBeGreaterThan(createElementIdx);
  });
});
