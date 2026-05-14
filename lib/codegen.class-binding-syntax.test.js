/**
 * Test for Bug #0003: Dynamic :class Binding Generates Invalid JavaScript Syntax
 * 
 * Verifies that object syntax in :class bindings generates valid JavaScript.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { compile } from '../lib/compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Bug #0003: Dynamic :class Binding Syntax', () => {
  let dir;

  beforeEach(() => {
    dir = join(tmpdir(), `wcc-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('should generate valid syntax for object :class binding', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-class-obj',
})

const isActive = signal(false)
</script>

<template>
<div :class="{ active: isActive() }">Content</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Should NOT generate invalid syntax like { this._isActive(): this._isActive() }
    expect(code).not.toContain('this._isActive():');
    
    // Should generate valid object with string keys
    // The classList.add/remove approach is used for object syntax
    expect(code).toContain('classList.add(__k)');
    expect(code).toContain('classList.remove(__k)');
    
    // Should transform the signal correctly
    expect(code).toContain('this._isActive()');
    
    console.log('\n=== Generated Code Snippet (class binding) ===');
    const classEffectStart = code.indexOf('this.__attr_class_');
    if (classEffectStart !== -1) {
      const snippet = code.substring(classEffectStart, classEffectStart + 500);
      console.log(snippet);
    }
  });

  it('should handle multiple conditions in object :class', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-class-multi',
})

const hasError = signal(false)
const size = signal('medium')
</script>

<template>
<div :class="{
  error: hasError(),
  warning: !hasError() && size() === 'large',
  success: !hasError() && size() !== 'large'
}">Status</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Should not have invalid syntax
    expect(code).not.toMatch(/this\._\w+\(\):\s*this\._\w+\(\)/);
    
    // Should use classList API
    expect(code).toContain('classList.add(__k)');
    expect(code).toContain('classList.remove(__k)');
    
    // All signals should be transformed
    expect(code).toContain('this._hasError()');
    expect(code).toContain('this._size()');
  });

  it('should handle dynamic string :class binding', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-class-string',
})

const theme = signal('light')
</script>

<template>
<div :class="theme()">Theme box</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // String syntax should use className assignment
    expect(code).toContain('.className =');
    expect(code).toContain('this._theme()');
    
    // Should NOT use classList for string syntax
    const classEffectSection = code.substring(
      code.indexOf('this.__attr_class_'),
      code.indexOf('this.__attr_class_') + 300
    );
    expect(classEffectSection).not.toContain('classList.add');
  });

  it('should handle array :class syntax', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-class-array',
})

const customClass = signal('my-class')
const size = signal('medium')
</script>

<template>
<div :class="[customClass(), size()]">Array classes</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Array syntax should use className with join or similar
    expect(code).toContain('.className =');
    expect(code).toContain('this._customClass()');
    expect(code).toContain('this._size()');
  });

  it('should combine static and dynamic classes correctly', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-class-static-dynamic',
})

const isActive = signal(false)
</script>

<template>
<button class="static-btn primary" :class="{ disabled: !isActive() }">
  Button
</button>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Static classes should be in the template HTML
    expect(code).toContain('static-btn primary');
    
    // Dynamic class should use classList
    expect(code).toContain('classList.add(__k)');
    expect(code).toContain('classList.remove(__k)');
  });
});
