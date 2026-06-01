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

  // ── SSR-3: Compilation + hydratation ──

  it('compile() with ssr:true returns ssrCode', async () => {
    const { compile } = await import('../../../lib/compiler.js');
    const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = join(tmpdir(), `wcc-ssr-compile-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    try {
      writeFileSync(join(dir, 'c.wcc'), `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'wcc-ssr-test' })
</script>
<template><p>SSR works</p></template>`);
      const result = await compile(join(dir, 'c.wcc'), { ssr: true });
      expect(result.code).toBeDefined();
      expect(result.code.length).toBeGreaterThan(100);
      expect(result.ssrCode).toBeDefined();
      expect(result.ssrCode).toContain('renderToString');
      expect(result.ssrCode).toContain('wcc-ssr-test');
      // Without ssr, ssrCode should be null
      const result2 = await compile(join(dir, 'c.wcc'), {});
      expect(result2.ssrCode).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('generated SSR code runs and produces valid HTML', async () => {
    const { compile } = await import('../../../lib/compiler.js');
    const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = join(tmpdir(), `wcc-ssr-run-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    try {
      writeFileSync(join(dir, 'c.wcc'), `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'wcc-ssr-run' })
const name = signal('World')
</script>
<template><p>Hello {{name}}!</p></template>`);
      const result = await compile(join(dir, 'c.wcc'), { ssr: true });
      const ssrPath = join(dir, 'c.ssr.js');
      writeFileSync(ssrPath, result.ssrCode);
      const { renderToString } = await import(ssrPath);
      const html = renderToString({}, { name: 'SSR Test' });
      expect(html).toContain('Hello SSR Test');
      expect(html).toContain('wcc-ssr-run');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('hydrated connectedCallback has __ssr guard for SSR children', async () => {
    const { compile } = await import('../../../lib/compiler.js');
    const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = join(tmpdir(), `wcc-ssr-hydrate-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    try {
      writeFileSync(join(dir, 'c.wcc'), `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'wcc-hydrate' })
const count = signal(0)
</script>
<template><span>{{count}}</span></template>`);
      const result = await compile(join(dir, 'c.wcc'), { ssr: true });

      // The generated browser code should have __ssr hydration logic
      expect(result.code).toContain('__ssr');
      expect(result.code).toMatch(/children\.length\s*>\s*0/);

      // The generated code should not clear innerHTML when SSR content exists
      expect(result.code).toMatch(/if\s*\(!this\.__ssr\)\s*\{\s*this\.innerHTML\s*=\s*''/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('hydrated connectedCallback skips anchor setup for if/each', async () => {
    const { compile } = await import('../../../lib/compiler.js');
    const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = join(tmpdir(), `wcc-ssr-anchor-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    try {
      writeFileSync(join(dir, 'c.wcc'), `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'wcc-if-ssr' })
const show = signal(true)
</script>
<template>
<div if="show()"><p>Visible</p></div>
<div else><p>Hidden</p></div>
</template>`);
      const result = await compile(join(dir, 'c.wcc'), { ssr: true });

      // The SSR codegen should generate a render function
      expect(result.ssrCode).toContain('renderToString');
      expect(result.ssrCode).toContain('if (show)');
      expect(result.ssrCode).toContain('else {');

      // The browser code should skip anchor setup in SSR mode
      expect(result.code).toMatch(/if\s*\(!this\.__ssr\)\s*\{/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
