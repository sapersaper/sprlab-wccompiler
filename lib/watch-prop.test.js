/**
 * Tests for watch(() => props.x) with framework integration pattern.
 *
 * Bug: When a framework sets an attribute before connectedCallback,
 * the watcher should detect the change and fire the callback.
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { JSDOM, VirtualConsole } from 'jsdom';
import { compile } from './compiler.js';

function createTempDir() {
  const dir = join(tmpdir(), `wcc-watch-prop-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('watch(() => props.x) — framework integration pattern', () => {
  it('watcher fires when attribute is set before connectedCallback', async () => {
    const dir = createTempDir();
    try {
      const sfc = `<script>
import { defineComponent, signal, watch, defineProps } from 'wcc'

export default defineComponent({ tag: 'wcc-controlled' })

const props = defineProps({ value: '' })
const internal = signal('')

watch(() => props.value, (newVal, oldVal) => {
  internal.set(newVal)
})
</script>

<template>
<span>{{internal()}}</span>
</template>
`;
      writeFileSync(join(dir, 'test.wcc'), sfc);
      const { code } = await compile(join(dir, 'test.wcc'));

      // Verify the generated code initializes __prev_watch0 with the default value
      expect(code).toContain("this.__prev_watch0 = ''");

      // Simulate framework pattern: createElement → setAttribute → appendChild
      const virtualConsole = new VirtualConsole();
      const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'http://localhost',
        runScripts: 'dangerously',
        virtualConsole,
      });

      const scriptEl = dom.window.document.createElement('script');
      scriptEl.textContent = code;
      dom.window.document.head.appendChild(scriptEl);

      // 1. createElement (no DOM manipulation in constructor)
      const el = dom.window.document.createElement('wcc-controlled');
      expect(el.children.length).toBe(0);

      // 2. setAttribute BEFORE connecting (framework pattern)
      el.setAttribute('value', 'Hello from framework');

      // 3. Connect to DOM (triggers connectedCallback)
      dom.window.document.body.appendChild(el);

      // 4. The watcher should have fired and synced internal signal
      // The span should show the value
      const span = el.querySelector('span');
      expect(span.textContent).toBe('Hello from framework');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('watcher does NOT fire when attribute matches default (no change)', async () => {
    const dir = createTempDir();
    try {
      const sfc = `<script>
import { defineComponent, signal, watch, defineProps } from 'wcc'

export default defineComponent({ tag: 'wcc-nofire' })

const props = defineProps({ value: '' })
const fireCount = signal(0)

watch(() => props.value, (newVal, oldVal) => {
  fireCount.set(fireCount() + 1)
})
</script>

<template>
<span>{{fireCount()}}</span>
</template>
`;
      writeFileSync(join(dir, 'test.wcc'), sfc);
      const { code } = await compile(join(dir, 'test.wcc'));

      const virtualConsole = new VirtualConsole();
      const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'http://localhost',
        runScripts: 'dangerously',
        virtualConsole,
      });

      const scriptEl = dom.window.document.createElement('script');
      scriptEl.textContent = code;
      dom.window.document.head.appendChild(scriptEl);

      // createElement without setting attribute (value stays at default '')
      const el = dom.window.document.createElement('wcc-nofire');
      dom.window.document.body.appendChild(el);

      // Watcher should NOT have fired (value is still the default)
      const span = el.querySelector('span');
      expect(span.textContent).toBe('0');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('watch(signal, cb) on a prop also detects pre-connection changes', async () => {
    const dir = createTempDir();
    try {
      const sfc = `<script>
import { defineComponent, signal, watch, defineProps } from 'wcc'

export default defineComponent({ tag: 'wcc-direct-watch' })

const props = defineProps({ count: 0 })
const lastChange = signal('')

watch(count, (newVal, oldVal) => {
  lastChange.set(oldVal + ' -> ' + newVal)
})
</script>

<template>
<span>{{lastChange()}}</span>
</template>
`;
      writeFileSync(join(dir, 'test.wcc'), sfc);
      const { code } = await compile(join(dir, 'test.wcc'));

      // For direct signal watch on a prop, __prev should be initialized with default
      expect(code).toContain('this.__prev_count = 0');

      const virtualConsole = new VirtualConsole();
      const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'http://localhost',
        runScripts: 'dangerously',
        virtualConsole,
      });

      const scriptEl = dom.window.document.createElement('script');
      scriptEl.textContent = code;
      dom.window.document.head.appendChild(scriptEl);

      const el = dom.window.document.createElement('wcc-direct-watch');
      el.setAttribute('count', '5');
      dom.window.document.body.appendChild(el);

      // Watcher should have fired: 0 -> 5
      const span = el.querySelector('span');
      expect(span.textContent).toBe('0 -> 5');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
