/**
 * Runtime reproduction tests for nested directives bugs.
 * These tests compile real components and inspect the generated code
 * to identify the exact issues reported in QA.
 */

import { describe, it, expect } from 'vitest';
import { compile } from './compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function createTempDir() {
  const dir = join(tmpdir(), `wcc-runtime-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

describe('Break Test 1: Nested each (each inside each)', () => {
  it('generates code that correctly scopes inner loop variable', async () => {
    const dir = createTempDir();
    try {
      const sfc = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-nested-each-rt' })

const categories = signal([
  { name: 'Fruits', items: ['Apple', 'Banana'] },
  { name: 'Vegs', items: ['Carrot', 'Pea'] }
])
</script>

<template>
<ul>
  <li each="cat in categories">
    <span each="item in cat.items">{{item}}</span>
  </li>
</ul>
</template>`;

      writeFileSync(join(dir, 'component.wcc'), sfc);
      const output = await compile(join(dir, 'component.wcc'));

      console.log('\n=== NESTED EACH OUTPUT ===\n');
      // Print just the forEach section
      const forEachStart = output.indexOf('__for0_nodes');
      const connectedEnd = output.indexOf('disconnectedCallback');
      if (forEachStart > -1 && connectedEnd > -1) {
        console.log(output.slice(forEachStart, connectedEnd));
      } else {
        console.log(output);
      }

      // Bug 1: Check for stray effect referencing 'item' before inner loop scope
      // The inner variable 'item' should ONLY appear inside the inner forEach callback
      const lines = output.split('\n');
      const forEachLine = lines.findIndex(l => l.includes('__for0_iter.forEach((item'));
      const outerForEachLine = lines.findIndex(l => l.includes('.forEach((cat'));

      // Find any reference to 'item' between outer forEach start and inner forEach start
      if (outerForEachLine > -1 && forEachLine > -1) {
        const betweenLines = lines.slice(outerForEachLine + 1, forEachLine);
        const strayItemRef = betweenLines.find(l => /\bitem\b/.test(l) && !l.includes('__for0_iter') && !l.includes('cat.items'));
        if (strayItemRef) {
          console.log('\n!!! STRAY ITEM REFERENCE FOUND:', strayItemRef.trim());
        }
      }

      // Bug 2: Check that inner loop sets textContent on nodes
      expect(output).toContain('innerNode');
      expect(output).toContain("item ?? ''");

      // The textContent assignment should be INSIDE the inner forEach
      const innerForEachIdx = output.indexOf('__for0_iter.forEach((item');
      const textContentIdx = output.indexOf("item ?? ''");
      expect(textContentIdx).toBeGreaterThan(innerForEachIdx);
    } finally {
      cleanupDir(dir);
    }
  });
});

describe('Break Test 2: If/else inside each', () => {
  it('generates code with correct childNodes path for if anchor', async () => {
    const dir = createTempDir();
    try {
      const sfc = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-if-each-rt' })

const items = signal([
  { name: 'A', active: true },
  { name: 'B', active: false },
  { name: 'C', active: true }
])
</script>

<template>
<ul>
  <li each="item in items">
    <span if="item.active">Active: {{item.name}}</span>
    <span else>Inactive: {{item.name}}</span>
  </li>
</ul>
</template>`;

      writeFileSync(join(dir, 'component.wcc'), sfc);
      const output = await compile(join(dir, 'component.wcc'));

      console.log('\n=== IF/ELSE INSIDE EACH OUTPUT ===\n');
      const forEachStart = output.indexOf('__for0_nodes');
      const connectedEnd = output.indexOf('disconnectedCallback');
      if (forEachStart > -1 && connectedEnd > -1) {
        console.log(output.slice(forEachStart, connectedEnd));
      } else {
        console.log(output);
      }

      // Bug: Check that the anchor path resolves correctly
      // The __if0_anchor should reference a valid path from 'node'
      expect(output).toContain('__if0_anchor');

      // Check the anchor path - it should be relative to 'node' (the cloned li)
      const anchorLine = output.split('\n').find(l => l.includes('__if0_anchor'));
      console.log('\nAnchor line:', anchorLine?.trim());

      // The if condition should use item.active
      expect(output).toContain('if (item.active)');

      // Branch insertion
      expect(output).toContain('__if0_anchor.parentNode.insertBefore');
    } finally {
      cleanupDir(dir);
    }
  });
});
