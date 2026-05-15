/**
 * Tests for defineModel wrapper method generation — BUG-0005 fix.
 *
 * This test file verifies that the compiler generates wrapper methods
 * (e.g., _username(), _age()) for each defineModel declaration.
 *
 * These wrapper methods act as dual-purpose getter/setter functions:
 * - As getter (no args): returns signal value
 * - As setter (with arg): updates signal and dispatches events
 *
 * **Validates: Bug #0005 Fix**
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
    `wcc-wrapper-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

describe('defineModel wrapper method generation', () => {
  
  it('should generate wrapper method for single string model', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'test-single-model' })

const username = defineModel({ name: 'username', default: '' })
</script>

<template>
<input model="username" />
<p>{{ username() }}</p>
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // Verify wrapper method is generated
      expect(code).toMatch(/_username\s*\(\s*val\s*\)\s*\{/);
      
      // Verify wrapper has getter logic (returns signal value)
      expect(code).toContain('return this._m_username()');
      
      // Verify wrapper has setter logic (calls _modelSet_*)
      expect(code).toContain('this._modelSet_username(val)');
      
      // Verify internal signal exists
      expect(code).toContain('this._m_username = __signal(');
      
      // Verify model setter with events exists
      expect(code).toContain('_modelSet_username(');
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('should generate wrapper methods for multiple models with different types', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'test-multi-model' })

const username = defineModel({ name: 'username', default: '' })
const age = defineModel({ name: 'age', default: 0 })
const agree = defineModel({ name: 'agree', default: false })
</script>

<template>
<input model="username" />
<input model="age" type="number" />
<input model="agree" type="checkbox" />
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // Verify all three wrapper methods are generated
      expect(code).toMatch(/_username\s*\(\s*val\s*\)\s*\{/);
      expect(code).toMatch(/_age\s*\(\s*val\s*\)\s*\{/);
      expect(code).toMatch(/_agree\s*\(\s*val\s*\)\s*\{/);
      
      // Verify each wrapper has correct getter logic
      expect(code).toContain('return this._m_username()');
      expect(code).toContain('return this._m_age()');
      expect(code).toContain('return this._m_agree()');
      
      // Verify each wrapper has correct setter logic
      expect(code).toContain('this._modelSet_username(val)');
      expect(code).toContain('this._modelSet_age(val)');
      expect(code).toContain('this._modelSet_agree(val)');
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('should generate wrapper method with arguments.length check for dual getter/setter behavior', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'test-dual-behavior' })

const value = defineModel({ name: 'value', default: 'test' })
</script>

<template>
<input model="value" />
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // Verify wrapper uses arguments.length to distinguish getter vs setter
      expect(code).toMatch(/if\s*\(\s*arguments\.length\s*===\s*0\s*\)/);
      
      // Verify getter branch returns signal value
      expect(code).toMatch(/return\s+this\._m_value\s*\(\s*\)/);
      
      // Verify setter branch calls _modelSet_*
      expect(code).toMatch(/this\._modelSet_value\s*\(\s*val\s*\)/);
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('wrapper methods should be called in template text bindings', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'test-text-binding' })

const name = defineModel({ name: 'name', default: 'World' })
</script>

<template>
<p>Hello {{ name() }}!</p>
<input model="name" />
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // When there's a model= binding, wrapper method should be used
      expect(code).toContain('this.__model_name_0.value = this._name()');
      expect(code).toContain("addEventListener('input'");
      expect(code).toContain('this._name(e.target.value)');
      
      // Verify wrapper method exists
      expect(code).toMatch(/_name\s*\(\s*val\s*\)\s*\{/);
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('wrapper methods should be called in model bindings (value assignment)', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'test-model-value' })

const email = defineModel({ name: 'email', default: '' })
</script>

<template>
<input model="email" type="email" />
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // Verify model binding reads from wrapper method
      expect(code).toContain('this.__model_email_0.value = this._email()');
      
      // Verify event listener calls wrapper as setter
      expect(code).toContain("addEventListener('input'");
      expect(code).toContain('this._email(e.target.value)');
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('wrapper methods should work with checkbox (checked property)', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'test-checkbox' })

const enabled = defineModel({ name: 'enabled', default: false })
</script>

<template>
<input model="enabled" type="checkbox" />
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // Verify checkbox binding uses wrapper
      expect(code).toContain('this.__model_enabled_0.checked = !!this._enabled()');
      
      // Verify change event listener calls wrapper as setter
      expect(code).toContain("addEventListener('change'");
      expect(code).toContain('this._enabled(e.target.checked)');
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('wrapper methods should integrate with existing _modelSet_* methods', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'test-integration' })

const count = defineModel({ name: 'count', default: 0 })
</script>

<template>
<input model="count" type="number" />
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // Verify _modelSet_* method exists
      expect(code).toMatch(/_modelSet_count\s*\(\s*newVal\s*\)\s*\{/);
      
      // Verify wrapper calls _modelSet_*
      expect(code).toContain('this._modelSet_count(val)');
      
      // Verify _modelSet_* dispatches events
      expect(code).toContain("dispatchEvent(new CustomEvent('wcc:model'");
      expect(code).toContain("dispatchEvent(new CustomEvent('count-changed'");
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('should NOT generate wrapper methods when there are no defineModel declarations', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-no-models' })

const count = signal(0)
</script>

<template>
<p>{{ count() }}</p>
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // Should NOT have wrapper methods section
      expect(code).not.toContain('// --- Model wrapper methods ---');
      
      // Should NOT have _modelSet_* methods
      expect(code).not.toMatch(/_modelSet_\w+\(/);
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('should generate wrapper methods with correct naming for camelCase model names', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'test-camelcase' })

const userName = defineModel({ name: 'userName', default: '' })
const isActive = defineModel({ name: 'isActive', default: false })
</script>

<template>
<input model="userName" />
<input model="isActive" type="checkbox" />
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // Verify wrapper methods use exact model names (camelCase preserved)
      expect(code).toMatch(/_userName\s*\(\s*val\s*\)\s*\{/);
      expect(code).toMatch(/_isActive\s*\(\s*val\s*\)\s*\{/);
      
      // Verify internal signals match
      expect(code).toContain('this._m_userName = __signal(');
      expect(code).toContain('this._m_isActive = __signal(');
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('wrapper methods should be placed after _modelSet_* methods in generated code', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'test-order' })

const value = defineModel({ name: 'value', default: '' })
</script>

<template>
<input model="value" />
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // Find positions of _modelSet_* and wrapper method
      const modelSetIndex = code.indexOf('_modelSet_value(');
      const wrapperIndex = code.indexOf('_value(val) {');
      
      // Wrapper should come AFTER _modelSet_*
      expect(wrapperIndex).toBeGreaterThan(modelSetIndex);
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('wrapper methods should work with select element', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'test-select' })

const country = defineModel({ name: 'country', default: '' })
</script>

<template>
<select model="country">
  <option value="us">US</option>
  <option value="uk">UK</option>
</select>
<p>{{ country() }}</p>
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // Verify wrapper is used for select binding
      expect(code).toContain('this._country(');
      
      // Verify wrapper method exists
      expect(code).toMatch(/_country\s*\(\s*val\s*\)\s*\{/);
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('wrapper methods should work with textarea element', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'test-textarea' })

const bio = defineModel({ name: 'bio', default: '' })
</script>

<template>
<textarea model="bio"></textarea>
<p>{{ bio() }}</p>
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // Verify wrapper is used for textarea binding
      expect(code).toContain('this._bio(');
      
      // Verify wrapper method exists
      expect(code).toMatch(/_bio\s*\(\s*val\s*\)\s*\{/);
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

});
