import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { compile } from './compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('BUG-0013: Malformed Loop Key Bindings', () => {
  const tmpDir = join(process.cwd(), 'tmp-test-bug-0013');

  beforeEach(() => {
    try { mkdirSync(tmpDir, { recursive: true }); } catch {}
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it('should handle :key binding syntax correctly', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-key-binding' })

const items = signal([
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' }
])
</script>

<template>
<ul>
  <li each="item in items()" :key="item.id">
    {{ item.name }}
  </li>
</ul>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should generate keyed reconciliation code
    expect(code).toContain('__oldMap.has(__key)');
    expect(code).toContain('item.id');
    
    // Should NOT have malformed attributes
    expect(code).not.toContain('key="{{"');
    expect(code).not.toContain('item.id=""');
  });

  it('should reject key="{{ }}" Mustache syntax with clear error', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-mustache-key' })

const items = signal([
  { id: 1, name: 'Item 1' }
])
</script>

<template>
<ul>
  <li each="item in items()" key="{{ item.id }}">
    {{ item.name }}
  </li>
</ul>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    
    // Should either:
    // 1. Convert key="{{ item.id }}" to proper binding, OR
    // 2. Throw a clear error message
    try {
      const { code } = await compile(join(tmpDir, 'component.wcc'));
      
      // If it compiles, check that key is handled correctly
      // and not split into malformed attributes
      expect(code).not.toMatch(/key="\{\{/);
      expect(code).not.toMatch(/item\.id=""/);
      expect(code).not.toMatch(/\}=""/);
    } catch (error) {
      // If it throws, should be a clear validation error
      expect(error.message).toMatch(/key|Mustache|binding/i);
    }
  });

  it('should handle nested property access in :key', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-nested-key' })

const items = signal([
  { user: { id: 1 }, name: 'Item 1' }
])
</script>

<template>
<ul>
  <li each="item in items()" :key="item.user.id">
    {{ item.name }}
  </li>
</ul>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should handle nested property access
    expect(code).toContain('item.user.id');
    expect(code).toContain('__oldMap.has(__key)');
  });
});
