/**
 * Integration tests for the full compilation pipeline with explicit component imports.
 *
 * Feature: explicit-component-imports
 *
 * Validates: Requirements 1.1, 2.1, 3.1, 5.3, 6.1, 7.2, 8.1
 *
 * These tests exercise the complete compileSFC() pipeline end-to-end,
 * verifying that named imports, side-effect imports, guarded registration,
 * __meta, unresolved tag errors, and hyphenated tag passthrough all work
 * correctly in the compiled output.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from './compiler.js';

// ── Helpers ─────────────────────────────────────────────────────────

/** @type {string[]} */
const tempDirs = [];

function createTempDir() {
  const dir = join(
    tmpdir(),
    `wcc-explicit-imports-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

// ── Integration Tests ───────────────────────────────────────────────

describe('Explicit component imports — full pipeline integration', () => {
  it('compiles a component with one named import used in template', async () => {
    const dir = createTempDir();

    // Child component
    const childSfc = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-badge' })

const label = signal('badge')
</script>

<template>
  <span>{{label()}}</span>
</template>`;

    writeFileSync(join(dir, 'wcc-badge.wcc'), childSfc);

    // Parent component with one named import
    const parentSfc = `<script>
import { defineComponent, signal } from 'wcc'
import WccBadge from './wcc-badge.wcc'

export default defineComponent({ tag: 'wcc-parent' })

const title = signal('Hello')
</script>

<template>
  <div>
    <h1>{{title()}}</h1>
    <WccBadge></WccBadge>
  </div>
</template>`;

    writeFileSync(join(dir, 'wcc-parent.wcc'), parentSfc);

    const { code: output } = await compile(join(dir, 'wcc-parent.wcc'));

    // Named import emitted with .js extension
    expect(output).toContain("import WccBadge from './wcc-badge.js';");

    // Guarded child registration using __meta.tag
    expect(output).toContain(
      'if (!customElements.get(WccBadge.__meta.tag)) customElements.define(WccBadge.__meta.tag, WccBadge);'
    );

    // Component class generated
    expect(output).toContain('class WccParent extends HTMLElement');

    // Static __meta property with tag
    expect(output).toMatch(/static __meta\s*=\s*\{[^}]*tag:\s*'wcc-parent'/);

    // Guarded self-registration at the end
    expect(output).toContain(
      "if (!customElements.get('wcc-parent')) customElements.define('wcc-parent', WccParent);"
    );

    // Template is normalized: PascalCase tag converted to kebab-case
    expect(output).toContain('wcc-badge');
    expect(output).not.toContain('<WccBadge');
  });

  it('compiles a component with multiple imports (named + side-effect)', async () => {
    const dir = createTempDir();

    // Child component
    const childSfc = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-card' })

const text = signal('card')
</script>

<template>
  <div>{{text()}}</div>
</template>`;

    writeFileSync(join(dir, 'wcc-card.wcc'), childSfc);

    // Side-effect component
    const utilsSfc = `<script>
import { defineComponent } from 'wcc'

export default defineComponent({ tag: 'wcc-utils' })
</script>

<template>
  <span>utils</span>
</template>`;

    writeFileSync(join(dir, 'wcc-utils.wcc'), utilsSfc);

    // Parent with both named and side-effect imports
    const parentSfc = `<script>
import { defineComponent, signal } from 'wcc'
import WccCard from './wcc-card.wcc'
import './wcc-utils.wcc'

export default defineComponent({ tag: 'wcc-app' })

const name = signal('App')
</script>

<template>
  <div>
    <h1>{{name()}}</h1>
    <WccCard></WccCard>
  </div>
</template>`;

    writeFileSync(join(dir, 'wcc-app.wcc'), parentSfc);

    const { code: output } = await compile(join(dir, 'wcc-app.wcc'));

    // Named import with guarded registration
    expect(output).toContain("import WccCard from './wcc-card.js';");
    expect(output).toContain(
      'if (!customElements.get(WccCard.__meta.tag)) customElements.define(WccCard.__meta.tag, WccCard);'
    );

    // Side-effect import with .js extension, no registration
    expect(output).toContain("import './wcc-utils.js';");

    // Side-effect import should NOT have a customElements.define call
    // (only the named import WccCard and self-registration should have define calls)
    const defineLines = output.split('\n').filter(l => l.includes('customElements.define'));
    const wccUtilsDefine = defineLines.filter(l => l.includes('wcc-utils') || l.includes('WccUtils'));
    expect(wccUtilsDefine.length).toBe(0);

    // Self-registration
    expect(output).toContain(
      "if (!customElements.get('wcc-app')) customElements.define('wcc-app', WccApp);"
    );

    // Class generated
    expect(output).toContain('class WccApp extends HTMLElement');
  });

  it('throws UNRESOLVED_COMPONENT error for unresolved PascalCase tag', async () => {
    const dir = createTempDir();

    // Component that uses a PascalCase tag without importing it
    const sfcSource = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-broken' })

const msg = signal('oops')
</script>

<template>
  <div>
    <UnknownWidget></UnknownWidget>
  </div>
</template>`;

    writeFileSync(join(dir, 'wcc-broken.wcc'), sfcSource);

    await expect(compile(join(dir, 'wcc-broken.wcc'))).rejects.toThrow(/UnknownWidget/);

    try {
      await compile(join(dir, 'wcc-broken.wcc'));
    } catch (err) {
      expect(err.code).toBe('UNRESOLVED_COMPONENT');
      expect(err.message).toContain('UnknownWidget');
      expect(err.message).toContain('wcc-broken.wcc');
    }
  });

  it('compiles a component with hyphenated tags only — no child imports generated', async () => {
    const dir = createTempDir();

    // Component that uses only hyphenated custom element tags (no imports)
    const sfcSource = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-container' })

const count = signal(0)
</script>

<template>
  <div>
    <span>{{count()}}</span>
    <some-external-widget></some-external-widget>
    <another-lib-component></another-lib-component>
  </div>
</template>`;

    writeFileSync(join(dir, 'wcc-container.wcc'), sfcSource);

    const { code: output } = await compile(join(dir, 'wcc-container.wcc'));

    // Class generated correctly
    expect(output).toContain('class WccContainer extends HTMLElement');

    // Self-registration present
    expect(output).toContain(
      "if (!customElements.get('wcc-container')) customElements.define('wcc-container', WccContainer);"
    );

    // No child component imports should be present
    // The only import should be the runtime import (if shared) or no imports at all (standalone)
    const importLines = output.split('\n').filter(l => l.trim().startsWith('import '));
    // Filter out runtime imports
    const nonRuntimeImports = importLines.filter(l => !l.includes('_wcc-runtime'));
    expect(nonRuntimeImports.length).toBe(0);

    // No guarded child registration (only self-registration)
    const defineLines = output.split('\n').filter(l => l.includes('customElements.define'));
    // Should only have the self-registration line
    expect(defineLines.length).toBe(1);
    expect(defineLines[0]).toContain('wcc-container');

    // Hyphenated tags should appear in the template as-is
    expect(output).toContain('some-external-widget');
    expect(output).toContain('another-lib-component');
  });

  it('compiles a component with unused named import — import still emitted', async () => {
    const dir = createTempDir();

    // Child component (exists on disk but won't be used in template)
    const childSfc = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-unused' })

const x = signal(0)
</script>

<template>
  <span>{{x()}}</span>
</template>`;

    writeFileSync(join(dir, 'wcc-unused.wcc'), childSfc);

    // Parent imports the child but never uses it in the template
    const parentSfc = `<script>
import { defineComponent, signal } from 'wcc'
import WccUnused from './wcc-unused.wcc'

export default defineComponent({ tag: 'wcc-main' })

const greeting = signal('hi')
</script>

<template>
  <div>
    <p>{{greeting()}}</p>
  </div>
</template>`;

    writeFileSync(join(dir, 'wcc-main.wcc'), parentSfc);

    const { code: output } = await compile(join(dir, 'wcc-main.wcc'));

    // The unused named import MUST still be emitted (bundler decides tree-shaking)
    expect(output).toContain("import WccUnused from './wcc-unused.js';");

    // Guarded registration for the unused import must also be present
    expect(output).toContain(
      'if (!customElements.get(WccUnused.__meta.tag)) customElements.define(WccUnused.__meta.tag, WccUnused);'
    );

    // Class generated
    expect(output).toContain('class WccMain extends HTMLElement');

    // Self-registration
    expect(output).toContain(
      "if (!customElements.get('wcc-main')) customElements.define('wcc-main', WccMain);"
    );

    // Template should NOT contain any PascalCase tags (WccUnused is not used)
    expect(output).not.toContain('<wcc-unused');
  });
});
