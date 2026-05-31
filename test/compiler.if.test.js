/**
 * Integration test for wcCompiler v2 — if/else-if/else conditional rendering.
 *
 * Creates a temp component with a if/else-if/else chain using signal-based
 * expressions, includes {{interpolation}} and @event bindings inside branches,
 * compiles it, and verifies the output contains all expected runtime constructs.
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from '../lib/compiler.js';

// ── Helper: create temp component files ─────────────────────────────

function createTempDir() {
  const dir = join(tmpdir(), `wcc-if-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

// ── Integration Tests ───────────────────────────────────────────────

describe('compile() — if/else-if/else integration', () => {
  it('compiles a component with if/else-if/else chain, bindings, and events', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-conditional' })

const status = signal('idle')
const count = signal(0)

function retry() {
  status.set('active')
}
</script>

<template>
<p if="status === 'active'">Active: {{count()}}</p>
<p else-if="status === 'pending'"><button @click="retry">Retry</button></p>
<p else>Inactive</p>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // 1. Class definition
      expect(output).toContain('class WccConditional extends HTMLElement');

      // 2. Template elements for each branch
      expect(output).toContain("this.__if0_t0 = document.createElement('template')");
      expect(output).toContain("this.__if0_t1 = document.createElement('template')");
      expect(output).toContain("this.__if0_t2 = document.createElement('template')");

      // 3. Branch template HTML (directive attributes removed)
      expect(output).toContain('this.__if0_t0.innerHTML');
      expect(output).toContain('this.__if0_t1.innerHTML');
      expect(output).toContain('this.__if0_t2.innerHTML');

      // 4. Anchor reference
      expect(output).toContain('this.__if0_anchor = ');

      // 5. State initialization
      expect(output).toContain('this.__if0_current = null');
      expect(output).toContain('this.__if0_active = undefined');

      // 6. Reactive effect with transformed expressions
      // status should be transformed to this._state.status
      expect(output).toContain("this._state.status === 'active'");
      expect(output).toContain("this._state.status === 'pending'");

      // 7. Early return optimization
      expect(output).toContain('__branch === this.__if0_active) return');

      // 8. Branch removal
      expect(output).toContain('this.__if0_current.remove()');

      // 9. Clone and insert
      expect(output).toContain('tpl.content.cloneNode(true)');
      expect(output).toContain('this.__if0_anchor.parentNode.insertBefore(node, this.__if0_anchor)');

      // 10. Setup method (branches have bindings/events)
      expect(output).toContain('__if0_setup(node, branch)');

      // 11. Text binding in setup for branch 0 ({{count()}})
      expect(output).toContain('this._state.count');

      // 12. Event listener in setup for branch 1 (@click="retry")
      expect(output).toContain("addEventListener('click'");
      expect(output).toContain('_retry');

      // 13. Signal initialization in Proxy state
      expect(output).toContain("status:");
      expect(output).toContain('count:');

      // 14. Processed template should have comment anchor instead of conditional elements
      expect(output).toContain('<!-- if -->');

      // 15. customElements.define
      expect(output).toContain("customElements.define('wcc-conditional', WccConditional)");
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiles a component with if-only (no else) chain', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-ifonly' })

const visible = signal(true)
const message = signal('Hello')
</script>

<template>
<div if="visible">{{message()}}</div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // Only one template element
      expect(output).toContain("this.__if0_t0 = document.createElement('template')");
      expect(output).not.toContain('this.__if0_t1');

      // Only if condition, no else branch in the if-chain
      expect(output).toContain('if (this._state.visible)');
      expect(output).not.toContain('else { __branch');

      // Phase 2: no setup method for simple text bindings (handled via __invalidate)
      expect(output).not.toContain('__if0_setup(');
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiles a component with nested if chain inside a wrapper element', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-nested' })

const active = signal(false)
</script>

<template>
<div class="wrapper">
  <span if="active">On</span>
  <span else>Off</span>
</div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code: output } = await compile(join(dir, 'component.wcc'));

      // Should have if block
      expect(output).toContain("this.__if0_t0 = document.createElement('template')");
      expect(output).toContain("this.__if0_t1 = document.createElement('template')");
      expect(output).toContain('this.__if0_anchor');

      // Anchor path should reference nested position using findAnchor
      // The anchor is inside the wrapper div
      expect(output).toContain("findAnchor(__root, 'if', 0)");
    } finally {
      cleanupDir(dir);
    }
  });

  it('throws CONFLICTING_DIRECTIVES for show + if on same element', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-conflict' })

const x = signal(true)
const y = signal(true)
</script>

<template>
<div show="x" if="y">content</div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      try {
        await compile(join(dir, 'component.wcc'));
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err.code).toBe('CONFLICTING_DIRECTIVES');
      }
    } finally {
      cleanupDir(dir);
    }
  });

  it('throws ORPHAN_ELSE for else without preceding if', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent } from 'wcc'

export default defineComponent({ tag: 'wcc-orphan' })
</script>

<template>
<div>normal</div><div else>orphan</div>
</template>`;
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      try {
        await compile(join(dir, 'component.wcc'));
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err.code).toBe('ORPHAN_ELSE');
      }
    } finally {
      cleanupDir(dir);
    }
  });
});
