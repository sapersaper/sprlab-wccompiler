/**
 * Tests for standalone resolution in the Compiler.
 *
 * Feature: standalone-mode
 * Validates: Requirements 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 7.1
 *
 * Includes:
 * - Unit tests for resolveStandalone (Task 3.5)
 * - Property-based test for Property 3: precedence resolution (Task 3.6)
 * - Integration tests for Property 4 and Property 5 (Task 3.7)
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile, resolveStandalone } from './compiler.js';

// ── Helpers ─────────────────────────────────────────────────────────

function createTempDir() {
  const dir = join(tmpdir(), `wcc-standalone-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

/**
 * Build a minimal valid SFC with optional standalone option.
 */
function buildSFC(tag, standaloneOption) {
  const defineBody = standaloneOption !== undefined
    ? `tag: '${tag}', standalone: ${standaloneOption}`
    : `tag: '${tag}'`;

  return `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ ${defineBody} })

const count = signal(0)

function increment() {
  count.set(count() + 1)
}
</script>

<template>
<div>{{count()}}</div><button @click="increment">+</button>
</template>
`;
}

// ── Unit Tests: resolveStandalone (Task 3.5) ────────────────────────

describe('resolveStandalone — unit tests', () => {
  it('returns true when component specifies standalone: true (global: false)', () => {
    expect(resolveStandalone(true, false)).toBe(true);
  });

  it('returns true when component specifies standalone: true (global: true)', () => {
    expect(resolveStandalone(true, true)).toBe(true);
  });

  it('returns false when component specifies standalone: false (global: true)', () => {
    expect(resolveStandalone(false, true)).toBe(false);
  });

  it('returns false when component specifies standalone: false (global: false)', () => {
    expect(resolveStandalone(false, false)).toBe(false);
  });

  it('returns global value (false) when component does not specify standalone', () => {
    expect(resolveStandalone(undefined, false)).toBe(false);
  });

  it('returns global value (true) when component does not specify standalone', () => {
    expect(resolveStandalone(undefined, true)).toBe(true);
  });
});

// ── Property-Based Test: Property 3 (Task 3.6) ─────────────────────

describe('Compiler — Property 3: resolución de precedencia standalone', () => {
  /**
   * **Validates: Requirements 3.1, 3.2, 3.3, 7.1**
   *
   * For any combination of component-level standalone value (true, false, or undefined)
   * and global standalone value (true or false), the resolution function SHALL return
   * the component value when defined, or the global value when the component does not specify it.
   *
   * Formally: resolve(componentVal, globalVal) === (componentVal !== undefined ? componentVal : globalVal)
   */
  it('component value takes precedence over global when defined, otherwise global is used', () => {
    const componentValueArb = fc.oneof(
      fc.constant(true),
      fc.constant(false),
      fc.constant(undefined)
    );
    const globalValueArb = fc.boolean();

    fc.assert(
      fc.property(componentValueArb, globalValueArb, (componentValue, globalValue) => {
        const result = resolveStandalone(componentValue, globalValue);
        const expected = componentValue !== undefined ? componentValue : globalValue;
        return result === expected;
      }),
      { numRuns: 100 }
    );
  });
});

// ── Integration Tests: Property 4 (Task 3.7) ───────────────────────

describe('Compiler — Property 4: standalone=true produces self-contained output', () => {
  /**
   * **Validates: Requirements 4.1, 4.2, 4.3**
   *
   * For any component compiled with standalone resolved to true, the output SHALL
   * contain the inline runtime definitions and SHALL NOT contain any import from
   * __wcc-signals.js or other runtime module.
   */
  it('component with standalone: true in defineComponent inlines the runtime', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = buildSFC('wcc-standalone', 'true');
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code, usesSharedRuntime } = await compile(join(dir, 'component.wcc'), {
        standalone: false,
        runtimeImportPath: './__wcc-signals.js',
      });

      // Should contain inline runtime definitions
      expect(code).toContain('function __signal');
      expect(code).toContain('function __effect');
      expect(code).toContain('function __computed');

      // Should NOT contain import from shared runtime
      expect(code).not.toContain("from './__wcc-signals.js'");
      expect(code).not.toMatch(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*__wcc-signals/);

      // Metadata
      expect(usesSharedRuntime).toBe(false);
    } finally {
      cleanupDir(dir);
    }
  });

  it('component without standalone but global standalone: true inlines the runtime', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = buildSFC('wcc-global-standalone', undefined);
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code, usesSharedRuntime } = await compile(join(dir, 'component.wcc'), {
        standalone: true,
        runtimeImportPath: './__wcc-signals.js',
      });

      // Should contain inline runtime definitions
      expect(code).toContain('function __signal');
      expect(code).toContain('function __effect');

      // Should NOT contain import from shared runtime
      expect(code).not.toMatch(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*__wcc-signals/);

      // Metadata
      expect(usesSharedRuntime).toBe(false);
    } finally {
      cleanupDir(dir);
    }
  });

  it('component with standalone: true overrides global standalone: false', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = buildSFC('wcc-override', 'true');
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code, usesSharedRuntime } = await compile(join(dir, 'component.wcc'), {
        standalone: false,
        runtimeImportPath: './__wcc-signals.js',
      });

      // Standalone overrides: should inline
      expect(code).toContain('function __signal');
      expect(code).not.toMatch(/import\s*\{[^}]*\}\s*from/);
      expect(usesSharedRuntime).toBe(false);
    } finally {
      cleanupDir(dir);
    }
  });
});

