/**
 * Test for Bug #0004: Ternary Expressions Have Misplaced Parentheses
 * 
 * Verifies that ternary expressions in templates generate correct JavaScript syntax.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { compile } from '../lib/compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Bug #0004: Ternary Expression Syntax', () => {
  let dir;

  beforeEach(() => {
    dir = join(tmpdir(), `wcc-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('should handle simple ternary in text interpolation', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-ternary-simple',
})

const active = signal(true)
</script>

<template>
<div>{{ active() ? 'Active' : 'Inactive' }}</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    console.log('\n=== Generated Code for Simple Ternary ===');
    const textContentStart = code.indexOf('textContent');
    if (textContentStart !== -1) {
      const snippet = code.substring(textContentStart, textContentStart + 300);
      console.log(snippet);
    }

    // Should NOT have misplaced parentheses like: 'Inactive'()
    expect(code).not.toMatch(/'Inactive'\(\)/);
    expect(code).not.toMatch(/'Active'\(\)/);
    
    // Should wrap the entire ternary expression in parentheses before ??
    // This prevents operator precedence issues
    expect(code).toMatch(/\(this\._active\(\) \? 'Active' : 'Inactive'\) \?\? ''/);
    
    // Verify the code is syntactically valid by extracting and testing it
    const match = code.match(/textContent = (.+?) \?\? '';/);
    if (match) {
      const expr = match[1];
      // The expression should be wrapped in parentheses if it's a ternary
      expect(expr.startsWith('(')).toBe(true);
      expect(expr.endsWith(')')).toBe(true);
    }
    
    // Should transform the signal correctly
    expect(code).toContain('this._active()');
  });

  it('should handle nested ternary expressions', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-ternary-nested',
})

const status = signal('a')
</script>

<template>
<div>{{ status() === 'a' ? 'A' : status() === 'b' ? 'B' : 'C' }}</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    console.log('\n=== Generated Code for Nested Ternary ===');
    const textContentStart = code.indexOf('textContent');
    if (textContentStart !== -1) {
      const snippet = code.substring(textContentStart, textContentStart + 400);
      console.log(snippet);
    }

    // Should not have any string followed by ()
    expect(code).not.toMatch(/'[A-C]'\(\)/);
    
    // Should wrap the entire nested ternary in parentheses
    const match = code.match(/textContent = (.+?) \?\? '';/);
    if (match) {
      const expr = match[1];
      // Nested ternaries must be wrapped to prevent precedence issues
      expect(expr.startsWith('(')).toBe(true);
      expect(expr.endsWith(')')).toBe(true);
    }
    
    // Should transform all status() calls
    expect(code).toContain('this._status()');
  });

  it('should handle ternary with function calls', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-ternary-function',
})

const value = signal(42)

function formatValue(v) {
  return \`Value: \${v}\`
}
</script>

<template>
<div>{{ value() ? formatValue(value()) : 'default' }}</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    console.log('\n=== Generated Code for Ternary with Functions ===');
    const textContentStart = code.indexOf('textContent');
    if (textContentStart !== -1) {
      const snippet = code.substring(textContentStart, textContentStart + 400);
      console.log(snippet);
    }

    // Should not have 'default'()
    expect(code).not.toMatch(/'default'\(\)/);
    
    // Should transform method calls
    expect(code).toContain('this._formatValue(');
    expect(code).toContain('this._value()');
  });

  it('should handle ternary in attribute binding', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-ternary-attr',
})

const isActive = signal(false)
</script>

<template>
<div :class="isActive() ? 'active' : 'inactive'">Content</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    console.log('\n=== Generated Code for Ternary in Attribute ===');
    const classEffectStart = code.indexOf('this.__attr_class_');
    if (classEffectStart !== -1) {
      const snippet = code.substring(classEffectStart, classEffectStart + 400);
      console.log(snippet);
    }

    // Should not have 'active'() or 'inactive'()
    expect(code).not.toMatch(/'active'\(\)/);
    expect(code).not.toMatch(/'inactive'\(\)/);
    
    // Should use className assignment for string expressions
    expect(code).toContain('.className =');
    expect(code).toContain('this._isActive()');
  });
});
