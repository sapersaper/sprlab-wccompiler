/**
 * Integration test for wcCompiler v2 — attr-bindings.
 *
 * Creates temp components with multiple attribute bindings: :href, :disabled,
 * :class (object and string), :style (object and string).
 * Includes {{interpolation}} and @event bindings alongside attribute bindings.
 * Compiles and verifies output contains correct reactive effects per binding kind.
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from './compiler.js';

// ── Helper: create temp component files ─────────────────────────────

function createTempDir() {
  const dir = join(tmpdir(), `wcc-attr-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

// ── Integration Tests ───────────────────────────────────────────────

describe('compile() — attr-bindings integration', () => {
  it('compiles a component with multiple attr binding kinds, interpolation, and events', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-attr-test' })

const url = signal('https://example.com')
const linkText = signal('Click here')
const isLoading = signal(false)
const isActive = signal(true)
const isBold = signal(false)
const className = signal('highlight')
const textColor = signal('red')
const size = signal('16px')
const styleStr = signal('color: blue')

function submit() {
  isLoading.set(true)
}
</script>

<template>
<div>
  <a :href="url">{{linkText()}}</a>
  <button :disabled="isLoading" @click="submit">Submit</button>
  <div :class="{ active: isActive, bold: isBold }">Styled</div>
  <span :class="className">Dynamic class</span>
  <div :style="{ color: textColor, fontSize: size }">Colored</div>
  <p :style="styleStr">Inline style</p>
</div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // 1. Class definition
      expect(output).toContain('class WccAttrTest extends HTMLElement');

      // 2. DOM element references for attr bindings in constructor
      expect(output).toContain('this.__attr0 =');
      expect(output).toContain('this.__attr1 =');
      expect(output).toContain('this.__attr2 =');
      expect(output).toContain('this.__attr3 =');
      expect(output).toContain('this.__attr4 =');
      expect(output).toContain('this.__attr5 =');

      // 3. DOM refs assigned before appendChild
      const constructorSection = output.slice(
        output.indexOf('constructor()'),
        output.indexOf('connectedCallback()')
      );
      const appendPos = constructorSection.indexOf('this.appendChild(__root)');
      expect(appendPos).toBeGreaterThan(-1);
      for (let i = 0; i <= 5; i++) {
        const refPos = constructorSection.indexOf(`this.__attr${i} =`);
        expect(refPos).toBeGreaterThan(-1);
        expect(refPos).toBeLessThan(appendPos);
      }

      // 4. Regular attr effect: :href="url" → setAttribute/removeAttribute
      expect(output).toContain("this.__attr0.setAttribute('href'");
      expect(output).toContain("this.__attr0.removeAttribute('href')");

      // 5. Boolean attr effect: :disabled="isLoading" → property assignment with !!
      expect(output).toContain('this.__attr1.disabled = !!(');

      // 6. Class binding (object): :class="{ active: isActive, bold: isBold }"
      expect(output).toContain('this.__attr2.classList.add(__k)');
      expect(output).toContain('this.__attr2.classList.remove(__k)');

      // 7. Class binding (string): :class="className"
      expect(output).toContain('this.__attr3.className =');

      // 8. Style binding (object): :style="{ color: textColor, fontSize: size }"
      expect(output).toContain('this.__attr4.style[__k] = __val');

      // 9. Style binding (string): :style="styleStr"
      expect(output).toContain('this.__attr5.style.cssText =');

      // 10. Signal transformation in expressions
      expect(output).toContain('this._url()');
      expect(output).toContain('this._isLoading()');
      expect(output).toContain('this._isActive()');
      expect(output).toContain('this._className()');
      expect(output).toContain('this._textColor()');
      expect(output).toContain('this._styleStr()');

      // 11. Text binding for {{linkText()}}
      expect(output).toContain('this._linkText()');

      // 12. Event listener for @click="submit"
      expect(output).toContain("addEventListener('click'");
      expect(output).toContain('_submit');

      // 13. Binding attributes removed from processed template
      expect(output).not.toMatch(/:href="/);
      expect(output).not.toMatch(/:disabled="/);
      expect(output).not.toMatch(/:class="/);
      expect(output).not.toMatch(/:style="/);

      // 14. customElements.define
      expect(output).toContain("customElements.define('wcc-attr-test', WccAttrTest)");
    } finally {
      cleanupDir(dir);
    }
  });

  it('bind:attr form produces same output patterns as :attr form', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-bind-form' })

const url = signal('https://example.com')
const isOff = signal(false)
</script>

<template>
<a bind:href="url" bind:disabled="isOff">link</a>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // Regular attr: setAttribute/removeAttribute
      expect(output).toContain("setAttribute('href'");
      expect(output).toContain("removeAttribute('href')");

      // Boolean attr: property assignment
      expect(output).toContain('.disabled = !!(');

      // Signal transformation
      expect(output).toContain('this._url()');
      expect(output).toContain('this._isOff()');

      // bind: attributes removed
      expect(output).not.toMatch(/bind:href/);
      expect(output).not.toMatch(/bind:disabled/);
    } finally {
      cleanupDir(dir);
    }
  });
});
