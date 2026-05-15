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
    
    // The ternary should be properly formed (with or without parentheses)
    expect(code).toMatch(/className\s*=\s*\(?\s*this\._theme\(\)\s*===\s*'light'\s*\?\s*'light-theme'\s*:\s*'dark-theme'/);
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

  it('should handle multiple signals in string literals', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-multi-signals',
})

const status = signal('error')
const theme = signal('dark')
</script>

<template>
<div :class="status() === 'error' ? 'error-status-theme' : 'success-status-theme'">Test</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    console.log('\n=== Generated Code for Multiple Signals ===');
    const classNameStart = code.indexOf('.className =');
    if (classNameStart !== -1) {
      const snippet = code.substring(classNameStart, classNameStart + 300);
      console.log(snippet);
    }

    // Should NOT corrupt strings containing signal names
    expect(code).not.toMatch(/'error-status-this\._status\(\)'/);
    expect(code).not.toMatch(/'success-status-this\._status\(\)'/);
    
    // Should preserve original strings
    expect(code).toContain("'error-status-theme'");
    expect(code).toContain("'success-status-theme'");
    
    // Should transform signal calls
    expect(code).toContain('this._status()');
  });

  it('should handle double quotes and backticks in string literals', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-quotes',
})

const mode = signal('test')
</script>

<template>
<div :class='mode() === "test" ? "test-mode-active" : "test-mode-inactive"'>Test</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Should NOT corrupt strings
    expect(code).not.toMatch(/'test-mode-this\._mode\(\)'/);
    
    // Should preserve original strings
    expect(code).toContain('"test-mode-active"');
    expect(code).toContain('"test-mode-inactive"');
    
    // Should transform signal calls
    expect(code).toContain('this._mode()');
  });

  it('should handle expressions without string literals', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-no-strings',
})

const count = signal(0)
const hasItems = signal(false)
const noItems = signal(true)
</script>

<template>
<div :class="count() > 0 ? hasItems() : noItems()">Test</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    console.log('\n=== Generated Code for No Strings ===');
    const classNameStart = code.indexOf('.className =');
    if (classNameStart !== -1) {
      const snippet = code.substring(classNameStart, classNameStart + 200);
      console.log(snippet);
    }

    // Should transform all signal calls
    expect(code).toContain('this._count()');
    expect(code).toContain('this._hasItems()');
    expect(code).toContain('this._noItems()');
  });
});
