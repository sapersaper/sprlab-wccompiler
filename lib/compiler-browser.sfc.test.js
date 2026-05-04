/**
 * Unit tests for compileFromSFC (browser compiler).
 *
 * Validates: Requirements 7.1, 7.2, 7.3
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { compileFromSFC } from './compiler-browser.js';

// ── Test 1: SFC compilation in browser mode produces valid JS output ──

describe('compileFromSFC — valid SFC compilation', () => {
  it('compiles a valid SFC string into JS with class, signals, and customElements.define', async () => {
    const sfcSource = `<script>
import { defineComponent, signal, computed } from 'wcc'

export default defineComponent({ tag: 'wcc-browser' })

const count = signal(0)
const doubled = computed(() => count() * 2)

function increment() {
  count.set(count() + 1)
}
</script>

<template>
  <div class="browser">
    <span>{{count}}</span>
    <span>{{doubled}}</span>
    <button @click="increment">+1</button>
  </div>
</template>

<style>
.browser { display: flex; gap: 8px; }
</style>`;

    const output = await compileFromSFC(sfcSource);

    // Contains class definition with correct name
    expect(output).toContain('class WccBrowser extends HTMLElement');

    // Contains customElements.define
    expect(output).toContain("customElements.define('wcc-browser', WccBrowser)");

    // Contains signal initialization
    expect(output).toContain('__signal(0)');

    // Contains reactive runtime helpers
    expect(output).toContain('__signal');
    expect(output).toContain('__computed');
    expect(output).toContain('__effect');

    // Contains binding effects (interpolation)
    expect(output).toContain('textContent');

    // Contains event listener
    expect(output).toContain("addEventListener('click'");

    // Contains CSS injection scoped by tag name
    expect(output).toContain("document.createElement('style')");
    expect(output).toContain('wcc-browser .browser');
  });
});

// ── Test 2: Invalid SFC throws the same validation errors ───────────

describe('compileFromSFC — validation errors', () => {
  it('throws SFC_MISSING_TEMPLATE when <template> is absent', async () => {
    const sfcSource = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'wcc-bad' })
</script>`;

    try {
      await compileFromSFC(sfcSource);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err.code).toBe('SFC_MISSING_TEMPLATE');
    }
  });

  it('throws SFC_MISSING_SCRIPT when <script> is absent', async () => {
    const sfcSource = `<template>
  <div>Hello</div>
</template>`;

    try {
      await compileFromSFC(sfcSource);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err.code).toBe('SFC_MISSING_SCRIPT');
    }
  });
});
