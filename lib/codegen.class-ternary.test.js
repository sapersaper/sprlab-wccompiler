/**
 * Test for :class directive with ternary expressions
 * 
 * Verifies that :class bindings with ternaries generate correct code.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { compile } from '../lib/compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Bug: :class directive with ternary expressions', () => {
  let dir;

  beforeEach(() => {
    dir = join(tmpdir(), `wcc-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('should handle ternary in :class binding correctly', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-class-ternary',
})

const theme = signal('light')
</script>

<template>
<div :class="theme() === 'light' ? 'light-theme' : 'dark-theme'">Test</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    console.log('\n=== Generated Code for :class with Ternary ===');
    const classNameStart = code.indexOf('.className =');
    if (classNameStart !== -1) {
      const snippet = code.substring(classNameStart, classNameStart + 300);
      console.log(snippet);
    }

    // Should NOT have strings followed by () like 'light-theme()' or 'dark-theme()'
    expect(code).not.toMatch(/'light-theme'\(\)/);
    expect(code).not.toMatch(/'dark-theme'\(\)/);
    
    // Should transform the signal call
    expect(code).toContain('this._theme()');
    
    // The ternary should be properly formed
    expect(code).toMatch(/className\s*=\s*this\._theme\(\)\s*===\s*'light'\s*\?\s*'light-theme'\s*:\s*'dark-theme'/);
  });

  it('should handle complex ternary in :class binding', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-class-complex',
})

const isActive = signal(false)
const size = signal('large')
</script>

<template>
<div :class="isActive() ? (size() === 'large' ? 'active-large' : 'active-small') : 'inactive'">Test</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    console.log('\n=== Generated Code for Complex :class Ternary ===');
    const classNameStart = code.indexOf('.className =');
    if (classNameStart !== -1) {
      const snippet = code.substring(classNameStart, classNameStart + 400);
      console.log(snippet);
    }

    // Should not have any string literals followed by ()
    expect(code).not.toMatch(/'[a-z-]+'\(\)/g);
    
    // Should transform all signal calls
    expect(code).toContain('this._isActive()');
    expect(code).toContain('this._size()');
  });
});
