import { describe, it, expect } from 'vitest';
import { generateSSR } from '../../../lib/codegen/ssr.js';

describe('generateSSR', () => {
  // ── Text bindings ──
  it('replaces {{expr}} with SSR interpolation', () => {
    const result = generateSSR({
      tagName: 'wcc-t',
      style: '',
      propDefs: [{ name: 'name', default: "'W'", attrName: 'name' }],
      signals: [{ name: 'count', value: '0' }],
      constantVars: [],
      template: '<p>{{props.name}}: {{count()}}</p>',
    });
    expect(result).toContain('__esc(String(name))');
    expect(result).toContain('__esc(String(count))');
  });

  it('strips signal calls in expressions', () => {
    const result = generateSSR({
      tagName: 'wcc-t',
      style: '',
      propDefs: [],
      signals: [{ name: 'items', value: '[]' }],
      constantVars: [],
      template: '<p>{{items().length}}</p>',
    });
    expect(result).toContain('items.length');
    expect(result).not.toContain('items()');
  });

  // ── Props ──
  it('generates props as destructured variables and HTML attrs', () => {
    const result = generateSSR({
      tagName: 'wcc-p',
      style: '',
      propDefs: [{ name: 'title', default: "''", attrName: 'title' }],
      signals: [],
      constantVars: [],
      template: '<h2>{{props.title}}</h2>',
    });
    expect(result).toContain('const title = props.title ??');
    expect(result).toContain('__esc(String(title))');
  });

  // ── each ──
  it('generates each as .map()', () => {
    const result = generateSSR({
      tagName: 'wcc-e',
      style: '',
      propDefs: [],
      signals: [{ name: 'items', value: '[]' }],
      constantVars: [],
      template: '<li each="item in items()">{{item}}</li>',
    });
    expect(result).toContain('.map(');
    expect(result).toContain('items || []');
    expect(result).toContain('<li>');
  });

  it('generates each with index variable', () => {
    const result = generateSSR({
      tagName: 'wcc-e',
      style: '',
      propDefs: [],
      signals: [{ name: 'items', value: '[]' }],
      constantVars: [],
      template: '<li each="(item, i) in items()">{{i}}: {{item}}</li>',
    });
    expect(result).toContain('.map((');
    expect(result).toContain('item, i');
  });

  // ── if ──
  it('removes if directive (keeps content)', () => {
    const result = generateSSR({
      tagName: 'wcc-i',
      style: '',
      propDefs: [],
      signals: [{ name: 'show', value: 'true' }],
      constantVars: [],
      template: '<span if="show()">Content</span>',
    });
    expect(result).not.toContain('if=');
    expect(result).toContain('Content');
  });

  // ── show ──
  it('replaces show with conditional display:none', () => {
    const result = generateSSR({
      tagName: 'wcc-s',
      style: '',
      propDefs: [],
      signals: [{ name: 'vis', value: 'true' }],
      constantVars: [],
      template: '<div show="vis()">Content</div>',
    });
    expect(result).not.toContain('show=');
    expect(result).toContain('display:none');
  });

  // ── CSS ──
  it('includes scoped CSS inline', () => {
    const result = generateSSR({
      tagName: 'wcc-c',
      style: '.x { color: red; }',
      propDefs: [],
      signals: [],
      constantVars: [],
      template: '<p>Hi</p>',
    });
    expect(result).toContain('<style>');
    expect(result).toContain('.x{ color: red; }');
  });

  // ── XSS ──
  it('includes __esc function', () => {
    const result = generateSSR({
      tagName: 'wcc-safe', style: '', propDefs: [], signals: [], constantVars: [],
      template: '<p>Hi</p>',
    });
    expect(result).toContain('__esc');
    expect(result).toContain('.replace(/&/g');
  });

  // ── Compile + SSR pipeline ──
  it('compile with ssr:true returns ssrCode', async () => {
    const { compile } = await import('../../../lib/compiler.js');
    const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = join(tmpdir(), `ssr-test-${Date.now()}`);
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

  // ── E2E: SSR code runs and produces correct HTML ──
  it('generated SSR code produces correct HTML', async () => {
    const { compile } = await import('../../../lib/compiler.js');
    const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = join(tmpdir(), `ssr-e2e-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    try {
      writeFileSync(join(dir, 'c.wcc'), `<script>
import { defineComponent, defineProps, signal } from 'wcc'
export default defineComponent({ tag: 'wcc-demo' })
const props = defineProps({ title: 'Default' })
const items = signal(['a', 'b'])
</script>
<template>
<div>
  <h2>{{props.title}}</h2>
  <ul><li each="item in items()">{{item}}</li></ul>
</div>
</template>`);
      const r = await compile(join(dir, 'c.wcc'), { ssr: true });
      const ssrPath = join(dir, 'c.ssr.js');
      writeFileSync(ssrPath, r.ssrCode);
      const { renderToString } = await import(ssrPath);
      const html = renderToString({ title: 'Test' }, { items: ['x', 'y'] });
      expect(html).toContain('Test');
      expect(html).toContain('<li>x</li>');
      expect(html).toContain('<li>y</li>');
      expect(html).toContain('wcc-demo');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // ── Hydration ──
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
