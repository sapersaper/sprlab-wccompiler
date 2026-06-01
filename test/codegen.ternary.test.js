/**
 * Ternary expressions — tests for ternary in templates, both with signals and props.
 *
 * Consolidated from: BUG-0003 (ternary-inline-props), BUG-0004 (ternary-expression),
 * BUG-0018 (ternary-expressions).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { compile } from '../lib/compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Ternary expressions', () => {
  let dir;

  beforeEach(() => {
    dir = join(tmpdir(), `wcc-ternary-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe('with signals', () => {
    it('compiles simple ternary in text interpolation', async () => {
      const path = join(dir, 'c.wcc');
      writeFileSync(path, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const active = signal(true)
</script>
<template><div>{{ active() ? 'Active' : 'Inactive' }}</div></template>`);
      const { code } = await compile(path);
      expect(code).not.toMatch(/'Active'\(\)/);
      expect(code).not.toMatch(/'Inactive'\(\)/);
      expect(code).toContain('__invalidate(key)');
    });

    it('compiles nested ternary', async () => {
      const path = join(dir, 'c.wcc');
      writeFileSync(path, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const s = signal('a')
</script>
<template><div>{{ s() === 'a' ? 'A' : s() === 'b' ? 'B' : 'C' }}</div></template>`);
      const { code } = await compile(path);
      expect(code).not.toMatch(/[A-C]'\(\)/);
    });

    it('compiles ternary with function call', async () => {
      const path = join(dir, 'c.wcc');
      writeFileSync(path, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const v = signal(42)
function fmt(v) { return 'V:'+v }
</script>
<template><div>{{ v() ? fmt(v()) : 'default' }}</div></template>`);
      const { code } = await compile(path);
      expect(code).not.toMatch(/'default'\(\)/);
    });

    it('compiles ternary in :class binding', async () => {
      const path = join(dir, 'c.wcc');
      writeFileSync(path, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const a = signal(false)
</script>
<template><div :class="a() ? 'active' : 'inactive'">X</div></template>`);
      const { code } = await compile(path);
      expect(code).not.toMatch(/'active'\(\)/);
      expect(code).toContain('.className =');
    });

    it('compiles ternary in nested each loops', async () => {
      const path = join(dir, 'c.wcc');
      writeFileSync(path, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const cats = signal([{id:1,items:[{n:'a',ok:true}]}])
</script>
<template>
<div each="cat in cats()">
  <span each="item in cat.items">{{ item.ok ? 'ok' : 'nok' }}</span>
</div></template>`);
      const { code } = await compile(path);
      expect(code).not.toMatch(/[?]:[^;]+\?\?/);
    });

    it('no invalid ??? pattern in ternary', async () => {
      const path = join(dir, 'c.wcc');
      writeFileSync(path, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const v = signal(10)
</script>
<template><div>{{ v() > 10 ? 'High' : 'Low' }}</div></template>`);
      const { code } = await compile(path);
      expect(code).not.toMatch(/[?]:[^;]+\?\?/);
    });
  });

  describe('with props', () => {
    it('compiles props ternary in text interpolation', async () => {
      const path = join(dir, 'c.wcc');
      writeFileSync(path, `<script>
import { defineComponent, defineProps } from 'wcc'
export default defineComponent({ tag: 't' })
const p = defineProps({ active: false })
</script>
<template><p>{{p.active ? 'Active' : 'Inactive'}}</p></template>`);
      const { code } = await compile(path);
      expect(code).not.toMatch(/this\._s_active \?/);
      expect(code).not.toMatch(/'Inactive'\(\)/);
    });

    it('compiles props ternary with equality comparison', async () => {
      const path = join(dir, 'c.wcc');
      writeFileSync(path, `<script>
import { defineComponent, defineProps } from 'wcc'
export default defineComponent({ tag: 't' })
const p = defineProps({ status: 'idle' })
</script>
<template><p>{{p.status === 'loading' ? 'Loading' : 'Ready'}}</p></template>`);
      const { code } = await compile(path);
      expect(code).not.toMatch(/this\._s_status ===/);
    });

    it('compiles props ternary with multiple props', async () => {
      const path = join(dir, 'c.wcc');
      writeFileSync(path, `<script>
import { defineComponent, defineProps } from 'wcc'
export default defineComponent({ tag: 't' })
const p = defineProps({ count: 0, max: 10 })
</script>
<template><p>{{p.count > p.max ? 'Over' : 'OK'}}</p></template>`);
      const { code } = await compile(path);
      expect(code).toContain('this._state.count');
      expect(code).toContain('this._state.max');
    });

    it('compiles props ternary with logical operators', async () => {
      const path = join(dir, 'c.wcc');
      writeFileSync(path, `<script>
import { defineComponent, defineProps } from 'wcc'
export default defineComponent({ tag: 't' })
const p = defineProps({ active: false, visible: true })
</script>
<template><p>{{p.active && p.visible ? 'Show' : 'Hide'}}</p></template>`);
      const { code } = await compile(path);
      expect(code).toContain('__invalidate(key)');
    });

    it('compiles props ternary with negation', async () => {
      const path = join(dir, 'c.wcc');
      writeFileSync(path, `<script>
import { defineComponent, defineProps } from 'wcc'
export default defineComponent({ tag: 't' })
const p = defineProps({ disabled: false })
</script>
<template><p>{{!p.disabled ? 'Enabled' : 'Disabled'}}</p></template>`);
      const { code } = await compile(path);
      expect(code).toContain('__invalidate(key)');
    });

    it('compiles props ternary inside if-block branches', async () => {
      const path = join(dir, 'c.wcc');
      writeFileSync(path, `<script>
import { defineComponent, defineProps, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const p = defineProps({ active: false })
const show = signal(true)
</script>
<template>
<div if="show()"><p>{{p.active ? 'ON' : 'OFF'}}</p></div>
</template>`);
      const { code } = await compile(path);
      expect(code).not.toMatch(/this\._s_active \? 'ON'/);
    });

    it('compiles props ternary mixed with signals', async () => {
      const path = join(dir, 'c.wcc');
      writeFileSync(path, `<script>
import { defineComponent, defineProps, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const p = defineProps({ active: false })
const c = signal(0)
</script>
<template><p>{{p.active ? c() : 'N/A'}}</p></template>`);
      const { code } = await compile(path);
      expect(code).not.toMatch(/this\._s_active \?/);
    });
  });

  describe('logical and nullish operators', () => {
    it('compiles logical OR expression', async () => {
      const path = join(dir, 'c.wcc');
      writeFileSync(path, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const c = signal(0)
</script>
<template><div>{{ c() || 'No items' }}</div></template>`);
      const { code } = await compile(path);
      expect(code).toContain('__invalidate(key)');
    });

    it('compiles logical AND expression', async () => {
      const path = join(dir, 'c.wcc');
      writeFileSync(path, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const f = signal(true)
const v = signal('x')
</script>
<template><div>{{ f() && v() }}</div></template>`);
      const { code } = await compile(path);
      expect(code).toContain('__invalidate(key)');
    });

    it('compiles nullish coalescing expression', async () => {
      const path = join(dir, 'c.wcc');
      writeFileSync(path, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 't' })
const v = signal(null)
const fb = signal('default')
</script>
<template><div>{{ v() ?? fb() }}</div></template>`);
      const { code } = await compile(path);
      expect(code).toContain('__invalidate(key)');
    });
  });
});
