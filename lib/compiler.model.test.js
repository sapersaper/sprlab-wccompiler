/**
 * Integration tests for wcCompiler v2 — model directive end-to-end.
 *
 * Tests the full compilation pipeline: parse → tree-walk → codegen
 * with model directives on various form element types.
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from './compiler.js';

// ── Helper: create temp component files ─────────────────────────────

function createTempDir() {
  const dir = join(tmpdir(), `wcc-model-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

// ── End-to-end model compilation ────────────────────────────────────

describe('compile() — model directive end-to-end', () => {
  it('compiles a component with multiple model directives (text, checkbox, radio, number, select, textarea)', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-form' })

const name = signal('')
const agreed = signal(false)
const color = signal('red')
const age = signal(0)
const category = signal('a')
const bio = signal('')
</script>

<template>
<input model="name">
<input type="checkbox" model="agreed">
<input type="radio" model="color" value="red">
<input type="radio" model="color" value="blue">
<input type="number" model="age">
<select model="category"><option value="a">A</option><option value="b">B</option></select>
<textarea model="bio"></textarea>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const output = await compile(join(dir, 'component.wcc'));

      // Class definition
      expect(output).toContain('class WccForm extends HTMLElement');

      // DOM element references in constructor
      expect(output).toContain('this.__model0 = __root.');
      expect(output).toContain('this.__model1 = __root.');
      expect(output).toContain('this.__model2 = __root.');
      expect(output).toContain('this.__model3 = __root.');
      expect(output).toContain('this.__model4 = __root.');
      expect(output).toContain('this.__model5 = __root.');
      expect(output).toContain('this.__model6 = __root.');

      // Signal → DOM effects
      // Text input: value with nullish coalesce
      expect(output).toContain("this.__model0.value = this._name() ?? ''");
      // Checkbox: !! coercion
      expect(output).toContain('this.__model1.checked = !!this._agreed()');
      // Radio red: compare to 'red'
      expect(output).toContain("this.__model2.checked = (this._color() === 'red')");
      // Radio blue: compare to 'blue'
      expect(output).toContain("this.__model3.checked = (this._color() === 'blue')");
      // Number: value with nullish coalesce
      expect(output).toContain("this.__model4.value = this._age() ?? ''");
      // Select: value with nullish coalesce
      expect(output).toContain("this.__model5.value = this._category() ?? ''");
      // Textarea: value with nullish coalesce
      expect(output).toContain("this.__model6.value = this._bio() ?? ''");

      // DOM → Signal event listeners
      // Text input: input event, e.target.value
      expect(output).toContain("this.__model0.addEventListener('input'");
      expect(output).toContain('this._name(e.target.value)');
      // Checkbox: change event, e.target.checked
      expect(output).toContain("this.__model1.addEventListener('change'");
      expect(output).toContain('this._agreed(e.target.checked)');
      // Radio: change event, e.target.value
      expect(output).toContain("this.__model2.addEventListener('change'");
      expect(output).toContain("this.__model3.addEventListener('change'");
      // Number: input event, Number(e.target.value)
      expect(output).toContain("this.__model4.addEventListener('input'");
      expect(output).toContain('this._age(Number(e.target.value))');
      // Select: change event, e.target.value
      expect(output).toContain("this.__model5.addEventListener('change'");
      expect(output).toContain('this._category(e.target.value)');
      // Textarea: input event, e.target.value
      expect(output).toContain("this.__model6.addEventListener('input'");
      expect(output).toContain('this._bio(e.target.value)');

      // model attributes should NOT appear in the template
      expect(output).not.toMatch(/model="/);
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiles model alongside interpolation and event bindings', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-mixed' })

const greeting = signal('Hello')
const name = signal('')

function submit() {
  console.log(name())
}
</script>

<template>
<div>{{greeting()}}</div>
<input model="name">
<button @click="submit">Submit</button>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const output = await compile(join(dir, 'component.wcc'));

      // Text binding effect
      expect(output).toContain('textContent');
      // Model effect
      expect(output).toContain("this.__model0.value = this._name() ?? ''");
      // Model event listener
      expect(output).toContain("this.__model0.addEventListener('input'");
      // Click event listener
      expect(output).toContain("addEventListener('click'");
      expect(output).toContain('_submit');
    } finally {
      cleanupDir(dir);
    }
  });
});
