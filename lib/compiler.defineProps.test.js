/**
 * Integration test for wcCompiler v2 — defineProps end-to-end.
 *
 * Creates a temp component with defineProps, compiles it, and verifies
 * the output contains all expected prop infrastructure.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from './compiler.js';

// ── Helpers ─────────────────────────────────────────────────────────

/** @type {string[]} */
const tempDirs = [];

function createTempDir() {
  const dir = join(
    tmpdir(),
    `wcc-compiler-props-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  tempDirs.length = 0;
});

// ── End-to-end test ─────────────────────────────────────────────────

describe('compile() — defineProps end-to-end', () => {
  it('compiles a component with defineProps generic form', async () => {
    const dir = createTempDir();

    writeFileSync(join(dir, 'my-btn.html'), '<div>{{label}}</div><span>{{count}}</span>');
    writeFileSync(
      join(dir, 'my-btn.ts'),
      `import { defineComponent, defineProps, signal } from 'wcc'

export default defineComponent({
  tag: 'my-btn',
  template: './my-btn.html',
})

const props = defineProps<{ label: string, count: number }>({ label: 'Hello', count: 0 })

const clicks = signal(0)

function handleClick() {
  clicks.set(clicks() + 1)
  console.log(props.label)
}
`
    );

    const output = await compile(join(dir, 'my-btn.ts'));

    // observedAttributes
    expect(output).toContain("static get observedAttributes()");
    expect(output).toContain("'label'");
    expect(output).toContain("'count'");

    // Prop signal initialization (esbuild may convert single to double quotes)
    expect(output).toMatch(/this\._s_label = __signal\(['"]Hello['"]\)/);
    expect(output).toContain('this._s_count = __signal(0)');

    // User signal initialization
    expect(output).toContain('this._clicks = __signal(0)');

    // attributeChangedCallback (esbuild may convert quotes)
    expect(output).toContain('attributeChangedCallback(name, oldVal, newVal)');
    expect(output).toMatch(/if \(name === 'label'\) this\._s_label\(newVal \?\? ['"]Hello['"]\)/);
    expect(output).toContain("if (name === 'count') this._s_count(newVal != null ? Number(newVal) : 0)");

    // Getters and setters
    expect(output).toContain('get label() { return this._s_label(); }');
    expect(output).toContain("set label(val) { this._s_label(val); this.setAttribute('label', String(val)); }");
    expect(output).toContain('get count() { return this._s_count(); }');
    expect(output).toContain("set count(val) { this._s_count(val); this.setAttribute('count', String(val)); }");

    // Binding effects (prop type)
    expect(output).toContain("this._s_label() ?? ''");
    expect(output).toContain("this._s_count() ?? ''");

    // props.label → this._s_label() in method body
    expect(output).toContain('this._s_label()');

    // Class and registration
    expect(output).toContain('class MyBtn extends HTMLElement');
    expect(output).toContain("customElements.define('my-btn', MyBtn)");
  });

  it('compiles a component with defineProps array form', async () => {
    const dir = createTempDir();

    writeFileSync(join(dir, 'my-tag.html'), '<div>{{title}}</div>');
    writeFileSync(
      join(dir, 'my-tag.js'),
      `import { defineComponent, defineProps } from 'wcc'

export default defineComponent({
  tag: 'my-tag',
  template: './my-tag.html',
})

const props = defineProps(['title'])
`
    );

    const output = await compile(join(dir, 'my-tag.js'));

    expect(output).toContain("static get observedAttributes()");
    expect(output).toContain("'title'");
    expect(output).toContain('this._s_title = __signal(undefined)');
    expect(output).toContain("if (name === 'title') this._s_title(newVal)");
    expect(output).toContain('get title()');
    expect(output).toContain('set title(val)');
  });

  it('compiles a component without defineProps (no prop infrastructure)', async () => {
    const dir = createTempDir();

    writeFileSync(join(dir, 'plain.html'), '<div>{{count}}</div>');
    writeFileSync(
      join(dir, 'plain.js'),
      `import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'my-plain',
  template: './plain.html',
})

const count = signal(0)
`
    );

    const output = await compile(join(dir, 'plain.js'));

    expect(output).not.toContain('observedAttributes');
    expect(output).not.toContain('attributeChangedCallback');
    expect(output).not.toContain('_s_');
  });
});
