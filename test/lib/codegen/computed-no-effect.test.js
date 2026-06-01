/**
 * Phase 2 tests: Computed values migrated from __computed() to inline __invalidate recalculation.
 *
 * Verifies:
 * - Computed values stored in _state (not __computed)
 * - Inline recalculation in __invalidate cases
 * - Topological ordering for initial render
 * - No __computed runtime
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from '../../../lib/compiler.js';

function createTempDir() {
  const dir = join(tmpdir(), `wcc-cmp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('Phase 2: computed inline recalculation', () => {
  it('stores computed value in _state, not __computed', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal, computed } from 'wcc'

export default defineComponent({ tag: 'wcc-cmp-test' })

const count = signal(0)
const doubled = computed(() => count() * 2)
</script>

<template>
<div>{{doubled()}}</div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);
      const { code } = await compile(join(dir, 'component.wcc'));

      // Computed stored in _state
      expect(code).toContain('this._state.doubled = this._state.count * 2');
      // No __computed runtime
      expect(code).not.toContain('__computed');
      // Binding depends on computed name in depGraph
      expect(code).toContain("case 'doubled':");
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('generates topological order for computed chain', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal, computed } from 'wcc'

export default defineComponent({ tag: 'wcc-chain-test' })

const count = signal(0)
const doubled = computed(() => count() * 2)
const tripled = computed(() => doubled() + count())
</script>

<template>
<div>{{doubled()}},{{tripled()}}</div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);
      const { code } = await compile(join(dir, 'component.wcc'));

      // Both computeds in _state
      expect(code).toContain('this._state.doubled');
      expect(code).toContain('this._state.tripled');
      // No __computed
      expect(code).not.toContain('__computed');
      // Both computeds in __invalidate cases
      expect(code).toContain("case 'count':");
      expect(code).toContain("case 'doubled':");
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('computed initial value in constructor', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal, computed } from 'wcc'

export default defineComponent({ tag: 'wcc-init-test' })

const count = signal(5)
const doubled = computed(() => count() * 2)
</script>

<template><div>{{doubled()}}</div></template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);
      const { code } = await compile(join(dir, 'component.wcc'));

      // Initial value: doubled = 5 * 2 = 10
      expect(code).toContain('this._state.doubled = this._state.count * 2');
      // No __computed
      expect(code).not.toContain('__computed');
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('wildcard case includes computed recalculations', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal, computed } from 'wcc'

export default defineComponent({ tag: 'wcc-wild-test' })

const count = signal(0)
const doubled = computed(() => count() * 2)
</script>

<template><div>{{doubled()}}</div></template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);
      const { code } = await compile(join(dir, 'component.wcc'));

      // Wildcard case with computed
      expect(code).toContain("case '*':");
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('computed depending on computed cascades via Proxy setter', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal, computed } from 'wcc'

export default defineComponent({ tag: 'wcc-cascade-test' })

const a = signal(1)
const b = computed(() => a() * 2)
const c = computed(() => b() + 1)
</script>

<template><div>{{c()}}</div></template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);
      const { code } = await compile(join(dir, 'component.wcc'));

      // b depends on a, c depends on b
      expect(code).toContain('this._state.b = ');
      expect(code).toContain('this._state.c = ');
      // Every signal/computed should have its own __invalidate case
      expect(code).toContain("case 'a':");
      expect(code).toContain("case 'b':");
      expect(code).toContain("case 'c':");
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });
});
