import { describe, it, expect } from 'vitest';
import { generateSSR } from '../../../lib/codegen/ssr.js';

describe('generateSSR', () => {
  it('generates renderToString for a component with props, signals, and text', () => {
    const result = generateSSR({
      tagName: 'wcc-greeting',
      style: '.greeting { color: blue; }',
      propDefs: [{ name: 'name', default: "'World'", attrName: 'name' }],
      signals: [{ name: 'count', value: '0' }],
      constantVars: [],
      bindings: [
        { varName: '__b0', name: 'name', type: 'prop', path: [] },
        { varName: '__b1', name: 'count', type: 'signal', path: [] },
      ],
      attrBindings: [],
      ifBlocks: [],
      forBlocks: [],
      showBindings: [],
      template: '<div class="greeting">\n  <h2>Hello {{name}}!</h2>\n  <p>Count: {{count}}</p>\n</div>',
    });

    expect(result).toContain('export function renderToString');
    expect(result).toContain('const name = props.name ??');
    expect(result).toContain('const count = state.count ??');
    expect(result).toContain('__esc(String(name))');
    expect(result).toContain('__esc(String(count))');
    expect(result).toContain('wcc-greeting');
    expect(result).toContain('function __esc');
  });

  it('handles component with no props or signals', () => {
    const result = generateSSR({
      tagName: 'wcc-static',
      style: '',
      propDefs: [],
      signals: [],
      constantVars: [],
      bindings: [],
      attrBindings: [],
      ifBlocks: [],
      forBlocks: [],
      showBindings: [],
      template: '<div><p>Static content</p></div>',
    });

    expect(result).toContain('export function renderToString');
    expect(result).toContain('<div><p>Static content</p></div>');
  });

  it('handles :attr bindings', () => {
    const result = generateSSR({
      tagName: 'wcc-link',
      style: '',
      propDefs: [],
      signals: [{ name: 'url', value: "'https://example.com'" }],
      constantVars: [],
      bindings: [],
      attrBindings: [
        { varName: '__a0', attr: 'href', expression: 'url', kind: 'attr', path: [] },
      ],
      ifBlocks: [],
      forBlocks: [],
      showBindings: [],
      template: '<a :href="url">Link</a>',
    });

    expect(result).toContain('href');
  });

  it('includes __esc function for XSS prevention', () => {
    const result = generateSSR({
      tagName: 'wcc-safe',
      style: '',
      propDefs: [{ name: 'msg', default: "''", attrName: 'msg' }],
      signals: [],
      constantVars: [],
      bindings: [{ varName: '__b0', name: 'msg', type: 'prop', path: [] }],
      attrBindings: [],
      ifBlocks: [],
      forBlocks: [],
      showBindings: [],
      template: '<p>{{msg}}</p>',
    });

    expect(result).toContain('.replace(/&/g');
    expect(result).toContain('.replace(/</g');
  });

  // ── SSR-2: if/else-if/else ──

  it('generates if block with single branch', () => {
    const result = generateSSR({
      tagName: 'wcc-if',
      style: '',
      propDefs: [],
      signals: [{ name: 'show', value: 'true' }],
      constantVars: [],
      bindings: [],
      attrBindings: [],
      ifBlocks: [{
        varName: '__if0',
        anchorType: 'if',
        anchorIndex: 0,
        branches: [{
          type: 'if', expression: 'show',
          templateHtml: '<p>Visible</p>',
          bindings: [], events: [], showBindings: [], attrBindings: [], modelBindings: [], slots: [],
        }],
      }],
      forBlocks: [],
      showBindings: [],
      template: '<!-- if -->',
    });

    expect(result).toContain('__if_0');
    expect(result).toContain('if (show)');
    expect(result).toContain('__if_0');
  });

  it('generates if/else-if/else chain', () => {
    const result = generateSSR({
      tagName: 'wcc-chain',
      style: '',
      propDefs: [],
      signals: [{ name: 'status', value: "'idle'" }],
      constantVars: [],
      bindings: [],
      attrBindings: [],
      ifBlocks: [{
        varName: '__if0',
        anchorType: 'if', anchorIndex: 0,
        branches: [
          { type: 'if', expression: "status === 'loading'",
            templateHtml: '<p>Loading</p>',
            bindings: [], events: [], showBindings: [], attrBindings: [], modelBindings: [], slots: [] },
          { type: 'else-if', expression: "status === 'error'",
            templateHtml: '<p>Error</p>',
            bindings: [], events: [], showBindings: [], attrBindings: [], modelBindings: [], slots: [] },
          { type: 'else', expression: null,
            templateHtml: '<p>OK</p>',
            bindings: [], events: [], showBindings: [], attrBindings: [], modelBindings: [], slots: [] },
        ],
      }],
      forBlocks: [],
      showBindings: [],
      template: '<!-- if -->',
    });

    expect(result).toContain('if (status');
    expect(result).toContain('else if');
    expect(result).toContain('else {');
  });

  // ── SSR-2: each ──

  it('generates each block with .map()', () => {
    const result = generateSSR({
      tagName: 'wcc-each',
      style: '',
      propDefs: [],
      signals: [{ name: 'items', value: '[]' }],
      constantVars: [],
      bindings: [],
      attrBindings: [],
      ifBlocks: [],
      forBlocks: [{
        varName: '__for0',
        itemVar: 'item', indexVar: null,
        source: 'items', keyExpr: null,
        templateHtml: '<li>{{item}}</li>',
        anchorType: 'each', anchorIndex: 0,
        bindings: [{ varName: '__b0', name: 'item', type: 'signal', path: [] }],
        events: [], showBindings: [], attrBindings: [], modelBindings: [], slots: [],
      }],
      showBindings: [],
      template: '<!-- each -->',
    });

    expect(result).toContain('__for_0');
    expect(result).toContain('.map(');
    expect(result).toContain('items || []');
  });

  it('generates each block with index variable', () => {
    const result = generateSSR({
      tagName: 'wcc-each-idx',
      style: '',
      propDefs: [],
      signals: [{ name: 'items', value: '[]' }],
      constantVars: [],
      bindings: [{ varName: '__b0', name: 'item', type: 'signal', path: [] },
                 { varName: '__b1', name: 'index', type: 'signal', path: [] }],
      attrBindings: [],
      ifBlocks: [],
      forBlocks: [{
        varName: '__for0',
        itemVar: 'item', indexVar: 'index',
        source: 'items', keyExpr: null,
        templateHtml: '<li>{{index}}: {{item}}</li>',
        anchorType: 'each', anchorIndex: 0,
        bindings: [{ varName: '__b0', name: 'item', type: 'signal', path: [] },
                   { varName: '__b1', name: 'index', type: 'signal', path: [] }],
        events: [], showBindings: [], attrBindings: [], modelBindings: [], slots: [],
      }],
      showBindings: [],
      template: '<!-- each -->',
    });

    expect(result).toContain('.map((');
    expect(result).toContain('item, index');
  });
});
