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
      writeFileSync(join(dir, 'counter.html'), '<div>{{count}}</div><button @click="increment">+</button>');
      writeFileSync(
        join(dir, 'counter.js'),
        `import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'wcc-counter',
  template: './counter.html',
})

const count = signal(0)

function increment() {
  count.set(count() + 1)
}
`
      );

      const output = await compile(join(dir, 'counter.js'));

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
      writeFileSync(join(dir, 'app.html'), '<div>{{msg}}</div><button @click="greet">Go</button>');
      writeFileSync(join(dir, 'app.css'), '.container { color: blue; }');
      writeFileSync(
        join(dir, 'app.js'),
        `import { defineComponent, signal, effect } from 'wcc'

export default defineComponent({
  tag: 'my-app',
  template: './app.html',
  styles: './app.css',
})

const msg = signal('hello')

effect(() => {
  console.log(msg())
})

function greet() {
  msg.set('world')
}
`
      );

      const output = await compile(join(dir, 'app.js'));

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
      writeFileSync(join(dir, 'bad.js'), 'const x = 1;');

      try {
        await compile(join(dir, 'bad.js'));
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err.code).toBe('MISSING_DEFINE_COMPONENT');
      }
    } finally {
      cleanupDir(dir);
    }
  });

  it('propagates TEMPLATE_NOT_FOUND error', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(
        join(dir, 'comp.js'),
        `defineComponent({ tag: 'my-comp', template: './missing.html' })`
      );

      try {
        await compile(join(dir, 'comp.js'));
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err.code).toBe('TEMPLATE_NOT_FOUND');
      }
    } finally {
      cleanupDir(dir);
    }
  });
});
