import { describe, it, expect } from 'vitest';
import { parse } from './parser.js';

// ── Task 2.1: Block extraction & name derivation ────────────────────

describe('parse — block extraction (task 2.1)', () => {
  it('extracts <template>, <script>, <style> from a valid source', () => {
    const html = `
<template>
  <div>{{msg}}</div>
</template>

<script>
  const msg = 'hello'
</script>

<style>
  div { color: red; }
</style>`;

    const ir = parse(html, 'my-comp.html');
    expect(ir.template).toContain('<div>{{msg}}</div>');
    expect(ir.script).toBe("const msg = 'hello'");
    expect(ir.style).toBe('div { color: red; }');
  });

  it('derives tagName and className correctly', () => {
    const html = '<template><p>hi</p></template>';
    const ir = parse(html, 'spr-hi.html');
    expect(ir.tagName).toBe('spr-hi');
    expect(ir.className).toBe('SprHi');
  });

  it('works when fileName has no .html extension', () => {
    const html = '<template><p>hi</p></template>';
    const ir = parse(html, 'wcc-button');
    expect(ir.tagName).toBe('wcc-button');
    expect(ir.className).toBe('WccButton');
  });

  it('throws MISSING_TEMPLATE when <template> is absent', () => {
    const html = '<script>const x = 1</script>';
    expect(() => parse(html, 'no-tpl.html')).toThrowError(/el bloque <template> es obligatorio/);
    try {
      parse(html, 'no-tpl.html');
    } catch (e) {
      expect(e.code).toBe('MISSING_TEMPLATE');
    }
  });

  it('treats missing <script> as empty', () => {
    const html = '<template><p>hi</p></template>';
    const ir = parse(html, 'no-script');
    expect(ir.script).toBe('');
    expect(ir.props).toEqual([]);
    expect(ir.reactiveVars).toEqual([]);
  });

  it('treats missing <style> as empty', () => {
    const html = '<template><p>hi</p></template>';
    const ir = parse(html, 'no-style');
    expect(ir.style).toBe('');
  });

  it('leaves tree-walker fields empty', () => {
    const html = '<template><p>hi</p></template>';
    const ir = parse(html, 'test-comp');
    expect(ir.bindings).toEqual([]);
    expect(ir.events).toEqual([]);
    expect(ir.slots).toEqual([]);
    expect(ir.processedTemplate).toBeNull();
  });
});

// ── Task 2.2: Script-level construct extraction ─────────────────────

describe('parse — props extraction (task 2.2)', () => {
  it('extracts props from defineProps', () => {
    const html = `<template><p>hi</p></template>
<script>
  defineProps(['value', 'label'])
</script>`;
    const ir = parse(html, 'test');
    expect(ir.props).toEqual(['value', 'label']);
  });

  it('returns empty props when no defineProps', () => {
    const html = `<template><p>hi</p></template>
<script>
  const x = 1
</script>`;
    const ir = parse(html, 'test');
    expect(ir.props).toEqual([]);
  });

  it('throws DUPLICATE_PROPS on duplicates', () => {
    const html = `<template><p>hi</p></template>
<script>
  defineProps(['a', 'b', 'a'])
</script>`;
    expect(() => parse(html, 'dup.html')).toThrowError(/props duplicados: a/);
    try {
      parse(html, 'dup.html');
    } catch (e) {
      expect(e.code).toBe('DUPLICATE_PROPS');
    }
  });
});

describe('parse — reactive variables (task 2.2)', () => {
  it('extracts root-level const/let/var declarations', () => {
    const html = `<template><p>hi</p></template>
<script>
  const msg = 'hello'
  let count = 0
  var flag = true
</script>`;
    const ir = parse(html, 'test');
    expect(ir.reactiveVars).toEqual([
      { name: 'msg', value: "'hello'" },
      { name: 'count', value: '0' },
      { name: 'flag', value: 'true' },
    ]);
  });

  it('excludes computed and watch assignments', () => {
    const html = `<template><p>hi</p></template>
<script>
  const msg = 'hello'
  const full = computed(() => msg + '!')
  watch('msg', (n, o) => { console.log(n) })
</script>`;
    const ir = parse(html, 'test');
    expect(ir.reactiveVars).toEqual([{ name: 'msg', value: "'hello'" }]);
  });

  it('excludes variables inside functions (nested blocks)', () => {
    const html = `<template><p>hi</p></template>
<script>
  const root = 'yes'
  function doStuff() {
    const nested = 'no'
  }
</script>`;
    const ir = parse(html, 'test');
    expect(ir.reactiveVars).toEqual([{ name: 'root', value: "'yes'" }]);
  });
});

