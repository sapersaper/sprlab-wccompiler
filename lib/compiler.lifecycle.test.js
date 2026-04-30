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
import { compile } from './compiler.js';

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

    writeFileSync(join(dir, 'wcc-timer.html'), '<div>{{count}}</div>');
    writeFileSync(
      join(dir, 'wcc-timer.js'),
      `import { defineComponent, signal, onMount, onDestroy } from 'wcc'

export default defineComponent({
  tag: 'wcc-timer',
  template: './wcc-timer.html',
})

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
`
    );

    const output = await compile(join(dir, 'wcc-timer.js'));

    // 1. connectedCallback should contain transformed mount body at the end
    expect(output).toContain('connectedCallback()');
    // Signal read transformed: count() → this._count()
    expect(output).toContain("console.log('mounted, count is', this._count())");
    // Signal write transformed: count.set(count() + 1) → this._count(this._count() + 1)
    expect(output).toContain('this._count(this._count() + 1)');

    // 2. disconnectedCallback should contain transformed destroy body
    expect(output).toContain('disconnectedCallback()');
    expect(output).toContain('clearInterval(intervalId)');

    // 3. Mount body should appear after effects/event listeners in connectedCallback
    const ccStart = output.indexOf('connectedCallback()');
    const afterCC = output.slice(ccStart);
    const effectPos = afterCC.indexOf('__effect(');
    const mountPos = afterCC.indexOf("console.log('mounted, count is'");
    expect(mountPos).toBeGreaterThan(effectPos);

    // 4. Class structure
    expect(output).toContain('class WccTimer extends HTMLElement');
    expect(output).toContain("customElements.define('wcc-timer', WccTimer)");
  });

  it('compiles a component with only onMount (no disconnectedCallback)', async () => {
    const dir = createTempDir();

    writeFileSync(join(dir, 'wcc-hello.html'), '<div>hello</div>');
    writeFileSync(
      join(dir, 'wcc-hello.js'),
      `import { defineComponent, onMount } from 'wcc'

export default defineComponent({
  tag: 'wcc-hello',
  template: './wcc-hello.html',
})

onMount(() => {
  console.log('hello mounted')
})
`
    );

    const output = await compile(join(dir, 'wcc-hello.js'));

    expect(output).toContain("console.log('hello mounted')");
    expect(output).not.toContain('disconnectedCallback');
  });

  it('compiles a component with multiple hooks in source order', async () => {
    const dir = createTempDir();

    writeFileSync(join(dir, 'wcc-multi.html'), '<div>multi</div>');
    writeFileSync(
      join(dir, 'wcc-multi.js'),
      `import { defineComponent, onMount, onDestroy } from 'wcc'

export default defineComponent({
  tag: 'wcc-multi',
  template: './wcc-multi.html',
})

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
`
    );

    const output = await compile(join(dir, 'wcc-multi.js'));

    // Both mount hooks in order
    const mount1Pos = output.indexOf("console.log('mount1')");
    const mount2Pos = output.indexOf("console.log('mount2')");
    expect(mount1Pos).toBeGreaterThan(-1);
    expect(mount2Pos).toBeGreaterThan(mount1Pos);

    // Both destroy hooks in order
    const destroy1Pos = output.indexOf("console.log('destroy1')");
    const destroy2Pos = output.indexOf("console.log('destroy2')");
    expect(destroy1Pos).toBeGreaterThan(-1);
    expect(destroy2Pos).toBeGreaterThan(destroy1Pos);
  });

  it('compiles a component with computed references in hooks', async () => {
    const dir = createTempDir();

    writeFileSync(join(dir, 'wcc-comp.html'), '<div>{{doubled}}</div>');
    writeFileSync(
      join(dir, 'wcc-comp.js'),
      `import { defineComponent, signal, computed, onMount } from 'wcc'

export default defineComponent({
  tag: 'wcc-comp',
  template: './wcc-comp.html',
})

const count = signal(0)
const doubled = computed(() => count() * 2)

onMount(() => {
  console.log('doubled is', doubled())
})
`
    );

    const output = await compile(join(dir, 'wcc-comp.js'));

    // Computed read transformed: doubled() → this._c_doubled()
    expect(output).toContain("console.log('doubled is', this._c_doubled())");
  });
});
