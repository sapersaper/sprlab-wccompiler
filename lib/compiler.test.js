import { describe, it, expect } from 'vitest';
import { compile } from './compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';

const TMP_DIR = resolve('__test_fixtures__');

function setup() {
  mkdirSync(TMP_DIR, { recursive: true });
}

function teardown() {
  rmSync(TMP_DIR, { recursive: true, force: true });
}

function writeFixture(name, content) {
  const p = join(TMP_DIR, name);
  writeFileSync(p, content, 'utf-8');
  return p;
}

describe('compile() integration', () => {
  const sampleHTML = `
<template>
  <div class="counter">{{value}}</div>
  <div>{{prefix}} {{value2}}</div>
  <button @click="handleClick">Click</button>
</template>

<style>
  .counter { color: red; }
</style>

<script>
  defineProps(['value', 'value2'])
  const prefix = 'hi'

  function handleClick() {
    emit('on-click', prefix)
  }
</script>
`;

  it('compiles a source file to a self-contained JS component', () => {
    setup();
    try {
      const filePath = writeFixture('wcc-test.html', sampleHTML);
      const output = compile(filePath);

      expect(typeof output).toBe('string');
      expect(output.length).toBeGreaterThan(0);
      expect(output).not.toMatch(/^\s*import\s+/m);
      expect(output).toContain("customElements.define('wcc-test'");
      expect(output).toContain('class WccTest extends HTMLElement');
      expect(output).toContain('__signal');
      expect(output).toContain('__computed');
      expect(output).toContain('__effect');
      expect(output).toContain("'value'");
      expect(output).toContain("'value2'");
      expect(output).toContain('wcc-test .counter');
    } finally {
      teardown();
    }
  });

  it('throws on a file without <template>', () => {
    setup();
    try {
      const filePath = writeFixture('bad.html', '<script>const x = 1</script>');
      expect(() => compile(filePath)).toThrow();
    } finally {
      teardown();
    }
  });
});
