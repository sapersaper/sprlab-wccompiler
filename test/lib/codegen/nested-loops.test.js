/**
 * Nested loops — tests for each loops with conditionals, event handlers,
 * :class bindings, and nested structures.
 *
 * Consolidated from: BUG-0007 (each-loop-events, nested-loops-conditionals),
 * BUG-0019 (nested-loop-structure).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { compile } from '../../../lib/compiler.js';
import { processForBlocks, processIfChains } from '../../../lib/tree-walker.js';
import { parseHTML } from 'linkedom';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function tmp(name) {
  const dir = join(tmpdir(), `wcc-${name}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ── tree-walker: processForBlocks skips conditional elements ──

describe('tree-walker: processForBlocks skips conditional elements', () => {
  it('skips each inside if', () => {
    const { document } = parseHTML(`<div id="r">
      <div if="show"><div each="i in items"></div></div>
    </div>`);
    expect(processForBlocks(document.getElementById('r'), [], new Set(), new Set(), new Set())).toHaveLength(0);
  });

  it('skips each inside else-if', () => {
    const { document } = parseHTML(`<div id="r">
      <div if="a">x</div>
      <div else-if="b"><div each="i in items"></div></div>
    </div>`);
    expect(processForBlocks(document.getElementById('r'), [], new Set(), new Set(), new Set())).toHaveLength(0);
  });

  it('skips each inside else', () => {
    const { document } = parseHTML(`<div id="r">
      <div if="a">x</div>
      <div else><div each="i in items"></div></div>
    </div>`);
    expect(processForBlocks(document.getElementById('r'), [], new Set(), new Set(), new Set())).toHaveLength(0);
  });

  it('finds each at same level as if (not inside)', () => {
    const { document } = parseHTML(`<div id="r">
      <div if="show">x</div>
      <div each="i in items"></div>
    </div>`);
    const blocks = processForBlocks(document.getElementById('r'), [], new Set(), new Set(), new Set());
    expect(blocks).toHaveLength(1);
    expect(blocks[0].itemVar).toBe('i');
  });

  it('finds each inside non-conditional wrapper', () => {
    const { document } = parseHTML(`<div id="r">
      <div class="w"><div each="i in items"></div></div>
    </div>`);
    expect(processForBlocks(document.getElementById('r'), [], new Set(), new Set(), new Set())).toHaveLength(1);
  });
});

// ── tree-walker: buildIfBlock captures branch forBlocks ──

describe('tree-walker: buildIfBlock captures branch forBlocks', () => {
  it('includes forBlocks in if branch data', () => {
    const { document } = parseHTML(`<div id="r">
      <div if="expanded"><div each="i in items" class="x"></div></div>
    </div>`);
    const root = document.getElementById('r');
    expect(processForBlocks(root, [], new Set(), new Set(), new Set())).toHaveLength(0);
    const ifBlocks = processIfChains(root, [], new Set(), new Set(), new Set());
    expect(ifBlocks[0].branches[0].forBlocks).toHaveLength(1);
    expect(ifBlocks[0].branches[0].forBlocks[0].itemVar).toBe('i');
  });

  it('handles each with :key inside if', () => {
    const { document } = parseHTML(`<div id="r">
      <div if="expanded"><div each="i in items" :key="i.id"></div></div>
    </div>`);
    const root = document.getElementById('r');
    const ifBlocks = processIfChains(root, [], new Set(), new Set(), new Set());
    expect(ifBlocks[0].branches[0].forBlocks[0].keyExpr).toBe('i.id');
  });

  it('handles multiple branches with different forBlocks', () => {
    const { document } = parseHTML(`<div id="r">
      <div if="a"><div each="i in xs"></div></div>
      <div else><div each="j in ys"></div></div>
    </div>`);
    const root = document.getElementById('r');
    const ifBlocks = processIfChains(root, [], new Set(), new Set(), new Set());
    expect(ifBlocks[0].branches[0].forBlocks[0].itemVar).toBe('i');
    expect(ifBlocks[0].branches[1].forBlocks[0].itemVar).toBe('j');
  });
});

// ── codegen: each inside if at top level ──

describe('codegen: each inside top-level if', () => {
  let dir;

  beforeEach(() => { dir = tmp('nested'); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('generates reactive each inside if setup', async () => {
    const p = join(dir, 'c.wcc');
    writeFileSync(p, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const v = signal(true)
const items = signal(['a'])
</script>
<template>
<div if="v()"><li each="i in items()">{{ i }}</li></div>
</template>`);
    const { code } = await compile(p);
    expect(code).toMatch(/__if0_setup/);
    expect(code).toMatch(/this\._state\.items/);
  });

  it('handles keyed each inside if', async () => {
    const p = join(dir, 'c.wcc');
    writeFileSync(p, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const s = signal(true)
const todos = signal([{ id: 1, text: 'x' }])
</script>
<template>
<div if="s()"><div each="t in todos()" :key="t.id">{{ t.text }}</div></div>
</template>`);
    const { code } = await compile(p);
    expect(code).toMatch(/keyMap/);
    expect(code).toMatch(/this\._state\.todos/);
  });
});

// ── codegen: each inside if inside each (core BUG-0007 scenario) ──

describe('codegen: each inside if inside each', () => {
  let dir;

  beforeEach(() => { dir = tmp('nested'); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('generates correct structure for nested each inside if', async () => {
    const p = join(dir, 'c.wcc');
    writeFileSync(p, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const cats = signal([{ id: 1, expanded: true, items: [{ id: 10, name: 'A' }] }])
</script>
<template>
<div each="cat in cats()" :key="cat.id">
  <div if="cat.expanded" class="items">
    <div each="item in cat.items" :key="item.id">{{ item.name }}</div>
  </div>
</div>
</template>`);
    const { code } = await compile(p);
    expect(code).toContain('__renderEach_0() {');
    expect(code).toMatch(/item\.name/);
  });

  it('handles addNewCategory scenario (new items with expanded: true)', async () => {
    const p = join(dir, 'c.wcc');
    writeFileSync(p, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const cats = signal([{ id: 1, name: 'A', expanded: false, items: ['a'] }])
</script>
<template>
<div each="cat in cats()" :key="cat.id">
  <h3>{{ cat.name }}</h3>
  <div if="cat.expanded"><div each="i in cat.items" :key="i">{{ i }}</div></div>
</div>
</template>`);
    const { code } = await compile(p);
    expect(code).toContain('__renderEach_0() {');
    expect(code).toMatch(/cat\.name/);
  });
});

// ── codegen: nested loop structure ──

describe('codegen: nested loop structure', () => {
  let dir;

  beforeEach(() => { dir = tmp('nested'); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('handles deep nesting (each inside if inside each)', async () => {
    const p = join(dir, 'c.wcc');
    writeFileSync(p, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const cats = signal([{ id:1, expanded:true, items: [{id:10, name:'Laptop', inStock:true}] }])
</script>
<template>
<div each="cat in cats()" :key="cat.id">
  <div @click="() => toggle(cat.id)">{{ cat.name }}</div>
  <div if="cat.expanded">
    <div each="item in cat.items" :key="item.id">
      <span>{{ item.inStock ? 'yes' : 'no' }}</span>
    </div>
  </div>
</div>
</template>`);
    const { code } = await compile(p);
    expect(code).toContain('__renderEach_0() {');
    expect(code).toMatch(/cat\.name/);
  });

  it('handles variable shadowing in nested each', async () => {
    const p = join(dir, 'c.wcc');
    writeFileSync(p, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const outer = signal([1, 2, 3])
</script>
<template>
<div each="x in outer()" :key="x">
  <div each="x in [10, 20, 30]" :key="x">{{ x }}</div>
</div>
</template>`);
    const { code } = await compile(p);
    expect(code).toMatch(/this\._state\.outer/);
    expect(code.length).toBeGreaterThan(0);
  });
});

// ── codegen: :class in loops ──

describe('codegen: :class binding in loops', () => {
  let dir;

  beforeEach(() => { dir = tmp('nested'); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('uses classList for object :class in each', async () => {
    const p = join(dir, 'c.wcc');
    writeFileSync(p, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const items = signal([{ id: 1, active: true }])
</script>
<template>
<div each="i in items()" :key="i.id" :class="{ active: i.active }">{{ i.name }}</div>
</template>`);
    const { code } = await compile(p);
    expect(code).toContain('__renderEach_0() {');
    expect(code).not.toMatch(/setAttribute\('class', __val\)/);
  });

  it('handles ternary :class in each', async () => {
    const p = join(dir, 'c.wcc');
    writeFileSync(p, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const items = signal([{ id: 1, active: true }])
</script>
<template>
<div each="i in items()" :key="i.id" :class="i.active ? 'active' : ''">x</div>
</template>`);
    const { code } = await compile(p);
    expect(code).toContain('__renderEach_0() {');
  });
});

// ── codegen: event handlers in each loops ──

describe('codegen: event handlers in each loops', () => {
  let dir;

  beforeEach(() => { dir = tmp('nested'); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('prefixes method with this._ in arrow function inside each', async () => {
    const p = join(dir, 'c.wcc');
    writeFileSync(p, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const items = signal([{ id: 1, name: 'x' }])
function toggle(id) { items.set(items().map(i => i.id===id ? {...i, active:!i.active} : i)) }
</script>
<template>
<li each="item in items()" :key="item.id">
  <button @click="() => toggle(item.id)">Toggle</button>
</li>
</template>`);
    const { code } = await compile(p);
    expect(code).toContain('this._toggle(item.id)');
  });

  it('prefixes method with this._ in direct method reference with args', async () => {
    const p = join(dir, 'c.wcc');
    writeFileSync(p, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const items = signal([1, 2, 3])
function remove(i) { items.set(items().filter((_,x) => x!==i)) }
</script>
<template>
<li each="(item, index) in items()">
  <button @click="remove(index)">Remove</button>
</li>
</template>`);
    const { code } = await compile(p);
    expect(code).toMatch(/addEventListener\(['"]click['"],\s*\(e\)\s*=>\s*{\s*this\._remove\(index\)/);
  });

  it('preserves loop variables in method calls', async () => {
    const p = join(dir, 'c.wcc');
    writeFileSync(p, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const items = signal([{ id: 1, value: 10 }])
function upd(id, v) { items.set(items().map(i => i.id===id ? {...i, value:v} : i)) }
</script>
<template>
<div each="item in items()">
  <button @click="() => upd(item.id, item.value+1)">+</button>
</div>
</template>`);
    const { code } = await compile(p);
    expect(code).toContain('this._upd(item.id, item.value+1)');
    expect(code).toContain('item.id');
    expect(code).toContain('item.value');
  });

  it('handles multiple parameters in method calls', async () => {
    const p = join(dir, 'c.wcc');
    writeFileSync(p, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const items = signal([{ id: 1, name: 'x' }])
function upd(id, name, active) { /*noop*/ }
</script>
<template>
<div each="item in items()">
  <button @click="() => upd(item.id, item.name, true)">Upd</button>
</div>
</template>`);
    const { code } = await compile(p);
    expect(code).toContain('this._upd(item.id, item.name, true)');
  });

  it('handles index parameter in each loops', async () => {
    const p = join(dir, 'c.wcc');
    writeFileSync(p, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const items = signal(['a', 'b'])
function rm(i) { items.set(items().filter((_,x)=>x!==i)) }
</script>
<template>
<div each="(item, index) in items()">
  <button @click="() => rm(index)">Remove</button>
</div>
</template>`);
    const { code } = await compile(p);
    expect(code).toContain('this._rm(index)');
  });

  it('handles event handlers outside each loops correctly', async () => {
    const p = join(dir, 'c.wcc');
    writeFileSync(p, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const count = signal(0)
function inc() { count.set(count() + 1) }
</script>
<template>
<button @click="inc">{{ count() }}</button>
<div each="i in [1,2,3]">
  <button @click="inc">Inside {{ i }}</button>
</div>
</template>`);
    const { code } = await compile(p);
    expect(code).toMatch(/addEventListener\(['"]click['"],\s*this\._inc\.bind\(this\)/);
    expect(code).toContain('this._inc');
  });
});
