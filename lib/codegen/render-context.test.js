import { describe, it, expect } from 'vitest';
import { RenderContext } from './render-context.js';

describe('RenderContext', () => {
  // ── Constructor defaults ──

  it('sets all fields to defaults when no opts provided', () => {
    const ctx = new RenderContext();
    expect(ctx.signalNames).toEqual(new Set());
    expect(ctx.computedNames).toEqual(new Set());
    expect(ctx.propNames).toEqual(new Set());
    expect(ctx.methodNames).toEqual([]);
    expect(ctx.constantNames).toEqual([]);
    expect(ctx.modelVarMap).toEqual(new Map());
    expect(ctx.indent).toBe('    ');
    expect(ctx.loopStack).toEqual([]);
  });

  it('respects custom values passed to constructor', () => {
    const ctx = new RenderContext({
      signalNames: new Set(['count', 'name']),
      propNames: new Set(['label']),
      indent: '  ',
    });
    expect(ctx.signalNames).toEqual(new Set(['count', 'name']));
    expect(ctx.propNames).toEqual(new Set(['label']));
    expect(ctx.indent).toBe('  ');
    expect(ctx.computedNames).toEqual(new Set()); // default
  });

  // ── nested() ──

  it('nested() creates child context with loop added to stack', () => {
    const ctx = new RenderContext({ indent: '    ' });
    const child = ctx.nested('item', 'i');
    expect(child.loopStack).toEqual([{ itemVar: 'item', indexVar: 'i' }]);
    expect(child.indent).toBe('      '); // '    ' + '  '
  });

  it('nested() with custom indent increment', () => {
    const ctx = new RenderContext({ indent: '  ' });
    const child = ctx.nested('x', null, '    ');
    expect(child.indent).toBe('      '); // '  ' + '    '
  });

  it('nested() does not mutate the original context (immutability)', () => {
    const ctx = new RenderContext({ indent: '    ' });
    const child = ctx.nested('item', 'i');
    expect(ctx.loopStack).toEqual([]);
    expect(ctx.indent).toBe('    ');
    expect(child.loopStack).not.toBe(ctx.loopStack);
  });

  it('nested() supports multiple levels', () => {
    const ctx = new RenderContext();
    const level1 = ctx.nested('outer', 'i');
    const level2 = level1.nested('inner', 'j');
    expect(level1.loopStack).toHaveLength(1);
    expect(level2.loopStack).toHaveLength(2);
    expect(level2.loopStack[0]).toEqual({ itemVar: 'outer', indexVar: 'i' });
    expect(level2.loopStack[1]).toEqual({ itemVar: 'inner', indexVar: 'j' });
  });

  it('nested() with null indexVar', () => {
    const ctx = new RenderContext();
    const child = ctx.nested('item', null);
    expect(child.loopStack).toEqual([{ itemVar: 'item', indexVar: null }]);
  });

  // ── currentLoop ──

  it('currentLoop returns null when no loops active', () => {
    const ctx = new RenderContext();
    expect(ctx.currentLoop).toBeNull();
  });

  it('currentLoop returns the most recent loop', () => {
    const ctx = new RenderContext();
    const child = ctx.nested('item', 'i');
    expect(child.currentLoop).toEqual({ itemVar: 'item', indexVar: 'i' });
  });

  it('currentLoop at depth 3', () => {
    const ctx = new RenderContext();
    const l1 = ctx.nested('a', 'i');
    const l2 = l1.nested('b', 'j');
    const l3 = l2.nested('c', 'k');
    expect(l1.currentLoop).toEqual({ itemVar: 'a', indexVar: 'i' });
    expect(l2.currentLoop).toEqual({ itemVar: 'b', indexVar: 'j' });
    expect(l3.currentLoop).toEqual({ itemVar: 'c', indexVar: 'k' });
  });

  // ── _allLoopVars ──

  it('_allLoopVars returns empty set with no loops', () => {
    const ctx = new RenderContext();
    expect(ctx._allLoopVars()).toEqual(new Set());
  });

  it('_allLoopVars returns all vars from all levels', () => {
    const ctx = new RenderContext();
    const l2 = ctx.nested('outer', 'i').nested('inner', 'j');
    expect(l2._allLoopVars()).toEqual(new Set(['outer', 'i', 'inner', 'j']));
  });

  it('_allLoopVars filters out null indexVars', () => {
    const ctx = new RenderContext();
    const child = ctx.nested('item', null);
    expect(child._allLoopVars()).toEqual(new Set(['item']));
  });

  // ── filteredSignalNames ──

  it('filteredSignalNames returns all signals when no loops', () => {
    const ctx = new RenderContext({ signalNames: new Set(['a', 'b', 'c']) });
    expect(ctx.filteredSignalNames()).toEqual(new Set(['a', 'b', 'c']));
  });

  it('filteredSignalNames excludes loop variables', () => {
    const ctx = new RenderContext({ signalNames: new Set(['count', 'item', 'idx']) });
    const child = ctx.nested('item', 'idx');
    expect(child.filteredSignalNames()).toEqual(new Set(['count']));
  });

  // ── filteredComputedNames ──

  it('filteredComputedNames excludes loop vars', () => {
    const ctx = new RenderContext({ computedNames: new Set(['doubled', 'item']) });
    const child = ctx.nested('item', 'i');
    expect(child.filteredComputedNames()).toEqual(new Set(['doubled']));
  });

  // ── filteredPropNames ──

  it('filteredPropNames excludes loop vars', () => {
    const ctx = new RenderContext({ propNames: new Set(['label', 'item']) });
    const child = ctx.nested('item', 'i');
    expect(child.filteredPropNames()).toEqual(new Set(['label']));
  });

  // ── isStatic ──

  it('isStatic returns true for expression with only loop vars', () => {
    const ctx = new RenderContext({ signalNames: new Set(['count']) });
    const child = ctx.nested('item', 'i');
    expect(child.isStatic('item.name')).toBe(true);
  });

  it('isStatic returns true for expression with index var', () => {
    const ctx = new RenderContext({ signalNames: new Set(['count']) });
    const child = ctx.nested('item', 'i');
    expect(child.isStatic('i')).toBe(true);
  });

  it('isStatic returns false for signal reference', () => {
    const ctx = new RenderContext({ signalNames: new Set(['count']) });
    const child = ctx.nested('item', 'i');
    expect(child.isStatic('count')).toBe(false);
  });

  it('isStatic returns false for prop reference', () => {
    const ctx = new RenderContext({ propNames: new Set(['label']) });
    const child = ctx.nested('item', 'i');
    expect(child.isStatic('label')).toBe(false);
  });

  it('isStatic returns false for computed reference', () => {
    const ctx = new RenderContext({ computedNames: new Set(['doubled']) });
    const child = ctx.nested('item', 'i');
    expect(child.isStatic('doubled')).toBe(false);
  });

  it('isStatic with nested loops — outer loop var is still static', () => {
    const ctx = new RenderContext({ signalNames: new Set(['count']) });
    const l2 = ctx.nested('outer', 'i').nested('inner', 'j');
    expect(l2.isStatic('outer.name')).toBe(true);
    expect(l2.isStatic('inner.name')).toBe(true);
    expect(l2.isStatic('outer.name + inner.value')).toBe(true);
    expect(l2.isStatic('count')).toBe(false);
  });

  it('isStatic returns true when no loops and no signals/computeds/props match', () => {
    const ctx = new RenderContext({ signalNames: new Set(['count']), propNames: new Set(['label']) });
    expect(ctx.isStatic('hello')).toBe(true);
    expect(ctx.isStatic('world')).toBe(true);
  });

  it('isStatic with exact word boundary matching', () => {
    const ctx = new RenderContext({ signalNames: new Set(['count']) });
    const child = ctx.nested('item', 'i');
    // 'counter' should NOT match 'count' because of word boundary
    expect(child.isStatic('counter')).toBe(true);
    // 'count' exact match IS a signal
    expect(child.isStatic('count')).toBe(false);
    // 'count + 1' contains 'count' as a separate word → not static
    expect(child.isStatic('count + 1')).toBe(false);
  });

  // ── fromParseResult ──

  it('fromParseResult creates context from parse result', () => {
    const parseResult = {
      signals: [{ name: 'count' }, { name: 'name' }],
      computeds: [{ name: 'doubled' }],
      propDefs: [{ name: 'label' }],
      methods: [{ name: 'doSomething' }],
      constantVars: [{ name: 'MAX' }],
      modelDefs: [],
    };
    const ctx = RenderContext.fromParseResult(parseResult);
    expect(ctx.signalNames).toEqual(new Set(['count', 'name']));
    expect(ctx.computedNames).toEqual(new Set(['doubled']));
    expect(ctx.propNames).toEqual(new Set(['label']));
    expect(ctx.methodNames).toEqual(['doSomething']);
    expect(ctx.constantNames).toEqual(['MAX']);
  });

  it('fromParseResult includes modelDefs in signalNames and modelVarMap', () => {
    const parseResult = {
      signals: [],
      computeds: [],
      propDefs: [],
      methods: [],
      constantVars: [],
      modelDefs: [
        { varName: 'myModel', name: 'modelValue' },
        { varName: 'countModel', name: 'count' },
      ],
    };
    const ctx = RenderContext.fromParseResult(parseResult);
    expect(ctx.signalNames.has('myModel')).toBe(true);
    expect(ctx.signalNames.has('countModel')).toBe(true);
    expect(ctx.modelVarMap.get('myModel')).toBe('modelValue');
    expect(ctx.modelVarMap.get('countModel')).toBe('count');
  });

  it('fromParseResult handles empty parse result', () => {
    const parseResult = {};
    const ctx = RenderContext.fromParseResult(parseResult);
    expect(ctx.signalNames).toEqual(new Set());
    expect(ctx.computedNames).toEqual(new Set());
    expect(ctx.propNames).toEqual(new Set());
    expect(ctx.methodNames).toEqual([]);
    expect(ctx.constantNames).toEqual([]);
  });
});
