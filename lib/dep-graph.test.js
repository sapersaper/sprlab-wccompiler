/**
 * Unit tests for the zero-runtime dependency graph utilities.
 * Tests extractDeps, refsComputedOrMethod, and buildDepGraph.
 */

import { describe, it, expect } from 'vitest';
import { extractDeps, refsComputedOrMethod, buildDepGraph } from './codegen.js';

// ── extractDeps ─────────────────────────────────────────────────────

describe('extractDeps', () => {
  it('extracts a single signal from a bare name', () => {
    const deps = extractDeps('count', ['count', 'name'], new Set(), []);
    expect(deps).toEqual(new Set(['count']));
  });

  it('extracts a single signal from a function call pattern', () => {
    const deps = extractDeps('count()', ['count', 'name'], new Set(), []);
    expect(deps).toEqual(new Set(['count']));
  });

  it('extracts multiple signals from a complex expression', () => {
    const deps = extractDeps('firstName() + " " + lastName()', ['firstName', 'lastName'], new Set(), []);
    expect(deps).toEqual(new Set(['firstName', 'lastName']));
  });

  it('extracts prop names', () => {
    const deps = extractDeps('label', [], new Set(['label', 'title']), []);
    expect(deps).toEqual(new Set(['label']));
  });

  it('extracts model var names mapped to model prop names', () => {
    const deps = extractDeps('modelValue()', [], new Set(), [{ name: 'modelValue', varName: 'modelValue' }]);
    expect(deps).toEqual(new Set(['modelValue']));
  });

  it('extracts model var with different varName', () => {
    const deps = extractDeps('val()', [], new Set(), [{ name: 'modelValue', varName: 'val' }]);
    expect(deps).toEqual(new Set(['modelValue']));
  });

  it('returns empty set for static expressions', () => {
    const deps = extractDeps('"hello"', ['count'], new Set(), []);
    // "hello" contains no signal names
    expect(deps).toEqual(new Set());
  });

  it('extracts from ternary expressions', () => {
    const deps = extractDeps('count() > 5 ? "high" : "low"', ['count'], new Set(), []);
    expect(deps).toEqual(new Set(['count']));
  });

  it('extracts from comparison expressions', () => {
    const deps = extractDeps('count > 0', ['count'], new Set(), []);
    expect(deps).toEqual(new Set(['count']));
  });

  it('does not match partial names', () => {
    const deps = extractDeps('discount()', ['count'], new Set(), []);
    expect(deps).toEqual(new Set());
  });
});

// ── refsComputedOrMethod ────────────────────────────────────────────

describe('refsComputedOrMethod', () => {
  it('returns true when expression references a computed', () => {
    expect(refsComputedOrMethod('doubled', ['doubled'], [])).toBe(true);
  });

  it('returns true when expression references a computed with call syntax', () => {
    expect(refsComputedOrMethod('doubled()', ['doubled'], [])).toBe(true);
  });

  it('returns true when expression contains a method call', () => {
    expect(refsComputedOrMethod('getLabel()', [], ['getLabel'])).toBe(true);
  });

  it('returns true when expression contains method call with args', () => {
    expect(refsComputedOrMethod('format(count)', [], ['format'])).toBe(true);
  });

  it('returns false for pure signal expressions', () => {
    expect(refsComputedOrMethod('count() + 1', [], [])).toBe(false);
  });

  it('returns false for expressions with no computed or method', () => {
    expect(refsComputedOrMethod('count > 5 ? "yes" : "no"', ['doubled'], ['format'])).toBe(false);
  });

  it('does not match partial computed names', () => {
    expect(refsComputedOrMethod('redoubled', ['doubled'], [])).toBe(false);
  });
});

// ── buildDepGraph ───────────────────────────────────────────────────

