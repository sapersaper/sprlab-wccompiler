/**
 * Tests for codegen scoped slot changes:
 * - __scopedSlots static array emission
 * - __scopedSlots instance getter
 * - registerSlotRenderer method
 * - __slotRenderers / __slotProps initialization
 * - Effect stores props in __slotProps
 * - Effect emits wcc:slot-update event
 * - Token replacement skipped when renderer registered
 * - Token replacement works as fallback
 */

import { describe, it, expect } from 'vitest';
import { generateComponent } from './codegen.js';

/**
 * Helper: create a minimal ParseResult with scoped slots.
 */
function makeParseResult(overrides = {}) {
  return {
    tagName: 'wcc-card',
    className: 'WccCard',
    style: '',
    signals: [{ name: 'likes', value: '0' }],
    computeds: [],
    effects: [],
    methods: [],
    bindings: [],
    events: [],
    processedTemplate: '<div><div data-slot="stats"></div></div>',
    slots: [
      {
        name: 'stats',
        varName: '__s1',
        path: ['childNodes[0]'],
        slotProps: [{ prop: 'likes', source: 'likes' }],
        defaultContent: '',
      },
    ],
    propDefs: [],
    propsObjectName: null,
    emits: [],
    emitsObjectName: null,
    ifBlocks: [],
    showBindings: [],
    forBlocks: [],
    onMountHooks: [],
    onDestroyHooks: [],
    modelBindings: [],
    modelPropBindings: [],
    attrBindings: [],
    constantVars: [],
    watchers: [],
    refs: [],
    refBindings: [],
    childComponents: [],
    childImports: [],
    exposeNames: [],
    modelDefs: [],
    ...overrides,
  };
}

/**
 * Helper: create a ParseResult WITHOUT scoped slots.
 */
function makeParseResultNoScoped(overrides = {}) {
  return {
    tagName: 'wcc-simple',
    className: 'WccSimple',
    style: '',
    signals: [{ name: 'count', value: '0' }],
    computeds: [],
    effects: [],
    methods: [],
    bindings: [],
    events: [],
    processedTemplate: '<div><span></span></div>',
    slots: [],
    propDefs: [],
    propsObjectName: null,
    emits: [],
    emitsObjectName: null,
    ifBlocks: [],
    showBindings: [],
    forBlocks: [],
    onMountHooks: [],
    onDestroyHooks: [],
    modelBindings: [],
    modelPropBindings: [],
    attrBindings: [],
    constantVars: [],
    watchers: [],
    refs: [],
    refBindings: [],
    childComponents: [],
    childImports: [],
    exposeNames: [],
    modelDefs: [],
    ...overrides,
  };
}

describe('Codegen: __scopedSlots static array', () => {
  it('emits static __scopedSlots for components with scoped slots', () => {
    const code = generateComponent(makeParseResult());
    expect(code).toContain("static __scopedSlots = ['stats']");
  });

  it('does NOT emit __scopedSlots for components without scoped slots', () => {
    const code = generateComponent(makeParseResultNoScoped());
    expect(code).not.toContain('__scopedSlots');
  });

  it('lists multiple scoped slot names', () => {
    const code = generateComponent(makeParseResult({
      slots: [
        { name: 'stats', varName: '__s1', path: ['childNodes[0]'], slotProps: [{ prop: 'likes', source: 'likes' }], defaultContent: '' },
        { name: 'details', varName: '__s2', path: ['childNodes[1]'], slotProps: [{ prop: 'total', source: 'likes' }], defaultContent: '' },
      ],
      processedTemplate: '<div><div data-slot="stats"></div><div data-slot="details"></div></div>',
    }));
    expect(code).toContain("static __scopedSlots = ['stats', 'details']");
  });

  it('does not include named slots (no slotProps) in __scopedSlots', () => {
    const code = generateComponent(makeParseResult({
      slots: [
        { name: 'stats', varName: '__s1', path: ['childNodes[0]'], slotProps: [{ prop: 'likes', source: 'likes' }], defaultContent: '' },
        { name: 'header', varName: '__s2', path: ['childNodes[1]'], slotProps: [], defaultContent: '' },
      ],
      processedTemplate: '<div><div data-slot="stats"></div><div data-slot="header"></div></div>',
    }));
    expect(code).toContain("static __scopedSlots = ['stats']");
    // 'header' should NOT be in the __scopedSlots array
    expect(code).not.toMatch(/static __scopedSlots\s*=\s*\[.*'header'.*\]/);
  });
});

