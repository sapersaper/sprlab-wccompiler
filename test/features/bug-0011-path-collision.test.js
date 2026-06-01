/**
 * BUG-0011: Text binding path collision in nested loops
 *
 * When a parent element contains mixed text interpolations ({{ expr }}) followed by
 * child elements with their own interpolations, the tree-walker generated incorrect
 * childNodes paths because DOM modifications from Case 2 (mixed interpolations)
 * shifted sibling indices.
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from '../../lib/compiler.js';

function createTempDir() {
  const dir = join(tmpdir(), `wcc-bug0011-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

describe('BUG-0011: text binding path collision after DOM modification', () => {
  it('generates different paths for sibling interpolations in mixed content', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'app.wcc'), `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'path-test' })
const items = signal([{ name: 'hello', status: 'active' }])
</script>
<template>
<div>
  <div each="item in items()">
    <div class="container">
      {{ item.name }}
      <span class="status">{{ item.status }}</span>
    </div>
  </div>
</div>
</template>`);

      const { code } = await compile(join(dir, 'app.wcc'));

      // Should be valid JS
  // Phase 4: generated code may not be standalone-parseable without runtime
      expect(() => new Function(code.replace(/^export default .+$/m, ''))).not.toThrow();

      // The two bindings should have DIFFERENT paths
      const lines = code.split('\n');
      const nameLine = lines.find(l => l.includes('item.name') && l.includes('textContent'));
      const statusLine = lines.find(l => l.includes('item.status') && l.includes('textContent'));

      expect(nameLine).toBeDefined();
      expect(statusLine).toBeDefined();

      const namePathMatch = nameLine.match(/(childNodes\[\d+\](?:\.childNodes\[\d+\])*)/);
      const statusPathMatch = statusLine.match(/(childNodes\[\d+\](?:\.childNodes\[\d+\])*)/);

      expect(namePathMatch).not.toBeNull();
      expect(statusPathMatch).not.toBeNull();
      expect(namePathMatch[1]).not.toBe(statusPathMatch[1]);
    } finally {
      cleanupDir(dir);
    }
  });

  it('handles multiple interpolations followed by elements in a loop', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'app.wcc'), `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'loop-path' })
const items = signal([{ id: 1, name: 'A', tag: 'active' }])
</script>
<template>
<div>
  <div each="item in items()" :key="item.id">
    <div class="info">
      {{ item.name }}
      <span class="tag">{{ item.tag }}</span>
    </div>
  </div>
</div>
</template>`);

      const { code } = await compile(join(dir, 'app.wcc'));

      // Should be valid JS
  // Phase 4: generated code may not be standalone-parseable without runtime
      expect(() => new Function(code.replace(/^export default .+$/m, ''))).not.toThrow();

      // item.name and item.tag should have different paths
      const lines = code.split('\n');
      const nameLine = lines.find(l => l.includes('item.name'));
      const tagLine = lines.find(l => l.includes('item.tag'));

      expect(nameLine).toBeDefined();
      expect(tagLine).toBeDefined();

      // Extract the full path from each line
      const namePathMatch = nameLine.match(/(childNodes\[\d+\](?:\.childNodes\[\d+\])*)/);
      const tagPathMatch = tagLine.match(/(childNodes\[\d+\](?:\.childNodes\[\d+\])*)/);

      expect(namePathMatch).not.toBeNull();
      expect(tagPathMatch).not.toBeNull();
      // Paths must be different
      expect(namePathMatch[1]).not.toBe(tagPathMatch[1]);
    } finally {
      cleanupDir(dir);
    }
  });

  it('nested loops with mixed content produce correct paths', async () => {
    const { code } = await compile('example/src/12-edge-cases/test-nested-loops.wcc');

    // Should be valid JS
  // Phase 4: generated code may not be standalone-parseable without runtime
    expect(() => new Function(code.replace(/^export default .+$/m, ''))).not.toThrow();

    // Should contain __renderEach_0 for each-loop rendering
    expect(code).toContain('__renderEach_0() {');

    // Should contain category references
    const lines = code.split('\n');
    const catLines = lines.filter(l => l.includes('category') && l.includes('textContent'));
    expect(catLines.length).toBeGreaterThan(0);
  });
});