describe('buildDepGraph', () => {
  const baseContext = {
    signalNames: ['count', 'visible', 'firstName', 'lastName'],
    computedNames: ['doubled'],
    propNames: new Set(['label']),
    propDefs: [{ name: 'label', default: "'Hello'", attrName: 'label' }],
    modelDefs: [],
    modelVarMap: new Map(),
    propsObjectName: 'props',
    emitsObjectName: null,
    constantNames: [],
    methodNames: ['getLabel'],
  };

  it('classifies a simple signal text binding into depGraph', () => {
    const parseResult = {
      bindings: [{ name: 'count', type: 'signal', varName: '__b0' }],
      showBindings: [],
      attrBindings: [],
      constantVars: [],
    };

    const { depGraph, effectBindings } = buildDepGraph(parseResult, baseContext);

    expect(depGraph.has('count')).toBe(true);
    expect(depGraph.get('count')).toHaveLength(1);
    expect(depGraph.get('count')[0].type).toBe('text');
    expect(depGraph.get('count')[0].varName).toBe('__b0');
    expect(effectBindings.text).toHaveLength(0);
  });

  it('classifies a multi-signal text binding under both signals', () => {
    const parseResult = {
      bindings: [{ name: 'firstName() + " " + lastName()', type: 'expression', varName: '__b0' }],
      showBindings: [],
      attrBindings: [],
      constantVars: [],
    };

    const { depGraph } = buildDepGraph(parseResult, baseContext);

    expect(depGraph.has('firstName')).toBe(true);
    expect(depGraph.has('lastName')).toBe(true);
    // Both should reference the same binding
    expect(depGraph.get('firstName')[0].varName).toBe('__b0');
    expect(depGraph.get('lastName')[0].varName).toBe('__b0');
  });

  it('keeps computed-type bindings in effectBindings', () => {
    const parseResult = {
      bindings: [{ name: 'doubled', type: 'computed', varName: '__b0' }],
      showBindings: [],
      attrBindings: [],
      constantVars: [],
    };

    const { depGraph, effectBindings } = buildDepGraph(parseResult, baseContext);

    expect(depGraph.size).toBe(0);
    expect(effectBindings.text).toHaveLength(1);
    expect(effectBindings.text[0].name).toBe('doubled');
  });

  it('keeps method-referencing expressions in effectBindings', () => {
    const parseResult = {
      bindings: [{ name: 'getLabel()', type: 'expression', varName: '__b0' }],
      showBindings: [],
      attrBindings: [],
      constantVars: [],
    };

    const { depGraph, effectBindings } = buildDepGraph(parseResult, baseContext);

    expect(depGraph.size).toBe(0);
    expect(effectBindings.text).toHaveLength(1);
  });

  it('classifies show bindings into depGraph', () => {
    const parseResult = {
      bindings: [],
      showBindings: [{ expression: 'visible', varName: '__sb0' }],
      attrBindings: [],
      constantVars: [],
    };

    const { depGraph } = buildDepGraph(parseResult, baseContext);

    expect(depGraph.has('visible')).toBe(true);
    expect(depGraph.get('visible')[0].type).toBe('show');
    expect(depGraph.get('visible')[0].varName).toBe('__sb0');
  });

  it('classifies attr bindings into depGraph', () => {
    const parseResult = {
      bindings: [],
      showBindings: [],
      attrBindings: [{ expression: 'count > 5', kind: 'bool', varName: '__ab0', attr: 'disabled', staticValue: null }],
      constantVars: [],
    };

    const { depGraph } = buildDepGraph(parseResult, baseContext);

    expect(depGraph.has('count')).toBe(true);
    expect(depGraph.get('count')[0].type).toBe('bool');
    expect(depGraph.get('count')[0].attr).toBe('disabled');
  });

  it('classifies class binding with object expression', () => {
    const parseResult = {
      bindings: [],
      showBindings: [],
      attrBindings: [{ expression: '{ active: visible }', kind: 'class', varName: '__ab0', attr: 'class', staticValue: null }],
      constantVars: [],
    };

    const { depGraph } = buildDepGraph(parseResult, baseContext);

    expect(depGraph.has('visible')).toBe(true);
    expect(depGraph.get('visible')[0].type).toBe('class');
    expect(depGraph.get('visible')[0].subKind).toBe('object');
  });

  it('classifies style binding with string expression', () => {
    const parseResult = {
      bindings: [],
      showBindings: [],
      attrBindings: [{ expression: 'count + "px"', kind: 'style', varName: '__ab0', attr: 'style', staticValue: 'margin: 0' }],
      constantVars: [],
    };

    const { depGraph } = buildDepGraph(parseResult, baseContext);

    expect(depGraph.has('count')).toBe(true);
    expect(depGraph.get('count')[0].type).toBe('style');
    expect(depGraph.get('count')[0].subKind).toBe('string');
    expect(depGraph.get('count')[0].staticValue).toBe('margin: 0');
  });

  it('keeps show bindings referencing computeds in effectBindings', () => {
    const parseResult = {
      bindings: [],
      showBindings: [{ expression: 'doubled > 10', varName: '__sb0' }],
      attrBindings: [],
      constantVars: [],
    };

    const { depGraph, effectBindings } = buildDepGraph(parseResult, baseContext);

    expect(depGraph.size).toBe(0);
    expect(effectBindings.show).toHaveLength(1);
  });

  it('keeps attr bindings referencing computeds in effectBindings', () => {
    const parseResult = {
      bindings: [],
      showBindings: [],
      attrBindings: [{ expression: 'doubled', kind: 'attr', varName: '__ab0', attr: 'data-val', staticValue: null }],
      constantVars: [],
    };

    const { depGraph, effectBindings } = buildDepGraph(parseResult, baseContext);

    expect(depGraph.size).toBe(0);
    expect(effectBindings.attr).toHaveLength(1);
  });

  it('classifies prop-dependent text binding into depGraph', () => {
    const parseResult = {
      bindings: [{ name: 'label', type: 'prop', varName: '__b0' }],
      showBindings: [],
      attrBindings: [],
      constantVars: [],
    };

    const { depGraph } = buildDepGraph(parseResult, baseContext);

    expect(depGraph.has('label')).toBe(true);
    expect(depGraph.get('label')[0].type).toBe('text');
  });

  it('skips constant function bindings (keeps in effectBindings)', () => {
    const parseResult = {
      bindings: [{ name: 'formatter', type: 'constant', varName: '__b0' }],
      showBindings: [],
      attrBindings: [],
      constantVars: [{ name: 'formatter', value: '() => count() + 1' }],
    };

    const { depGraph, effectBindings } = buildDepGraph(parseResult, baseContext);

    expect(depGraph.size).toBe(0);
    expect(effectBindings.text).toHaveLength(1);
  });

  it('skips non-function constant bindings entirely (static)', () => {
    const parseResult = {
      bindings: [{ name: 'title', type: 'constant', varName: '__b0' }],
      showBindings: [],
      attrBindings: [],
      constantVars: [{ name: 'title', value: "'My App'" }],
    };

    const { depGraph, effectBindings } = buildDepGraph(parseResult, baseContext);

    expect(depGraph.size).toBe(0);
    expect(effectBindings.text).toHaveLength(0);
  });
});
