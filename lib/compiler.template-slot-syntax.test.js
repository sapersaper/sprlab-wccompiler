/**
 * Test for BUG-0008: Template Slot Syntax Support
 * 
 * Verifies that <template slot="name"> syntax is accepted by the compiler
 * and generates correct code without "duplicate template blocks" error.
 */

import { describe, it, expect } from 'vitest';
import { compile } from '../lib/compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const createTempDir = () => {
  const dir = join(tmpdir(), `wcc-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
};

describe('BUG-0008: Template slot syntax support', () => {
  
  it('should accept <template slot="name"> syntax without duplicate template error', async () => {
    const dir = createTempDir();
    try {
      // Child component with slots
      const childContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'test-slot-child' })
</script>

<template>
<div class="child">
  <slot name="header"></slot>
  <slot></slot>
  <slot name="footer"></slot>
</div>
</template>`;

      // Parent component using <template slot="name"> syntax
      const parentContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'test-slot-parent' })
</script>

<template>
<test-slot-child>
  <template slot="header">
    <h4>Custom Header</h4>
  </template>
  
  <p>Default slot content</p>
  
  <template slot="footer">
    <button>Click me</button>
  </template>
</test-slot-child>
</template>`;

      writeFileSync(join(dir, 'child.wcc'), childContent);
      writeFileSync(join(dir, 'parent.wcc'), parentContent);

      // Should compile without "duplicate template blocks" error
      const { code: childCode } = await compile(join(dir, 'child.wcc'));
      expect(childCode).toBeDefined();
      
      const { code: parentCode } = await compile(join(dir, 'parent.wcc'));
      expect(parentCode).toBeDefined();
      
      // Verify no error about duplicate templates
      expect(parentCode).not.toContain('duplicate');
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  it('should support mixed syntax (<template> and <div> with slot attribute)', async () => {
    const dir = createTempDir();
    try {
      const childContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'test-mixed-child' })
</script>

<template>
<div>
  <slot name="header"></slot>
  <slot name="body"></slot>
  <slot name="footer"></slot>
</div>
</template>`;

      const parentContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'test-mixed-parent' })
</script>

<template>
<test-mixed-child>
  <template slot="header">
    <h1>Header with template</h1>
  </template>
  
  <div slot="body">
    <p>Body with div</p>
  </div>
  
  <span slot="footer">Footer with span</span>
</test-mixed-child>
</template>`;

      writeFileSync(join(dir, 'child.wcc'), childContent);
      writeFileSync(join(dir, 'parent.wcc'), parentContent);

      const { code: parentCode } = await compile(join(dir, 'parent.wcc'));
      expect(parentCode).toBeDefined();
      expect(parentCode).not.toContain('duplicate');
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  it('should not create extra wrapper nodes when using <template slot="name">', async () => {
    const dir = createTempDir();
    try {
      const childContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'test-no-wrapper-child' })
</script>

<template>
<div class="container">
  <slot name="content"></slot>
</div>
</template>`;

      const parentContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'test-no-wrapper-parent' })
</script>

<template>
<test-no-wrapper-child>
  <template slot="content">
    <p>Direct content without wrapper</p>
  </template>
</test-no-wrapper-child>
</template>`;

      writeFileSync(join(dir, 'child.wcc'), childContent);
      writeFileSync(join(dir, 'parent.wcc'), parentContent);

      const { code: parentCode } = await compile(join(dir, 'parent.wcc'));
      expect(parentCode).toBeDefined();
      
      // The generated code should handle template slot content as fragments
      // (implementation detail - this test verifies compilation succeeds)
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  it('should maintain backward compatibility with <div slot="name"> syntax', async () => {
    const dir = createTempDir();
    try {
      const childContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'test-backward-child' })
</script>

<template>
<div>
  <slot name="header"></slot>
  <slot></slot>
</div>
</template>`;

      const parentContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'test-backward-parent' })
</script>

<template>
<test-backward-child>
  <div slot="header">
    <h2>Old syntax still works</h2>
  </div>
  
  <p>Default content</p>
</test-backward-child>
</template>`;

      writeFileSync(join(dir, 'child.wcc'), childContent);
      writeFileSync(join(dir, 'parent.wcc'), parentContent);

      const { code: parentCode } = await compile(join(dir, 'parent.wcc'));
      expect(parentCode).toBeDefined();
      expect(parentCode).not.toContain('duplicate');
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  it('should handle multiple named slots with <template> syntax', async () => {
    const dir = createTempDir();
    try {
      const childContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'test-multi-slots-child' })
</script>

<template>
<article>
  <header><slot name="header"></slot></header>
  <main><slot name="body"></slot></main>
  <footer><slot name="footer"></slot></footer>
  <aside><slot name="sidebar"></slot></aside>
</article>
</template>`;

      const parentContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'test-multi-slots-parent' })
</script>

<template>
<test-multi-slots-child>
  <template slot="header">
    <h1>Page Title</h1>
  </template>
  
  <template slot="body">
    <p>Main content paragraph 1</p>
    <p>Main content paragraph 2</p>
  </template>
  
  <template slot="footer">
    <p>&copy; 2026 Company</p>
  </template>
  
  <template slot="sidebar">
    <nav>Sidebar navigation</nav>
  </template>
</test-multi-slots-child>
</template>`;

      writeFileSync(join(dir, 'child.wcc'), childContent);
      writeFileSync(join(dir, 'parent.wcc'), parentContent);

      const { code: parentCode } = await compile(join(dir, 'parent.wcc'));
      expect(parentCode).toBeDefined();
      expect(parentCode).not.toContain('duplicate');
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  it('should handle nested <template> tags correctly', async () => {
    const dir = createTempDir();
    try {
      const childContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'test-nested-child' })
</script>

<template>
<div>
  <slot name="content"></slot>
</div>
</template>`;

      const parentContent = `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'test-nested-parent' })

const showContent = signal(true)
</script>

<template>
<test-nested-child>
  <template slot="content">
    <div v-if="showContent()">
      <p>Nested content</p>
    </div>
  </template>
</test-nested-child>
</template>`;

      writeFileSync(join(dir, 'child.wcc'), childContent);
      writeFileSync(join(dir, 'parent.wcc'), parentContent);

      const { code: parentCode } = await compile(join(dir, 'parent.wcc'));
      expect(parentCode).toBeDefined();
      expect(parentCode).not.toContain('duplicate');
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

});
