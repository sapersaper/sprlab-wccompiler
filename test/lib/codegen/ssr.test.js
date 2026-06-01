import { describe, it, expect } from 'vitest';

function evalSSR(code) {
  const fn = new Function(code.replace('export function', 'function') + '; return renderToString;');
  return fn();
}

describe('generateSSR', () => {
  describe('text bindings', () => {
    it('replaces {{signal()}} with interpolated value', async () => {
      const { generateSSR } = await import('../../../lib/codegen/ssr.js');
      const code = generateSSR({
        tagName: 'wcc-x', style: '', propDefs: [], signals: [{ name: 'count', value: '0' }],
        constantVars: [], template: '<p>{{count()}}</p>',
      });
      expect(code).toContain('__esc(String(count))');
      expect(code).not.toContain('count()');
      const html = evalSSR(code)({}, { count: 42 });
      expect(html).toContain('42');
    });

    it('replaces {{prop()}} with interpolated value', async () => {
      const { generateSSR } = await import('../../../lib/codegen/ssr.js');
      const code = generateSSR({
        tagName: 'wcc-x', style: '', propDefs: [{ name: 'name', default: "''", attrName: 'name' }],
        signals: [], constantVars: [], template: '<h2>{{name()}}</h2>',
      });
      expect(code).toContain('__esc(String(name))');
      expect(code).not.toContain('name()');
      const html = evalSSR(code)({ name: 'Mundo' });
      expect(html).toContain('Mundo');
    });

    it('replaces {{computed()}} with interpolated value', async () => {
      const { generateSSR } = await import('../../../lib/codegen/ssr.js');
      const code = generateSSR({
        tagName: 'wcc-x', style: '', propDefs: [],
        signals: [{ name: 'count', value: '1' }],
        computeds: [{ name: 'doubled', body: 'count * 2' }],
        constantVars: [], template: '<p>{{doubled()}}</p>',
      });
      expect(code).toContain('const doubled = count * 2');
      expect(code).not.toContain('doubled()');
      const html = evalSSR(code)({}, { count: 5 });
      expect(html).toContain('10');
    });

    it('strips signal calls in complex expressions', async () => {
      const { generateSSR } = await import('../../../lib/codegen/ssr.js');
      const code = generateSSR({
        tagName: 'wcc-x', style: '', propDefs: [],
        signals: [{ name: 'items', value: '[]' }],
        constantVars: [], template: '<p>{{items().length}}</p>',
      });
      expect(code).toContain('items.length');
      expect(code).not.toContain('items()');
    });
  });

  describe('props', () => {
    it('declares props as local variables with defaults', async () => {
      const { generateSSR } = await import('../../../lib/codegen/ssr.js');
      const code = generateSSR({
        tagName: 'wcc-x', style: '', propDefs: [
          { name: 'title', default: "'Default'", attrName: 'title' },
          { name: 'count', default: '0', attrName: 'count' },
        ], signals: [], constantVars: [], template: '<p>Hi</p>',
      });
      expect(code).toContain("const title = props.title ?? 'Default'");
      expect(code).toContain('const count = props.count ?? 0');
    });

    it('renders props as HTML attributes', async () => {
      const { generateSSR } = await import('../../../lib/codegen/ssr.js');
      const code = generateSSR({
        tagName: 'wcc-x', style: '', propDefs: [{ name: 'title', default: "''", attrName: 'title' }],
        signals: [], constantVars: [], template: '<p>Hi</p>',
      });
      const html = evalSSR(code)({ title: 'My Title' });
      expect(html).toContain('title="My Title"');
    });
  });

  describe('each', () => {
    it('generates .map() with items', async () => {
      const { generateSSR } = await import('../../../lib/codegen/ssr.js');
      const code = generateSSR({
        tagName: 'wcc-x', style: '', propDefs: [], signals: [{ name: 'items', value: '[]' }],
        constantVars: [], template: '<li each="item in items()">{{item}}</li>',
      });
      expect(code).toContain('.map(');
      expect(code).toContain('items || []');
      const html = evalSSR(code)({}, { items: ['a', 'b', 'c'] });
      expect(html).toContain('<li>a</li>');
      expect(html).toContain('<li>b</li>');
      expect(html).toContain('<li>c</li>');
    });

    it('generates .map() with index variable', async () => {
      const { generateSSR } = await import('../../../lib/codegen/ssr.js');
      const code = generateSSR({
        tagName: 'wcc-x', style: '', propDefs: [], signals: [{ name: 'items', value: '[]' }],
        constantVars: [], template: '<span each="(item, i) in items()">{{i}}: {{item}}</span>',
      });
      expect(code).toContain('.map((');
      expect(code).toContain('item, i');
      const html = evalSSR(code)({}, { items: ['x', 'y'] });
      expect(html).toContain('0: x');
      expect(html).toContain('1: y');
    });
  });

  describe('if/show', () => {
    it('removes if directive but keeps content', async () => {
      const { generateSSR } = await import('../../../lib/codegen/ssr.js');
      const code = generateSSR({
        tagName: 'wcc-x', style: '', propDefs: [], signals: [{ name: 'show', value: 'true' }],
        constantVars: [], template: '<span if="show()">Visible</span>',
      });
      expect(code).not.toContain('if=');
      expect(code).toContain('Visible');
    });

    it('replaces show with conditional display:none', async () => {
      const { generateSSR } = await import('../../../lib/codegen/ssr.js');
      const code = generateSSR({
        tagName: 'wcc-x', style: '', propDefs: [], signals: [{ name: 'vis', value: 'true' }],
        constantVars: [], template: '<div show="vis()">Content</div>',
      });
      expect(code).not.toContain('show=');
      expect(code).toContain('display:none');
      const htmlVisible = evalSSR(code)({}, { vis: true });
      expect(htmlVisible).not.toContain('display:none');
      const htmlHidden = evalSSR(code)({}, { vis: false });
      expect(htmlHidden).toContain('display:none');
    });
  });

  describe('CSS', () => {
    it('includes scoped CSS inline', async () => {
      const { generateSSR } = await import('../../../lib/codegen/ssr.js');
      const code = generateSSR({
        tagName: 'wcc-x', style: '.card { color: red; }',
        propDefs: [], signals: [], constantVars: [], template: '<p>Hi</p>',
      });
      expect(code).toContain('<style>');
    });
  });

  describe('XSS prevention', () => {
    it('escapes HTML in interpolated values', async () => {
      const { generateSSR } = await import('../../../lib/codegen/ssr.js');
      const code = generateSSR({
        tagName: 'wcc-x', style: '', propDefs: [{ name: 'msg', default: "''", attrName: 'msg' }],
        signals: [], constantVars: [], template: '<p>{{msg()}}</p>',
      });
      const html = evalSSR(code)({ msg: '<script>alert(1)</script>' });
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('escapes HTML in attribute values', async () => {
      const { generateSSR } = await import('../../../lib/codegen/ssr.js');
      const code = generateSSR({
        tagName: 'wcc-x', style: '', propDefs: [{ name: 'title', default: "''", attrName: 'title' }],
        signals: [], constantVars: [], template: '<p>X</p>',
      });
      const html = evalSSR(code)({ title: '" onclick="alert(1)' });
      expect(html).toContain('&quot;');
    });
  });

  describe('full pipeline integration', () => {
    it('compile with ssr:true returns ssrCode', async () => {
      const { compile } = await import('../../../lib/compiler.js');
      const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
      const { join } = await import('node:path');
      const { tmpdir } = await import('node:os');
      const dir = join(tmpdir(), `ssr-int-${Date.now()}`);
      mkdirSync(dir, { recursive: true });
      try {
        writeFileSync(join(dir, 'c.wcc'), `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'wcc-x' })
const n = signal('W')
</script>
<template><p>{{n()}}</p></template>`);
        const r = await compile(join(dir, 'c.wcc'), { ssr: true });
        expect(r.ssrCode).toContain('renderToString');
        expect(r.ssrCode).toContain('wcc-x');
        const r2 = await compile(join(dir, 'c.wcc'), {});
        expect(r2.ssrCode).toBeNull();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('generated SSR code produces correct HTML for full component', async () => {
      const { compile } = await import('../../../lib/compiler.js');
      const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
      const { join } = await import('node:path');
      const { tmpdir } = await import('node:os');
      const dir = join(tmpdir(), `ssr-e2e-${Date.now()}`);
      mkdirSync(dir, { recursive: true });
      try {
        writeFileSync(join(dir, 'c.wcc'), `<script>
import { defineComponent, defineProps, signal, computed } from 'wcc'
export default defineComponent({ tag: 'wcc-demo' })
const props = defineProps({ title: 'Default' })
const items = signal(['a', 'b'])
const total = computed(() => items().length)
</script>
<template>
<div>
  <h2>{{title()}}</h2>
  <p>Items: {{items().length}} / Total: {{total()}}</p>
  <ul><li each="item in items()">{{item}}</li></ul>
</div>
</template>`);
        const r = await compile(join(dir, 'c.wcc'), { ssr: true });
        const ssrPath = join(dir, 'c.ssr.js');
        writeFileSync(ssrPath, r.ssrCode);
        const { renderToString } = await import(ssrPath);
        const html = renderToString({ title: 'Test' }, { items: ['x', 'y'] });
        expect(html).toContain('Test');
        expect(html).toContain('Items: 2');
        expect(html).toContain('Total: 2');
        expect(html).toContain('<li>x</li>');
        expect(html).toContain('<li>y</li>');
        expect(html).toContain('wcc-demo');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('hydration', () => {
    it('browser code has SSR hydration guards', async () => {
      const { compile } = await import('../../../lib/compiler.js');
      const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
      const { join } = await import('node:path');
      const { tmpdir } = await import('node:os');
      const dir = join(tmpdir(), `ssr-hyd-${Date.now()}`);
      mkdirSync(dir, { recursive: true });
      try {
        writeFileSync(join(dir, 'c.wcc'), `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'wcc-h' })
const c = signal(0)
</script>
<template><span>{{c()}}</span></template>`);
        const r = await compile(join(dir, 'c.wcc'), { ssr: true });
        expect(r.code).toMatch(/if\s*\(!this\.__ssr\)\s*\{\s*this\.innerHTML\s*=\s*''/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
