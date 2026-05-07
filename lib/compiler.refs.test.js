/**
 * Integration test for template-refs end-to-end compilation.
 *
 * Creates a temp component with templateRef('canvas') and templateRef('input'),
 * template with ref="canvas" and ref="input", and an onMount callback
 * that accesses canvas.value and input.value.
 *
 * Verifies the compiled output contains all expected ref-related code.
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from './compiler.js';

// ── Helpers ─────────────────────────────────────────────────────────

function createTempDir() {
  const dir = join(tmpdir(), `wcc-refs-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

// ── Integration Test ────────────────────────────────────────────────

describe('compile() — template-refs integration', () => {
  it('compiles a component with templateRef, ref attributes, and onMount accessing refs', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, templateRef, onMount } from 'wcc'

export default defineComponent({ tag: 'wcc-refs' })

const canvas = templateRef('canvas')
const input = templateRef('input')

onMount(() => {
  const ctx = canvas.value.getContext('2d')
  input.value.focus()
})
</script>

<template>
<canvas ref="canvas"></canvas><input ref="input" />
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // Constructor: ref DOM reference assignments
      // Note: SFC template has a leading newline text node, so canvas is childNodes[1]
      expect(output).toContain('this._ref_canvas = __root.childNodes[1]');
      expect(output).toContain('this._ref_input = __root.childNodes[2]');

      // Getter methods for both refs
      expect(output).toContain('get _canvas() { return { value: this._ref_canvas }; }');
      expect(output).toContain('get _input() { return { value: this._ref_input }; }');

      // Transformed onMount body: canvas.value → this._canvas.value
      expect(output).toContain('this._canvas.value.getContext');
      expect(output).toContain('this._input.value.focus');

      // Processed template has no ref attributes
      expect(output).not.toMatch(/ref="/);

      // Ref assignments appear before appendChild
      const refAssignIdx = output.indexOf('this._ref_canvas');
      const appendIdx = output.indexOf('this.appendChild(__root)');
      expect(refAssignIdx).toBeLessThan(appendIdx);
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiles a component with ref on nested element', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, templateRef } from 'wcc'

export default defineComponent({ tag: 'wcc-nested' })

const canvas = templateRef('canvas')
</script>

<template>
<div><span><canvas ref="canvas"></canvas></span></div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // Should have a multi-segment path
      // Note: SFC template has a leading newline text node, so the path starts at childNodes[1]
      expect(output).toContain('this._ref_canvas = __root.childNodes[1].childNodes[0].childNodes[0]');
      expect(output).toContain('get _canvas()');
    } finally {
      cleanupDir(dir);
    }
  });
});
