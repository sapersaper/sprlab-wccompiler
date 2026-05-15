/**
 * Test for BUG-0009: Multi-Property Style Binding Invalid Syntax
 * 
 * Verifies that :style bindings with multiple properties generate valid JavaScript
 */

import { describe, it, expect } from 'vitest';
import { compile } from '../lib/compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const createTempDir = () => {
  const dir = join(tmpdir(), `wcc-style-binding-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
};

describe('BUG-0009: Multi-Property Style Binding', () => {
  
  it('should generate valid syntax for single property style binding', async () => {
    const dir = createTempDir();
    try {
      const content = `<script>
import { defineComponent, signal } from 'wcc'

const textColor = signal('red')

export default defineComponent({
  tag: 'test-single-style',
})
</script>

<template>
  <div :style="{ color: textColor() }">
    Styled Text
  </div>
</template>`;

      const filePath = join(dir, 'test-single-style.wcc');
      writeFileSync(filePath, content);

      const result = await compile(filePath);
      
      expect(result.code).toBeDefined();
      expect(result.code).not.toContain('Error compiling');
      
      // Verify the generated code has valid syntax by checking it doesn't have function calls as keys
      // Should NOT have patterns like: this._textColor(): this._textColor()
      expect(result.code).not.toMatch(/this\._\w+\(\)\s*:/);
      
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should generate valid syntax for multi-property style binding', async () => {
    const dir = createTempDir();
    try {
      const content = `<script>
import { defineComponent, signal } from 'wcc'

const textColor = signal('red')
const fontSize = signal(16)

export default defineComponent({
  tag: 'test-multi-style',
})
</script>

<template>
  <div :style="{ color: textColor(), fontSize: fontSize() + 'px' }">
    Styled Text
  </div>
</template>`;

      const filePath = join(dir, 'test-multi-style.wcc');
      writeFileSync(filePath, content);

      const result = await compile(filePath);
      
      expect(result.code).toBeDefined();
      expect(result.code).not.toContain('Error compiling');
      
      // CRITICAL: Should NOT generate invalid syntax like: this._fontSize(): this._fontSize()
      // This is the main bug - function calls cannot be used as object keys
      expect(result.code).not.toMatch(/this\._\w+\(\)\s*:/);
      
      // Should have proper object literal with string keys or identifier keys
      expect(result.code).toContain('color:');
      expect(result.code).toContain('fontSize:');
      
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should handle mixed static and dynamic style properties', async () => {
    const dir = createTempDir();
    try {
      const content = `<script>
import { defineComponent, signal } from 'wcc'

const size = signal(16)

export default defineComponent({
  tag: 'test-mixed-style',
})
</script>

<template>
  <div :style="{ color: 'red', fontSize: size() + 'px', fontWeight: 'bold' }">
    Mixed Styles
  </div>
</template>`;

      const filePath = join(dir, 'test-mixed-style.wcc');
      writeFileSync(filePath, content);

      const result = await compile(filePath);
      
      expect(result.code).toBeDefined();
      expect(result.code).not.toContain('Error compiling');
      
      // Should NOT have function calls as keys
      expect(result.code).not.toMatch(/this\._\w+\(\)\s*:/);
      
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should handle kebab-case CSS properties in style bindings', async () => {
    const dir = createTempDir();
    try {
      const content = `<script>
import { defineComponent, signal } from 'wcc'

const fontSize = signal(16)
const fontWeight = signal('bold')

export default defineComponent({
  tag: 'test-kebab-style',
})
</script>

<template>
  <div :style="{ 'font-size': fontSize() + 'px', 'font-weight': fontWeight() }">
    Kebab Case Styles
  </div>
</template>`;

      const filePath = join(dir, 'test-kebab-style.wcc');
      writeFileSync(filePath, content);

      const result = await compile(filePath);
      
      expect(result.code).toBeDefined();
      expect(result.code).not.toContain('Error compiling');
      
      // Should NOT have function calls as keys
      expect(result.code).not.toMatch(/this\._\w+\(\)\s*:/);
      
      // Should preserve kebab-case keys as strings
      expect(result.code).toContain("'font-size'");
      expect(result.code).toContain("'font-weight'");
      
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should handle complex expressions in style values', async () => {
    const dir = createTempDir();
    try {
      const content = `<script>
import { defineComponent, signal } from 'wcc'

const angle = signal(45)

export default defineComponent({
  tag: 'test-complex-style',
})
</script>

<template>
  <div :style="{ transform: \`rotate(\${angle()}deg)\` }">
    Complex Expression
  </div>
</template>`;

      const filePath = join(dir, 'test-complex-style.wcc');
      writeFileSync(filePath, content);

      const result = await compile(filePath);
      
      expect(result.code).toBeDefined();
      expect(result.code).not.toContain('Error compiling');
      
      // Should NOT have function calls as keys
      expect(result.code).not.toMatch(/this\._\w+\(\)\s*:/);
      
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

});
