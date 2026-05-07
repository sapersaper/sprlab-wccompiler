/**
 * Integration tests for wcCompiler v2 — Scoped Slots (Light DOM).
 *
 * End-to-end compiler tests verifying that templates with slots
 * produce light DOM output with slot resolution code, and templates
 * without slots produce standard light DOM output.
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from './compiler.js';

// ── Helper: create temp component files ─────────────────────────────

function createTempDir() {
  const dir = join(tmpdir(), `wcc-slots-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

// ── Integration Tests ───────────────────────────────────────────────

describe('compile() — scoped slots integration', () => {
  it('compiles a component with named slots, default slot, fallback content, bindings, events, and CSS into light DOM with slot resolution', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-card' })

const title = signal('Card Title')

function handleClick() {
  title.set('Clicked!')
}
</script>

<template>
<div class="card">
  <slot name="header">Default Header</slot>
  <div class="body">
    <p>{{title()}}</p>
    <slot>Default Body</slot>
  </div>
  <button @click="handleClick">Action</button>
  <slot name="footer"></slot>
</div>
</template>

<style>
.card { display: flex; flex-direction: column; } .body { padding: 8px; }
</style>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // Light DOM pattern (always)
      expect(output).toContain("this.innerHTML = ''");
      expect(output).toContain('this.appendChild(__root)');

      // No Shadow DOM
      expect(output).not.toContain('attachShadow');
      expect(output).not.toContain('this.shadowRoot');

      // Scoped CSS in document.head
      expect(output).toContain('document.head.appendChild');
      expect(output).toContain('wcc-card .card');
      expect(output).toContain('wcc-card .body');

      // Slot resolution code
      expect(output).toContain('const __slotMap = {}');
      expect(output).toContain('const __defaultSlotNodes = []');
      expect(output).toContain("child.nodeName === 'TEMPLATE'");

      // <slot> elements replaced with <span data-slot="..."> in template
      expect(output).toContain('data-slot="header"');
      expect(output).toContain('data-slot="default"');
      expect(output).toContain('data-slot="footer"');
      expect(output).not.toMatch(/<slot[\s>]/);

      // Fallback content preserved in placeholders
      expect(output).toContain('Default Header');
      expect(output).toContain('Default Body');

      // Named slot injection
      expect(output).toContain("__slotMap['header']");
      expect(output).toContain("__slotMap['footer']");

      // Default slot injection
      expect(output).toContain('__defaultSlotNodes.length');

      // Bindings and events still work
      expect(output).toContain('__signal');
      expect(output).toContain('textContent');
      expect(output).toContain("addEventListener('click'");
      expect(output).toContain('_handleClick');

      // Class definition
      expect(output).toContain('class WccCard extends HTMLElement');
      expect(output).toContain("customElements.define('wcc-card', WccCard)");
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiles a component with scoped slot props into light DOM with reactive effects', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-list' })

const currentItem = signal('Item 1')
const currentIndex = signal(0)
</script>

<template>
<div class="list">
  <slot name="item" :data="currentItem" :index="currentIndex"></slot>
</div>
</template>

<style>
.list { display: flex; }
</style>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // Light DOM
      expect(output).toContain("this.innerHTML = ''");
      expect(output).toContain('this.appendChild(__root)');
      expect(output).not.toContain('attachShadow');

      // Scoped slot template storage
      expect(output).toContain("this.__slotTpl_item = __slotMap['item'].content");

      // Reactive effect for scoped slot
      expect(output).toContain('if (this.__slotTpl_item)');
      expect(output).toContain('__effect');
      expect(output).toContain('data: this._currentItem()');
      expect(output).toContain('index: this._currentIndex()');

      // Scoped CSS
      expect(output).toContain('document.head.appendChild');
      expect(output).toContain('wcc-list .list');
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiles a component without slots into standard light DOM output with scoped CSS', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-counter' })

const count = signal(0)

function increment() {
  count.set(count() + 1)
}
</script>

<template>
<div class="counter"><p>{{count()}}</p><button @click="increment">+</button></div>
</template>

<style>
.counter { display: flex; }
</style>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // Light DOM pattern
      expect(output).toContain("this.innerHTML = ''");
      expect(output).toContain('this.appendChild(__root)');

      // Scoped CSS in document.head
      expect(output).toContain('document.head.appendChild');
      expect(output).toContain('wcc-counter .counter');

      // No Shadow DOM
      expect(output).not.toContain('attachShadow');
      expect(output).not.toContain('this.shadowRoot');

      // No slot resolution code
      expect(output).not.toContain('__slotMap');
      expect(output).not.toContain('__defaultSlotNodes');
    } finally {
      cleanupDir(dir);
    }
  });
});
