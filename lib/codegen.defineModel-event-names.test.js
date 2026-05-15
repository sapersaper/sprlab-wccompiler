import { describe, it, expect } from 'vitest';
import { compile } from './compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const createTempDir = () => {
  const dir = join(tmpdir(), `wcc-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
};

describe('BUG-0006: defineModel event naming - kebab-case convention', () => {
  
  it('should emit events in kebab-case format for single model', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'test-event-naming' })

const username = defineModel({ name: 'username', default: '' })
</script>

<template>
<input model="username" />
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // Should emit kebab-case event (username-changed)
      expect(code).toContain("dispatchEvent(new CustomEvent('username-changed'");
      
      // Should NOT emit camelCase event (usernameChange)
      expect(code).not.toContain("dispatchEvent(new CustomEvent('usernameChange'");
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  it('should emit kebab-case events for multiple models with different types', async () => {
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

      // All events should use kebab-case
      expect(code).toContain("dispatchEvent(new CustomEvent('username-changed'");
      expect(code).toContain("dispatchEvent(new CustomEvent('age-changed'");
      expect(code).toContain("dispatchEvent(new CustomEvent('agree-changed'");
      
      // None should use camelCase
      expect(code).not.toContain("dispatchEvent(new CustomEvent('usernameChange'");
      expect(code).not.toContain("dispatchEvent(new CustomEvent('ageChange'");
      expect(code).not.toContain("dispatchEvent(new CustomEvent('agreeChange'");
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  it('should convert camelCase model names to kebab-case events', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'test-camelcase' })

const userName = defineModel({ name: 'userName', default: '' })
const firstName = defineModel({ name: 'firstName', default: '' })
</script>

<template>
<input model="userName" />
<input model="firstName" />
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // camelCase should be converted to kebab-case
      // userName → user-name-changed
      // firstName → first-name-changed
      expect(code).toContain("dispatchEvent(new CustomEvent('user-name-changed'");
      expect(code).toContain("dispatchEvent(new CustomEvent('first-name-changed'");
      
      // Should NOT have camelCase events
      expect(code).not.toContain("dispatchEvent(new CustomEvent('userNameChange'");
      expect(code).not.toContain("dispatchEvent(new CustomEvent('firstNameChange'");
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  it('should still emit generic wcc:model event', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'test-generic-event' })

const value = defineModel({ name: 'value', default: '' })
</script>

<template>
<input model="value" />
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // Generic wcc:model event should still be present
      expect(code).toContain("dispatchEvent(new CustomEvent('wcc:model'");
      
      // And specific kebab-case event should also be present
      expect(code).toContain("dispatchEvent(new CustomEvent('value-changed'");
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  it('should handle single-letter capitalization correctly', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'test-single-letter' })

const aValue = defineModel({ name: 'aValue', default: '' })
const xCoord = defineModel({ name: 'xCoord', default: 0 })
</script>

<template>
<input model="aValue" />
<input model="xCoord" type="number" />
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // Single letter capitals should be handled correctly
      // aValue → a-value-changed
      // xCoord → x-coord-changed
      expect(code).toContain("dispatchEvent(new CustomEvent('a-value-changed'");
      expect(code).toContain("dispatchEvent(new CustomEvent('x-coord-changed'");
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  it('event dispatching should include correct detail and bubbles properties', async () => {
    const dir = createTempDir();
    try {
      const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'test-event-structure' })

const count = defineModel({ name: 'count', default: 0 })
</script>

<template>
<input model="count" type="number" />
</template>`;

      const filePath = join(dir, 'component.wcc');
      writeFileSync(filePath, sfcContent);

      const { code } = await compile(filePath);

      // Verify event structure is correct
      expect(code).toMatch(/dispatchEvent\(new CustomEvent\('count-changed',\s*\{\s*detail:\s*newVal,\s*bubbles:\s*true\s*\}\)/);
      
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

});
