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

    const sfcContent = `<script lang="ts">
import { defineComponent, defineProps, signal } from 'wcc'

export default defineComponent({ tag: 'my-btn' })

const props = defineProps<{ label: string, count: number }>({ label: 'Hello', count: 0 })

const clicks = signal(0)

function handleClick() {
  clicks.set(clicks() + 1)
  console.log(props.label)
}
</script>

<template>
<div>{{label}}</div><span>{{count}}</span>
</template>`;
    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const { code: output } = await compile(join(dir, 'component.wcc'));

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

    const sfcContent = `<script>
import { defineComponent, defineProps } from 'wcc'

export default defineComponent({ tag: 'my-tag' })

const props = defineProps(['title'])
</script>

<template>
<div>{{title}}</div>
</template>`;
    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const { code: output } = await compile(join(dir, 'component.wcc'));

    expect(output).toContain("static get observedAttributes()");
    expect(output).toContain("'title'");
    expect(output).toContain('this._s_title = __signal(undefined)');
    expect(output).toContain("if (name === 'title') this._s_title(newVal)");
    expect(output).toContain('get title()');
    expect(output).toContain('set title(val)');
  });

  it('compiles a component without defineProps (no prop infrastructure)', async () => {
    const dir = createTempDir();

    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'my-plain' })

const count = signal(0)
</script>

<template>
<div>{{count()}}</div>
</template>`;
    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const { code: output } = await compile(join(dir, 'component.wcc'));

    expect(output).not.toContain('observedAttributes');
    expect(output).not.toContain('attributeChangedCallback');
    expect(output).not.toContain('_s_');
  });
});
