/**
 * Tests for compiler after standalone removal.
 *
 * Feature: zero-runtime
 * Validates that compile() always returns self-contained code with inline runtime.
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from '../../lib/compiler.js';

function createTempDir() {
  const dir = join(tmpdir(), `wcc-zero-runtime-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

function buildSFC(tag) {
  return `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: '${tag}' })

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

describe('Compiler — zero-runtime: always produces self-contained output', () => {
  it('returns an object with code (not a string directly)', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = buildSFC('wcc-zero');
      writeFileSync(join(dir, 'component.wcc'), sfcContent);

      const result = await compile(join(dir, 'component.wcc'), {});

      expect(typeof result).toBe('object');
      expect(typeof result.code).toBe('string');
      expect(result.code).toContain('_state = new Proxy(');
      expect(result.code).toContain('__invalidate');
      expect(result.code).not.toMatch(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*__wcc-signals/);
    } finally {
      cleanupDir(dir);
    }
  });

  it('component with standalone option in defineComponent still compiles (option ignored)', async () => {
    const dir = createTempDir();
    try {
      const sfc = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-ignored', standalone: true })

const count = signal(0)
</script>

<template><div>{{count()}}</div></template>
`;
      writeFileSync(join(dir, 'component.wcc'), sfc);

      const { code } = await compile(join(dir, 'component.wcc'), {});

      expect(code).toContain('_state = new Proxy(');
      expect(code).not.toMatch(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*__wcc-signals/);
    } finally {
      cleanupDir(dir);
    }
  });
});
