/**
 * Tests for CLI behavior after standalone removal: __wcc-signals.js is never generated.
 *
 * Feature: zero-runtime
 * Validates that the CLI no longer generates __wcc-signals.js regardless of standalone config.
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
const projectRoot = join(__dirname, '..', '..');
const wcccli = join(projectRoot, 'bin', 'wcc.js');

const tempDirs = [];

function createTempDir() {
  const dir = join(
    tmpdir(),
    `wcc-cli-zero-runtime-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

describe('CLI — zero-runtime: __wcc-signals.js is never generated', () => {
  it('with default config, __wcc-signals.js is NOT generated', () => {
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

    writeFileSync(
      join(dir, 'wcc.config.js'),
      `export default { input: 'src', output: 'dist' };\n`
    );

    execFileSync('node', [wcccli, 'build'], { cwd: dir, timeout: 30000 });

    const output = readFileSync(join(distDir, 'wcc-shared.js'), 'utf-8');
    expect(output).toContain('this._state = new Proxy(');
    expect(output).toContain('__invalidate');
    expect(output).not.toContain('let __currentEffect');
    // __wcc-signals.js should NOT be generated (zero-runtime)
    expect(existsSync(join(distDir, '__wcc-signals.js'))).toBe(false);
  });

  it('with standalone: false config, __wcc-signals.js is NOT generated', () => {
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

    const output = readFileSync(join(distDir, 'wcc-explicit-shared.js'), 'utf-8');
    expect(output).toContain('this._state = new Proxy(');
    expect(output).toContain('__invalidate');
    expect(output).not.toContain('let __currentEffect');
    expect(existsSync(join(distDir, '__wcc-signals.js'))).toBe(false);
  });

  it('with standalone: true config, __wcc-signals.js is NOT generated', () => {
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

    expect(existsSync(join(distDir, '__wcc-signals.js'))).toBe(false);

    const output = readFileSync(join(distDir, 'wcc-standalone.js'), 'utf-8');
    expect(output).toContain('this._state = new Proxy(');
    expect(output).toContain('__invalidate');
    expect(output).not.toContain('__wcc-signals.js');
    expect(output).not.toMatch(/import\s*\{[^}]*\}\s*from/);
  });

  it('with standalone: true globally and component-level standalone: false, __wcc-signals.js is NOT generated', () => {
    const dir = createTempDir();
    const srcDir = join(dir, 'src');
    const distDir = join(dir, 'dist');
    mkdirSync(srcDir, { recursive: true });

    const sfcStandalone = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-inline' })

const x = signal(10)
</script>

<template>
  <span>{{x()}}</span>
</template>
`;

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

    // __wcc-signals.js should NEVER be generated (zero-runtime)
    expect(existsSync(join(distDir, '__wcc-signals.js'))).toBe(false);

    const inlineOutput = readFileSync(join(distDir, 'wcc-inline.js'), 'utf-8');
    expect(inlineOutput).toContain('this._state = new Proxy(');
    expect(inlineOutput).toContain('__invalidate');
    expect(inlineOutput).not.toContain('__wcc-signals.js');

    const sharedOutput = readFileSync(join(distDir, 'wcc-shared-override.js'), 'utf-8');
    expect(sharedOutput).toContain('this._state = new Proxy(');
    expect(sharedOutput).toContain('__invalidate');
    expect(sharedOutput).not.toContain('let __currentEffect');
  });
});
