/**
 * Integration test: WCC-to-WCC scoped slots still work.
 *
 * Compiles a component with scoped slots using {{prop}} syntax and verifies
 * the generated code contains the combined regex that can match {{prop}} tokens
 * and replace them correctly (backward compatibility).
 *
 * Validates: Requirements 7.4, 1.7
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from './compiler.js';

// ── Helper: create temp component files ─────────────────────────────

function createTempDir() {
  const dir = join(tmpdir(), `wcc-scoped-slots-wcc-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

// ── Integration Tests ───────────────────────────────────────────────

describe('compile() — WCC-to-WCC scoped slots backward compatibility', () => {
  it('compiles a component with scoped slots and generates combined regex supporting {{prop}} syntax', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-user-card' })

const userName = signal('Alice')
const userAge = signal(30)
</script>

<template>
<div class="card">
  <slot name="info" :name="userName" :age="userAge">Default info</slot>
</div>
</template>

<style>
.card { padding: 16px; }
</style>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // Light DOM pattern (always)
      expect(output).toContain("this.innerHTML = ''");
      expect(output).toContain('this.appendChild(__root)');
      expect(output).not.toContain('attachShadow');

      // Scoped slot template storage
      expect(output).toContain("this.__slotTpl_info = __slotMap['info'].content");

      // Reactive effect for scoped slot
      expect(output).toContain('if (this.__slotTpl_info)');
      expect(output).toContain('__effect');

      // Props are resolved from signals
      expect(output).toContain('name: this._userName()');
      expect(output).toContain('age: this._userAge()');

      // The generated regex uses the combined pattern that supports BOTH {{prop}} and {%prop%}
      // This ensures backward compatibility: {{prop}} still works in WCC-to-WCC usage
      expect(output).toContain("(?:\\\\{\\\\{|\\\\{%)\\\\s*");
      expect(output).toContain("(?:\\\\}\\\\}|%\\\\})");

      // The replacement uses nullish coalescing for null/undefined → empty string
      expect(output).toContain("v ?? ''");

      // The regex has the global flag for replacing all occurrences
      expect(output).toContain("'g')");

      // innerHTML assignment to render the replaced template
      expect(output).toContain('innerHTML = __html');
    } finally {
      cleanupDir(dir);
    }
  });

  it('scoped slot with single prop generates correct regex replacement loop', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-item-list' })

const currentItem = signal('Item 1')
</script>

<template>
<ul>
  <slot name="row" :item="currentItem"></slot>
</ul>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // Scoped slot template storage
      expect(output).toContain("this.__slotTpl_row = __slotMap['row'].content");

      // Reactive effect with prop resolution
      expect(output).toContain('item: this._currentItem()');

      // The replacement loop iterates Object.entries(__props)
      expect(output).toContain('Object.entries(__props)');

      // Combined regex pattern present — ensures {{item}} tokens are matched
      expect(output).toContain("(?:\\\\{\\\\{|\\\\{%)\\\\s*");
      expect(output).toContain("(?:\\\\}\\\\}|%\\\\})");
    } finally {
      cleanupDir(dir);
    }
  });

  it('scoped slot with multiple props generates replacement for each prop', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-data-table' })

const rowData = signal('Row 1')
const rowIndex = signal(0)
const rowSelected = signal(false)
</script>

<template>
<table>
  <slot name="cell" :data="rowData" :index="rowIndex" :selected="rowSelected"></slot>
</table>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // All three props are resolved
      expect(output).toContain('data: this._rowData()');
      expect(output).toContain('index: this._rowIndex()');
      expect(output).toContain('selected: this._rowSelected()');

      // Template storage
      expect(output).toContain("this.__slotTpl_cell = __slotMap['cell'].content");

      // Combined regex ensures {{data}}, {{index}}, {{selected}} all get replaced
      // The for loop with Object.entries handles each prop in sequence
      expect(output).toContain('for (const [k, v] of Object.entries(__props))');
      expect(output).toContain("(?:\\\\{\\\\{|\\\\{%)\\\\s*");
    } finally {
      cleanupDir(dir);
    }
  });
});
