/**
 * Unit tests for the zero-runtime dependency graph utilities.
 * Tests extractDeps, refsComputedOrMethod, and buildDepGraph.
 */

import { describe, it, expect } from 'vitest';
import { extractDeps, refsComputedOrMethod, buildDepGraph, extractComputedDeps, topologicalSortComputeds } from './codegen.js';

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

  it('Phase 2: computed-type bindings go to depGraph (no __effect needed)', () => {
    const parseResult = {
      bindings: [{ name: 'doubled', type: 'computed', varName: '__b0' }],
      showBindings: [],
      attrBindings: [],
      constantVars: [],
    };

    const { depGraph, effectBindings } = buildDepGraph(parseResult, baseContext);

    expect(depGraph.size).toBe(1);
    expect(depGraph.has('doubled')).toBe(true);
    expect(depGraph.get('doubled')[0].type).toBe('text');
    expect(depGraph.get('doubled')[0].expr).toBe('this._state.doubled');
    expect(effectBindings.text).toHaveLength(0);
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

// ── Phase 2: extractComputedDeps ────────────────────────────────────

describe('extractComputedDeps', () => {
  it('extracts a single signal dependency', () => {
    const deps = extractComputedDeps('count * 2', ['count', 'name'], ['doubled']);
    expect(deps).toEqual(['count']);
  });

  it('extracts multiple signal dependencies', () => {
    const deps = extractComputedDeps('firstName + " " + lastName', ['firstName', 'lastName', 'age'], ['fullName']);
    expect(deps).toEqual(['firstName', 'lastName']);
  });

  it('extracts computed-to-computed dependency', () => {
    const deps = extractComputedDeps('doubled + 1', ['count'], ['doubled']);
    expect(deps).toEqual(['doubled']);
  });

  it('extracts both signal and computed deps', () => {
    const deps = extractComputedDeps('count + doubled', ['count', 'name'], ['doubled']);
    expect(deps).toEqual(['count', 'doubled']);
  });
});

// ── Phase 2: topologicalSortComputeds ───────────────────────────────

describe('topologicalSortComputeds', () => {
  it('returns single computed in order', () => {
    const order = topologicalSortComputeds(
      [{ name: 'doubled', deps: ['count'] }],
      new Set(['doubled'])
    );
    expect(order).toEqual(['doubled']);
  });

  it('returns two independent computeds', () => {
    const order = topologicalSortComputeds(
      [
        { name: 'doubled', deps: ['count'] },
        { name: 'tripled', deps: ['count'] },
      ],
      new Set(['doubled', 'tripled'])
    );
    expect(order).toHaveLength(2);
    expect(order).toContain('doubled');
    expect(order).toContain('tripled');
  });

  it('orders computed chain: A depends on B depends on signal', () => {
    const order = topologicalSortComputeds(
      [
        { name: 'total', deps: ['doubled'] },
        { name: 'doubled', deps: ['count'] },
      ],
      new Set(['total', 'doubled'])
    );
    expect(order).toEqual(['doubled', 'total']);
  });

  it('throws on circular dependency', () => {
    expect(() => topologicalSortComputeds(
      [
        { name: 'a', deps: ['b'] },
        { name: 'b', deps: ['a'] },
      ],
      new Set(['a', 'b'])
    )).toThrow('Circular dependency detected among computed values');
  });

  it('returns empty array for no computeds', () => {
    expect(topologicalSortComputeds([], new Set())).toEqual([]);
  });
});

// ── Phase 2: buildDepGraph with if-blocks ───────────────────────────

describe('buildDepGraph — Phase 2 if-blocks', () => {
  const baseCtx = {
    signalNames: ['status', 'count'],
    computedNames: [],
    propNames: new Set(),
    modelDefs: [],
    modelVarMap: new Map(),
    propsObjectName: null,
    emitsObjectName: null,
    constantNames: [],
    methodNames: [],
  };

  it('registers renderIf entries for if-block condition signals', () => {
    const result = buildDepGraph({
      bindings: [],
      showBindings: [],
      attrBindings: [],
      ifBlocks: [{
        varName: '__if0',
        branches: [
          { type: 'if', expression: "status === 'active'" },
          { type: 'else', expression: null },
        ],
      }],
    }, baseCtx);

    expect(result.depGraph.has('status')).toBe(true);
    const entries = result.depGraph.get('status');
    expect(entries.some(e => e.type === 'renderIf' && e.ifBlockIndex === 0)).toBe(true);
  });

  it('registers internal binding deps under ifPathExpr', () => {
    const result = buildDepGraph({
      bindings: [],
      showBindings: [],
      attrBindings: [],
      ifBlocks: [{
        varName: '__if0',
        branches: [{
          type: 'if',
          expression: 'status',
          bindings: [{ name: 'count', type: 'signal', varName: '__b0', path: ['childNodes[0]'] }],
          events: [],
          showBindings: [],
          attrBindings: [],
        }],
      }],
    }, baseCtx);

    expect(result.depGraph.has('count')).toBe(true);
    const entries = result.depGraph.get('count');
    expect(entries.some(e => e.type === 'text' && e.ifPathExpr)).toBe(true);
  });
});

// ── Phase 2: buildDepGraph with computeds ────────────────────────────

describe('buildDepGraph — Phase 2 computeds', () => {
  it('registers computed entries under dependency signals', () => {
    const result = buildDepGraph({
      bindings: [],
      showBindings: [],
      attrBindings: [],
      computeds: [
        { name: 'doubled', body: 'count * 2' },
      ],
    }, {
      signalNames: ['count'],
      computedNames: ['doubled'],
      propNames: new Set(),
      modelDefs: [],
      modelVarMap: new Map(),
      propsObjectName: null,
      emitsObjectName: null,
      constantNames: [],
      methodNames: [],
    });

    expect(result.depGraph.has('count')).toBe(true);
    const entries = result.depGraph.get('count');
    const compEntry = entries.find(e => e.type === 'computed');
    expect(compEntry).toBeDefined();
    expect(compEntry.computedName).toBe('doubled');
  });
});

// ── Phase 2: buildDepGraph with watchers ─────────────────────────────

describe('buildDepGraph — Phase 2 watchers', () => {
  const baseCtx = {
    signalNames: ['count', 'name'],
    computedNames: [],
    propNames: new Set(),
    modelDefs: [],
    modelVarMap: new Map(),
    propsObjectName: null,
    emitsObjectName: null,
    constantNames: [],
    methodNames: [],
  };

  it('registers signal watcher under the target signal', () => {
    const result = buildDepGraph({
      bindings: [],
      showBindings: [],
      attrBindings: [],
      watchers: [
        { kind: 'signal', target: 'count', body: 'console.log(newVal)', newParam: 'newVal', oldParam: null },
      ],
    }, baseCtx);

    expect(result.depGraph.has('count')).toBe(true);
    const entries = result.depGraph.get('count');
    const wEntry = entries.find(e => e.type === 'watcher' && e.watcherKind === 'signal');
    expect(wEntry).toBeDefined();
    expect(wEntry.watcherTarget).toBe('count');
  });

  it('registers getter watcher under each dependency signal', () => {
    const result = buildDepGraph({
      bindings: [],
      showBindings: [],
      attrBindings: [],
      watchers: [
        { kind: 'getter', target: 'count + name', body: 'console.log(newVal)', newParam: 'newVal', oldParam: null },
      ],
    }, baseCtx);

    expect(result.depGraph.has('count')).toBe(true);
    expect(result.depGraph.has('name')).toBe(true);
    // Both signals should have watcher entries
    const countEntry = result.depGraph.get('count').find(e => e.type === 'watcher');
    expect(countEntry).toBeDefined();
  });

  it('stores transformed callback body in watcher entries', () => {
    const result = buildDepGraph({
      bindings: [],
      showBindings: [],
      attrBindings: [],
      watchers: [
        { kind: 'signal', target: 'count', body: 'console.log(newVal)', newParam: 'newVal', oldParam: 'oldVal' },
      ],
    }, baseCtx);

    const wEntry = result.depGraph.get('count').find(e => e.type === 'watcher');
    expect(wEntry.expr).toBeTruthy();
    expect(wEntry.newParam).toBe('newVal');
    expect(wEntry.oldParam).toBe('oldVal');
  });
});
