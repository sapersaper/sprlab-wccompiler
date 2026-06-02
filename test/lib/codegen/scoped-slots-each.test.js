/**
 * Tests for BUG-0012: Scoped slots inside each loops.
 */

import { describe, it, expect } from 'vitest';
import { generateComponent } from '../../../lib/codegen.js';

function makeParseResult(overrides = {}) {
  return {
    tagName: 'wcc-test', className: 'WccTest', template: '<div>Hello</div>', style: '',
    signals: [], computeds: [], effects: [], methods: [],
    bindings: [], events: [], processedTemplate: '<div>Hello</div>',
    propDefs: [], propsObjectName: null, emits: [], emitsObjectName: null,
    ifBlocks: [], showBindings: [], forBlocks: [], onMountHooks: [], onDestroyHooks: [],
    modelBindings: [], attrBindings: [], slots: [], refs: [], refBindings: [],
    ...overrides,
  };
}

describe('BUG-0012: scoped slots in each loops', () => {
  it('generates slot resolution in __renderEach_N', () => {
    const result = generateComponent(makeParseResult({
      tagName: 'wcc-list', className: 'WccList',
      signals: [{ name: 'items', value: "['a','b']" }],
      processedTemplate: '<ul><!-- each --></ul>',
      forBlocks: [{
        varName: '__for0', itemVar: 'item', indexVar: null, source: 'items', keyExpr: null,
        templateHtml: '<li><span data-slot="item">{{item}}</span></li>',
        anchorType: 'each', anchorIndex: 0,
        bindings: [], events: [], showBindings: [], attrBindings: [], modelBindings: [],
        slots: [{ varName: '__s0', name: 'item', path: ['childNodes[0]'],
          defaultContent: '{{item}}', slotProps: [{ prop: 'item', source: 'item' }] }],
      }],
    }));
    expect(result).toContain('__slotTpl_item');
    expect(result).toContain('__slotHtml');
    expect(result).toContain('querySelector');
    expect(result).toContain('__slotNode');
  });

  it('generates scoped slot template storage in connectedCallback', () => {
    const result = generateComponent(makeParseResult({
      tagName: 'wcc-list', className: 'WccList',
      signals: [{ name: 'items', value: "['a','b']" }],
      processedTemplate: '<ul><!-- each --></ul>',
      forBlocks: [{
        varName: '__for0', itemVar: 'item', indexVar: null, source: 'items', keyExpr: null,
        templateHtml: '<li><span data-slot="item">{{item}}</span></li>',
        anchorType: 'each', anchorIndex: 0,
        bindings: [], events: [], showBindings: [], attrBindings: [], modelBindings: [],
        slots: [{ varName: '__s0', name: 'item', path: ['childNodes[0]'],
          defaultContent: '{{item}}', slotProps: [{ prop: 'item', source: 'item' }] }],
      }],
    }));
    expect(result).toContain('Object.entries(__slotMap)');
    expect(result).toContain('__sc.propsExpr');
    expect(result).toContain("__slotTpl_' + __sn");
  });

  it('handles each with index variable in scoped slot', () => {
    const result = generateComponent(makeParseResult({
      tagName: 'wcc-list-idx', className: 'WccListIdx',
      signals: [{ name: 'items', value: "['a','b']" }],
      processedTemplate: '<ul><!-- each --></ul>',
      forBlocks: [{
        varName: '__for0', itemVar: 'item', indexVar: 'index', source: 'items', keyExpr: null,
        templateHtml: '<li><span data-slot="row">{{item}} - {{index}}</span></li>',
        anchorType: 'each', anchorIndex: 0,
        bindings: [], events: [], showBindings: [], attrBindings: [], modelBindings: [],
        slots: [{ varName: '__s0', name: 'row', path: ['childNodes[0]'],
          defaultContent: '{{item}} - {{index}}',
          slotProps: [{ prop: 'item', source: 'item' }, { prop: 'index', source: 'index' }] }],
      }],
    }));
    expect(result).toContain('__slotTpl_row');
    expect(result).toContain('__slotHtml');
  });

  it('does NOT generate slot resolution for components without for-block slots', () => {
    const result = generateComponent(makeParseResult({
      tagName: 'wcc-no-slots', className: 'WccNoSlots',
      signals: [{ name: 'count', value: '0' }],
      processedTemplate: '<span></span>',
      bindings: [{ varName: '__b0', name: 'count', type: 'signal', path: ['childNodes[0]'] }],
    }));
    expect(result).not.toContain('Object.entries(__slotMap)');
  });

  it('renders nested each with scoped slots correctly', () => {
    const result = generateComponent(makeParseResult({
      tagName: 'wcc-nested', className: 'WccNested',
      signals: [{ name: 'groups', value: '[]' }],
      processedTemplate: '<div><!-- each --></div>',
      forBlocks: [{
        varName: '__for0', itemVar: 'group', indexVar: null, source: 'groups', keyExpr: null,
        templateHtml: '<div><!-- each --></div>',
        anchorType: 'each', anchorIndex: 0,
        bindings: [], events: [], showBindings: [], attrBindings: [], modelBindings: [], slots: [],
        forBlocks: [{
          varName: '__for0_d1', itemVar: 'item', indexVar: null, source: 'group.items', keyExpr: null,
          templateHtml: '<span data-slot="cell">{{item}}</span>',
          anchorType: 'each', anchorIndex: 1,
          bindings: [], events: [], showBindings: [], attrBindings: [], modelBindings: [],
          slots: [{ varName: '__s0', name: 'cell', path: ['childNodes[0]'],
            defaultContent: '{{item}}', slotProps: [{ prop: 'item', source: 'item' }] }],
        }],
      }],
    }));
    expect(result).toContain('__slotTpl_cell');
    expect(result).toContain('__slotHtml');
  });
});
