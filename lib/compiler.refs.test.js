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
      writeFileSync(
        join(dir, 'comp.html'),
        '<canvas ref="canvas"></canvas><input ref="input" />'
      );
      writeFileSync(
        join(dir, 'comp.js'),
        `import { defineComponent, templateRef, onMount } from 'wcc'

export default defineComponent({
  tag: 'wcc-refs',
  template: './comp.html',
})

const canvas = templateRef('canvas')
const input = templateRef('input')

onMount(() => {
  const ctx = canvas.value.getContext('2d')
  input.value.focus()
})
`
      );

      const output = await compile(join(dir, 'comp.js'));

      // Constructor: ref DOM reference assignments
      expect(output).toContain('this._ref_canvas = __root.childNodes[0]');
      expect(output).toContain('this._ref_input = __root.childNodes[1]');

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
      writeFileSync(
        join(dir, 'comp.html'),
        '<div><span><canvas ref="canvas"></canvas></span></div>'
      );
      writeFileSync(
        join(dir, 'comp.js'),
        `import { defineComponent, templateRef } from 'wcc'

export default defineComponent({
  tag: 'wcc-nested',
  template: './comp.html',
})

const canvas = templateRef('canvas')
`
      );

      const output = await compile(join(dir, 'comp.js'));

      // Should have a multi-segment path
      expect(output).toContain('this._ref_canvas = __root.childNodes[0].childNodes[0].childNodes[0]');
      expect(output).toContain('get _canvas()');
    } finally {
      cleanupDir(dir);
    }
  });
});