describe('parse — computeds (task 2.2)', () => {
  it('extracts computed declarations', () => {
    const html = `<template><p>hi</p></template>
<script>
  const fullLabel = computed(() => prefix + ' - ' + value)
</script>`;
    const ir = parse(html, 'test');
    expect(ir.computeds).toEqual([
      { name: 'fullLabel', body: "prefix + ' - ' + value" },
    ]);
  });
});

describe('parse — watchers (task 2.2)', () => {
  it('extracts watcher declarations', () => {
    const html = `<template><p>hi</p></template>
<script>
  watch('value', (newVal, oldVal) => {
    console.log('changed:', oldVal, '->', newVal)
  })
</script>`;
    const ir = parse(html, 'test');
    expect(ir.watchers).toHaveLength(1);
    expect(ir.watchers[0].target).toBe('value');
    expect(ir.watchers[0].newParam).toBe('newVal');
    expect(ir.watchers[0].oldParam).toBe('oldVal');
    expect(ir.watchers[0].body).toContain("console.log('changed:'");
  });
});

describe('parse — functions (task 2.2)', () => {
  it('extracts function declarations', () => {
    const html = `<template><p>hi</p></template>
<script>
  function handleClick() {
    emit('on-click', value)
  }

  function greet(name) {
    console.log('hi', name)
  }
</script>`;
    const ir = parse(html, 'test');
    expect(ir.methods).toHaveLength(2);
    expect(ir.methods[0].name).toBe('handleClick');
    expect(ir.methods[0].params).toBe('');
    expect(ir.methods[0].body).toContain("emit('on-click', value)");
    expect(ir.methods[1].name).toBe('greet');
    expect(ir.methods[1].params).toBe('name');
  });
});

// ── Integration: parse the example spr-hi.html content ──────────────

describe('parse — spr-hi.html integration', () => {
  const sprHiHtml = `
<template>
  <div class="counter">{{value}}</div>
  <div class="info">segundo: {{prefix}} {{value2}}</div>
  <div>{{internalValue}}</div>
  <div>computed: {{fullLabel}}</div>
  <div class="slot-area">
    <slot name="title">Default title</slot>
  </div>
  <div class="slot-area">
    <slot name="info" :count="value" :label="prefix">Default info</slot>
  </div>
  <slot>Default content</slot>
  <button @click="handleClick">Click me</button>
  <button @click="handleInternal">cambiar adentro</button>
</template>

<style>
  .counter {
    color: red;
    font-size: 24px;
    font-weight: bold;
  }

  .info {
    color: blue;
  }

  .slot-area {
    border: 1px solid #ccc;
    padding: 8px;
    margin: 4px 0;
  }

  button {
    padding: 8px 16px;
    cursor: pointer;
  }
</style>

<script>
  defineProps(['value', 'value2'])

  const prefix = 'el prefix'
  const internalValue = 'hola desde adentro'

  const fullLabel = computed(() => prefix + ' - ' + value + '/' + value2)

  watch('value', (newVal, oldVal) => {
    console.log('value cambió:', oldVal, '->', newVal)
  })

  function handleClick() {
    emit('on-click', internalValue)
  }

  function handleInternal() {
    const internalValue = 'chau'
  }
</script>
`;

  it('extracts all constructs from spr-hi.html', () => {
    const ir = parse(sprHiHtml, 'spr-hi.html');

    expect(ir.tagName).toBe('spr-hi');
    expect(ir.className).toBe('SprHi');
    expect(ir.template).toContain('{{value}}');
    expect(ir.style).toContain('.counter');
    expect(ir.props).toEqual(['value', 'value2']);
    expect(ir.reactiveVars).toEqual([
      { name: 'prefix', value: "'el prefix'" },
      { name: 'internalValue', value: "'hola desde adentro'" },
    ]);
    expect(ir.computeds).toEqual([
      { name: 'fullLabel', body: "prefix + ' - ' + value + '/' + value2" },
    ]);
    expect(ir.watchers).toHaveLength(1);
    expect(ir.watchers[0].target).toBe('value');
    expect(ir.methods).toHaveLength(2);
    expect(ir.methods[0].name).toBe('handleClick');
    expect(ir.methods[1].name).toBe('handleInternal');
  });
});
