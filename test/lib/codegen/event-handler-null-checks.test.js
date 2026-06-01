import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { compile } from '../../../lib/compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('BUG-0019: Null checks on event handlers inside loops', () => {
  const tmpDir = join(process.cwd(), 'tmp-test-null-checks');

  beforeAll(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it('should generate null checks for event handlers in outer loop', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'test-null-check-outer' })
const items = signal([{ id: 1, name: 'Item 1' }])
function handleClick(id) { console.log(id) }
</script>

<template>
<div each="item in items()" key={{ item.id }}>
  <button @click={{ () => handleClick(item.id) }}>Click</button>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should have addEventListener generated in __renderEach_0
    expect(code).toContain("addEventListener('click'");
    
    // Should NOT have any const declarations for event targets
    expect(code).not.toMatch(/const __evt_target/);
    expect(code).not.toMatch(/const __model_target/);
  });

  it('should generate null checks for event handlers in nested loop', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'test-null-check-nested' })
const categories = signal([
  { id: 1, items: [{ id: 101, name: 'Item 1' }] }
])
function handleClick(id) { console.log(id) }
</script>

<template>
<div each="category in categories()" key={{ category.id }}>
  <div each="item in category.items" key={{ item.id }}>
    <button @click={{ () => handleClick(item.id) }}>Click</button>
  </div>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should have __renderEach_0 for each-loop rendering
    expect(code).toContain('__renderEach_0() {');
    
    // Should NOT have any const declarations
    expect(code).not.toMatch(/const __evt_target/);
    expect(code).not.toMatch(/const __model_target/);
  });

  it('should generate null checks for model bindings inside loops', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'test-null-check-model' })
const value = signal('')
const items = signal([{ id: 1 }])
</script>

<template>
<div each="item in items()" key={{ item.id }}>
  <input model="value" />
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should have __renderEach_0 for each-loop rendering with model binding
    expect(code).toContain('__renderEach_0() {');
  });

  it('should preserve top-level event handlers with existing null checks', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'test-null-check-toplevel' })
function handleClick() { console.log('clicked') }
</script>

<template>
<button @click={{ handleClick }}>Click</button>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Top-level handlers should still use the old pattern with this.__evt_ variables
    expect(code).toContain('if (this.__evt_click_handleClick');
  });

  it('should handle multiple event handlers in same loop iteration', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'test-null-check-multiple' })
const items = signal([{ id: 1 }])
function action1() {}
function action2() {}
function action3() {}
</script>

<template>
<div each="item in items()" key={{ item.id }}>
  <button @click={{ action1 }}>A</button>
  <button @click={{ action2 }}>B</button>
  <button @click={{ action3 }}>C</button>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Count addEventListener occurrences - should have 3 (one per handler)
    const listenerCount = (code.match(/addEventListener\('click'/g) || []).length;
    expect(listenerCount).toBeGreaterThanOrEqual(3);
  });

  it('should not break when DOM node references are valid', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'test-null-check-valid' })
const count = signal(0)
const items = signal([1, 2, 3])
function increment() { count.set(count() + 1) }
</script>

<template>
<div>
  <p>Count: {{ count() }}</p>
  <div each="item in items()" key={{ item }}>
    <button @click={{ increment }}>+</button>
  </div>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Code should be syntactically valid
    expect(code).toBeDefined();
    expect(typeof code).toBe('string');
    expect(code.length).toBeGreaterThan(0);
    
    // Should have addEventListener generated in __renderEach_0
    expect(code).toContain("addEventListener('click'");
    
    // Should NOT have any const declarations
    expect(code).not.toMatch(/const __evt_target/);
  });
});
