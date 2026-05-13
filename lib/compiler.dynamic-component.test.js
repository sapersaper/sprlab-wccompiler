import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from './compiler.js';

// ── Helper: create temp component files ─────────────────────────────

function createTempDir() {
  const dir = join(tmpdir(), `wcc-dyn-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

function writeSFC(dir, name, content) {
  const filePath = join(dir, name);
  writeFileSync(filePath, content);
  return filePath;
}

// ── End-to-end compilation of <component :is="expr"> ────────────────

describe('compile() — dynamic component integration', () => {
  it('compiles a template with <component :is="expr">', async () => {
    const dir = createTempDir();
    try {
      const filePath = writeSFC(dir, 'app.wcc', `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'dyn-app' })

const currentView = signal('my-page')
</script>

<template>
<div class="container">
  <component :is="currentView()"></component>
</div>
</template>`);

      const { code } = await compile(filePath);

      // Template should contain the comment anchor instead of <component>
      expect(code).toContain('<!-- dynamic -->');
      expect(code).not.toContain('<component');

      // Should contain the swap effect structure
      expect(code).toContain('__effect');
      expect(code).toContain('__dyn0_anchor');
      expect(code).toContain('__dyn0_current');
      expect(code).toContain('__dyn0_tag');
      expect(code).toContain('__dyn0_propDisposers');

      // Should contain createElement and insertBefore
      expect(code).toContain('document.createElement(__tag)');
      expect(code).toContain('insertBefore');
      expect(code).toContain('customElements.upgrade');

      // Should contain the transformed expression (signal read)
      expect(code).toContain('this._currentView()');

      // Should contain cleanup logic
      expect(code).toContain('.remove()');

      // Should contain class definition
      expect(code).toContain('class DynApp extends HTMLElement');
      expect(code).toContain("customElements.define('dyn-app', DynApp)");
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiles a template with props and events on <component>', async () => {
    const dir = createTempDir();
    try {
      const filePath = writeSFC(dir, 'app.wcc', `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'dyn-props' })

const routeComponent = signal('home-page')
const pageTitle = signal('Hello')
const items = signal([])

function onNavigate(e) {
  console.log(e)
}
</script>

<template>
<div>
  <component :is="routeComponent()" :title="pageTitle()" :data="items()" @navigate="onNavigate"></component>
</div>
</template>`);

      const { code } = await compile(filePath);

      // Should contain prop effects (setAttribute calls)
      expect(code).toContain("setAttribute('title'");
      expect(code).toContain("setAttribute('data'");

      // Prop effects should be nested (propDisposers.push)
      expect(code).toContain('__dyn0_propDisposers.push(__effect');

      // Should contain event listener
      expect(code).toContain("addEventListener('navigate'");

      // Should contain transformed expressions for props
      expect(code).toContain('this._pageTitle()');
      expect(code).toContain('this._items()');

      // Should contain the handler reference
      expect(code).toContain('_onNavigate');
    } finally {
      cleanupDir(dir);
    }
  });

  it('produces valid standalone output (IIFE-compatible) for bundle mode', async () => {
    const dir = createTempDir();
    try {
      const filePath = writeSFC(dir, 'app.wcc', `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'dyn-bundle', standalone: true })

const view = signal('page-a')
</script>

<template>
<div>
  <component :is="view()"></component>
</div>
</template>`);

      // Compile in standalone mode (inlines runtime — no import statements needed for IIFE bundling)
      const { code } = await compile(filePath, { standalone: true });

      // Standalone output should NOT have import statements (self-contained for IIFE bundling)
      // The only non-export statement should be the default export at the end
      expect(code).not.toMatch(/^import\s/m);

      // Should contain the inlined reactive runtime
      expect(code).toContain('__signal');
      expect(code).toContain('__effect');

      // Should still contain dynamic component code
      expect(code).toContain('__dyn0_anchor');
      expect(code).toContain('document.createElement(__tag)');

      // The output should be valid JavaScript when the export is stripped
      // (esbuild wraps this in IIFE for bundle mode, removing exports)
      const codeWithoutExport = code.replace(/^export default .+;?$/m, '');
      expect(() => new Function(codeWithoutExport)).not.toThrow();
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiles <component> inside an if block', async () => {
    const dir = createTempDir();
    try {
      const filePath = writeSFC(dir, 'app.wcc', `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'dyn-if' })

const showDynamic = signal(true)
const currentView = signal('my-page')
</script>

<template>
<div>
  <div if="showDynamic()">
    <component :is="currentView()"></component>
  </div>
</div>
</template>`);

      const { code } = await compile(filePath);

      // Should have the if block structure
      expect(code).toContain('__if0');

      // The <component> inside the if branch is processed by walkBranch.
      // The branch template captures the <component> element and the :is binding
      // is handled as an attr binding within the branch setup.
      expect(code).toContain('__if0_t0');
      expect(code).toContain('__if0_setup');

      // The :is attribute is treated as an attr binding inside the branch
      expect(code).toContain("setAttribute('is'");
      expect(code).toContain('this._currentView()');
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiles <component> inside an each loop', async () => {
    const dir = createTempDir();
    try {
      const filePath = writeSFC(dir, 'app.wcc', `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'dyn-each' })

const tabs = signal([
  { tag: 'tab-home' },
  { tag: 'tab-about' }
])
</script>

<template>
<div>
  <div each="tab in tabs()">
    <component :is="tab.tag"></component>
  </div>
</div>
</template>`);

      const { code } = await compile(filePath);

      // Should have the for block structure
      expect(code).toContain('__for0');
      expect(code).toContain('__for0_tpl');
      expect(code).toContain('__for0_anchor');
      expect(code).toContain('__for0_nodes');

      // The <component> inside the each loop is processed by walkBranch.
      // The :is attribute is handled as an attr binding within the loop iteration setup.
      expect(code).toContain("setAttribute('is'");
      expect(code).toContain('tab.tag');

      // Should contain the iteration logic
      expect(code).toContain('__iter.forEach');
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiles multiple <component> elements with sequential varNames', async () => {
    const dir = createTempDir();
    try {
      const filePath = writeSFC(dir, 'app.wcc', `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'dyn-multi' })

const header = signal('app-header')
const content = signal('app-content')
const footer = signal('app-footer')
</script>

<template>
<div>
  <component :is="header()"></component>
  <component :is="content()"></component>
  <component :is="footer()"></component>
</div>
</template>`);

      const { code } = await compile(filePath);

      // Should have three dynamic component bindings with sequential names
      expect(code).toContain('__dyn0_anchor');
      expect(code).toContain('__dyn1_anchor');
      expect(code).toContain('__dyn2_anchor');

      expect(code).toContain('__dyn0_current');
      expect(code).toContain('__dyn1_current');
      expect(code).toContain('__dyn2_current');

      expect(code).toContain('__dyn0_tag');
      expect(code).toContain('__dyn1_tag');
      expect(code).toContain('__dyn2_tag');

      // Each should have its own swap effect with the correct expression
      expect(code).toContain('this._header()');
      expect(code).toContain('this._content()');
      expect(code).toContain('this._footer()');
    } finally {
      cleanupDir(dir);
    }
  });
});
