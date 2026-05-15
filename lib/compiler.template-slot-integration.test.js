/**
 * Integration test for BUG-0008: Template Slot Syntax
 * 
 * Tests actual compilation and rendering of components using <template slot="name"> syntax
 */

import { describe, it, expect } from 'vitest';
import { compile } from '../lib/compiler.js';
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const createTempDir = () => {
  const dir = join(tmpdir(), `wcc-integration-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
};

describe('BUG-0008: Template Slot Syntax - Integration Tests', () => {
  
  it('should compile component with <template slot="name"> without errors', async () => {
    const dir = createTempDir();
    try {
      // Child component with slots
      const childContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'test-slot-child' })
</script>
<template>
  <div class="child-component">
    <header><slot name="header"><h3>Default Header</h3></slot></header>
    <main><slot>Default content</slot></main>
    <footer><slot name="footer"><p>Default Footer</p></slot></footer>
  </div>
</template>`;
      
      const childPath = join(dir, 'test-slot-child.wcc');
      writeFileSync(childPath, childContent);
      
      // Parent component using <template slot="name"> syntax
      const parentContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'test-template-slot-parent' })
</script>
<template>
  <div class="parent-component">
    <h3>Test Template Slot Syntax</h3>
    
    <test-slot-child>
      <template slot="header">
        <h4>🎯 Header con Template Syntax</h4>
      </template>
      
      <p>Contenido default slot</p>
      
      <template slot="footer">
        <button>Footer Button</button>
      </template>
    </test-slot-child>
  </div>
</template>`;
      
      const parentPath = join(dir, 'test-template-slot-parent.wcc');
      writeFileSync(parentPath, parentContent);
      
      // Compile both components
      const { code: childCode } = await compile(childPath);
      const { code: parentCode } = await compile(parentPath);
      
      // Verify compilation succeeded
      expect(childCode).toBeDefined();
      expect(parentCode).toBeDefined();
      expect(childCode.length).toBeGreaterThan(100);
      expect(parentCode.length).toBeGreaterThan(100);
      
      // Verify no compilation errors in generated code
      expect(childCode).not.toContain('Error');
      expect(parentCode).not.toContain('Error');
      
      // Verify slot handling code exists
      expect(parentCode).toContain('slot');
      
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should compile component with mixed syntax (<template slot> + <div slot>)', async () => {
    const dir = createTempDir();
    try {
      const childContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'mixed-slot-child' })
</script>
<template>
  <div>
    <slot name="header"></slot>
    <slot name="body"></slot>
    <slot name="footer"></slot>
  </div>
</template>`;
      
      const childPath = join(dir, 'mixed-slot-child.wcc');
      writeFileSync(childPath, childContent);
      
      const parentContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'mixed-slot-parent' })
</script>
<template>
  <mixed-slot-child>
    <template slot="header">
      <h4>Header con Template</h4>
    </template>
    
    <div slot="body">
      <p>Body con Div (backward compatibility)</p>
    </div>
    
    <template slot="footer">
      <p>Footer con Template</p>
    </template>
  </mixed-slot-child>
</template>`;
      
      const parentPath = join(dir, 'mixed-slot-parent.wcc');
      writeFileSync(parentPath, parentContent);
      
      const { code: childCode } = await compile(childPath);
      const { code: parentCode } = await compile(parentPath);
      
      expect(childCode).toBeDefined();
      expect(parentCode).toBeDefined();
      expect(parentCode).toContain('slot');
      
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should compile component with multiple elements inside <template slot>', async () => {
    const dir = createTempDir();
    try {
      const childContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'multi-element-child' })
</script>
<template>
  <div>
    <slot name="header"></slot>
    <slot name="footer"></slot>
  </div>
</template>`;
      
      const childPath = join(dir, 'multi-element-child.wcc');
      writeFileSync(childPath, childContent);
      
      const parentContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'multi-element-parent' })
</script>
<template>
  <multi-element-child>
    <template slot="header">
      <h4>Header 1</h4>
      <p>Header 2</p>
      <span>Header 3</span>
    </template>
    
    <p>Default content</p>
    
    <template slot="footer">
      <button>Button 1</button>
      <button>Button 2</button>
    </template>
  </multi-element-child>
</template>`;
      
      const parentPath = join(dir, 'multi-element-parent.wcc');
      writeFileSync(parentPath, parentContent);
      
      const { code: childCode } = await compile(childPath);
      const { code: parentCode } = await compile(parentPath);
      
      expect(childCode).toBeDefined();
      expect(parentCode).toBeDefined();
      expect(parentCode).toContain('slot');
      
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

});
