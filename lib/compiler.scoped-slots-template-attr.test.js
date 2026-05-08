/**
 * Integration test: slot-template-<name> attribute works.
 *
 * Compiles a WCC component with scoped slots and verifies the generated
 * `connectedCallback` code includes the `slot-template-<name>` attribute
 * detection logic for React/Angular string attribute pattern.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from './compiler.js';

// ── Helper: create temp component files ─────────────────────────────

function createTempDir() {
  const dir = join(tmpdir(), `wcc-slot-template-attr-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

// ── Integration Tests ───────────────────────────────────────────────

describe('compile() — slot-template-<name> attribute detection', () => {
  it('generated code detects slot-template-<name> attributes on child elements (Req 3.1)', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-user-card' })

const userName = signal('Alice')
</script>

<template>
<div class="card">
  <slot name="info" :name="userName">Default info</slot>
</div>
</template>

<style>
.card { padding: 16px; }
</style>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // The generated code should check for slot-template- prefix on attributes
      expect(output).toContain("attr.name.startsWith('slot-template-')");

      // The generated code should extract the slot name from the attribute
      expect(output).toContain("attr.name.slice('slot-template-'.length)");

      // The generated code should read the attribute value as template content
      expect(output).toContain('attr.value');
    } finally {
      cleanupDir(dir);
    }
  });

  it('generated code stores attribute value for reactive interpolation (Req 3.2)', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-data-list' })

const currentItem = signal('Item 1')
</script>

<template>
<ul>
  <slot name="row" :item="currentItem"></slot>
</ul>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // The attribute value is stored as template content in __slotMap
      expect(output).toContain("content: attr.value");
      expect(output).toContain("propsExpr: ''");

      // The reactive effect still runs for slot-template-based templates
      expect(output).toContain('__effect');
      expect(output).toContain('if (this.__slotTpl_row)');

      // The combined regex supports {%prop%} tokens used in slot-template attributes
      expect(output).toContain("(?:\\\\{\\\\{|\\\\{%)\\\\s*");
      expect(output).toContain("(?:\\\\}\\\\}|%\\\\})");
    } finally {
      cleanupDir(dir);
    }
  });

  it('generated code supports {%prop%} tokens in slot-template attribute values (Req 3.3)', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-profile' })

const name = signal('Bob')
const age = signal(25)
</script>

<template>
<div>
  <slot name="header" :name="name" :age="age">Default</slot>
</div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // The combined regex matches {%prop%} syntax (used in slot-template attributes)
      // Pattern: (?:\{\{|\{%)\s*propName(\(\))?\s*(?:\}\}|%\})
      expect(output).toContain("(?:\\\\{\\\\{|\\\\{%)\\\\s*");
      expect(output).toContain("(?:\\\\}\\\\}|%\\\\})");

      // Props are resolved for the reactive replacement
      expect(output).toContain('name: this._name()');
      expect(output).toContain('age: this._age()');

      // The replacement loop handles both {{prop}} and {%prop%} in a single pass
      expect(output).toContain('Object.entries(__props)');
      expect(output).toContain("v ?? ''");
    } finally {
      cleanupDir(dir);
    }
  });

  it('generated code supports {{prop}} tokens in slot-template attribute values (Req 3.4)', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-widget' })

const title = signal('Hello')
</script>

<template>
<section>
  <slot name="content" :title="title">Fallback</slot>
</section>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // The combined regex also matches {{prop}} syntax in slot-template attributes
      // The (?:\{\{|\{%) alternation handles both opening delimiters
      expect(output).toContain("(?:\\\\{\\\\{|\\\\{%)\\\\s*");
      // The (?:\}\}|%\}) alternation handles both closing delimiters
      expect(output).toContain("(?:\\\\}\\\\}|%\\\\})");

      // Global flag ensures all occurrences are replaced
      expect(output).toContain("'g')");
    } finally {
      cleanupDir(dir);
    }
  });

  it('element-based slot takes priority over slot-template attribute (Req 3.5)', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-priority-test' })

const value = signal('test')
</script>

<template>
<div>
  <slot name="main" :value="value">Default</slot>
</div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // The priority check: only store slot-template if not already in __slotMap
      expect(output).toContain('if (!__slotMap[slotName])');

      // The slot="name" check comes before slot-template- check in the generated code
      const slotAttrCheck = output.indexOf("child.getAttribute('slot')");
      const slotTemplateCheck = output.indexOf("attr.name.startsWith('slot-template-')");

      expect(slotAttrCheck).toBeGreaterThan(-1);
      expect(slotTemplateCheck).toBeGreaterThan(-1);
      expect(slotAttrCheck).toBeLessThan(slotTemplateCheck);
    } finally {
      cleanupDir(dir);
    }
  });

  it('generated code removes slot-template attribute after reading (cleanup)', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-cleanup-test' })

const msg = signal('hi')
</script>

<template>
<div>
  <slot name="footer" :msg="msg">Default footer</slot>
</div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // The generated code removes the attribute after reading its value
      expect(output).toContain('child.removeAttribute(attr.name)');

      // Removal happens after storing the value
      const storeIndex = output.indexOf("content: attr.value");
      const removeIndex = output.indexOf("child.removeAttribute(attr.name)");

      expect(storeIndex).toBeGreaterThan(-1);
      expect(removeIndex).toBeGreaterThan(-1);
      expect(storeIndex).toBeLessThan(removeIndex);
    } finally {
      cleanupDir(dir);
    }
  });
});
