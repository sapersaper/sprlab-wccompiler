/**
 * End-to-end compiler integration tests for nested directives inside `each` loops.
 *
 * These tests verify the full compiler pipeline (parse → tree-walk → codegen)
 * correctly handles:
 * - Nested `each` inside `each` (6.1)
 * - `if`/`else` inside `each` (6.2)
 * - `else-if` inside `each` (6.3)
 */

import { describe, it, expect } from 'vitest';
import { compile } from './compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ── Helper: create temp component files ─────────────────────────────

function createTempDir() {
  const dir = join(tmpdir(), `wcc-nested-dir-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

// ── 6.1: Nested each compiles without error and generates correct nested loop ──

describe('6.1 compiler — nested each inside each compiles correctly', () => {
  it('compiles component with nested each and generates nested forEach structure', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-nested-each' })

const categories = signal([])
</script>

<template>
<ul><li each="cat in categories"><span each="item in cat.items">{{item.name}}</span></li></ul>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const output = await compile(join(dir, 'component.wcc'));

      // Should compile without error and produce a class definition
      expect(output).toContain('class WccNestedEach extends HTMLElement');

      // Outer loop: template, anchor, nodes array
      expect(output).toContain("this.__for0_tpl = document.createElement('template')");
      expect(output).toContain('this.__for0_anchor');
      expect(output).toContain('this.__for0_nodes = []');

      // Outer loop: reactive effect with transformed source (categories signal)
      expect(output).toContain('this._categories()');

      // Inner loop: template, anchor for nested forEach
      expect(output).toContain("const __for0_tpl = document.createElement('template')");
      expect(output).toContain('__for0_anchor');

      // Inner loop: forEach with inner item variable
      expect(output).toContain('__for0_iter.forEach((item');

      // Inner loop: source expression references outer loop variable
      expect(output).toContain('cat.items');

      // Inner loop: binding uses inner item variable
      expect(output).toContain("item.name ?? ''");

      // Outer loop variable (cat) should NOT be transformed to a signal call
      expect(output).not.toMatch(/this\._cat\(\)/);

      // Inner loop variable (item) should NOT be transformed to a signal call
      expect(output).not.toMatch(/this\._item\(\)/);

      // Template should not contain each attributes in the output
      expect(output).not.toMatch(/each="cat in categories"/);
      expect(output).not.toMatch(/each="item in cat.items"/);
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiles nested each with outer variable access in inner scope', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-scope-test' })

const categories = signal([])
</script>

<template>
<div><div each="cat in categories"><p each="item in cat.items">{{cat.name}}: {{item.name}}</p></div></div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const output = await compile(join(dir, 'component.wcc'));

      // Should compile without error
      expect(output).toContain('class WccScopeTest extends HTMLElement');

      // Inner scope should access outer variable (cat.name)
      expect(output).toContain("cat.name ?? ''");

      // Inner scope should access inner variable (item.name)
      expect(output).toContain("item.name ?? ''");

      // Neither loop variable should be treated as a signal
      expect(output).not.toMatch(/this\._cat\(\)/);
      expect(output).not.toMatch(/this\._item\(\)/);
    } finally {
      cleanupDir(dir);
    }
  });
});

// ── 6.2: If/else inside each compiles correctly ──

describe('6.2 compiler — if/else inside each compiles correctly', () => {
  it('compiles component with if/else inside each and generates per-item conditional', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-if-each' })

const items = signal([])
</script>

<template>
<ul><li each="item in items"><span if="item.active">Active</span><span else>Inactive</span></li></ul>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const output = await compile(join(dir, 'component.wcc'));

      // Should compile without error and produce a class definition
      expect(output).toContain('class WccIfEach extends HTMLElement');

      // Outer loop structure
      expect(output).toContain("this.__for0_tpl = document.createElement('template')");
      expect(output).toContain('this.__for0_anchor');
      expect(output).toContain('this._items()');

      // Per-item conditional: evaluates item.active
      expect(output).toContain('if (item.active)');

      // Per-item conditional: branch templates
      expect(output).toContain('__if0_t0');
      expect(output).toContain('__if0_t1');

      // Per-item conditional: anchor for branch insertion
      expect(output).toContain('__if0_anchor');

      // Per-item conditional: inserts only matching branch
      expect(output).toContain('__if0_anchor.parentNode.insertBefore');

      // item.active should NOT be transformed to a signal call (it's a loop variable)
      expect(output).not.toMatch(/this\._item\(\)/);

      // Template should not contain if/else attributes in the output
      expect(output).not.toMatch(/if="item.active"/);
      expect(output).not.toMatch(/\belse\b.*="/);
    } finally {
      cleanupDir(dir);
    }
  });

  it('generates only matching branch — not both branches simultaneously', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-branch-test' })

const items = signal([])
</script>

<template>
<ul><li each="item in items"><span if="item.visible">Shown</span><span else>Hidden</span></li></ul>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const output = await compile(join(dir, 'component.wcc'));

      // Should have conditional branch selection (not both rendered)
      expect(output).toContain('if (item.visible)');

      // The for block template should contain a comment anchor (not both spans)
      // The if/else elements are replaced by <!-- if --> comment in the processed template
      expect(output).toContain('<!-- if -->');

      // Branch templates are separate — each branch has its own template
      expect(output).toContain('__if0_t0');
      expect(output).toContain('__if0_t1');
    } finally {
      cleanupDir(dir);
    }
  });
});

// ── 6.3: Else-if inside each evaluates full chain per item ──

describe('6.3 compiler — else-if inside each evaluates full chain per item', () => {
  it('compiles component with if/else-if/else inside each and generates full chain', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-elseif-each' })

const items = signal([])
</script>

<template>
<ul><li each="item in items"><span if="item.status === 'a'">A</span><span else-if="item.status === 'b'">B</span><span else>C</span></li></ul>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const output = await compile(join(dir, 'component.wcc'));

      // Should compile without error and produce a class definition
      expect(output).toContain('class WccElseifEach extends HTMLElement');

      // Outer loop structure
      expect(output).toContain("this.__for0_tpl = document.createElement('template')");
      expect(output).toContain('this.__for0_anchor');
      expect(output).toContain('this._items()');

      // Full if/else-if/else chain evaluation per item
      expect(output).toContain("if (item.status === 'a')");
      expect(output).toContain("else if (item.status === 'b')");

      // Three branch templates (one for each branch)
      expect(output).toContain('__if0_t0');
      expect(output).toContain('__if0_t1');
      expect(output).toContain('__if0_t2');

      // Anchor for conditional insertion
      expect(output).toContain('__if0_anchor');

      // Branch insertion
      expect(output).toContain('__if0_anchor.parentNode.insertBefore');

      // item.status should NOT be transformed to a signal call
      expect(output).not.toMatch(/this\._item\(\)/);
    } finally {
      cleanupDir(dir);
    }
  });

  it('evaluates else branch correctly when no conditions match', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-else-chain' })

const items = signal([])
</script>

<template>
<div><div each="item in items"><p if="item.type === 'x'">X</p><p else-if="item.type === 'y'">Y</p><p else>Other</p></div></div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const output = await compile(join(dir, 'component.wcc'));

      // Should compile without error
      expect(output).toContain('class WccElseChain extends HTMLElement');

      // Full chain with else fallback
      expect(output).toContain("if (item.type === 'x')");
      expect(output).toContain("else if (item.type === 'y')");

      // Else branch should set branch index to 2
      expect(output).toContain('__if0_branch = 2');

      // All three branch templates exist
      expect(output).toContain('__if0_t0');
      expect(output).toContain('__if0_t1');
      expect(output).toContain('__if0_t2');
    } finally {
      cleanupDir(dir);
    }
  });
});
