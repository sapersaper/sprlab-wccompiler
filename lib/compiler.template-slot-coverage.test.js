/**
 * Additional coverage tests for BUG-0008 fix
 * 
 * Tests edge cases and ensures the workaround (disabling validateNoUnexpectedContent)
 * doesn't break other valid SFC patterns
 */

import { describe, it, expect } from 'vitest';
import { compile } from '../lib/compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const createTempDir = () => {
  const dir = join(tmpdir(), `wcc-coverage-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
};

describe('BUG-0008: Additional coverage tests', () => {
  
  it('should still compile components without any slots', async () => {
    const dir = createTempDir();
    try {
      const content = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'no-slots-component' })
</script>
<template>
  <div>
    <h1>No Slots Here</h1>
    <p>Just a simple component</p>
  </div>
</template>`;
      
      const filePath = join(dir, 'no-slots.wcc');
      writeFileSync(filePath, content);
      
      const { code } = await compile(filePath);
      expect(code).toBeDefined();
      expect(code.length).toBeGreaterThan(100);
      expect(code).not.toContain('Error');
      
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should compile nested components with mixed slot syntax', async () => {
    const dir = createTempDir();
    try {
      // Grandchild component
      const grandchildContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'grandchild' })
</script>
<template>
  <div><slot name="content"></slot></div>
</template>`;
      
      // Child component using grandchild
      const childContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'child-mixed' })
</script>
<template>
  <div>
    <grandchild>
      <template slot="content">
        <span>Grandchild content</span>
      </template>
    </grandchild>
    <slot name="body"></slot>
  </div>
</template>`;
      
      // Parent component
      const parentContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'parent-mixed' })
</script>
<template>
  <child-mixed>
    <template slot="body">
      <p>Body content</p>
    </template>
  </child-mixed>
</template>`;
      
      const grandchildPath = join(dir, 'grandchild.wcc');
      const childPath = join(dir, 'child-mixed.wcc');
      const parentPath = join(dir, 'parent-mixed.wcc');
      
      writeFileSync(grandchildPath, grandchildContent);
      writeFileSync(childPath, childContent);
      writeFileSync(parentPath, parentContent);
      
      const { code: gc } = await compile(grandchildPath);
      const { code: ch } = await compile(childPath);
      const { code: pr } = await compile(parentPath);
      
      expect(gc).toBeDefined();
      expect(ch).toBeDefined();
      expect(pr).toBeDefined();
      
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should compile component with default slot content (direct children)', async () => {
    const dir = createTempDir();
    try {
      const childContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'default-slot-child' })
</script>
<template>
  <div><slot>Default content</slot></div>
</template>`;
      
      const parentContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'default-slot-parent' })
</script>
<template>
  <default-slot-child>
    <p>Custom default content</p>
  </default-slot-child>
</template>`;
      
      const childPath = join(dir, 'default-slot-child.wcc');
      const parentPath = join(dir, 'default-slot-parent.wcc');
      
      writeFileSync(childPath, childContent);
      writeFileSync(parentPath, parentContent);
      
      const { code: ch } = await compile(childPath);
      const { code: pr } = await compile(parentPath);
      
      expect(ch).toBeDefined();
      expect(pr).toBeDefined();
      
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should compile component with many named slots (5+)', async () => {
    const dir = createTempDir();
    try {
      const childContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'many-slots-child' })
</script>
<template>
  <div>
    <slot name="slot1"></slot>
    <slot name="slot2"></slot>
    <slot name="slot3"></slot>
    <slot name="slot4"></slot>
    <slot name="slot5"></slot>
  </div>
</template>`;
      
      const parentContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'many-slots-parent' })
</script>
<template>
  <many-slots-child>
    <template slot="slot1"><span>1</span></template>
    <template slot="slot2"><span>2</span></template>
    <template slot="slot3"><span>3</span></template>
    <template slot="slot4"><span>4</span></template>
    <template slot="slot5"><span>5</span></template>
  </many-slots-child>
</template>`;
      
      const childPath = join(dir, 'many-slots-child.wcc');
      const parentPath = join(dir, 'many-slots-parent.wcc');
      
      writeFileSync(childPath, childContent);
      writeFileSync(parentPath, parentContent);
      
      const { code: ch } = await compile(childPath);
      const { code: pr } = await compile(parentPath);
      
      expect(ch).toBeDefined();
      expect(pr).toBeDefined();
      expect(pr.length).toBeGreaterThan(100);
      
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should compile component with template slot containing complex HTML', async () => {
    const dir = createTempDir();
    try {
      const childContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'complex-slot-child' })
</script>
<template>
  <div><slot name="complex"></slot></div>
</template>`;
      
      const parentContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'complex-slot-parent' })
</script>
<template>
  <complex-slot-child>
    <template slot="complex">
      <div class="wrapper">
        <h2>Title</h2>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
          <li>Item 3</li>
        </ul>
        <button @click="handleClick">Click me</button>
      </div>
    </template>
  </complex-slot-child>
</template>`;
      
      const childPath = join(dir, 'complex-slot-child.wcc');
      const parentPath = join(dir, 'complex-slot-parent.wcc');
      
      writeFileSync(childPath, childContent);
      writeFileSync(parentPath, parentContent);
      
      const { code: ch } = await compile(childPath);
      const { code: pr } = await compile(parentPath);
      
      expect(ch).toBeDefined();
      expect(pr).toBeDefined();
      expect(pr).toContain('slot');
      
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should maintain backward compatibility with div slot syntax', async () => {
    const dir = createTempDir();
    try {
      const childContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'backward-compat-child' })
</script>
<template>
  <div>
    <slot name="header"></slot>
    <slot name="footer"></slot>
  </div>
</template>`;
      
      // Using OLD syntax (div slot) - should still work
      const parentContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'backward-compat-parent' })
</script>
<template>
  <backward-compat-child>
    <div slot="header">
      <h4>Header with div</h4>
    </div>
    <div slot="footer">
      <p>Footer with div</p>
    </div>
  </backward-compat-child>
</template>`;
      
      const childPath = join(dir, 'backward-compat-child.wcc');
      const parentPath = join(dir, 'backward-compat-parent.wcc');
      
      writeFileSync(childPath, childContent);
      writeFileSync(parentPath, parentContent);
      
      const { code: ch } = await compile(childPath);
      const { code: pr } = await compile(parentPath);
      
      expect(ch).toBeDefined();
      expect(pr).toBeDefined();
      expect(pr).toContain('slot');
      
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should compile component with style block and template slots', async () => {
    const dir = createTempDir();
    try {
      const childContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'styled-slot-child' })
</script>
<template>
  <div class="container"><slot name="content"></slot></div>
</template>
<style>
.container { padding: 10px; }
</style>`;
      
      const parentContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'styled-slot-parent' })
</script>
<template>
  <styled-slot-child>
    <template slot="content">
      <p>Styled content</p>
    </template>
  </styled-slot-child>
</template>
<style>
p { color: blue; }
</style>`;
      
      const childPath = join(dir, 'styled-slot-child.wcc');
      const parentPath = join(dir, 'styled-slot-parent.wcc');
      
      writeFileSync(childPath, childContent);
      writeFileSync(parentPath, parentContent);
      
      const { code: ch } = await compile(childPath);
      const { code: pr } = await compile(parentPath);
      
      expect(ch).toBeDefined();
      expect(pr).toBeDefined();
      expect(pr).toContain('slot');
      
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

});