// ── Integration Tests: Property 5 (Task 3.7) ───────────────────────

describe('Compiler — Property 5: standalone=false produces imports with tree-shaking', () => {
  /**
   * **Validates: Requirements 5.1, 5.2, 5.3**
   *
   * For any component compiled with standalone resolved to false and a runtimeImportPath
   * provided, the output SHALL contain an import statement with only the used runtime
   * functions and SHALL NOT contain inline runtime definitions.
   */
  it('component with standalone: false imports from shared runtime', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = buildSFC('wcc-shared', 'false');
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code, usesSharedRuntime } = await compile(join(dir, 'component.wcc'), {
        standalone: true,
        runtimeImportPath: './__wcc-signals.js',
      });

      // Should contain import from shared runtime
      expect(code).toMatch(/import\s*\{[^}]*\}\s*from\s*'\.\/\__wcc-signals\.js'/);

      // Should NOT contain inline runtime definitions
      expect(code).not.toContain('function __signal');
      expect(code).not.toContain('function __computed');
      expect(code).not.toContain('function __effect');

      // Metadata
      expect(usesSharedRuntime).toBe(true);
    } finally {
      cleanupDir(dir);
    }
  });

  it('component without standalone and global standalone: false imports from shared runtime', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = buildSFC('wcc-default-shared', undefined);
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code, usesSharedRuntime } = await compile(join(dir, 'component.wcc'), {
        standalone: false,
        runtimeImportPath: './__wcc-signals.js',
      });

      // Should contain import from shared runtime
      expect(code).toMatch(/import\s*\{[^}]*\}\s*from\s*'\.\/\__wcc-signals\.js'/);

      // Should NOT contain inline runtime definitions
      expect(code).not.toContain('function __signal');

      // Metadata
      expect(usesSharedRuntime).toBe(true);
    } finally {
      cleanupDir(dir);
    }
  });

  it('tree-shakes: imports only __signal and __effect for a simple signal+binding component', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = buildSFC('wcc-treeshake', 'false');
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code } = await compile(join(dir, 'component.wcc'), {
        standalone: false,
        runtimeImportPath: './__wcc-signals.js',
      });

      // Should import __signal and __effect (needed for bindings)
      expect(code).toContain('__signal');
      expect(code).toContain('__effect');

      // Should NOT import __untrack (no watchers in this component)
      const importMatch = code.match(/import\s*\{([^}]*)\}\s*from/);
      expect(importMatch).not.toBeNull();
      expect(importMatch[1]).not.toContain('__untrack');
    } finally {
      cleanupDir(dir);
    }
  });

  it('component with standalone: false overrides global standalone: true', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = buildSFC('wcc-override-shared', 'false');
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code, usesSharedRuntime } = await compile(join(dir, 'component.wcc'), {
        standalone: true,
        runtimeImportPath: './__wcc-signals.js',
      });

      // Component override: should import, not inline
      expect(code).toMatch(/import\s*\{[^}]*\}\s*from\s*'\.\/\__wcc-signals\.js'/);
      expect(code).not.toContain('function __signal');
      expect(usesSharedRuntime).toBe(true);
    } finally {
      cleanupDir(dir);
    }
  });

  it('usesSharedRuntime is false when standalone: false but no runtimeImportPath provided', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = buildSFC('wcc-no-path', 'false');
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const { code, usesSharedRuntime } = await compile(join(dir, 'component.wcc'), {
        standalone: false,
      });

      // Without runtimeImportPath, falls back to inline (backward compat)
      expect(code).toContain('function __signal');
      expect(usesSharedRuntime).toBe(false);
    } finally {
      cleanupDir(dir);
    }
  });
});
