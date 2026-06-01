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
    expect(result).toContain('.greeting{ color: blue; }');
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

    expect(result).toContain('href=');
  });

  it('handles :class and :style bindings', () => {
    const result = generateSSR({
      tagName: 'wcc-box',
      style: '',
      propDefs: [],
      signals: [
        { name: 'active', value: 'false' },
        { name: 'color', value: "'red'" },
      ],
      constantVars: [],
      bindings: [],
      attrBindings: [
        { varName: '__c0', attr: 'class', expression: "active ? 'active' : ''", kind: 'class', path: [] },
        { varName: '__s0', attr: 'style', expression: "`color: ${color}`", kind: 'style', path: [] },
      ],
      ifBlocks: [],
      forBlocks: [],
      showBindings: [],
      template: '<div :class="active ? \'active\' : \'\'" :style="`color: ${color}`">Content</div>',
    });

    expect(result).toContain('class=');
    expect(result).toContain('style=');
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
});
