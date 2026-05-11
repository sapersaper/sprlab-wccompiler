/**
 * Integration tests for wcCompiler v2 — defineModel end-to-end.
 *
 * Tests the full compilation pipeline: parse → tree-walk → codegen
 * for defineModel declarations, coexistence with form model="signal",
 * parent-child WCC binding via model:propName, and multiple defineModel props.
 *
 * Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 5.1, 5.2, 10.1, 10.2, 10.3
 */

import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from './compiler.js';

// ── Helpers ─────────────────────────────────────────────────────────

/** @type {string[]} */
const tempDirs = [];

function createTempDir() {
  const dir = join(
    tmpdir(),
    `wcc-defineModel-integ-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

// ── 1. Full pipeline test ───────────────────────────────────────────

describe('compile() — defineModel full pipeline', () => {
  it('compiles a component with defineModel and verifies complete generated output', async () => {
    const dir = createTempDir();
    const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'wcc-input' })

const value = defineModel({ name: 'value', default: '' })
</script>

<template>
<div>{{value()}}</div>
</template>`;
    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const { code } = await compile(join(dir, 'component.wcc'));

    // 1. observedAttributes includes the prop name (Req 1.1, 3.1)
    expect(code).toContain("observedAttributes");
    expect(code).toMatch(/observedAttributes.*\[.*['"]value['"]/);

    // 2. Model signal initialization (Req 1.2)
    expect(code).toContain("this._m_value = __signal('')");

    // 3. _modelSet_value method with event dispatch (Req 2.2, 2.3)
    expect(code).toContain('_modelSet_value(');
    expect(code).toContain("new CustomEvent('wcc:model'");
    expect(code).toContain("prop: 'value'");
    expect(code).toContain('bubbles: true');
    expect(code).toContain('composed: true');

    // 4. attributeChangedCallback entry for the prop (Req 3.2)
    expect(code).toContain('attributeChangedCallback');
    // The callback should update the signal directly (no _modelSet)
    expect(code).toMatch(/if\s*\(\s*name\s*===\s*'value'\s*\)/);

    // 5. Public getter/setter (Req 3.3)
    expect(code).toContain('get value()');
    expect(code).toContain('set value(');

    // 6. defineModel is stripped from output (Req 1.5)
    expect(code).not.toContain('defineModel');

    // 7. Template effects use _m_ prefix (bug fix: was using this._value() instead of this._m_value())
    expect(code).toContain('this._m_value()');
    expect(code).not.toMatch(/this\._value\(\)/);
  });

  it('template bindings use _m_ prefix for model vars (QA bug fix)', async () => {
    const dir = createTempDir();
    const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'wcc-model-test' })

const modelValue = defineModel({ name: 'modelValue', default: '' })
const count = defineModel({ name: 'count', default: 0 })
</script>

<template>
<p>{{modelValue()}}</p>
<p>{{count()}}</p>
</template>`;
    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const { code } = await compile(join(dir, 'component.wcc'));

    // Template effects MUST use _m_ prefix
    expect(code).toContain('this._m_modelValue()');
    expect(code).toContain('this._m_count()');

    // Must NOT use bare signal name (the bug)
    expect(code).not.toMatch(/this\._modelValue\(\)/);
    expect(code).not.toMatch(/this\._count\(\)/);
  });

  it('compiles a component with defineModel using a numeric default', async () => {
    const dir = createTempDir();
    const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'wcc-counter' })

const count = defineModel({ name: 'count', default: 0 })
</script>

<template>
<span>{{count()}}</span>
</template>`;
    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const { code } = await compile(join(dir, 'component.wcc'));

    // Signal initialized with numeric default
    expect(code).toContain('this._m_count = __signal(0)');

    // attributeChangedCallback should apply Number coercion for numeric defaults
    expect(code).toContain('Number(');

    // Public getter/setter
    expect(code).toContain('get count()');
    expect(code).toContain('set count(');

    // _modelSet method
    expect(code).toContain('_modelSet_count(');
  });

  it('transforms .set() calls to _modelSet in user methods', async () => {
    const dir = createTempDir();
    const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'wcc-setter' })

const value = defineModel({ name: 'value', default: '' })

function updateValue() {
  value.set('new')
}
</script>

<template>
<button @click="updateValue">Update</button>
</template>`;
    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const { code } = await compile(join(dir, 'component.wcc'));

    // .set() should be transformed to _modelSet (Req 2.2)
    expect(code).toContain('this._modelSet_value(');
    // Should NOT contain direct signal write for model vars
    expect(code).not.toMatch(/this\._m_value\(\s*'new'\s*\)/);
  });
});

// ── 2. Coexistence test: defineModel + model="signal" ───────────────

describe('compile() — defineModel coexistence with form model="signal"', () => {
  it('compiles a component with both defineModel and model="signal" on form elements independently', async () => {
    const dir = createTempDir();
    const sfcContent = `<script>
import { defineComponent, defineModel, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-form-model' })

const modelValue = defineModel({ name: 'modelValue', default: '' })
const localInput = signal('')
</script>

<template>
<input model="localInput">
<span>{{modelValue()}}</span>
</template>`;
    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const { code } = await compile(join(dir, 'component.wcc'));

    // Form model binding code is present (Req 10.1)
    expect(code).toContain("addEventListener('input'");
    expect(code).toContain('this._localInput(e.target.value)');
    expect(code).toContain('this.__model0');

    // defineModel code is present (Req 10.2)
    expect(code).toContain("this._m_modelValue = __signal('')");
    expect(code).toContain('_modelSet_modelValue(');
    expect(code).toMatch(/observedAttributes.*\[.*['"]model-value['"]/);

    // Public getter/setter for defineModel prop
    expect(code).toContain('get modelValue()');
    expect(code).toContain('set modelValue(');

    // No interference: form model uses _localInput, defineModel uses _m_modelValue
    // Both should be present without conflict
    expect(code).toContain('this._localInput');
    expect(code).toContain('this._m_modelValue');
  });

  it('form model="signal" still works with checkbox alongside defineModel', async () => {
    const dir = createTempDir();
    const sfcContent = `<script>
import { defineComponent, defineModel, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-check-model' })

const enabled = defineModel({ name: 'enabled', default: false })
const agreed = signal(false)
</script>

<template>
<input type="checkbox" model="agreed">
<span>{{enabled()}}</span>
</template>`;
    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const { code } = await compile(join(dir, 'component.wcc'));

    // Form checkbox model binding
    expect(code).toContain("addEventListener('change'");
    expect(code).toContain('this._agreed(e.target.checked)');

    // defineModel code
    expect(code).toContain('this._m_enabled = __signal(false)');
    expect(code).toContain('_modelSet_enabled(');
  });
});

// ── 3. Parent-child WCC binding via model:propName ──────────────────

describe('compile() — model:propName parent-child WCC binding', () => {
  it('generates bidirectional binding code for model:propName on a child custom element', async () => {
    const dir = createTempDir();
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-parent' })

const searchText = signal('')
</script>

<template>
<wcc-child model:value="searchText"></wcc-child>
</template>`;
    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const { code } = await compile(join(dir, 'component.wcc'));

    // __effect setting child attribute from parent signal (Req 5.1)
    expect(code).toContain('__effect');
    expect(code).toContain("setAttribute('value'");
    expect(code).toContain('this._searchText()');

    // addEventListener('wcc:model', ...) on child element (Req 5.2)
    expect(code).toContain("addEventListener('wcc:model'");
    expect(code).toContain("e.detail.prop === 'value'");

    // Parent signal write in the event handler
    expect(code).toContain('this._searchText(e.detail.value)');

    // model:propName attribute should be removed from template
    expect(code).not.toContain('model:value');
  });

  it('generates binding code when model:propName references a defineModel var', async () => {
    const dir = createTempDir();
    const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'wcc-parent' })

const text = defineModel({ name: 'text', default: '' })
</script>

<template>
<wcc-child model:value="text"></wcc-child>
</template>`;
    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const { code } = await compile(join(dir, 'component.wcc'));

    // Effect should use the model signal reference
    expect(code).toContain('__effect');
    expect(code).toContain("setAttribute('value'");

    // Event listener for wcc:model on child
    expect(code).toContain("addEventListener('wcc:model'");
    expect(code).toContain("e.detail.prop === 'value'");
  });
});

// ── 4. Multiple defineModel props ───────────────────────────────────

describe('compile() — multiple defineModel declarations', () => {
  it('handles multiple defineModel props correctly', async () => {
    const dir = createTempDir();
    const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'wcc-multi' })

const title = defineModel({ name: 'title', default: '' })
const count = defineModel({ name: 'count', default: 0 })
const active = defineModel({ name: 'active', default: false })
</script>

<template>
<div>{{title()}} - {{count()}} - {{active()}}</div>
</template>`;
    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const { code } = await compile(join(dir, 'component.wcc'));

    // All three model signals initialized (Req 1.2, 1.4)
    expect(code).toContain("this._m_title = __signal('')");
    expect(code).toContain('this._m_count = __signal(0)');
    expect(code).toContain('this._m_active = __signal(false)');

    // All three _modelSet methods generated
    expect(code).toContain('_modelSet_title(');
    expect(code).toContain('_modelSet_count(');
    expect(code).toContain('_modelSet_active(');

    // All three in observedAttributes (Req 3.1)
    expect(code).toContain('observedAttributes');
    // Check each prop name appears in the output (kebab-case for multi-word not needed here)
    expect(code).toMatch(/observedAttributes.*title/);
    expect(code).toMatch(/observedAttributes.*count/);
    expect(code).toMatch(/observedAttributes.*active/);

    // All three have public getters/setters (Req 3.3)
    expect(code).toContain('get title()');
    expect(code).toContain('set title(');
    expect(code).toContain('get count()');
    expect(code).toContain('set count(');
    expect(code).toContain('get active()');
    expect(code).toContain('set active(');

    // attributeChangedCallback handles all three
    expect(code).toMatch(/name\s*===\s*'title'/);
    expect(code).toMatch(/name\s*===\s*'count'/);
    expect(code).toMatch(/name\s*===\s*'active'/);

    // defineModel stripped
    expect(code).not.toContain('defineModel');
  });

  it('transforms .set() calls for multiple model props correctly', async () => {
    const dir = createTempDir();
    const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'wcc-multi-set' })

const title = defineModel({ name: 'title', default: '' })
const count = defineModel({ name: 'count', default: 0 })

function reset() {
  title.set('untitled')
  count.set(0)
}
</script>

<template>
<button @click="reset">Reset</button>
</template>`;
    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const { code } = await compile(join(dir, 'component.wcc'));

    // Both .set() calls transformed to _modelSet (Req 2.2)
    expect(code).toContain("this._modelSet_title('untitled')");
    expect(code).toContain('this._modelSet_count(0)');
  });
});
