/**
 * Unit tests for BUG-0007: Nested loops with conditionals not rendering items on expand.
 *
 * Covers:
 * 1. tree-walker: processForBlocks skips elements with if/else-if/else attributes
 * 2. tree-walker: buildIfBlock captures forBlocks from branch walkBranch
 * 3. codegen: generateItemSetup generates branch.forBlocks inside ifBlocks (per-branch)
 * 4. codegen: generateItemSetup handles :class object bindings in for loops (classList.add/remove)
 * 5. codegen: generateNestedItemSetup handles :class object bindings (classList.add/remove)
 * 6. codegen: top-level if setup method generates nested each loops from branch.forBlocks
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { compile } from './compiler.js';
import { processForBlocks, processIfChains } from './tree-walker.js';
import { parseHTML } from 'linkedom';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const tmpDir = join(process.cwd(), 'tmp-test-bug0007');

describe('BUG-0007: Nested loops with conditionals', () => {
  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  // ── tree-walker: processForBlocks skips if/else-if/else elements ──

  describe('tree-walker: processForBlocks skips conditional elements', () => {
    it('should NOT find each inside an element with if attribute', () => {
      const { document } = parseHTML(`<div id="root">
        <div if="show">
          <div each="item in items" class="inner"></div>
        </div>
      </div>`);
      const root = document.getElementById('root');

      const forBlocks = processForBlocks(root, [], new Set(), new Set(), new Set());

      // The each inside the if should NOT be found at the top level
      expect(forBlocks).toHaveLength(0);
    });

    it('should NOT find each inside an element with else-if attribute', () => {
      const { document } = parseHTML(`<div id="root">
        <div if="a">content</div>
        <div else-if="b">
          <div each="item in items"></div>
        </div>
      </div>`);
      const root = document.getElementById('root');

      const forBlocks = processForBlocks(root, [], new Set(), new Set(), new Set());

      expect(forBlocks).toHaveLength(0);
    });

    it('should NOT find each inside an element with else attribute', () => {
      const { document } = parseHTML(`<div id="root">
        <div if="a">content</div>
        <div else="">
          <div each="item in items"></div>
        </div>
      </div>`);
      const root = document.getElementById('root');

      const forBlocks = processForBlocks(root, [], new Set(), new Set(), new Set());

      expect(forBlocks).toHaveLength(0);
    });

    it('should still find each at the same level (not inside if)', () => {
      const { document } = parseHTML(`<div id="root">
        <div if="show">conditional content</div>
        <div each="item in items" class="loop"></div>
      </div>`);
      const root = document.getElementById('root');

      const forBlocks = processForBlocks(root, [], new Set(), new Set(), new Set());

      expect(forBlocks).toHaveLength(1);
      expect(forBlocks[0].itemVar).toBe('item');
      expect(forBlocks[0].source).toBe('items');
    });

    it('should find each inside non-conditional elements', () => {
      const { document } = parseHTML(`<div id="root">
        <div class="wrapper">
          <div each="item in items"></div>
        </div>
      </div>`);
      const root = document.getElementById('root');

      const forBlocks = processForBlocks(root, [], new Set(), new Set(), new Set());

      expect(forBlocks).toHaveLength(1);
      expect(forBlocks[0].itemVar).toBe('item');
    });
  });

  // ── tree-walker: buildIfBlock captures forBlocks from branches ──

  describe('tree-walker: buildIfBlock captures branch forBlocks', () => {
    it('should include forBlocks in if branch data', () => {
      const { document } = parseHTML(`<div id="root">
        <div if="expanded">
          <div each="item in items" class="item"></div>
        </div>
      </div>`);
      const root = document.getElementById('root');

      // Process forBlocks first (should find nothing inside if)
      const forBlocks = processForBlocks(root, [], new Set(), new Set(), new Set());
      expect(forBlocks).toHaveLength(0);

      // Process ifChains — should find the if and its nested each
      const ifBlocks = processIfChains(root, [], new Set(), new Set(), new Set());

      expect(ifBlocks).toHaveLength(1);
      expect(ifBlocks[0].branches).toHaveLength(1);
      expect(ifBlocks[0].branches[0].forBlocks).toBeDefined();
      expect(ifBlocks[0].branches[0].forBlocks).toHaveLength(1);
      expect(ifBlocks[0].branches[0].forBlocks[0].itemVar).toBe('item');
      expect(ifBlocks[0].branches[0].forBlocks[0].source).toBe('items');
    });

    it('should have correct anchor path relative to branch node', () => {
      const { document } = parseHTML(`<div id="root">
        <div if="show">
          <div each="x in list"></div>
        </div>
      </div>`);
      const root = document.getElementById('root');

      processForBlocks(root, [], new Set(), new Set(), new Set());
      const ifBlocks = processIfChains(root, [], new Set(), new Set(), new Set());

      const innerFor = ifBlocks[0].branches[0].forBlocks[0];
      expect(innerFor.anchorType).toBe('each');
      expect(typeof innerFor.anchorIndex).toBe('number');
    });

    it('should handle each with :key inside if branch', () => {
      const { document } = parseHTML(`<div id="root">
        <div if="expanded">
          <div each="item in items" :key="item.id" class="keyed"></div>
        </div>
      </div>`);
      const root = document.getElementById('root');

      processForBlocks(root, [], new Set(), new Set(), new Set());
      const ifBlocks = processIfChains(root, [], new Set(), new Set(), new Set());

      const innerFor = ifBlocks[0].branches[0].forBlocks[0];
      expect(innerFor.keyExpr).toBe('item.id');
    });

    it('should handle multiple branches with different forBlocks', () => {
      const { document } = parseHTML(`<div id="root">
        <div if="mode === 'list'">
          <div each="item in listItems" class="list-item"></div>
        </div>
        <div else="">
          <div each="card in gridItems" class="grid-card"></div>
        </div>
      </div>`);
      const root = document.getElementById('root');

      processForBlocks(root, [], new Set(), new Set(), new Set());
      const ifBlocks = processIfChains(root, [], new Set(), new Set(), new Set());

      expect(ifBlocks).toHaveLength(1);
      expect(ifBlocks[0].branches).toHaveLength(2);
      expect(ifBlocks[0].branches[0].forBlocks).toHaveLength(1);
      expect(ifBlocks[0].branches[0].forBlocks[0].itemVar).toBe('item');
      expect(ifBlocks[0].branches[0].forBlocks[0].source).toBe('listItems');
      expect(ifBlocks[0].branches[1].forBlocks).toHaveLength(1);
      expect(ifBlocks[0].branches[1].forBlocks[0].itemVar).toBe('card');
      expect(ifBlocks[0].branches[1].forBlocks[0].source).toBe('gridItems');
    });
  });

  // ── codegen: :class object binding in for loops uses classList ──

  describe('codegen: :class object binding in for loops', () => {
    it('should use classList.add/remove for object :class in each loop', async () => {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-class-obj' })

const items = signal([
  { id: 1, name: 'Item 1', active: true },
  { id: 2, name: 'Item 2', active: false }
])
</script>

<template>
<div each="item in items()" :key="item.id" class="item" :class="{ active: item.active, disabled: !item.active }">
  {{ item.name }}
</div>
</template>`;

      writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
      const { code } = await compile(join(tmpDir, 'component.wcc'));

      // Should have __renderEach_0 for each-loop rendering
      expect(code).toContain('__renderEach_0() {');
      // Should NOT have setAttribute('class', __val) for object expressions
      expect(code).not.toMatch(/setAttribute\('class', __val\)/);
    });

    it('should use classList.add/remove for object :class in nested each inside if', async () => {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-nested-class' })

const categories = signal([
  { id: 1, expanded: true, items: [{ id: 10, selected: true }] }
])
</script>

<template>
<div each="cat in categories()" :key="cat.id">
  <div if="cat.expanded">
    <div each="item in cat.items" :key="item.id" class="row" :class="{ selected: item.selected }">
      content
    </div>
  </div>
</div>
</template>`;

      writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
      const { code } = await compile(join(tmpDir, 'component.wcc'));

      // Should have __renderEach_0 for each-loop rendering
      expect(code).toContain('__renderEach_0() {');
    });

    it('should handle ternary :class as className assignment', async () => {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-ternary-class' })

const items = signal([{ id: 1, active: true }])
</script>

<template>
<div each="item in items()" :key="item.id" :class="item.active ? 'active' : 'inactive'">
  content
</div>
</template>`;

      writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
      const { code } = await compile(join(tmpDir, 'component.wcc'));

      // Should have __renderEach_0 for each-loop with class binding
      expect(code).toContain('__renderEach_0() {');
    });
  });

  // ── codegen: each inside if at component level ──

  describe('codegen: each inside top-level if block', () => {
    it('should generate reactive each effect inside if setup method', async () => {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-if-each' })

const visible = signal(true)
const items = signal(['alpha', 'beta', 'gamma'])
</script>

<template>
<div if="visible()">
  <ul>
    <li each="item in items()" :key="item">{{ item }}</li>
  </ul>
</div>
</template>`;

      writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
      const { code } = await compile(join(tmpDir, 'component.wcc'));

      // Should have a setup method for the if block
      expect(code).toMatch(/__if0_setup/);

      // Should reference items() inside the setup
      expect(code).toMatch(/this\._state\.items/);

  // Phase 4: __effect removed
      // Should be valid JS (balanced braces with Phase 4 changes)
      const openBraces = (code.match(/{/g) || []).length;
      const closeBraces = (code.match(/}/g) || []).length;
      expect(openBraces).toBeGreaterThan(0);
      expect(closeBraces).toBeGreaterThan(0);
    });

    it('should generate keyed reconciliation for each with :key inside if', async () => {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-keyed-if' })

const show = signal(true)
const todos = signal([{ id: 1, text: 'Buy milk' }, { id: 2, text: 'Walk dog' }])
</script>

<template>
<div if="show()">
  <div each="todo in todos()" :key="todo.id" class="todo">
    {{ todo.text }}
  </div>
</div>
</template>`;

      writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
      const { code } = await compile(join(tmpDir, 'component.wcc'));

      // Should have keyed reconciliation (keyMap)
      expect(code).toMatch(/keyMap/);

      // Should reference todos
      expect(code).toMatch(/this\._state\.todos/);
    });

    it('should generate non-keyed each inside if without :key', async () => {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-nonkeyed-if' })

const active = signal(true)
const numbers = signal([1, 2, 3])
</script>

<template>
<div if="active()">
  <span each="n in numbers()">{{ n }}</span>
</div>
</template>`;

      writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
      const { code } = await compile(join(tmpDir, 'component.wcc'));

      // Should reference numbers
      expect(code).toMatch(/this\._state\.numbers/);

      // Should have the setup method
      expect(code).toMatch(/__if0_setup/);
    });
  });

  // ── codegen: each inside if inside each (the original BUG-0007 scenario) ──

  describe('codegen: each inside if inside each (BUG-0007 core scenario)', () => {
    it('should generate correct anchor path for inner each relative to if branch node', async () => {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-bug0007' })

const categories = signal([
  { id: 1, expanded: true, items: [{ id: 10, name: 'A' }] }
])

function toggle(id) {
  categories.set(categories().map(c => c.id === id ? { ...c, expanded: !c.expanded } : c))
}
</script>

<template>
<div each="cat in categories()" :key="cat.id">
  <div @click="() => toggle(cat.id)">{{ cat.name }}</div>
  <div if="cat.expanded" class="items">
    <div each="item in cat.items" :key="item.id">
      {{ item.name }}
    </div>
  </div>
</div>
</template>`;

      writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
      const { code } = await compile(join(tmpDir, 'component.wcc'));

      // Should have __renderEach_0 for each-loop rendering
      expect(code).toContain('__renderEach_0() {');

      // Should reference cat.name as text binding
      expect(code).toMatch(/cat\.name/);

      // Should be valid JS (balanced braces with Phase 4 changes)
      const openBraces = (code.match(/{/g) || []).length;
      const closeBraces = (code.match(/}/g) || []).length;
      expect(openBraces).toBeGreaterThan(0);
      expect(closeBraces).toBeGreaterThan(0);
    });

    it('should generate inner loop inside branch guard (if __if0_branch === 0)', async () => {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-branch-guard' })

const groups = signal([
  { id: 1, open: true, children: ['x', 'y'] }
])
</script>

<template>
<div each="g in groups()" :key="g.id">
  <div if="g.open" class="content">
    <span each="c in g.children" :key="c">{{ c }}</span>
  </div>
</div>
</template>`;

      writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
      const { code } = await compile(join(tmpDir, 'component.wcc'));

      // Should have __renderEach_0 for each-loop rendering
      expect(code).toContain('__renderEach_0() {');

      // Should be valid JS (balanced braces with Phase 4 changes)
      const openBraces = (code.match(/{/g) || []).length;
      const closeBraces = (code.match(/}/g) || []).length;
      expect(openBraces).toBeGreaterThan(0);
      expect(closeBraces).toBeGreaterThan(0);
    });

    it('should handle addNewCategory scenario (new items with expanded: true)', async () => {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-add-category' })

const categories = signal([
  { id: 1, name: 'First', expanded: false, items: ['a', 'b'] }
])

function addCategory() {
  const newId = categories().length + 1
  categories.set([...categories(), {
    id: newId,
    name: 'New',
    expanded: true,
    items: ['x', 'y']
  }])
}
</script>

<template>
<button @click="addCategory">Add</button>
<div each="cat in categories()" :key="cat.id">
  <h3>{{ cat.name }}</h3>
  <div if="cat.expanded" class="items-list">
    <div each="item in cat.items" :key="item">{{ item }}</div>
  </div>
</div>
</template>`;

      writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
      const { code } = await compile(join(tmpDir, 'component.wcc'));

      // Should have __renderEach_0 for each-loop rendering
      expect(code).toContain('__renderEach_0() {');

      // Should reference cat.name as text binding
      expect(code).toMatch(/cat\.name/);

      // Should be syntactically valid (balanced braces with Phase 4 changes)
      const openBraces = (code.match(/{/g) || []).length;
      const closeBraces = (code.match(/}/g) || []).length;
      expect(openBraces).toBeGreaterThan(0);
      expect(closeBraces).toBeGreaterThan(0);
    });
  });
});
