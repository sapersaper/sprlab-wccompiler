import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from './compiler.js';

// ── Helper: create temp component files ─────────────────────────────

function createTempDir() {
  const dir = join(tmpdir(), `wcc-compiler-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

// ── Successful compilation ──────────────────────────────────────────

describe('compile() — successful compilation', () => {
  it('compiles a minimal component with signal, interpolation, and event', async () => {
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
<div>{{count()}}</div><button @click="increment">+</button>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // Contains reactive runtime
      expect(output).toContain('__signal');
      expect(output).toContain('__computed');
      expect(output).toContain('__effect');

      // Contains class definition
      expect(output).toContain('class WccCounter extends HTMLElement');

      // Contains customElements.define
      expect(output).toContain("customElements.define('wcc-counter', WccCounter)");

      // Contains signal initialization
      expect(output).toContain('__signal(0)');

      // Contains binding effect (interpolation)
      expect(output).toContain('textContent');

      // Contains event listener
      expect(output).toContain("addEventListener('click'");
      expect(output).toContain('_increment');
    } finally {
      cleanupDir(dir);
    }
  });
});

// ── Output structure ────────────────────────────────────────────────

describe('compile() — output structure', () => {
  it('contains all expected sections in order', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal, effect } from 'wcc'

export default defineComponent({ tag: 'my-app' })

const msg = signal('hello')

effect(() => {
  console.log(msg())
})

function greet() {
  msg.set('world')
}
</script>

<template>
<div>{{msg()}}</div><button @click="greet">Go</button>
</template>

<style>
.container { color: blue; }
</style>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // 1. Reactive runtime comes first
      const runtimeIdx = output.indexOf('__currentEffect');
      expect(runtimeIdx).toBeGreaterThanOrEqual(0);

      // 2. CSS injection
      const cssIdx = output.indexOf("document.createElement('style')");
      expect(cssIdx).toBeGreaterThan(runtimeIdx);
      expect(output).toContain('document.head.appendChild');
      // CSS should be scoped with tag name
      expect(output).toContain('my-app .container');

      // 3. Template element
      const templateIdx = output.indexOf("document.createElement('template')");
      expect(templateIdx).toBeGreaterThan(cssIdx);

      // 4. HTMLElement class
      const classIdx = output.indexOf('class MyApp extends HTMLElement');
      expect(classIdx).toBeGreaterThan(templateIdx);

      // 5. connectedCallback
      const connectedIdx = output.indexOf('connectedCallback()');
      expect(connectedIdx).toBeGreaterThan(classIdx);

      // 6. customElements.define at the end
      const defineIdx = output.indexOf("customElements.define('my-app', MyApp)");
      expect(defineIdx).toBeGreaterThan(connectedIdx);
    } finally {
      cleanupDir(dir);
    }
  });
});

// ── Error propagation ───────────────────────────────────────────────

describe('compile() — error propagation', () => {
  it('propagates MISSING_DEFINE_COMPONENT error', async () => {
    const dir = createTempDir();
    try {
      // A .wcc file without defineComponent in the script
      const sfcContent = `<script>
const x = 1;
</script>

<template>
<div>hello</div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      try {
        await compile(join(dir, 'component.wcc'));
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err.code).toBe('MISSING_DEFINE_COMPONENT');
      }
    } finally {
      cleanupDir(dir);
    }
  });

  it('propagates SFC_MISSING_TEMPLATE error for .wcc without template block', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'my-comp' })
</script>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      try {
        await compile(join(dir, 'component.wcc'));
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err.code).toBe('SFC_MISSING_TEMPLATE');
      }
    } finally {
      cleanupDir(dir);
    }
  });
});
