import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { compile } from './compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('BUG-0016: Event Handler Spacing Regression', () => {
  const tmpDir = join(process.cwd(), 'tmp-test-bug-0016');

  beforeEach(() => {
    try { mkdirSync(tmpDir, { recursive: true }); } catch {}
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it('should not generate spaces in simple event handler method names', async () => {
    const sfcContent = `<script>
import { defineComponent } from 'wcc'

export default defineComponent({ tag: 'test-event-spacing' })

function handleClick() {
  console.log('clicked')
}
</script>

<template>
<button @click="{{ handleClick }}">Click Me</button>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should NOT have spaces around method name
    expect(code).not.toMatch(/this\._\s+\w+\s+\.bind/);
    
    // Should have correct syntax without spaces
    expect(code).toMatch(/this\._handleClick\.bind\(this\)/);
    
    // Should NOT have the broken pattern
    expect(code).not.toContain('this._ handleClick .bind(this)');
  });

  it('should handle event handlers with function calls correctly', async () => {
    const sfcContent = `<script>
import { defineComponent } from 'wcc'

export default defineComponent({ tag: 'test-event-call' })

function increment(count) {
  return count + 1
}
</script>

<template>
<button @click="{{ increment }}">Increment</button>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should NOT have spaces in method name
    expect(code).not.toMatch(/this\._\s+\w+\s+\.bind/);
    
    // Should have correct syntax
    expect(code).toMatch(/this\._increment\.bind\(this\)/);
  });

  it('should handle event handlers in loops without spacing issues', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-loop-events' })

const items = signal([
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' }
])

function removeItem(id) {
  console.log('Removing', id)
}
</script>

<template>
<ul>
  <li each="item in items()" :key="item.id">
    <button @click="{{ removeItem(item.id) }}">Remove</button>
  </li>
</ul>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should NOT have spaces around method name
    expect(code).not.toMatch(/this\._\s+\w+\s+\(/);
    
    // Should have correct syntax
    expect(code).toMatch(/this\._removeItem\(item\.id\)/);
    
    // Should have key reconciliation
    expect(code).toContain('__oldMap.has(__key)');
  });

  it('should handle multiple event types without spacing issues', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-multiple-events' })

const value = signal('')

function handleChange(e) {
  value(e.target.value)
}

function handleSubmit() {
  console.log('Submitted:', value())
}
</script>

<template>
<form>
  <input type="text" @input="{{ handleChange }}" />
  <button type="submit" @click="{{ handleSubmit }}">Submit</button>
</form>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should NOT have spaces in any event handler
    expect(code).not.toMatch(/this\._\s+\w+\s+\.bind/);
    
    // Should have correct syntax for both handlers
    expect(code).toMatch(/this\._handleChange\.bind\(this\)/);
    expect(code).toMatch(/this\._handleSubmit\.bind\(this\)/);
  });

  it('should handle arrow function event handlers correctly', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-arrow-events' })

const count = signal(0)

function increment() {
  count(count() + 1)
}
</script>

<template>
<button @click="{{ increment }}">Increment</button>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should NOT have malformed syntax with spaces
    expect(code).not.toMatch(/this\._\s+increment\s+\.bind/);
    
    // Should have correct syntax
    expect(code).toMatch(/this\._increment\.bind\(this\)/);
  });
});
