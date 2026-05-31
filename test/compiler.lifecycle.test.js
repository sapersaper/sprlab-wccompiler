/**
 * Integration test for wcCompiler v2 — Lifecycle Hooks
 *
 * End-to-end compiler test: source with onMount/onDestroy hooks
 * → compiled output with correct lifecycle methods.
 *
 * Feature: lifecycle-hooks
 * Validates: Requirements 4.1, 4.3, 5.1, 5.3, 6.1, 6.2
 */

import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from '../lib/compiler.js';

// ── Helpers ─────────────────────────────────────────────────────────

/** @type {string[]} */
const tempDirs = [];

function createTempDir() {
  const dir = join(
    tmpdir(),
    `wcc-lc-int-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

// ── Integration Tests ───────────────────────────────────────────────

describe('Compiler — lifecycle hooks integration', () => {
  it('compiles a component with onMount and onDestroy hooks using signal references', async () => {
    const dir = createTempDir();

    const sfcContent = `<script>
import { defineComponent, signal, onMount, onDestroy } from 'wcc'

export default defineComponent({ tag: 'wcc-timer' })

const count = signal(0)
let intervalId

onMount(() => {
  console.log('mounted, count is', count())
  intervalId = setInterval(() => {
    count.set(count() + 1)
  }, 1000)
})

onDestroy(() => {
  clearInterval(intervalId)
})
</script>

<template>
<div>{{count()}}</div>
</template>`;
    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const { code: output } = await compile(join(dir, 'component.wcc'));

    // 1. connectedCallback should contain transformed mount body at the end
    expect(output).toContain('connectedCallback()');
    expect(output).toContain("console.log('mounted, count is', this._state.count)");
    expect(output).toContain('this._state.count = this._state.count + 1');

    // 2. disconnectedCallback should be generated with cleanup
    expect(output).toContain('disconnectedCallback()');
    expect(output).toContain('clearInterval(intervalId)');

    // 3. Class structure
    expect(output).toContain('class WccTimer extends HTMLElement');
    expect(output).toContain("customElements.define('wcc-timer', WccTimer)");
  });

  it('compiles a component with only onMount (no disconnectedCallback)', async () => {
    const dir = createTempDir();

    const sfcContent = `<script>
import { defineComponent, onMount } from 'wcc'

export default defineComponent({ tag: 'wcc-hello' })

onMount(() => {
  console.log('hello mounted')
})
</script>

<template>
<div>hello</div>
</template>`;
    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const { code: output } = await compile(join(dir, 'component.wcc'));

    expect(output).toContain("console.log('hello mounted')");
    expect(output).toContain('connectedCallback()');
  });

  it('compiles a component with multiple hooks in source order', async () => {
    const dir = createTempDir();

    const sfcContent = `<script>
import { defineComponent, onMount, onDestroy } from 'wcc'

export default defineComponent({ tag: 'wcc-multi' })

onMount(() => {
  console.log('mount1')
})

onMount(() => {
  console.log('mount2')
})

onDestroy(() => {
  console.log('destroy1')
})

onDestroy(() => {
  console.log('destroy2')
})
</script>

<template>
<div>multi</div>
</template>`;
    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const { code: output } = await compile(join(dir, 'component.wcc'));

    // Hook bodies should be in the compiled output
    expect(output).toContain("console.log('mount1')");
    expect(output).toContain("console.log('mount2')");
    expect(output).toContain("console.log('destroy1')");
    expect(output).toContain("console.log('destroy2')");
  });

  it('compiles a component with computed references in hooks', async () => {
    const dir = createTempDir();

    const sfcContent = `<script>
import { defineComponent, signal, computed, onMount } from 'wcc'

export default defineComponent({ tag: 'wcc-comp' })

const count = signal(0)
const doubled = computed(() => count() * 2)

onMount(() => {
  console.log('doubled is', doubled())
})
</script>

<template>
<div>{{doubled()}}</div>
</template>`;
    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const { code: output } = await compile(join(dir, 'component.wcc'));

    // Lifecycle hook body with computed references should appear
    expect(output).toContain("console.log('doubled is', this._state.doubled)");
  });
});
