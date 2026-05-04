/**
 * Property-based test for SFC compilation equivalence.
 *
 * Feature: single-file-components, Property 8: Equivalencia de output SFC vs multi-archivo
 *
 * Validates: Requirements 4.1, 4.3
 */

import { describe, it, expect, afterEach } from 'vitest';
import fc from 'fast-check';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from './compiler.js';

// ── Helpers ─────────────────────────────────────────────────────────

function createTempDir() {
  const dir = join(
    tmpdir(),
    `wcc-sfc-equiv-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

// ── Generators ──────────────────────────────────────────────────────

/** Generate a valid kebab-case tag name like 'x-abc' */
const arbTagName = fc
  .tuple(
    fc.stringMatching(/^[a-z]{1,4}$/),
    fc.stringMatching(/^[a-z]{1,4}$/)
  )
  .map(([a, b]) => `x-${a}${b}`);

/** Generate a simple signal name (valid JS identifier, lowercase) */
const arbSignalName = fc.stringMatching(/^[a-z]{2,6}$/);

/** Generate a simple signal initial value */
const arbSignalValue = fc.constantFrom('0', '1', "''", "'hello'", 'true', 'false');

/** Generate simple CSS content (safe, no block tags) */
const arbCssContent = fc
  .tuple(
    fc.stringMatching(/^[a-z]{1,6}$/),
    fc.constantFrom('color', 'display', 'margin', 'padding'),
    fc.constantFrom('red', 'blue', 'block', 'none', '0', '8px')
  )
  .map(([cls, prop, val]) => `.${cls} { ${prop}: ${val}; }`);

/**
 * Generate a component definition with:
 * - A tag name
 * - A signal name + initial value
 * - A simple template using the signal
 * - Simple CSS
 */
const arbComponent = fc
  .tuple(arbTagName, arbSignalName, arbSignalValue, arbCssContent)
  .filter(([_tag, sigName]) => {
    // Avoid JS reserved words
    const reserved = new Set([
      'do', 'if', 'in', 'for', 'let', 'new', 'try', 'var', 'case',
      'else', 'enum', 'eval', 'null', 'this', 'true', 'void', 'with',
      'break', 'catch', 'class', 'const', 'false', 'super', 'throw',
      'while', 'yield', 'delete', 'export', 'import', 'public',
      'return', 'static', 'switch', 'typeof',
    ]);
    return !reserved.has(sigName);
  });

// ── Property 8: Equivalencia de output SFC vs multi-archivo ─────────

/**
 * Validates: Requirements 4.1, 4.3
 *
 * For all components defined in both SFC and multi-file format with the same
 * logic, template, and styles, compile() SHALL produce identical JavaScript
 * output for both formats.
 */
describe('Property 8: Equivalencia de output SFC vs multi-archivo', () => {
  it('compile() produces identical output for SFC and multi-file formats', () => {
    fc.assert(
      fc.asyncProperty(
        arbComponent,
        async ([tagName, signalName, signalValue, css]) => {
          const template = `<div>{{${signalName}}}</div>`;
          const scriptBody = [
            `import { defineComponent, signal } from 'wcc'`,
            '',
            `const ${signalName} = signal(${signalValue})`,
          ].join('\n');

          const dir = createTempDir();
          try {
            // ── Multi-file format ──
            const multiJs = [
              `import { defineComponent, signal } from 'wcc'`,
              '',
              `export default defineComponent({`,
              `  tag: '${tagName}',`,
              `  template: './comp.html',`,
              `  styles: './comp.css',`,
              `})`,
              '',
              `const ${signalName} = signal(${signalValue})`,
            ].join('\n');

            writeFileSync(join(dir, 'comp.js'), multiJs);
            writeFileSync(join(dir, 'comp.html'), template);
            writeFileSync(join(dir, 'comp.css'), css);

            // ── SFC format ──
            const sfcSource = [
              '<script>',
              scriptBody,
              '',
              `export default defineComponent({ tag: '${tagName}' })`,
              '</script>',
              '',
              `<template>${template}</template>`,
              '',
              `<style>${css}</style>`,
            ].join('\n');

            writeFileSync(join(dir, 'comp.wcc'), sfcSource);

            // ── Compile both ──
            const multiOutput = await compile(join(dir, 'comp.js'));
            const sfcOutput = await compile(join(dir, 'comp.wcc'));

            // ── Verify identical output ──
            expect(sfcOutput).toBe(multiOutput);
          } finally {
            cleanupDir(dir);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ── Integration tests: SFC compilation ──────────────────────────────
// Validates: Requirements 4.1, 4.2, 4.3, 4.4, 6.1, 6.2, 8.1, 8.3

/** @type {string[]} */
const tempDirs = [];

function createIntegrationTempDir() {
  const dir = join(
    tmpdir(),
    `wcc-sfc-int-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  tempDirs.length = 0;
});

