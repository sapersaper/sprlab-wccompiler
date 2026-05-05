/**
 * Integration test for wcCompiler v2 — defineEmits end-to-end.
 *
 * Creates temp component sources with defineEmits, compiles them, and verifies
 * the output contains all expected emit infrastructure.
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
    `wcc-compiler-emits-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

// ── End-to-end tests ────────────────────────────────────────────────

describe('compile() — defineEmits end-to-end', () => {
  it('compiles a component with defineEmits call signatures form', async () => {
    const dir = createTempDir();

    const sfcContent = `<script lang="ts">
import { defineComponent, defineEmits, signal } from 'wcc'

export default defineComponent({ tag: 'my-btn' })

const emit = defineEmits<{ (e: 'change', value: number): void; (e: 'reset'): void }>()

const count = signal(0)

function handleClick() {
  count.set(count() + 1)
  emit('change', count())
}

function handleReset() {
  count.set(0)
  emit('reset')
}
</script>

<template>
<div>{{count()}}</div>
</template>`;
    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const output = await compile(join(dir, 'component.wcc'));

    // _emit method
    expect(output).toContain('_emit(name, detail)');
    expect(output).toContain('this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))');

    // Transformed emit calls in methods
    expect(output).toMatch(/this\._emit\(['"]change['"], this\._count\(\)\)/);
    expect(output).toMatch(/this\._emit\(['"]reset['"]\)/);

    // Signal transforms still work
    expect(output).toContain('this._count = __signal(0)');

    // emit variable is NOT treated as a signal
    expect(output).not.toContain('this._emit = __signal');

    // Class and registration
    expect(output).toContain('class MyBtn extends HTMLElement');
    expect(output).toContain("customElements.define('my-btn', MyBtn)");
  });

  it('compiles a component with defineEmits array form', async () => {
    const dir = createTempDir();

    const sfcContent = `<script>
import { defineComponent, defineEmits, signal } from 'wcc'

export default defineComponent({ tag: 'my-tag' })

const emit = defineEmits(['update', 'clear'])

const count = signal(0)

function doUpdate() {
  emit('update', count())
}
</script>

<template>
<div>{{count()}}</div>
</template>`;
    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const output = await compile(join(dir, 'component.wcc'));

    expect(output).toContain('_emit(name, detail)');
    expect(output).toContain("this._emit('update', this._count())");
  });

  it('compiles a component without defineEmits (no emit infrastructure)', async () => {
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

    const output = await compile(join(dir, 'component.wcc'));

    expect(output).not.toContain('_emit');
    expect(output).not.toContain('CustomEvent');
  });

  it('compiles a component with both defineProps and defineEmits', async () => {
    const dir = createTempDir();

    const sfcContent = `<script lang="ts">
import { defineComponent, defineProps, defineEmits, signal } from 'wcc'

export default defineComponent({ tag: 'my-input' })

const props = defineProps<{ label: string }>({ label: 'Enter' })
const emit = defineEmits<{ (e: 'change', value: string): void }>()

const value = signal('')

function handleInput() {
  emit('change', value())
  console.log(props.label)
}
</script>

<template>
<div>{{label}}</div>
</template>`;
    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const output = await compile(join(dir, 'component.wcc'));

    // Props infrastructure
    expect(output).toContain('observedAttributes');
    expect(output).toMatch(/this\._s_label = __signal\(['"]Enter['"]\)/);

    // Emits infrastructure
    expect(output).toContain('_emit(name, detail)');
    expect(output).toMatch(/this\._emit\(['"]change['"], this\._value\(\)\)/);

    // Props access in method
    expect(output).toContain('this._s_label()');

    // Neither props nor emit treated as signals
    expect(output).not.toContain('this._props = __signal');
    expect(output).not.toContain('this._emit = __signal');
  });
});
