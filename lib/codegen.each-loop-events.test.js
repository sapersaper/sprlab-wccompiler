import { describe, it, expect } from 'vitest';
import { compile } from './compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const createTempDir = () => {
  const dir = join(tmpdir(), `wcc-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
};

describe('BUG-0007: Event handlers in each loops - method reference resolution', () => {
  
  it('should add this._ prefix to method calls in arrow functions inside each loops', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-each-events' })

const items = signal([
  { id: 1, name: 'Item 1', active: false },
  { id: 2, name: 'Item 2', active: true }
])

function toggleActive(id) {
  const updated = items().map(item => 
    item.id === id ? { ...item, active: !item.active } : item
  )
  items(updated)
}
</script>

<template>
<ul>
  <li each="item in items()" :key="item.id">
    <button @click="() => toggleActive(item.id)">Toggle</button>
    <span>{{ item.name }}</span>
  </li>
</ul>
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // Should transform toggleActive to this._toggleActive inside arrow function
      expect(code).toContain('this._toggleActive(item.id)');
      
      // Should NOT have bare toggleActive call
      expect(code).not.toMatch(/addEventListener\([^)]*\(\)\s*=>\s*{\s*toggleActive\(/);
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  it('should add this._ prefix to direct method references inside each loops', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-direct-method' })

const items = signal([1, 2, 3])

function removeItem(index) {
  const updated = items().filter((_, i) => i !== index)
  items(updated)
}
</script>

<template>
<ul>
  <li each="(item, index) in items()">
    <button @click="removeItem(index)">Remove</button>
  </li>
</ul>
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // Direct method reference with arguments should use arrow function wrapper with this._ prefix
      expect(code).toMatch(/addEventListener\(['"]click['"],\s*\(e\)\s*=>\s*{\s*this\._removeItem\(index\)/);
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  it('should preserve loop variables while transforming method references', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-loop-vars' })

const items = signal([
  { id: 1, value: 10 },
  { id: 2, value: 20 }
])

function updateValue(id, newValue) {
  const updated = items().map(item => 
    item.id === id ? { ...item, value: newValue } : item
  )
  items(updated)
}
</script>

<template>
<div each="item in items()">
  <button @click="() => updateValue(item.id, item.value + 1)">Increment</button>
</div>
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // Method should be transformed
      expect(code).toContain('this._updateValue(item.id, item.value + 1)');
      
      // Loop variables should NOT be transformed
      expect(code).toContain('item.id');
      expect(code).toContain('item.value');
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  it('should handle multiple parameters in method calls inside each loops', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-multi-params' })

const items = signal([{ id: 1, name: 'Test' }])

function updateItem(id, name, active) {
  console.log(id, name, active)
}
</script>

<template>
<div each="item in items()">
  <button @click="() => updateItem(item.id, item.name, true)">Update</button>
</div>
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // All parameters should be preserved
      expect(code).toContain('this._updateItem(item.id, item.name, true)');
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  it('should work with index parameter in each loops', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-index-param' })

const items = signal(['a', 'b', 'c'])

function removeAt(index) {
  const updated = items().filter((_, i) => i !== index)
  items(updated)
}
</script>

<template>
<div each="(item, index) in items()">
  <button @click="() => removeAt(index)">Remove</button>
</div>
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // Index variable should be preserved, method should be transformed
      expect(code).toContain('this._removeAt(index)');
      expect(code).toContain('(item, index)');
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  it('event handlers outside each loops should still work correctly', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-outside-loop' })

const count = signal(0)

function increment() {
  count(count() + 1)
}
</script>

<template>
<button @click="increment">Outside: {{ count() }}</button>
<div each="i in [1,2,3]">
  <button @click="increment">Inside: {{ i }}</button>
</div>
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // Outside loop: should use .bind(this) pattern
      expect(code).toMatch(/addEventListener\(['"]click['"],\s*this\._increment\.bind\(this\)/);
      
      // Inside loop: should also work (either .bind or arrow function with this._)
      expect(code).toContain('this._increment');
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

});
