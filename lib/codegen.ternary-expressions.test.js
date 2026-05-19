import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { compile } from './compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const tmpDir = join(process.cwd(), 'tmp-test-ternary');

describe('BUG-0018: Ternary Expression Handling', () => {
  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it('should handle ternary expressions in text interpolation without syntax errors', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-ternary' })

const inStock = signal(true)
</script>

<template>
<span>{{ inStock() ? '✓ In Stock' : '✗ Out of Stock' }}</span>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should NOT have syntax error pattern: ternary ?? ''
    // The pattern "condition ? 'A' : 'B'  ?? ''" is invalid
    expect(code).not.toMatch(/\?\s*:\s*[^;]+\?\?/);
    
    // Should either wrap in parentheses OR not add ?? '' for ternaries
    expect(code).toMatch(/inStock\(\)\s*\?\s*'✓ In Stock'\s*:\s*'✗ Out of Stock'/);
  });

  it('should generate valid JavaScript for ternary expressions', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-ternary-valid' })

const value = signal(42)
</script>

<template>
<div>{{ value() > 10 ? 'High' : 'Low' }}</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should NOT have invalid syntax pattern: ternary followed by ??
    expect(code).not.toMatch(/\?\s*:\s*[^;]+\?\?/);
    
    // Should contain the ternary expression
    expect(code).toMatch(/value\(\)\s*>\s*10\s*\?\s*'High'\s*:\s*'Low'/);
  });

  it('should handle ternary expressions in nested loops', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-nested-ternary' })

const categories = signal([
  {
    id: 1,
    name: 'Electronics',
    items: [
      { id: 1, name: 'Laptop', inStock: true },
      { id: 2, name: 'Phone', inStock: false }
    ]
  }
])
</script>

<template>
<div each="category in categories()" key={{ category.id }}>
  <h2>{{ category.name }}</h2>
  <div each="item in category.items" key={{ item.id }}>
    <span>{{ item.inStock ? '✓ In Stock' : '✗ Out of Stock' }}</span>
  </div>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should NOT have invalid syntax
    expect(code).not.toMatch(/\?\s*:\s*[^;]+\?\?/);
    
    // Should contain the ternary expression
    expect(code).toMatch(/inStock\s*\?\s*'✓ In Stock'\s*:\s*'✗ Out of Stock'/);
  });

  it('should still add ?? \'\' for simple variable references', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-simple-var' })

const name = signal('World')
</script>

<template>
<div>Hello {{ name() }}</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Simple variables should still get ?? '' for safety
    expect(code).toMatch(/name\(\)\s*\?\?\s*''/);
  });

  it('should handle complex expressions with arithmetic operators', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-arithmetic' })

const a = signal(10)
const b = signal(5)
</script>

<template>
<div>{{ a() + b() }}</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Arithmetic expressions should have ?? '' for safety (wrapped or not)
    expect(code).toMatch(/this\._a\(\)\s*\+\s*this\._b\(\)/);
    expect(code).toMatch(/\?\?\s*''/);
  });

  it('should handle logical operators (|| and &&)', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-logical' })

const flag1 = signal(true)
const flag2 = signal(false)
</script>

<template>
<div>{{ flag1() && flag2() ? 'Both' : 'Not both' }}</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should NOT have invalid syntax pattern
    expect(code).not.toMatch(/\?\s*:\s*[^;]+\?\?/);
    
    // Should contain the expression (transformed to this._ prefix)
    expect(code).toMatch(/this\._flag1\(\)\s*&&\s*this\._flag2\(\)\s*\?\s*'Both'\s*:\s*'Not both'/);
  });

  it('should handle nested ternary expressions', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-nested-ternary' })

const score = signal(85)
</script>

<template>
<div>{{ score() >= 90 ? 'A' : score() >= 80 ? 'B' : 'C' }}</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should NOT have invalid syntax pattern
    expect(code).not.toMatch(/\?\s*:\s*[^;]+\?\?/);
    
    // Should contain the nested ternary
    expect(code).toMatch(/score\(\)/);
  });
});
