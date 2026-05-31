/**
 * Direct compilation test for the exact component QA used in testing
 */

import { describe, it, expect } from 'vitest';
import { compile } from '../lib/compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const createTempDir = () => {
  const dir = join(tmpdir(), `wcc-qa-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
};

describe('BUG-0008: QA Component Compilation Test', () => {
  
  it('should compile the EXACT component QA tested', async () => {
    const dir = createTempDir();
    try {
      // Child component (exact from QA report)
      const childContent = `<script>
import { defineComponent } from 'wcc'

export default defineComponent({
  tag: 'test-slot-child',
})
</script>

<template>
  <div class="slot-container">
    <header><slot name="header"><h3>Default Header</h3></slot></header>
    <main><slot>Default content</slot></main>
    <footer><slot name="footer"><p>Default Footer</p></slot></footer>
  </div>
</template>`;
      
      const childPath = join(dir, 'test-slot-child.wcc');
      writeFileSync(childPath, childContent);
      
      // Parent component (EXACT from QA report - test-template-slot-syntax.wcc)
      const parentContent = `<script>
import { defineComponent } from 'wcc'

export default defineComponent({
  tag: 'test-template-slot-syntax',
})
</script>

<template>
  <div class="template-slot-test">
    <h3>Test de Template Slot Syntax (v0.16.9)</h3>
    
    <!-- Test 1: Named slots con <template> syntax -->
    <section class="test-section">
      <h4>Test 1: Named Slots con &lt;template&gt;</h4>
      <test-slot-child>
        <template slot="header">
          <h4>🎯 Header con Template Syntax</h4>
        </template>
        
        <p>Contenido default slot</p>
        
        <template slot="footer">
          <button>Footer Button</button>
        </template>
      </test-slot-child>
    </section>

    <!-- Test 2: Mixed syntax (template + div) -->
    <section class="test-section">
      <h4>Test 2: Mixed Syntax</h4>
      <test-slot-child>
        <template slot="header">
          <h4>Header con Template</h4>
        </template>
        
        <div slot="body">
          <p>Body con Div (backward compatibility)</p>
        </div>
        
        <template slot="footer">
          <p>Footer con Template</p>
        </template>
      </test-slot-child>
    </section>

    <!-- Test 3: Multiple elements in template -->
    <section class="test-section">
      <h4>Test 3: Múltiples Elementos en Template</h4>
      <test-slot-child>
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
      </test-slot-child>
    </section>
  </div>
</template>

<style>
.template-slot-test {
  border: 2px solid #4caf50;
  padding: 15px;
  border-radius: 8px;
  background-color: #e8f5e9;
}
.template-slot-test h3 {
  color: #2e7d32;
  margin-top: 0;
}
.test-section {
  margin-bottom: 25px;
  background: white;
  padding: 15px;
  border-radius: 4px;
}
.test-section h4 {
  color: #2e7d32;
  margin-top: 0;
}
</style>`;
      
      const parentPath = join(dir, 'test-template-slot-syntax.wcc');
      writeFileSync(parentPath, parentContent);
      
      // Compile both components
      console.log('Compiling child component...');
      const childResult = await compile(childPath);
      console.log('Child compiled successfully:', childResult.code.length, 'bytes');
      
      console.log('Compiling parent component...');
      const parentResult = await compile(parentPath);
      console.log('Parent compiled successfully:', parentResult.code.length, 'bytes');
      
      // Verify compilation succeeded
      expect(childResult.code).toBeDefined();
      expect(parentResult.code).toBeDefined();
      expect(childResult.code.length).toBeGreaterThan(100);
      expect(parentResult.code.length).toBeGreaterThan(100);
      
      // Verify NO compilation errors
      expect(childResult.code).not.toContain('Error compiling');
      expect(parentResult.code).not.toContain('Error compiling');
      expect(childResult.code).not.toContain('missing a <template> block');
      expect(parentResult.code).not.toContain('unexpected content outside blocks');
      expect(childResult.code).not.toContain('duplicate <template> blocks');
      expect(parentResult.code).not.toContain('duplicate <template> blocks');
      
      // Verify slot handling code exists
      expect(parentResult.code).toContain('slot');
      
      console.log('✅ COMPILATION SUCCESSFUL - BUG-0008 IS FIXED');
      
    } catch (error) {
      console.error('❌ COMPILATION FAILED:', error.message);
      throw error;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

});