describe('SFC integration — end-to-end compilation', () => {
  it('compiles a .wcc file with signal, computed, event, and style into valid JS output', async () => {
    const dir = createIntegrationTempDir();

    const sfcSource = `<script>
import { defineComponent, signal, computed } from 'wcc'

export default defineComponent({ tag: 'wcc-demo' })

const count = signal(0)
const doubled = computed(() => count() * 2)

function increment() {
  count.set(count() + 1)
}
</script>

<template>
  <div class="demo">
    <span>{{count}}</span>
    <span>{{doubled}}</span>
    <button @click="increment">+1</button>
  </div>
</template>

<style>
.demo { display: flex; gap: 8px; }
</style>`;

    writeFileSync(join(dir, 'wcc-demo.wcc'), sfcSource);

    const output = await compile(join(dir, 'wcc-demo.wcc'));

    // Contains reactive runtime
    expect(output).toContain('__signal');
    expect(output).toContain('__computed');
    expect(output).toContain('__effect');

    // Contains class definition with correct name
    expect(output).toContain('class WccDemo extends HTMLElement');

    // Contains customElements.define
    expect(output).toContain("customElements.define('wcc-demo', WccDemo)");

    // Contains signal initialization
    expect(output).toContain('__signal(0)');

    // Contains binding effects (interpolation)
    expect(output).toContain('textContent');

    // Contains event listener
    expect(output).toContain("addEventListener('click'");

    // Contains CSS injection scoped by tag name
    expect(output).toContain("document.createElement('style')");
    expect(output).toContain('wcc-demo .demo');
  });

  it('compiles <script lang="ts"> with TypeScript types correctly', async () => {
    const dir = createIntegrationTempDir();

    const sfcSource = `<script lang="ts">
import { defineComponent, signal, computed } from 'wcc'

interface Config {
  step: number;
}

type State = 'idle' | 'active';

export default defineComponent({ tag: 'wcc-typed' })

const count = signal<number>(0)
const label = computed<string>(() => \`Count: \${count()}\`)

function increment(): void {
  count.set(count() + 1)
}
</script>

<template>
  <div>
    <span>{{label}}</span>
    <button @click="increment">+</button>
  </div>
</template>

<style>
div { padding: 4px; }
</style>`;

    writeFileSync(join(dir, 'wcc-typed.wcc'), sfcSource);

    const output = await compile(join(dir, 'wcc-typed.wcc'));

    // TypeScript syntax should be stripped
    expect(output).not.toContain('interface ');
    expect(output).not.toMatch(/\btype\s+\w+\s*=/);
    expect(output).not.toContain('<number>');
    expect(output).not.toContain('<string>');
    expect(output).not.toContain(': void');

    // Valid JS output should still be produced
    expect(output).toContain('class WccTyped extends HTMLElement');
    expect(output).toContain("customElements.define('wcc-typed', WccTyped)");
    expect(output).toContain('__signal(0)');
    expect(output).toContain('textContent');
  });

  it('resolves a child component in .wcc format correctly', async () => {
    const dir = createIntegrationTempDir();

    // Child component as .wcc
    const childSfc = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-child' })

const text = signal('hello')
</script>

<template>
  <span>{{text}}</span>
</template>`;

    writeFileSync(join(dir, 'wcc-child.wcc'), childSfc);

    // Parent component that uses the child tag in its template
    // Note: child component must have a prop binding (e.g., label="{{title}}")
    // for the compiler to detect it as a child component and generate an import
    const parentSfc = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-parent' })

const title = signal('Parent')
</script>

<template>
  <div>
    <h1>{{title}}</h1>
    <wcc-child label="{{title}}"></wcc-child>
  </div>
</template>`;

    writeFileSync(join(dir, 'wcc-parent.wcc'), parentSfc);

    const output = await compile(join(dir, 'wcc-parent.wcc'));

    // Parent output should contain an import for the child .wcc resolved as .js
    expect(output).toContain("import './wcc-child.js'");

    // Parent class should still be generated
    expect(output).toContain('class WccParent extends HTMLElement');
    expect(output).toContain("customElements.define('wcc-parent', WccParent)");
  });

  it('compiles existing multi-file components without changes (regression)', async () => {
    const dir = createIntegrationTempDir();

    // Create a multi-file component (same pattern as existing examples)
    writeFileSync(
      join(dir, 'wcc-legacy.js'),
      `import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'wcc-legacy',
  template: './wcc-legacy.html',
  styles: './wcc-legacy.css',
})

const value = signal(42)

function reset() {
  value.set(0)
}
`
    );
    writeFileSync(join(dir, 'wcc-legacy.html'), '<div class="legacy"><span>{{value}}</span><button @click="reset">Reset</button></div>');
    writeFileSync(join(dir, 'wcc-legacy.css'), '.legacy { color: blue; }');

    const output = await compile(join(dir, 'wcc-legacy.js'));

    // Multi-file component should compile correctly
    expect(output).toContain('class WccLegacy extends HTMLElement');
    expect(output).toContain("customElements.define('wcc-legacy', WccLegacy)");
    expect(output).toContain('__signal(42)');
    expect(output).toContain("addEventListener('click'");
    expect(output).toContain('wcc-legacy .legacy');
    expect(output).toContain("document.createElement('style')");
  });
});
