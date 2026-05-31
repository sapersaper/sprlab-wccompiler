/**
 * Unit tests for CLI integration with .wcc files.
 *
 * Feature: single-file-components
 * Validates: Requirements 5.1, 5.2
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
    `wcc-cli-sfc-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

// ── Tests ───────────────────────────────────────────────────────────

describe('CLI SFC integration — discoverFiles includes .wcc', () => {
  it('wcc build discovers and compiles .wcc files in the input directory', () => {
    const dir = createTempDir();
    const srcDir = join(dir, 'src');
    const distDir = join(dir, 'dist');
    mkdirSync(srcDir, { recursive: true });

    // Create a minimal .wcc component
    const sfcSource = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-hello' })

const msg = signal('hi')
</script>

<template>
  <span>{{msg()}}</span>
</template>
`;
    writeFileSync(join(srcDir, 'wcc-hello.wcc'), sfcSource);

    // Create a wcc.config.js pointing to src/dist
    writeFileSync(
      join(dir, 'wcc.config.js'),
      `export default { input: 'src', output: 'dist' };\n`
    );

    // Run wcc build
    execFileSync('node', [wcccli, 'build'], { cwd: dir, timeout: 30000 });

    // The .wcc file should have been discovered and compiled
    const outputFile = join(distDir, 'wcc-hello.js');
    expect(existsSync(outputFile)).toBe(true);

    // Verify the output is valid compiled JS
    const output = readFileSync(outputFile, 'utf-8');
    expect(output).toContain('class WccHello extends HTMLElement');
    expect(output).toContain("customElements.define('wcc-hello', WccHello)");
  });

  it('wcc build discovers multiple .wcc files in the input directory', () => {
    const dir = createTempDir();
    const srcDir = join(dir, 'src');
    const distDir = join(dir, 'dist');
    mkdirSync(srcDir, { recursive: true });

    // Create first .wcc SFC component
    const sfcSource1 = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-first' })

const val = signal(1)
</script>

<template>
  <div>{{val()}}</div>
</template>
`;
    writeFileSync(join(srcDir, 'wcc-first.wcc'), sfcSource1);

    // Create second .wcc SFC component
    const sfcSource2 = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-second' })

const num = signal(0)
</script>

<template>
  <div>{{num()}}</div>
</template>
`;
    writeFileSync(join(srcDir, 'wcc-second.wcc'), sfcSource2);

    writeFileSync(
      join(dir, 'wcc.config.js'),
      `export default { input: 'src', output: 'dist' };\n`
    );

    // Run wcc build
    execFileSync('node', [wcccli, 'build'], { cwd: dir, timeout: 30000 });

    // Both files should be compiled
    expect(existsSync(join(distDir, 'wcc-first.js'))).toBe(true);
    expect(existsSync(join(distDir, 'wcc-second.js'))).toBe(true);
  });
});

describe('CLI SFC integration — output path replaces .wcc with .js', () => {
  it('output file for a .wcc input has .js extension', () => {
    const dir = createTempDir();
    const srcDir = join(dir, 'src');
    const distDir = join(dir, 'dist');
    mkdirSync(srcDir, { recursive: true });

    const sfcSource = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-output' })

const x = signal(0)
</script>

<template>
  <span>{{x()}}</span>
</template>
`;
    writeFileSync(join(srcDir, 'wcc-output.wcc'), sfcSource);

    writeFileSync(
      join(dir, 'wcc.config.js'),
      `export default { input: 'src', output: 'dist' };\n`
    );

    execFileSync('node', [wcccli, 'build'], { cwd: dir, timeout: 30000 });

    // .wcc should be replaced with .js, NOT .wcc.js
    expect(existsSync(join(distDir, 'wcc-output.js'))).toBe(true);
    expect(existsSync(join(distDir, 'wcc-output.wcc'))).toBe(false);
    expect(existsSync(join(distDir, 'wcc-output.wcc.js'))).toBe(false);
  });

  it('output path preserves nested directory structure for .wcc files', () => {
    const dir = createTempDir();
    const srcDir = join(dir, 'src');
    const nestedDir = join(srcDir, 'nested');
    const distDir = join(dir, 'dist');
    mkdirSync(nestedDir, { recursive: true });

    const sfcSource = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-nested' })

const y = signal(0)
</script>

<template>
  <span>{{y()}}</span>
</template>
`;
    writeFileSync(join(nestedDir, 'wcc-nested.wcc'), sfcSource);

    writeFileSync(
      join(dir, 'wcc.config.js'),
      `export default { input: 'src', output: 'dist' };\n`
    );

    execFileSync('node', [wcccli, 'build'], { cwd: dir, timeout: 30000 });

    // Nested .wcc should produce nested .js output
    expect(existsSync(join(distDir, 'nested', 'wcc-nested.js'))).toBe(true);
  });
});
