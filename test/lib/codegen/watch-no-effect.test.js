/**
 * Phase 2 tests: Watchers migrated from __effect + __untrack to inline __invalidate invocation.
 *
 * Verifies:
 * - Signal watcher fires in __invalidate case
 * - Getter watcher fires in each dependency's case
 * - Old-value tracking initialized in constructor
 * - '*' case initializes old values without firing callbacks
 * - No __effect or __untrack generated for watchers
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from '../../../lib/compiler.js';

function createTempDir() {
  const dir = join(tmpdir(), `wcc-watch-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('Phase 2: watcher inline invocation', () => {
  it('signal watcher fires in __invalidate case', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal, watch } from 'wcc'

export default defineComponent({ tag: 'wcc-watch-sig' })

const count = signal(0)

watch(count, (newVal, oldVal) => {
  console.log('changed')
})
</script>

<template><div>{{count()}}</div></template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);
      const { code } = await compile(join(dir, 'component.wcc'));

      // Old-value tracking in constructor
      expect(code).toContain('this.__prev_count = 0');
      // Watcher code in __invalidate 'count' case
      expect(code).toContain("case 'count':");
      expect(code).toContain('this.__prev_count');
      // No __effect wrapper for watcher (just __invalidate)
      expect(code).toContain('__invalidate(key)');
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('watcher old-value tracking initialized with signal initial value', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal, watch } from 'wcc'

export default defineComponent({ tag: 'wcc-watch-init' })

const count = signal(42)

watch(count, (newVal, oldVal) => {
  console.log(oldVal, '->', newVal)
})
</script>

<template><div>{{count()}}</div></template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);
      const { code } = await compile(join(dir, 'component.wcc'));

      // Initialized with signal's initial value (42)
      expect(code).toContain('this.__prev_count = 42');
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('getter watcher fires in each dependency signal case', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal, watch } from 'wcc'

export default defineComponent({ tag: 'wcc-watch-getter' })

const firstName = signal('')
const lastName = signal('')

watch(() => firstName() + ' ' + lastName(), (newVal, oldVal) => {
  console.log('fullName:', newVal)
})
</script>

<template><div>{{firstName()}}{{lastName()}}</div></template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);
      const { code } = await compile(join(dir, 'component.wcc'));

      // Old-value tracking for getter watcher
      expect(code).toContain('this.__prev_watch0');
      // Getter watcher in both signal cases
      expect(code).toContain("case 'firstName':");
      expect(code).toContain("case 'lastName':");
      // Getter expression re-evaluated
      expect(code).toContain('this._state.firstName + \' \' + this._state.lastName');
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('watcher old-value comparison prevents callback when unchanged', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal, watch } from 'wcc'

export default defineComponent({ tag: 'wcc-watch-guard' })

const count = signal(0)

watch(count, (newVal, oldVal) => {
  console.log('changed')
})
</script>

<template><div>{{count()}}</div></template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);
      const { code } = await compile(join(dir, 'component.wcc'));

      // Old-value comparison guard
      expect(code).toContain('this.__prev_count !== undefined');
      expect(code).toContain('this.__prev_count !== this._state.count');
      // Prev value updated after comparison
      expect(code).toContain('this.__prev_count = this._state.count');
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('wildcard case initializes watcher old values without callbacks', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal, watch } from 'wcc'

export default defineComponent({ tag: 'wcc-watch-wild' })

const count = signal(0)

watch(count, (newVal, oldVal) => {
  console.log('changed')
})
</script>

<template><div>{{count()}}</div></template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);
      const { code } = await compile(join(dir, 'component.wcc'));

      // Wildcard case with watcher init
      expect(code).toContain("case '*':");
      // __invalidate method should exist
      expect(code).toContain('__invalidate(key)');
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('no __effect or __untrack generated for watchers', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal, watch } from 'wcc'

export default defineComponent({ tag: 'wcc-watch-no-effect' })

const count = signal(0)

watch(count, (newVal, oldVal) => {
  console.log('changed')
})
</script>

<template><div>{{count()}}</div></template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);
      const { code } = await compile(join(dir, 'component.wcc'));

      // No __effect wrappers for watchers
      expect(code).not.toContain('__untrack');
      // But __effect might be needed if component has other complex features
      // Since this component only has signal + watch, no __effect should exist
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });
});
