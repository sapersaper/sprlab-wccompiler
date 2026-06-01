/**
 * Test: Static class/style preservation with dynamic :class/:style bindings
 *
 * Verifies that when an element has both a static class="..." (or style="...")
 * and a dynamic :class (or :style) using string/array/ternary expressions,
 * the static values are preserved in the generated code.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from '../../../lib/compiler.js';

describe('Static class/style preservation with dynamic bindings', () => {
  let dir;

  beforeEach(() => {
    dir = join(tmpdir(), `wcc-static-preserve-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  // ── :class with ternary + static class ──

  it('should preserve static class when :class uses ternary expression', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-static-ternary',
})

const isActive = signal(true)
</script>

<template>
<div class="base-class" :class="isActive() ? 'active' : 'inactive'">Content</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Should prepend static class
    expect(code).toContain("'base-class ' +");
    // Should still have the ternary
    expect(code).toMatch(/isActive.*\?.*'active'.*:.*'inactive'/);
  });

  it('should preserve static class when :class uses array expression', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-static-array',
})

const theme = signal('dark')
const size = signal('large')
</script>

<template>
<div class="card elevated" :class="[theme(), size()]">Content</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Should prepend static class
    expect(code).toContain("'card elevated ' +");
    // Should have the array join
    expect(code).toContain(".join(' ')");
  });

  it('should preserve static class when :class uses simple string expression', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-static-string',
})

const dynamicClass = signal('highlight')
</script>

<template>
<div class="container" :class="dynamicClass()">Content</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Should prepend static class
    expect(code).toContain("'container ' +");
  });

  it('should NOT add prefix when no static class exists', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-no-static',
})

const isActive = signal(true)
</script>

<template>
<div :class="isActive() ? 'active' : 'inactive'">Content</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Should NOT have a static prefix
    expect(code).not.toContain("' +");
    // Should still have the ternary
    expect(code).toMatch(/className/);
  });

  // ── :style with string + static style ──

  it('should preserve static style when :style uses string expression', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-static-style',
})

const dynamicStyle = signal('background: blue')
</script>

<template>
<div style="color: red; font-size: 14px" :style="dynamicStyle()">Content</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Should prepend static style
    expect(code).toContain("'color: red; font-size: 14px; ' +");
  });

  it('should NOT add style prefix when no static style exists', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-no-static-style',
})

const dynamicStyle = signal('background: blue')
</script>

<template>
<div :style="dynamicStyle()">Content</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Should NOT have a static prefix
    expect(code).not.toContain("'; ' +");
    expect(code).toContain('style.cssText');
  });

  // ── :class object syntax still works (no change needed) ──

  it('should still use classList for object :class with static class (no prefix needed)', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-object-static',
})

const isActive = signal(true)
</script>

<template>
<div class="base" :class="{ active: isActive() }">Content</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Object syntax uses classList — no prefix needed
    expect(code).toContain('classList.add');
    expect(code).toContain('classList.remove');
    // Static class should be in the template HTML
    expect(code).toContain('class="base"');
  });

  // ── Multiple static classes with ternary ──

  it('should preserve multiple static classes with ternary', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-multi-static',
})

const mode = signal('edit')
</script>

<template>
<div class="card shadow rounded" :class="mode() === 'edit' ? 'editing' : 'viewing'">Content</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Should prepend all static classes
    expect(code).toContain("'card shadow rounded ' +");
  });
});
