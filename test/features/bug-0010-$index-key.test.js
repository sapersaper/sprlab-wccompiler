/**
 * BUG-0010: $index not defined in keyed loops
 *
 * Tests that :key="$index" is correctly transformed to the loop's index variable.
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from '../../lib/compiler.js';

function createTempDir() {
  const dir = join(tmpdir(), `wcc-bug0010-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

describe('BUG-0010: $index key expression in each loops', () => {
  it('transforms :key="$index" to __idx when no index variable is declared', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'app.wcc'), `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'idx-simple' })
const items = signal(['a', 'b', 'c'])
</script>
<template>
<div>
  <div each="item in items()" :key="$index">
    <span>{{ item }}</span>
  </div>
</div>
</template>`);

      const { code } = await compile(join(dir, 'app.wcc'));

      // Should be valid JS (no $index reference error)
  // Phase 4: generated code may not be standalone-parseable without runtime
      expect(() => new Function(code.replace(/^export default .+$/m, ''))).not.toThrow();

      // Should use __idx as the key (default index var name)
      expect(code).toContain('const __key = __idx;');

      // Should NOT contain bare $index
      expect(code).not.toContain('$index');
    } finally {
      cleanupDir(dir);
    }
  });

  it('transforms :key="$index" to the declared index variable', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'app.wcc'), `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'idx-named' })
const items = signal(['x', 'y', 'z'])
</script>
<template>
<div>
  <div each="(item, i) in items()" :key="$index">
    <span>{{ item }}</span>
  </div>
</div>
</template>`);

      const { code } = await compile(join(dir, 'app.wcc'));

      // Should be valid JS
  // Phase 4: generated code may not be standalone-parseable without runtime
      expect(() => new Function(code.replace(/^export default .+$/m, ''))).not.toThrow();

      // Should use the declared index variable 'i' as the key
      expect(code).toContain('const __key = i;');

      // Should NOT contain bare $index
      expect(code).not.toContain('$index');
    } finally {
      cleanupDir(dir);
    }
  });

  it('does not affect other :key expressions', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'app.wcc'), `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'idx-other' })
const items = signal([{ id: 1 }, { id: 2 }])
</script>
<template>
<div>
  <div each="item in items()" :key="item.id">
    <span>{{ item.id }}</span>
  </div>
</div>
</template>`);

      const { code } = await compile(join(dir, 'app.wcc'));

      // Should use item.id as the key (not transformed)
      expect(code).toContain('const __key = item.id;');
    } finally {
      cleanupDir(dir);
    }
  });

  it('works with $index in nested loops', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'app.wcc'), `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'idx-nested' })
const groups = signal([
  { id: 1, items: ['a', 'b'] },
  { id: 2, items: ['c', 'd'] }
])
</script>
<template>
<div>
  <div each="group in groups()" :key="group.id">
    <div each="item in group.items" :key="$index">
      <span>{{ item }}</span>
    </div>
  </div>
</div>
</template>`);

      const { code } = await compile(join(dir, 'app.wcc'));

      // Should be valid JS
  // Phase 4: generated code may not be standalone-parseable without runtime
      expect(() => new Function(code.replace(/^export default .+$/m, ''))).not.toThrow();

      // Should NOT contain bare $index
      expect(code).not.toContain('$index');

      // Outer loop uses group.id, inner uses __idx
      expect(code).toContain('group.id');
    } finally {
      cleanupDir(dir);
    }
  });
});
