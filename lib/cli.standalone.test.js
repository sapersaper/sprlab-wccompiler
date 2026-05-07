/**
 * Integration tests for CLI standalone mode behavior.
 *
 * Feature: standalone-mode
 * Validates: Requirements 6.1, 6.2, 6.3
 */

import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const wcccli = join(projectRoot, 'bin', 'wcc.js');

// ── Helpers ─────────────────────────────────────────────────────────

/** @type {string[]} */
const tempDirs = [];

function createTempDir() {
  const dir = join(
    tmpdir(),
    `wcc-cli-standalone-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

// ── Scenario 1: standalone: false (default) → __wcc-signals.js IS generated ──

describe('CLI standalone — Requirement 6.1: standalone false generates shared runtime', () => {
  it('with default config (standalone: false), __wcc-signals.js is generated', () => {
    const dir = createTempDir();
    const srcDir = join(dir, 'src');
    const distDir = join(dir, 'dist');
    mkdirSync(srcDir, { recursive: true });

    const sfcSource = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-shared' })

const count = signal(0)
</script>

<template>
  <span>{{count()}}</span>
</template>
`;
    writeFileSync(join(srcDir, 'wcc-shared.wcc'), sfcSource);

    // Config without standalone (defaults to false)
    writeFileSync(
      join(dir, 'wcc.config.js'),
      `export default { input: 'src', output: 'dist' };\n`
    );

    execFileSync('node', [wcccli, 'build'], { cwd: dir, timeout: 30000 });

    // __wcc-signals.js SHOULD be generated
    expect(existsSync(join(distDir, '__wcc-signals.js'))).toBe(true);

    // The compiled component should import from the shared runtime
    const output = readFileSync(join(distDir, 'wcc-shared.js'), 'utf-8');
    expect(output).toContain('from');
    expect(output).toContain('__wcc-signals.js');
    // Should NOT contain inline runtime definitions
    expect(output).not.toContain('let __currentEffect');
  });

  it('with explicit standalone: false, __wcc-signals.js is generated', () => {
    const dir = createTempDir();
    const srcDir = join(dir, 'src');
    const distDir = join(dir, 'dist');
    mkdirSync(srcDir, { recursive: true });

    const sfcSource = `<script>
import { defineComponent, signal, effect } from 'wcc'

export default defineComponent({ tag: 'wcc-explicit-shared' })

const name = signal('world')
effect(() => console.log(name()))
</script>

<template>
  <div>{{name()}}</div>
</template>
`;
    writeFileSync(join(srcDir, 'wcc-explicit-shared.wcc'), sfcSource);

    writeFileSync(
      join(dir, 'wcc.config.js'),
      `export default { input: 'src', output: 'dist', standalone: false };\n`
    );

    execFileSync('node', [wcccli, 'build'], { cwd: dir, timeout: 30000 });

    expect(existsSync(join(distDir, '__wcc-signals.js'))).toBe(true);

    const output = readFileSync(join(distDir, 'wcc-explicit-shared.js'), 'utf-8');
    expect(output).toContain('__wcc-signals.js');
    expect(output).not.toContain('let __currentEffect');
  });
});

// ── Scenario 2: standalone: true, no overrides → __wcc-signals.js NOT generated ──

