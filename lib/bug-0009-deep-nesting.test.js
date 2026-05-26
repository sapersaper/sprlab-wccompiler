/**
 * BUG-0009: Deep nesting (6 levels) generates "Cannot read properties of undefined (reading 'childNodes')"
 *
 * Tests for:
 * 1. extractConstants with multi-line objects/arrays
 * 2. isStaticForExpr with constantNames parameter
 * 3. Dynamic components inside nested forBlocks (loop → conditional → loop → component)
 * 4. Full compilation of deep nesting without syntax errors
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { extractConstants } from './parser-extractors.js';
import { isStaticForExpr } from './codegen.js';
import { compile } from './compiler.js';

// ── Helper ──────────────────────────────────────────────────────────

function createTempDir() {
  const dir = join(tmpdir(), `wcc-bug0009-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

// ── extractConstants: multi-line objects/arrays ──────────────────────

describe('BUG-0009: extractConstants multi-line support', () => {
  it('detects a multi-line object constant', () => {
    const source = `
const data = {
  1: ['a', 'b'],
  2: ['c']
}
`;
    const result = extractConstants(source);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('data');
    expect(result[0].value).toContain('1:');
    expect(result[0].value).toContain("['a', 'b']");
  });

  it('detects a multi-line array constant', () => {
    const source = `
const items = [
  { id: 1, name: 'A' },
  { id: 2, name: 'B' }
]
`;
    const result = extractConstants(source);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('items');
    expect(result[0].value).toContain('{ id: 1');
  });

  it('does not detect signal/computed as constants', () => {
    const source = `
const count = signal(0)
const doubled = computed(() => count() * 2)
const data = {
  x: 1,
  y: 2
}
`;
    const result = extractConstants(source);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('data');
  });

  it('handles single-line object constants', () => {
    const source = `const config = { theme: 'dark' }`;
    const result = extractConstants(source);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('config');
    expect(result[0].value).toContain('theme');
  });

  it('handles deeply nested multi-line objects', () => {
    const source = `
const nested = {
  level1: {
    level2: {
      value: 'deep'
    }
  }
}
`;
    const result = extractConstants(source);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('nested');
    expect(result[0].value).toContain('deep');
  });

  it('does not pick up constants inside functions', () => {
    const source = `
function setup() {
  const internal = { x: 1 }
}
const external = { y: 2 }
`;
    const result = extractConstants(source);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('external');
  });
});

// ── isStaticForExpr with constantNames ──────────────────────────────

describe('BUG-0009: isStaticForExpr with constantNames', () => {
  it('returns false when expression references a constant', () => {
    const result = isStaticForExpr(
      'data[item.id]',
      'item', null,
      new Set(), new Set(), new Set(),
      ['data']
    );
    expect(result).toBe(false);
  });

  it('returns true when expression only references loop vars (no constants)', () => {
    const result = isStaticForExpr(
      'item.children',
      'item', null,
      new Set(), new Set(), new Set(),
      ['data']
    );
    expect(result).toBe(true);
  });

  it('returns false when expression references a constant with operators', () => {
    const result = isStaticForExpr(
      'lookup[item.id] || []',
      'item', null,
      new Set(), new Set(), new Set(),
      ['lookup']
    );
    expect(result).toBe(false);
  });
});

// ── Dynamic components inside nested structures ─────────────────────

describe('BUG-0009: dynamic components in nested loops', () => {
  it('compiles <component :is> inside a nested loop (loop → loop → component)', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'app.wcc'), `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'nested-dyn' })
const groups = signal([
  { id: 1, items: [{ tag: 'comp-a' }, { tag: 'comp-b' }] }
])
</script>
<template>
<div>
  <div each="group in groups()" :key="group.id">
    <div each="item in group.items">
      <component :is="item.tag"></component>
    </div>
  </div>
</div>
</template>`);

      const { code } = await compile(join(dir, 'app.wcc'));

      // Should be valid JS
      expect(() => new Function(code.replace(/^export default .+$/m, ''))).not.toThrow();

      // Should contain dynamic component creation
      expect(code).toContain('<!-- dynamic -->');
      expect(code).toContain('document.createElement(__tag)');
      expect(code).toContain('__dyn0_anchor');
      expect(code).toContain('item.tag');
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiles <component :is> inside loop → conditional → component', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'app.wcc'), `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'cond-dyn' })
const items = signal([
  { id: 1, show: true, type: 'widget-a' },
  { id: 2, show: false, type: 'widget-b' }
])
</script>
<template>
<div>
  <div each="item in items()" :key="item.id">
    <div if="item.show">
      <component :is="item.type"></component>
    </div>
  </div>
</div>
</template>`);

      const { code } = await compile(join(dir, 'app.wcc'));

      // Should be valid JS
      expect(() => new Function(code.replace(/^export default .+$/m, ''))).not.toThrow();

      // Should contain both if block and dynamic component
      expect(code).toContain('<!-- if -->');
      expect(code).toContain('<!-- dynamic -->');
      expect(code).toContain('document.createElement(__tag)');
      expect(code).toContain('item.type');
    } finally {
      cleanupDir(dir);
    }
  });

  it('transforms constant references inside nested loop sources', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'app.wcc'), `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'const-loop' })
const lookup = {
  1: ['a', 'b'],
  2: ['c']
}
const items = signal([{ id: 1 }, { id: 2 }])
</script>
<template>
<div>
  <div each="item in items()" :key="item.id">
    <div each="sub in lookup[item.id]">
      <span>{{ sub }}</span>
    </div>
  </div>
</div>
</template>`);

      const { code } = await compile(join(dir, 'app.wcc'));

      // Should be valid JS
      expect(() => new Function(code.replace(/^export default .+$/m, ''))).not.toThrow();

      // Constant should be transformed to this._const_lookup
      expect(code).toContain('this._const_lookup');
      // Should NOT have bare 'lookup' reference (except in the assignment)
      const lines = code.split('\n').filter(l => 
        l.includes('lookup') && !l.includes('_const_lookup') && !l.includes('// ')
      );
      expect(lines).toHaveLength(0);
    } finally {
      cleanupDir(dir);
    }
  });

  it('full deep nesting (6 levels) compiles to valid JS', async () => {
    const { code } = await compile('example/src/12-edge-cases/test-deep-nesting.wcc');

    // Must produce valid JavaScript
    expect(() => new Function(code.replace(/^export default .+$/m, ''))).not.toThrow();

    // Must not contain raw <component> elements
    expect(code).not.toContain('<component');

    // Must contain dynamic component handling
    expect(code).toContain('<!-- dynamic -->');
    expect(code).toContain('document.createElement(__tag)');

    // Must transform level2Data constant
    expect(code).toContain('this._const_level2Data');
  });
});
