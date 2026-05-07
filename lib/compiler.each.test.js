import { describe, it, expect } from 'vitest';
import { compile } from './compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ── Helper: create temp component files ─────────────────────────────

function createTempDir() {
  const dir = join(tmpdir(), `wcc-each-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

// ── Integration Tests ───────────────────────────────────────────────

describe('compiler — each directive integration', () => {
  it('compiles a component with each directive and signal-based source', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-list' })

const items = signal([])
const count = signal(0)

function remove() {
  // remove logic
}
</script>

<template>
<ul><li each="item in items" :key="item.id"><span>{{item.name}}</span> <span>{{count()}}</span><button @click="remove">x</button></li></ul>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // Constructor: template element with innerHTML
      expect(output).toContain("this.__for0_tpl = document.createElement('template')");
      expect(output).toContain('this.__for0_tpl.innerHTML');

      // Constructor: anchor reference
      expect(output).toContain('this.__for0_anchor');

      // Constructor: nodes array
      expect(output).toContain('this.__for0_nodes = []');

      // connectedCallback: reactive effect with transformed source
      expect(output).toContain('this._items()');

      // connectedCallback: node removal loop (keyed reconciliation)
      expect(output).toContain('for (const n of __oldMap.values()) n.remove()');

      // connectedCallback: numeric range handling
      expect(output).toContain("typeof __source === 'number'");

      // Static binding: item.name (item-only reference, no __effect wrapper)
      expect(output).toContain("item.name ?? ''");

      // Reactive binding: count (component signal, wrapped in __effect)
      expect(output).toContain('this._count()');

      // Event binding: bound to component instance
      expect(output).toContain("this._remove.bind(this)");

      // Template should not contain each or :key attributes
      expect(output).not.toMatch(/each="/);
      expect(output).not.toMatch(/:key="/);
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiles a component with numeric range source', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent } from 'wcc'

export default defineComponent({ tag: 'wcc-range' })
</script>

<template>
<div><span each="n in 5">text</span></div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // Should contain the for block setup
      expect(output).toContain('__for0_tpl');
      // The source should be the literal 5
      expect(output).toContain('const __source = 5');
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiles a component with each and show bindings', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-show-list' })

const items = signal([])
</script>

<template>
<ul><li each="item in items"><span show="item.visible">text</span></li></ul>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // Should have a for block
      expect(output).toContain('__for0_tpl');
      expect(output).toContain('this._items()');
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiles a component with destructured each expression', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-indexed' })

const items = signal([])
</script>

<template>
<ul><li each="(item, index) in items">{{index}}</li></ul>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // Should use both item and index in the forEach
      expect(output).toContain('__iter.forEach((item, index)');
    } finally {
      cleanupDir(dir);
    }
  });

  it('rejects each + if on the same element', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-conflict' })

const items = signal([])
const visible = signal(true)
</script>

<template>
<div><li each="item in items" if="visible">text</li></div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      try {
        await compile(join(dir, 'component.wcc'));
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err.code).toBe('CONFLICTING_DIRECTIVES');
      }
    } finally {
      cleanupDir(dir);
    }
  });
});