describe('CLI standalone — Requirement 6.2: standalone true without overrides skips shared runtime', () => {
  it('with standalone: true and no component overrides, __wcc-signals.js is NOT generated', () => {
    const dir = createTempDir();
    const srcDir = join(dir, 'src');
    const distDir = join(dir, 'dist');
    mkdirSync(srcDir, { recursive: true });

    const sfcSource = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-standalone' })

const value = signal(42)
</script>

<template>
  <span>{{value()}}</span>
</template>
`;
    writeFileSync(join(srcDir, 'wcc-standalone.wcc'), sfcSource);

    writeFileSync(
      join(dir, 'wcc.config.js'),
      `export default { input: 'src', output: 'dist', standalone: true };\n`
    );

    execFileSync('node', [wcccli, 'build'], { cwd: dir, timeout: 30000 });

    // __wcc-signals.js should NOT be generated
    expect(existsSync(join(distDir, '__wcc-signals.js'))).toBe(false);

    // The compiled component should have inline runtime
    const output = readFileSync(join(distDir, 'wcc-standalone.js'), 'utf-8');
    expect(output).toContain('let __currentEffect');
    // Verify it doesn't import from __wcc-signals.js
    expect(output).not.toContain('__wcc-signals.js');
    expect(output).not.toMatch(/import\s*\{[^}]*\}\s*from/);
  });

  it('with standalone: true and multiple components without overrides, __wcc-signals.js is NOT generated', () => {
    const dir = createTempDir();
    const srcDir = join(dir, 'src');
    const distDir = join(dir, 'dist');
    mkdirSync(srcDir, { recursive: true });

    const sfcSource1 = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-one' })

const a = signal(1)
</script>

<template>
  <span>{{a()}}</span>
</template>
`;
    const sfcSource2 = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-two' })

const b = signal(2)
</script>

<template>
  <span>{{b()}}</span>
</template>
`;
    writeFileSync(join(srcDir, 'wcc-one.wcc'), sfcSource1);
    writeFileSync(join(srcDir, 'wcc-two.wcc'), sfcSource2);

    writeFileSync(
      join(dir, 'wcc.config.js'),
      `export default { input: 'src', output: 'dist', standalone: true };\n`
    );

    execFileSync('node', [wcccli, 'build'], { cwd: dir, timeout: 30000 });

    expect(existsSync(join(distDir, '__wcc-signals.js'))).toBe(false);
    expect(existsSync(join(distDir, 'wcc-one.js'))).toBe(true);
    expect(existsSync(join(distDir, 'wcc-two.js'))).toBe(true);
  });
});

// ── Scenario 3: standalone: true globally, one component overrides to false → __wcc-signals.js IS generated ──

describe('CLI standalone — Requirement 6.3: component override to false generates shared runtime', () => {
  it('with standalone: true globally but one component has standalone: false, __wcc-signals.js IS generated', () => {
    const dir = createTempDir();
    const srcDir = join(dir, 'src');
    const distDir = join(dir, 'dist');
    mkdirSync(srcDir, { recursive: true });

    // Component that stays standalone (no override)
    const sfcStandalone = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-inline' })

const x = signal(10)
</script>

<template>
  <span>{{x()}}</span>
</template>
`;

    // Component that overrides to shared mode
    const sfcShared = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-shared-override', standalone: false })

const y = signal(20)
</script>

<template>
  <span>{{y()}}</span>
</template>
`;

    writeFileSync(join(srcDir, 'wcc-inline.wcc'), sfcStandalone);
    writeFileSync(join(srcDir, 'wcc-shared-override.wcc'), sfcShared);

    writeFileSync(
      join(dir, 'wcc.config.js'),
      `export default { input: 'src', output: 'dist', standalone: true };\n`
    );

    execFileSync('node', [wcccli, 'build'], { cwd: dir, timeout: 30000 });

    // __wcc-signals.js SHOULD be generated because one component needs it
    expect(existsSync(join(distDir, '__wcc-signals.js'))).toBe(true);

    // The standalone component should have inline runtime
    const inlineOutput = readFileSync(join(distDir, 'wcc-inline.js'), 'utf-8');
    expect(inlineOutput).toContain('let __currentEffect');
    expect(inlineOutput).not.toContain('__wcc-signals.js');

    // The shared component should import from __wcc-signals.js
    const sharedOutput = readFileSync(join(distDir, 'wcc-shared-override.js'), 'utf-8');
    expect(sharedOutput).toContain('__wcc-signals.js');
    expect(sharedOutput).not.toContain('let __currentEffect');
  });
});
