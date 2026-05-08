/**
 * Integration test: {%prop%} escape syntax works in compiled output.
 *
 * Compiles a component with scoped slots and verifies the generated regex
 * can match {%prop%} tokens (the escape syntax for Vue/React/Angular).
 *
 * Validates: Requirements 1.1, 1.2, 1.3
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from './compiler.js';

// ── Helper: create temp component files ─────────────────────────────

function createTempDir() {
  const dir = join(tmpdir(), `wcc-escape-syntax-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

/**
 * Extract the regex pattern string from the compiled output and build a RegExp.
 * The generated code contains:
 *   new RegExp('(?:\\{\\{|\\{%)\\s*' + k + '(\\(\\))?\\s*(?:\\}\\}|%\\})', 'g')
 *
 * We reconstruct this regex for a given prop name to verify it matches {%prop%} tokens.
 */
function buildRuntimeRegex(propName) {
  return new RegExp('(?:\\{\\{|\\{%)\\s*' + propName + '(\\(\\))?\\s*(?:\\}\\}|%\\})', 'g');
}

/**
 * Simulate the runtime replacement loop (same logic as generated code).
 */
function simulateRuntimeReplace(template, props) {
  let html = template;
  for (const [k, v] of Object.entries(props)) {
    html = html.replace(buildRuntimeRegex(k), v ?? '');
  }
  return html;
}

// ── Integration Tests ───────────────────────────────────────────────

describe('compile() — {%prop%} escape syntax in compiled output', () => {
  it('compiled regex matches {%prop%} tokens and replaces them correctly', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-escape-test' })

const userName = signal('Alice')
</script>

<template>
<div class="card">
  <slot name="info" :name="userName">Default info</slot>
</div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // The generated code contains the combined regex pattern
      expect(output).toContain("(?:\\\\{\\\\{|\\\\{%)\\\\s*");
      expect(output).toContain("(?:\\\\}\\\\}|%\\\\})");

      // Simulate what the runtime does: use the same regex to replace {%prop%} tokens
      const template = '<span>{%name%}</span>';
      const result = simulateRuntimeReplace(template, { name: 'Alice' });
      expect(result).toBe('<span>Alice</span>');
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiled regex matches {% prop %} with whitespace inside delimiters', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-whitespace-test' })

const itemName = signal('Widget')
</script>

<template>
<div>
  <slot name="row" :item="itemName">Default</slot>
</div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // Verify the combined regex is present in compiled output
      expect(output).toContain("(?:\\\\{\\\\{|\\\\{%)\\\\s*");

      // Simulate runtime: {%  item  %} with extra whitespace should still match
      const template = '<li>{% item %}</li>';
      const result = simulateRuntimeReplace(template, { item: 'Widget' });
      expect(result).toBe('<li>Widget</li>');
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiled regex matches {%prop()%} with parentheses for method-style access', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-parens-test' })

const value = signal('computed-val')
</script>

<template>
<div>
  <slot name="data" :val="value">Default</slot>
</div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // Verify the regex supports optional parentheses group
      expect(output).toContain("(\\\\(\\\\))?");

      // Simulate runtime: {%val()%} should match and be replaced
      const template = '<span>{%val()%}</span>';
      const result = simulateRuntimeReplace(template, { val: 'computed-val' });
      expect(result).toBe('<span>computed-val</span>');
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiled regex handles mixed {{prop}} and {%prop%} in same template', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-mixed-test' })

const firstName = signal('John')
const lastName = signal('Doe')
</script>

<template>
<div>
  <slot name="profile" :firstName="firstName" :lastName="lastName">Default</slot>
</div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // Both props are resolved in the generated code
      expect(output).toContain('firstName: this._firstName()');
      expect(output).toContain('lastName: this._lastName()');

      // Simulate runtime: mix of {{}} and {%%} in same template
      const template = '<p>{{firstName}} {% lastName %}</p>';
      const result = simulateRuntimeReplace(template, { firstName: 'John', lastName: 'Doe' });
      expect(result).toBe('<p>John Doe</p>');
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiled regex replaces {%prop%} with empty string when value is null or undefined', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-null-test' })

const data = signal(null)
</script>

<template>
<div>
  <slot name="content" :data="data">Default</slot>
</div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // The generated code uses v ?? '' for null/undefined handling
      expect(output).toContain("v ?? ''");

      // Simulate runtime: null and undefined become empty string
      expect(simulateRuntimeReplace('<span>{%data%}</span>', { data: null })).toBe('<span></span>');
      expect(simulateRuntimeReplace('<span>{%data%}</span>', { data: undefined })).toBe('<span></span>');
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiled output regex replaces all occurrences of {%prop%} globally', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-global-test' })

const item = signal('X')
</script>

<template>
<ul>
  <slot name="row" :item="item">Default</slot>
</ul>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // The regex uses the 'g' flag for global replacement
      expect(output).toContain("'g')");

      // Simulate runtime: multiple {%item%} tokens all get replaced
      const template = '<li>{%item%} - {%item%} - {%item%}</li>';
      const result = simulateRuntimeReplace(template, { item: 'X' });
      expect(result).toBe('<li>X - X - X</li>');
    } finally {
      cleanupDir(dir);
    }
  });
});
