import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { compile } from './compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('BUG-0015: Complex Template Feature Combination', () => {
  const tmpDir = join(process.cwd(), 'tmp-test-bug-0015');

  beforeEach(() => {
    try { mkdirSync(tmpDir, { recursive: true }); } catch {}
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it('should handle loops with keys and dynamic components', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-loop-dynamic' })

const items = signal([
  { id: 1, type: 'comp-a' },
  { id: 2, type: 'comp-b' }
])
</script>

<template>
<div>
  <component each="item in items()" :is="item.type" :key="item.id"></component>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should have key reconciliation
    expect(code).toContain('__oldMap.has(__key)');
    expect(code).toContain('item.id');
    
    // Should have dynamic component handling
    expect(code).toContain('item.type');
    expect(code).toContain("setAttribute('is'");
    
    // Should NOT have raw {{ delimiters
    expect(code).not.toMatch(/\{\{.*\}\}/);
  });

  it('should handle loops with keys, conditionals, and slots', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-loop-conditional-slot' })

const items = signal([
  { id: 1, showTitle: true, title: 'Item 1' },
  { id: 2, showTitle: false, title: 'Item 2' }
])
</script>

<template>
<div>
  <div each="item in items()" :key="item.id">
    <component :is="'panel'">
      <template #header>
        <h3 if="{{ item.showTitle }}">{{ item.title }}</h3>
      </template>
    </component>
  </div>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should have all features working together
    expect(code).toContain('__oldMap.has(__key)');
    expect(code).toContain('item.id');
    expect(code).toContain('if (');
    expect(code).toContain('item.showTitle');
    expect(code).toContain('#header');
    
    // Should NOT have raw {{ delimiters
    expect(code).not.toMatch(/\{\{.*\}\}/);
  });

  it('should handle class and style bindings in loops', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-loop-class-style' })

const items = signal([
  { id: 1, theme: 'light', opacity: 0.8 },
  { id: 2, theme: 'dark', opacity: 0.9 }
])
</script>

<template>
<div>
  <div each="item in items()" :key="item.id">
    <div :class="item.theme + '-theme'" :style="{ opacity: item.opacity }">
      Content
    </div>
  </div>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should have key reconciliation
    expect(code).toContain('__oldMap.has(__key)');
    
    // Should have class and style bindings
    expect(code).toContain('item.theme');
    expect(code).toContain('item.opacity');
    expect(code).toContain('-theme');
    
    // Should NOT have raw {{ delimiters
    expect(code).not.toMatch(/\{\{.*\}\}/);
  });

  it('should handle event handlers in loops with complex expressions', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-loop-events' })

const items = signal([
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' }
])

function handleClick(id) {
  console.log('Clicked:', id)
}
</script>

<template>
<div>
  <button each="item in items()" :key="item.id" @click="{{ handleClick(item.id) }}">
    {{ item.name }}
  </button>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should have key reconciliation
    expect(code).toContain('__oldMap.has(__key)');
    
    // Should have event handler without raw {{
    expect(code).toContain('addEventListener');
    expect(code).not.toMatch(/this\._\{\{/);
    
    // Should NOT have raw {{ delimiters elsewhere
    expect(code).not.toMatch(/\{\{.*\}\}/);
  });

  it('should handle ALL features combined (7+ features)', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-all-features' })

const items = signal([
  { 
    id: 1, 
    type: 'comp-a',
    title: 'Item 1',
    showTitle: true,
    theme: 'light',
    opacity: 0.9,
    isActive: true
  }
])

function toggleActive(id) {
  console.log('Toggle:', id)
}
</script>

<template>
<div>
  <div each="item in items()" :key="item.id">
    <component :is="item.type">
      <template #header>
        <h3 if="{{ item.showTitle }}">{{ item.title }}</h3>
      </template>
      
      <div 
        :class="item.theme + '-theme'"
        :style="{ opacity: item.opacity }"
      >
        <p>Status: {{ item.isActive ? 'Active' : 'Inactive' }}</p>
      </div>
      
      <div slot="footer">
        <button @click="{{ toggleActive(item.id) }}">Toggle</button>
      </div>
    </component>
  </div>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    console.log('\n=== Generated Code for ALL features ===');
    const featureLines = code.split('\n').filter(line => 
      line.includes('each') || line.includes('__oldMap') || 
      line.includes('component') || line.includes('slot') ||
      line.includes('if (') || line.includes('addEventListener')
    );
    featureLines.slice(0, 20).forEach((line, i) => console.log(`Line ${i}: ${line.substring(0, 100)}`));

    // Verify ALL 7+ features are present and working:
    
    // 1. Loops
    expect(code).toContain('each');
    
    // 2. Keys
    expect(code).toContain('__oldMap.has(__key)');
    expect(code).toContain('item.id');
    
    // 3. Dynamic components
    expect(code).toContain('item.type');
    expect(code).toContain("setAttribute('is'");
    
    // 4. Named slots
    expect(code).toContain('#header');
    expect(code).toContain('slot="footer"');
    
    // 5. Conditionals
    expect(code).toContain('if (');
    expect(code).toContain('item.showTitle');
    
    // 6. Class bindings
    expect(code).toContain('item.theme');
    expect(code).toContain('-theme');
    
    // 7. Style bindings
    expect(code).toContain('item.opacity');
    
    // 8. Event handlers
    expect(code).toContain('addEventListener');
    expect(code).not.toMatch(/this\._\{\{/);
    
    // CRITICAL: No raw {{ delimiters anywhere
    expect(code).not.toMatch(/\{\{.*\}\}/);
    
    // No HTML entities
    expect(code).not.toContain('&gt;');
    expect(code).not.toContain('&lt;');
  });

  it('should handle nested structures (2 levels with conditional)', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-nesting' })

const items = signal([
  { 
    id: 1,
    showDetail: true,
    detail: 'nested value'
  }
])
</script>

<template>
<div>
  <div each="item in items()" :key="item.id">
    <div if="{{ item.showDetail }}">
      <span>{{ item.detail }}</span>
    </div>
  </div>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should handle nesting without errors
    expect(code).toContain('__oldMap.has(__key)');
    expect(code).toContain('item.id');
    expect(code).toContain('if (');
    expect(code).toContain('item.showDetail');
    expect(code).toContain('item.detail');
    
    // Should NOT have raw {{ delimiters
    expect(code).not.toMatch(/\{\{.*\}\}/);
  });
});
