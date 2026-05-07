/**
 * Integration test for wcCompiler v2 — show directive.
 *
 * Creates temp components with show directives using signal-based expressions,
 * includes {{interpolation}} and @event bindings alongside show directives,
 * compiles them, and verifies the output contains all expected runtime constructs.
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from './compiler.js';

// ── Helper: create temp component files ─────────────────────────────

function createTempDir() {
  const dir = join(tmpdir(), `wcc-show-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

// ── Integration Tests ───────────────────────────────────────────────

describe('compile() — show directive integration', () => {
  it('compiles a component with multiple show directives, interpolation, and events', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-show-test' })

const isVisible = signal(true)
const count = signal(5)
const message = signal('Hello')

function toggle() {
  isVisible.set(!isVisible())
}
</script>

<template>
<div>
  <p show="isVisible">{{message()}}</p>
  <span show="count > 0">Has items</span>
  <button @click="toggle">Toggle</button>
</div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // 1. Class definition
      expect(output).toContain('class WccShowTest extends HTMLElement');

      // 2. DOM element references for show bindings in constructor
      expect(output).toContain('this.__show0 = __root.');
      expect(output).toContain('this.__show1 = __root.');

      // 3. DOM refs assigned before appendChild
      const constructorSection = output.slice(
        output.indexOf('constructor()'),
        output.indexOf('connectedCallback()')
      );
      const show0Pos = constructorSection.indexOf('this.__show0 = __root');
      const show1Pos = constructorSection.indexOf('this.__show1 = __root');
      const appendPos = constructorSection.indexOf('this.appendChild(__root)');
      expect(show0Pos).toBeGreaterThan(-1);
      expect(show1Pos).toBeGreaterThan(-1);
      expect(appendPos).toBeGreaterThan(-1);
      expect(show0Pos).toBeLessThan(appendPos);
      expect(show1Pos).toBeLessThan(appendPos);

      // 4. Reactive effects with transformed expressions
      expect(output).toContain('this.__show0.style.display = (this._isVisible()) ?');
      expect(output).toContain('this.__show1.style.display = (this._count() > 0) ?');

      // 5. Display toggle pattern
      expect(output).toContain("? '' : 'none'");

      // 6. Signal initialization
      expect(output).toContain('this._isVisible = __signal(true)');
      expect(output).toContain('this._count = __signal(5)');
      expect(output).toContain("this._message = __signal('Hello')");

      // 7. Text binding for {{message()}}
      expect(output).toContain('this._message()');

      // 8. Event listener for @click="toggle"
      expect(output).toContain("addEventListener('click'");
      expect(output).toContain('_toggle');

      // 9. Show attributes removed from processed template
      expect(output).not.toMatch(/show="/);

      // 10. customElements.define
      expect(output).toContain("customElements.define('wcc-show-test', WccShowTest)");
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiles a component with show using complex expression', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-complex' })

const count = signal(0)
</script>

<template>
<div show="count > 0">Has items</div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // Complex expression should be transformed
      expect(output).toContain('this._count() > 0');
      expect(output).toContain('style.display');
    } finally {
      cleanupDir(dir);
    }
  });
});
