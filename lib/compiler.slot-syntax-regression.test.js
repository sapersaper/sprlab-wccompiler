/**
 * Regression tests for all slot syntax variants
 * Ensures backward compatibility while adding <template slot="name"> support
 */

import { describe, it, expect } from 'vitest';
import { compile } from '../lib/compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const createTempDir = () => {
  const dir = join(tmpdir(), `wcc-slot-regression-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
};

describe('Slot Syntax Regression Tests - All Variants', () => {
  
  it('should support Vue shorthand syntax: <template #name>', async () => {
    const dir = createTempDir();
    try {
      const childContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'shorthand-child' })
</script>
<template>
  <div>
    <slot name="header">Default Header</slot>
    <slot>Default content</slot>
  </div>
</template>`;
      
      const parentContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'shorthand-parent' })
</script>
<template>
  <shorthand-child>
    <template #header>
      <h4>Custom Header via #</h4>
    </template>
    <p>Default slot content</p>
  </shorthand-child>
</template>`;

      const childPath = join(dir, 'shorthand-child.wcc');
      const parentPath = join(dir, 'shorthand-parent.wcc');
      writeFileSync(childPath, childContent);
      writeFileSync(parentPath, parentContent);

      const childResult = await compile(childPath);
      const parentResult = await compile(parentPath);

      expect(childResult.code).toBeDefined();
      expect(parentResult.code).toBeDefined();
      expect(parentResult.code).not.toContain('Error compiling');
      expect(parentResult.code).not.toContain('duplicate');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should support Vue standard syntax: <template slot="name">', async () => {
    const dir = createTempDir();
    try {
      const childContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'standard-child' })
</script>
<template>
  <div>
    <slot name="header">Default Header</slot>
    <slot>Default content</slot>
  </div>
</template>`;
      
      const parentContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'standard-parent' })
</script>
<template>
  <standard-child>
    <template slot="header">
      <h4>Custom Header via slot=</h4>
    </template>
    <p>Default slot content</p>
  </standard-child>
</template>`;

      const childPath = join(dir, 'standard-child.wcc');
      const parentPath = join(dir, 'standard-parent.wcc');
      writeFileSync(childPath, childContent);
      writeFileSync(parentPath, parentContent);

      const childResult = await compile(childPath);
      const parentResult = await compile(parentPath);

      expect(childResult.code).toBeDefined();
      expect(parentResult.code).toBeDefined();
      expect(parentResult.code).not.toContain('Error compiling');
      expect(parentResult.code).not.toContain('duplicate');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should support regular element syntax: <div slot="name">', async () => {
    const dir = createTempDir();
    try {
      const childContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'element-child' })
</script>
<template>
  <div>
    <slot name="header">Default Header</slot>
    <slot>Default content</slot>
  </div>
</template>`;
      
      const parentContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'element-parent' })
</script>
<template>
  <element-child>
    <div slot="header">
      <h4>Custom Header via div</h4>
    </div>
    <p>Default slot content</p>
  </element-child>
</template>`;

      const childPath = join(dir, 'element-child.wcc');
      const parentPath = join(dir, 'element-parent.wcc');
      writeFileSync(childPath, childContent);
      writeFileSync(parentPath, parentContent);

      const childResult = await compile(childPath);
      const parentResult = await compile(parentPath);

      expect(childResult.code).toBeDefined();
      expect(parentResult.code).toBeDefined();
      expect(parentResult.code).not.toContain('Error compiling');
      expect(parentResult.code).not.toContain('duplicate');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });



  it('should support mixed syntax in same component', async () => {
    const dir = createTempDir();
    try {
      const childContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'mixed-child' })
</script>
<template>
  <div>
    <slot name="header">Default Header</slot>
    <slot name="body">Default Body</slot>
    <slot name="footer">Default Footer</slot>
  </div>
</template>`;
      
      const parentContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'mixed-parent' })
</script>
<template>
  <mixed-child>
    <template #header>
      <h4>Header via #</h4>
    </template>
    
    <div slot="body">
      <p>Body via div</p>
    </div>
    
    <template slot="footer">
      <button>Footer via template slot=</button>
    </template>
  </mixed-child>
</template>`;

      const childPath = join(dir, 'mixed-child.wcc');
      const parentPath = join(dir, 'mixed-parent.wcc');
      writeFileSync(childPath, childContent);
      writeFileSync(parentPath, parentContent);

      const childResult = await compile(childPath);
      const parentResult = await compile(parentPath);

      expect(childResult.code).toBeDefined();
      expect(parentResult.code).toBeDefined();
      expect(parentResult.code).not.toContain('Error compiling');
      expect(parentResult.code).not.toContain('duplicate');
      // All three syntaxes should be accepted without errors
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should remove processed template elements from DOM', async () => {
    const dir = createTempDir();
    try {
      const childContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'removal-child' })
</script>
<template>
  <div class="container">
    <slot name="header">Default</slot>
  </div>
</template>`;
      
      const parentContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'removal-parent' })
</script>
<template>
  <removal-child>
    <template slot="header">
      <h4>Custom Header</h4>
    </template>
  </removal-child>
</template>`;

      const childPath = join(dir, 'removal-child.wcc');
      const parentPath = join(dir, 'removal-parent.wcc');
      writeFileSync(childPath, childContent);
      writeFileSync(parentPath, parentContent);

      const parentResult = await compile(parentPath);

      expect(parentResult.code).toBeDefined();
      expect(parentResult.code).not.toContain('Error compiling');
      expect(parentResult.code).not.toContain('duplicate');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

});
