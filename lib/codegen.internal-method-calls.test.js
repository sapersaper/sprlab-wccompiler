import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { compile } from './compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('BUG-0017: Internal Method Calls Missing this._ Prefix', () => {
  const tmpDir = join(process.cwd(), 'tmp-test-bug-0017');

  beforeEach(() => {
    try { mkdirSync(tmpDir, { recursive: true }); } catch {}
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it('should transform internal method calls with this._ prefix', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-method-calls' })

const count = signal(0)

function helperMethod() {
  console.log('helper')
}

function mainMethod() {
  helperMethod()
}
</script>

<template>
<button @click="{{ mainMethod }}">Click</button>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should transform internal method call to this._helperMethod()
    expect(code).toMatch(/this\._helperMethod\(\)/);
    
    // Should NOT have bare helperMethod() without this._
    expect(code).not.toMatch(/\bhelperMethod\(\)(?!\s*\.)/);
  });

  it('should handle method calls with arguments', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-method-args' })

const value = signal('')

function processValue(val) {
  return val.toUpperCase()
}

function updateValue() {
  const result = processValue(value())
  value(result)
}
</script>

<template>
<button @click="{{ updateValue }}">Update</button>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Should transform method call with argument
    expect(code).toMatch(/this\._processValue\(this\._value\(\)\)/);
    
    // Should NOT have bare processValue(
    expect(code).not.toMatch(/\bprocessValue\(/);
  });

  it('should handle chained method calls (A → B → C)', async () => {
    const sfcContent = `<script>
import { defineComponent } from 'wcc'

export default defineComponent({ tag: 'test-chained-calls' })

function stepC() {
  console.log('step C')
}

function stepB() {
  stepC()
}

function stepA() {
  stepB()
}
</script>

<template>
<button @click="{{ stepA }}">Start</button>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // All internal method calls should be transformed
    expect(code).toMatch(/this\._stepC\(\)/);
    expect(code).toMatch(/this\._stepB\(\)/);
    
    // stepA is called from event handler, so it's bound as this._stepA.bind(this)
    expect(code).toMatch(/this\._stepA\.bind\(this\)/);
    
    // Should NOT have bare method calls in method bodies
    expect(code).not.toMatch(/_stepB\(\)\s*\{[^}]*\bstepC\(/);
    expect(code).not.toMatch(/_stepA\(\)\s*\{[^}]*\bstepB\(/);
  });

  it('should handle conditional method calls', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-conditional-calls' })

const flag = signal(true)

function methodA() {
  console.log('A')
}

function methodB() {
  console.log('B')
}

function conditionalMethod() {
  if (flag()) {
    methodA()
  } else {
    methodB()
  }
}
</script>

<template>
<button @click="{{ conditionalMethod }}">Run</button>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Both conditional method calls should be transformed
    expect(code).toMatch(/this\._methodA\(\)/);
    expect(code).toMatch(/this\._methodB\(\)/);
  });

  it('should handle method calls in callbacks', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-callback-calls' })

const items = signal([1, 2, 3])

function processItem(item) {
  return item * 2
}

function processAll() {
  const results = items().map(item => processItem(item))
  console.log(results)
}
</script>

<template>
<button @click="{{ processAll }}">Process</button>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // Method call inside callback should be transformed
    expect(code).toMatch(/this\._processItem\(item\)/);
  });

  it('should not transform external/global function calls', async () => {
    const sfcContent = `<script>
import { defineComponent } from 'wcc'

export default defineComponent({ tag: 'test-external-calls' })

function internalMethod() {
  // Call to external library function (not defined in component)
  console.log('test')
  Math.random()
}
</script>

<template>
<button @click="{{ internalMethod }}">Run</button>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // External functions should NOT be transformed
    expect(code).toContain('console.log(');
    expect(code).toContain('Math.random()');
    
    // But internal method should be available as this._internalMethod (called from event handler)
    expect(code).toMatch(/this\._internalMethod\.bind\(this\)/);
  });

  it('should handle the real-world scenario from test-large-dataset', async () => {
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-large-dataset-scenario' })

const largeList = signal([])
const filteredList = signal([])
const searchTerm = signal('')

function handleSearch(term) {
  searchTerm(term)
  
  if (!term) {
    filteredList(largeList())
    return
  }
  
  const lowerTerm = term.toLowerCase()
  const filtered = largeList().filter(item => 
    item.name.toLowerCase().includes(lowerTerm)
  )
  
  filteredList(filtered)
}

function sortBy(field) {
  const sorted = [...largeList()].sort((a, b) => {
    if (typeof a[field] === 'string') {
      return a[field].localeCompare(b[field])
    }
    return a[field] - b[field]
  })
  largeList(sorted)
  
  // Calling another internal method - THIS IS THE BUG
  handleSearch(searchTerm())
}
</script>

<template>
<div>
  <button @click="{{ sortBy('name') }}">Sort</button>
</div>
</template>`;

    writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(tmpDir, 'component.wcc'));

    // The critical bug: handleSearch call should be transformed
    expect(code).toMatch(/this\._handleSearch\(this\._searchTerm\(\)\)/);
    
    // Should NOT have bare handleSearch( which causes ReferenceError
    expect(code).not.toMatch(/\bhandleSearch\(/);
  });
});