describe('Codegen: __scopedSlots instance getter', () => {
  it('emits instance getter for components with scoped slots', () => {
    const code = generateComponent(makeParseResult());
    expect(code).toContain('get __scopedSlots() { return this.constructor.__scopedSlots || []; }');
  });

  it('does NOT emit instance getter for components without scoped slots', () => {
    const code = generateComponent(makeParseResultNoScoped());
    expect(code).not.toContain('get __scopedSlots()');
  });
});

describe('Codegen: registerSlotRenderer method', () => {
  it('emits registerSlotRenderer for components with scoped slots', () => {
    const code = generateComponent(makeParseResult());
    expect(code).toContain('registerSlotRenderer(slotName, callback)');
  });

  it('does NOT emit registerSlotRenderer for components without scoped slots', () => {
    const code = generateComponent(makeParseResultNoScoped());
    expect(code).not.toContain('registerSlotRenderer');
  });

  it('stores callback in __slotRenderers', () => {
    const code = generateComponent(makeParseResult());
    expect(code).toContain('this.__slotRenderers[slotName] = callback');
  });

  it('invokes callback immediately if __slotProps already has data', () => {
    const code = generateComponent(makeParseResult());
    expect(code).toContain('if (this.__slotProps && this.__slotProps[slotName])');
    expect(code).toContain('callback(this.__slotProps[slotName])');
  });

  it('returns a cleanup function that deletes the renderer', () => {
    const code = generateComponent(makeParseResult());
    expect(code).toContain('delete this.__slotRenderers[slotName]');
  });
});

describe('Codegen: __slotRenderers and __slotProps initialization', () => {
  it('initializes __slotRenderers in constructor for scoped slots', () => {
    const code = generateComponent(makeParseResult());
    expect(code).toContain('this.__slotRenderers = {}');
  });

  it('initializes __slotProps in constructor for scoped slots', () => {
    const code = generateComponent(makeParseResult());
    expect(code).toContain('this.__slotProps = {}');
  });

  it('does NOT initialize __slotRenderers for components without scoped slots', () => {
    const code = generateComponent(makeParseResultNoScoped());
    expect(code).not.toContain('__slotRenderers');
  });

  it('does NOT initialize __slotProps for components without scoped slots', () => {
    const code = generateComponent(makeParseResultNoScoped());
    expect(code).not.toContain('__slotProps');
  });
});

describe('Codegen: scoped slot effect stores props in __slotProps', () => {
  it('stores props in __slotProps within the effect', () => {
    const code = generateComponent(makeParseResult());
    expect(code).toContain("this.__slotProps['stats'] = __props");
  });
});

describe('Codegen: scoped slot effect emits wcc:slot-update event', () => {
  it('dispatches wcc:slot-update CustomEvent', () => {
    const code = generateComponent(makeParseResult());
    expect(code).toContain("this.dispatchEvent(new CustomEvent('wcc:slot-update'");
  });

  it('event has correct detail structure with slot and props', () => {
    const code = generateComponent(makeParseResult());
    expect(code).toContain("detail: { slot: 'stats', props: __props }");
  });

  it('event has bubbles: false', () => {
    const code = generateComponent(makeParseResult());
    expect(code).toContain('bubbles: false');
  });
});

describe('Codegen: token replacement skipped when renderer registered', () => {
  it('checks for registered renderer before token replacement', () => {
    const code = generateComponent(makeParseResult());
    expect(code).toContain("if (this.__slotRenderers && this.__slotRenderers['stats'])");
  });

  it('invokes the renderer with __props when registered', () => {
    const code = generateComponent(makeParseResult());
    expect(code).toContain("this.__slotRenderers['stats'](__props)");
  });

  it('preserves token replacement as else fallback', () => {
    const code = generateComponent(makeParseResult());
    // The token replacement should be inside an else block
    expect(code).toContain('} else {');
    expect(code).toContain('__html = __html.replace(');
  });

  it('token replacement still sets innerHTML on the slot element', () => {
    const code = generateComponent(makeParseResult());
    expect(code).toContain('this.__s1.innerHTML = __html');
  });
});
