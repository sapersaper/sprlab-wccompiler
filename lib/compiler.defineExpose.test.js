/**
 * Tests for defineExpose — exposes properties/methods on the element.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { compile } from './compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const TMP = resolve(import.meta.dirname, '__tmp_expose_test__');

function writeWcc(name, content) {
  const path = resolve(TMP, name);
  writeFileSync(path, content);
  return path;
}

describe('defineExpose', () => {
  beforeAll(() => mkdirSync(TMP, { recursive: true }));
  afterAll(() => rmSync(TMP, { recursive: true, force: true }));

  it('exposes a computed as a getter', async () => {
    const path = writeWcc('expose-computed.wcc', `
<script>
import { defineComponent, signal, computed, defineExpose } from 'wcc'
export default defineComponent({ tag: 'wcc-expose-computed' })
const count = signal(5)
const doubled = computed(() => count() * 2)
defineExpose({ doubled })
</script>
<template><div>{{doubled()}}</div></template>
`);
    const { code: output } = await compile(path);
    expect(output).toContain('get doubled() { return this._c_doubled(); }');
  });

  it('exposes a signal as a getter', async () => {
    const path = writeWcc('expose-signal.wcc', `
<script>
import { defineComponent, signal, defineExpose } from 'wcc'
export default defineComponent({ tag: 'wcc-expose-signal' })
const count = signal(0)
defineExpose({ count })
</script>
<template><div>{{count()}}</div></template>
`);
    const { code: output } = await compile(path);
    expect(output).toContain('get count() { return this._count(); }');
  });

  it('exposes a method as a public method', async () => {
    const path = writeWcc('expose-method.wcc', `
<script>
import { defineComponent, signal, defineExpose } from 'wcc'
export default defineComponent({ tag: 'wcc-expose-method' })
const count = signal(0)
function increment() { count.set(count() + 1) }
defineExpose({ increment })
</script>
<template><div>{{count()}}</div></template>
`);
    const { code: output } = await compile(path);
    expect(output).toContain('increment(...args) { return this._increment(...args); }');
  });

  it('exposes multiple properties of different types', async () => {
    const path = writeWcc('expose-multi.wcc', `
<script>
import { defineComponent, signal, computed, defineExpose } from 'wcc'
export default defineComponent({ tag: 'wcc-expose-multi' })
const count = signal(0)
const doubled = computed(() => count() * 2)
const LABEL = 'hello'
function reset() { count.set(0) }
defineExpose({ count, doubled, LABEL, reset })
</script>
<template><div>{{count()}}</div></template>
`);
    const { code: output } = await compile(path);
    expect(output).toContain('get count() { return this._count(); }');
    expect(output).toContain('get doubled() { return this._c_doubled(); }');
    expect(output).toContain('get LABEL() { return this._const_LABEL; }');
    expect(output).toContain('reset(...args) { return this._reset(...args); }');
  });

  it('produces no expose code when defineExpose is not used', async () => {
    const path = writeWcc('no-expose.wcc', `
<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'wcc-no-expose' })
const count = signal(0)
</script>
<template><div>{{count()}}</div></template>
`);
    const { code: output } = await compile(path);
    expect(output).not.toContain('defineExpose');
    expect(output).not.toMatch(/^\s*get count\(\)/m);
  });
});
