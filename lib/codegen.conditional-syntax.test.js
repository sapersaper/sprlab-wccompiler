import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { compile } from './compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('BUG-0014: Malformed Conditional Syntax with Comparison Operators', () => {
  const tmpDir = join(process.cwd(), 'tmp-test-bug-0014');

  beforeEach(() => {
    try { mkdirSync(tmpDir, { recursive: true }); } catch {}
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it('should handle if directive with greater-than operator (quoted)', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-if-gt' })

const items = signal([])
</script>

<template>
<div>
  <div if="{{ items().length > 0 }}">
    <p>Has items</p>
  </div>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    console.log('\n=== Generated Code for if with > operator ===');
    const conditionalLines = code.split('\n').filter(line => line.includes('if') && line.includes('items'));
    conditionalLines.forEach((line, i) => console.log(`Line ${i}: ${line}`));

    // Should NOT have Mustache delimiters in generated JavaScript
    expect(code).not.toMatch(/\{\{.*\}\}/);
    
    // Should have valid comparison operator
    expect(code).toMatch(/items\(\)\.length\s*>\s*0/);
    
    // Should NOT have HTML entities like &gt;
    expect(code).not.toContain('&gt;');
    
    // Should NOT have malformed attributes
    expect(code).not.toMatch(/items\(\)\.length=""/);
  });

  it('should handle if directive with greater-than operator (unquoted)', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-if-gt-unquoted' })

const items = signal([])
</script>

<template>
<div>
  <div if={{ items().length > 0 }}>
    <p>Has items</p>
  </div>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    console.log('\n=== Generated Code for if with > operator (unquoted) ===');
    const conditionalLines = code.split('\n').filter(line => line.includes('if') && line.includes('items'));
    conditionalLines.forEach((line, i) => console.log(`Line ${i}: ${line}`));

    // Should NOT have Mustache delimiters in generated JavaScript
    expect(code).not.toMatch(/\{\{.*\}\}/);
    
    // Should have valid comparison operator
    expect(code).toMatch(/items\(\)\.length\s*>\s*0/);
    
    // Should NOT have HTML entities
    expect(code).not.toContain('&gt;');
    
    // Should NOT have malformed attributes
    expect(code).not.toMatch(/items\(\)\.length=""/);
  });

  it('should handle else-if directive with equality operator', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-else-if-eq' })

const items = signal([])
</script>

<template>
<div>
  <div if="{{ items().length > 0 }}">
    <p>Has items</p>
  </div>
  
  <div else-if="{{ items().length === 0 }}">
    <p>No items</p>
  </div>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    console.log('\n=== Generated Code for else-if with === operator ===');
    const conditionalLines = code.split('\n').filter(line => line.includes('else if') || (line.includes('if') && line.includes('items')));
    conditionalLines.forEach((line, i) => console.log(`Line ${i}: ${line}`));

    // Should NOT have Mustache delimiters
    expect(code).not.toMatch(/\{\{.*\}\}/);
    
    // Should have valid equality operator
    expect(code).toMatch(/items\(\)\.length\s*===\s*0/);
    
    // Should NOT have HTML entities
    expect(code).not.toContain('&gt;');
    expect(code).not.toContain('&lt;');
  });

  it('should handle complex expressions with multiple operators', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-complex' })

const count = signal(0)
const min = signal(1)
const max = signal(10)
</script>

<template>
<div>
  <div if="{{ count() > min() && count() < max() }}">
    <p>In range</p>
  </div>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    console.log('\n=== Generated Code for complex expression ===');
    const conditionalLines = code.split('\n').filter(line => line.includes('count') && line.includes('min'));
    conditionalLines.forEach((line, i) => console.log(`Line ${i}: ${line}`));

    // Should NOT have Mustache delimiters
    expect(code).not.toMatch(/\{\{.*\}\}/);
    
    // Should preserve both comparison operators (search in full code, not just filtered lines)
    // The conditional expression should be in the effect callback
    const hasValidCondition = code.includes('_count()') && 
                              code.includes('_min()') && 
                              code.includes('_max()') &&
                              code.match(/_count\(\).*>.*_min\(\)/s);  // 's' flag for multiline
    
    console.log('Has valid condition:', !!hasValidCondition);
    
    expect(code).not.toMatch(/\{\{.*\}\}/);
    expect(hasValidCondition).toBeTruthy();
  });

  it('should handle event handlers with Mustache syntax (@click)', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-event-handler' })

const count = signal(0)

function increment() {
  count.set(count() + 1)
}
</script>

<template>
<div>
  <button @click="{{ increment() }}">Increment</button>
  <p>{{ count() }}</p>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    console.log('\n=== Generated Code for event handler ===');
    const eventLines = code.split('\n').filter(line => line.includes('addEventListener') || line.includes('increment'));
    eventLines.forEach((line, i) => console.log(`Line ${i}: ${line}`));

    // Should NOT have raw {{ in JavaScript
    expect(code).not.toMatch(/this\._\{\{/);
    expect(code).not.toMatch(/const __v = \{\{/);
    
    // Should have valid event listener setup
    expect(code).toContain('addEventListener');
  });

  it('should handle dynamic component bindings (:is)', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-dynamic-component' })

const selectedComponent = signal('panel-a')
</script>

<template>
<div>
  <component :is="{{ selectedComponent() }}"></component>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    console.log('\n=== Generated Code for dynamic component ===');
    const dynamicLines = code.split('\n').filter(line => line.includes('selectedComponent') || line.includes('__val___attr_is'));
    dynamicLines.forEach((line, i) => console.log(`Line ${i}: ${line}`));

    // Should NOT have raw {{ in variable assignment
    expect(code).not.toMatch(/const __val.*= \{\{;/);
    
    // Should have valid component resolution
    expect(code).toContain('selectedComponent');
  });

  it('should handle string equality comparison', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-string-eq' })

const status = signal('inactive')
</script>

<template>
<div>
  <div if="{{ status() === 'active' }}">
    <p>Active</p>
  </div>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    console.log('\n=== Generated Code for string equality ===');
    const conditionalLines = code.split('\n').filter(line => line.includes('status'));
    conditionalLines.forEach((line, i) => console.log(`Line ${i}: ${line}`));

    // Should NOT have Mustache delimiters
    expect(code).not.toMatch(/\{\{.*\}\}/);
    
    // Should have valid string comparison
    expect(code).toMatch(/status\(\)\s*===\s*['"]active['"]/);
    
    // Should NOT have HTML entities
    expect(code).not.toContain('&gt;');
  });

  it('should handle less-than operator', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-lt' })

const count = signal(5)
</script>

<template>
<div>
  <div if="{{ count() < 10 }}">
    <p>Less than 10</p>
  </div>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should NOT have Mustache delimiters
    expect(code).not.toMatch(/\{\{.*\}\}/);
    
    // Should have valid less-than operator
    expect(code).toMatch(/count\(\)\s*<\s*10/);
    
    // Should NOT have HTML entities
    expect(code).not.toContain('&lt;');
  });

  it('should handle greater-than-or-equal operator', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-gte' })

const count = signal(5)
</script>

<template>
<div>
  <div if="{{ count() >= 5 }}">
    <p>Greater or equal to 5</p>
  </div>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should NOT have Mustache delimiters
    expect(code).not.toMatch(/\{\{.*\}\}/);
    
    // Should have valid >= operator
    expect(code).toMatch(/count\(\)\s*>=\s*5/);
    
    // Should NOT have HTML entities
    expect(code).not.toContain('&gt;');
  });

  it('should handle logical OR operator in conditionals', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-or' })

const count = signal(0)
const status = signal('inactive')
</script>

<template>
<div>
  <div if="{{ count() === 0 || status() === 'inactive' }}">
    <p>Not ready</p>
  </div>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should NOT have Mustache delimiters
    expect(code).not.toMatch(/\{\{.*\}\}/);
    
    // Should preserve OR operator
    expect(code).toContain('||');
    expect(code).toMatch(/count\(\)\s*===\s*0/);
    expect(code).toMatch(/status\(\)\s*===\s*['"]inactive['"]/);
  });

  it('should handle else blocks (without condition)', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-else' })

const items = signal([])
</script>

<template>
<div>
  <div if="{{ items().length > 0 }}">
    <p>Has items</p>
  </div>
  
  <div else>
    <p>No items</p>
  </div>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should NOT have Mustache delimiters
    expect(code).not.toMatch(/\{\{.*\}\}/);
    
    // Should have if/else structure
    expect(code).toMatch(/if \(/);
    expect(code).toMatch(/else \{/);
  });

  it('should handle chained else-if directives', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-chained-elseif' })

const status = signal('pending')
</script>

<template>
<div>
  <div if="{{ status() === 'active' }}">
    <p>Active</p>
  </div>
  
  <div else-if="{{ status() === 'inactive' }}">
    <p>Inactive</p>
  </div>
  
  <div else-if="{{ status() === 'pending' }}">
    <p>Pending</p>
  </div>
  
  <div else>
    <p>Unknown</p>
  </div>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should NOT have Mustache delimiters
    expect(code).not.toMatch(/\{\{.*\}\}/);
    
    // Should have if/else-if/else chain
    expect(code).toMatch(/if \(/);
    expect(code).toMatch(/else if \(/);
    expect(code).toMatch(/else \{/);
    
    // Should have all three status checks
    expect(code).toContain("'active'");
    expect(code).toContain("'inactive'");
    expect(code).toContain("'pending'");
  });
});
