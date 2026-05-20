import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { compile } from './compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('BUG-0019: Conditional Elements Inside Loops - Reactivity', () => {
  const tmpDir = join(process.cwd(), 'tmp-test-bug-0019');

  beforeEach(() => {
    try { mkdirSync(tmpDir, { recursive: true }); } catch {}
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  // Helper function to compile template string
  async function compileTemplate(template) {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-component' })

const items = signal([])
const categories = signal([])
const users = signal([])
const showHeader = signal(true)

function isSelected(id) { return false; }
</script>

<template>
${template}
</template>`;
    
    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    return await compile(join(tmpDir, 'component.wcc'));
  }
  
  it('should generate reactive code for simple if inside loop', async () => {
    const template = `
      <div each="item in items">
        <span if="item.active">{{ item.name }}</span>
      </div>
    `;
    
    const result = await compileTemplate(template);
    const code = result.code;
    
    // Should NOT have comment placeholder
    expect(code).not.toMatch(/<!-- if -->/);
    
    // Should have effect wrapper for reactivity
    expect(code).toMatch(/__effect\(\(\) => \{[\s\S]*?if \(item\.active\)/);
    
    // Should toggle display style
    expect(code).toMatch(/style\.display = ''/);
    expect(code).toMatch(/style\.display = 'none'/);
  });

  it('should generate reactive code for negated condition inside loop', async () => {
    const template = `
      <div each="item in items">
        <span if="!item.inStock">Out of stock</span>
      </div>
    `;
    
    const result = await compileTemplate(template);
    const code = result.code;
    
    // Should have effect with negated condition
    expect(code).toMatch(/__effect\(\(\) => \{[\s\S]*?if \(!item\.inStock\)/);
  });

  it('should handle multiple conditionals inside same loop iteration', async () => {
    const template = `
      <div each="item in items">
        <button if="item.available">Buy</button>
        <span if="!item.available">Unavailable</span>
      </div>
    `;
    
    const result = await compileTemplate(template);
    const code = result.code;
    
    // Should have TWO separate effects
    const effectMatches = code.match(/__effect\(\(\) => \{/g);
    expect(effectMatches).toHaveLength(2);
    
    // Both should be present
    expect(code).toMatch(/if \(item\.available\)/);
    expect(code).toMatch(/if \(!item\.available\)/);
  });

  it('should generate reactive code for nested loops with conditionals', async () => {
    const template = `
      <div each="category in categories">
        <div each="item in category.items">
          <span if="item.inStock">{{ item.name }}</span>
        </div>
      </div>
    `;
    
    const result = await compileTemplate(template);
    const code = result.code;
    
    // Should have effect in nested context
    expect(code).toMatch(/__effect\(\(\) => \{[\s\S]*?if \(item\.inStock\)/);
  });

  it('should preserve if/else-if/else chains as structural ifBlocks', async () => {
    const template = `
      <div each="item in items">
        <div if="item.status === 'a'">Status A</div>
        <div else-if="item.status === 'b'">Status B</div>
        <div else>Status C</div>
      </div>
    `;
    
    const result = await compileTemplate(template);
    const code = result.code;
    
    // Should still use ifBlock structure for chains
    expect(code).toMatch(/__if\d+_branch/);
    expect(code).toMatch(/else if \(item\.status === 'b'\)/);
  });

  it('should work with complex expressions in conditionals', async () => {
    const template = `
      <div each="item in items">
        <span if="item.price > 100 && item.inStock">Expensive & Available</span>
      </div>
    `;
    
    const result = await compileTemplate(template);
    const code = result.code;
    
    // Should handle complex expression
    expect(code).toMatch(/__effect\(\(\) => \{[\s\S]*?if \(item\.price > 100 && item\.inStock\)/);
  });

  it('should handle conditionals with signal calls', async () => {
    const template = `
      <div each="item in items">
        <span if="isSelected(item.id)">Selected</span>
      </div>
    `;
    
    const result = await compileTemplate(template);
    const code = result.code;
    
    // Should transform signal call correctly
    expect(code).toMatch(/__effect\(\(\) => \{[\s\S]*?if \(this\._isSelected\(item\.id\)\)/);
  });

  it('should not affect conditionals outside of loops', async () => {
    const template = `
      <div if="showHeader">Header</div>
      <div each="item in items">
        <span>{{ item.name }}</span>
      </div>
    `;
    
    const result = await compileTemplate(template);
    const code = result.code;
    
    // Outside loop should still use ifBlock structure
    expect(code).toMatch(/__if\d+_t0/);
    expect(code).toMatch(/__if\d+_anchor/);
  });

  it('should generate correct childNodes paths for conditionals in nested structures', async () => {
    const template = `
      <div each="category in categories">
        <div class="wrapper">
          <span if="category.expanded">Expanded</span>
        </div>
      </div>
    `;
    
    const result = await compileTemplate(template);
    const code = result.code;
    
    // Should have proper path references
    expect(code).toMatch(/innerNode\.childNodes\[\d+\]\.style\.display/);
  });

  it('should handle conditionals with event handlers', async () => {
    const template = `
      <div each="item in items">
        <button if="item.editable" @click="editItem(item.id)">Edit</button>
      </div>
    `;
    
    const result = await compileTemplate(template);
    const code = result.code;
    
    // Should have both conditional and event handler
    expect(code).toMatch(/__effect\(\(\) => \{[\s\S]*?if \(item\.editable\)/);
    expect(code).toMatch(/addEventListener\('click'/);
  });

  it('should handle conditionals with attribute bindings', async () => {
    const template = `
      <div each="item in items">
        <span if="item.highlighted" :class="{'highlight': item.highlighted}">{{ item.name }}</span>
      </div>
    `;
    
    const result = await compileTemplate(template);
    const code = result.code;
    
    // Should have conditional effect
    expect(code).toMatch(/__effect\(\(\) => \{[\s\S]*?if \(item\.highlighted\)/);
    // Should also have attribute binding
    expect(code).toMatch(/setAttribute\('class'/);
  });

  it('should work with keyed loops and conditionals', async () => {
    const template = `
      <div each="item in items" key="item.id">
        <span if="item.visible">{{ item.name }}</span>
      </div>
    `;
    
    const result = await compileTemplate(template);
    const code = result.code;
    
    // Should have keyed reconciliation
    expect(code).toMatch(/__keyMap/);
    // And conditional effect
    expect(code).toMatch(/__effect\(\(\) => \{[\s\S]*?if \(item\.visible\)/);
  });

  it('should handle boolean property access in conditionals', async () => {
    const template = `
      <div each="user in users">
        <span if="user.isAdmin">Admin</span>
        <span if="user.isActive">Active</span>
      </div>
    `;
    
    const result = await compileTemplate(template);
    const code = result.code;
    
    // Should handle property access
    expect(code).toMatch(/if \(user\.isAdmin\)/);
    expect(code).toMatch(/if \(user\.isActive\)/);
  });

  it('should generate efficient code without duplicate effects for same condition', async () => {
    const template = `
      <div each="item in items">
        <div if="item.show">
          <span>{{ item.name }}</span>
        </div>
      </div>
    `;
    
    const result = await compile(template);
    const code = result.code;
    
    // Count effects - should be reasonable (not excessive)
    const effectCount = (code.match(/__effect\(\(\) => \{/g) || []).length;
    expect(effectCount).toBeLessThan(10); // Sanity check
  });
});
