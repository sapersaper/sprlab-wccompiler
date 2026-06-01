/**
 * Slot syntax — tests all variants compile correctly without errors.
 *
 * Covers BUG-0008 (template slot syntax) regression tests consolidated
 * from: template-slot-coverage, template-slot-integration,
 *       template-slot-syntax, slot-syntax-regression, qa-component-test
 */

import { describe, it, expect } from 'vitest';
import { compile } from '../lib/compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const createTempDir = () => {
  const dir = join(tmpdir(), `wcc-slot-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
};

function makeChild(extra = '') {
  return `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'slot-child' })
</script>
<template>
  <div>
    <slot name="header">Default Header</slot>
    <slot>Default content</slot>
  </div>
</template>`;
}

describe('Slot syntax — compilation', () => {
  it('compiles component with no slots', async () => {
    const dir = createTempDir();
    try {
      const path = join(dir, 'c.wcc');
      writeFileSync(path, `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'no-slots' })
</script>
<template><div><p>No slots here</p></div></template>`);
      const { code } = await compile(path);
      expect(code.length).toBeGreaterThan(100);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('compiles <template slot="name"> without errors', async () => {
    const dir = createTempDir();
    try {
      const childPath = join(dir, 'child.wcc');
      const parentPath = join(dir, 'parent.wcc');
      writeFileSync(childPath, makeChild());
      writeFileSync(parentPath, `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'p' })
</script>
<template>
  <slot-child>
    <template slot="header"><h4>Header</h4></template>
    <p>Default content</p>
    <template slot="footer"><button>Footer</button></template>
  </slot-child>
</template>`);
      const { code } = await compile(parentPath);
      expect(code).not.toContain('Error');
      expect(code).not.toContain('duplicate');
      expect(code).toContain('slot');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('compiles <template #name> shorthand without errors', async () => {
    const dir = createTempDir();
    try {
      const childPath = join(dir, 'child.wcc');
      const parentPath = join(dir, 'parent.wcc');
      writeFileSync(childPath, makeChild());
      writeFileSync(parentPath, `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'p' })
</script>
<template>
  <slot-child>
    <template #header><h4>Header via #</h4></template>
    <p>Default content</p>
  </slot-child>
</template>`);
      const { code } = await compile(parentPath);
      expect(code).not.toContain('Error');
      expect(code).not.toContain('duplicate');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('compiles <div slot="name"> for backward compatibility', async () => {
    const dir = createTempDir();
    try {
      const childPath = join(dir, 'child.wcc');
      const parentPath = join(dir, 'parent.wcc');
      writeFileSync(childPath, makeChild());
      writeFileSync(parentPath, `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'p' })
</script>
<template>
  <slot-child>
    <div slot="header"><h4>Header via div</h4></div>
    <p>Default content</p>
  </slot-child>
</template>`);
      const { code } = await compile(parentPath);
      expect(code).not.toContain('Error');
      expect(code).not.toContain('duplicate');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('compiles mixed slot syntaxes in same component', async () => {
    const dir = createTempDir();
    try {
      const childPath = join(dir, 'child.wcc');
      const parentPath = join(dir, 'parent.wcc');
      writeFileSync(childPath, `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'slot-child' })
</script>
<template>
  <div>
    <slot name="header">H</slot>
    <slot name="body">B</slot>
    <slot name="footer">F</slot>
  </div>
</template>`);
      writeFileSync(parentPath, `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'p' })
</script>
<template>
  <slot-child>
    <template #header><h4># header</h4></template>
    <div slot="body"><p>div body</p></div>
    <template slot="footer"><button>template footer</button></template>
  </slot-child>
</template>`);
      const { code } = await compile(parentPath);
      expect(code).not.toContain('Error');
      expect(code).not.toContain('duplicate');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('compiles multiple named slots (5+)', async () => {
    const dir = createTempDir();
    try {
      const childPath = join(dir, 'child.wcc');
      const parentPath = join(dir, 'parent.wcc');
      writeFileSync(childPath, `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'slot-child' })
</script>
<template>${[1,2,3,4,5].map(n => `    <slot name="slot${n}"></slot>`).join('\n')}
</template>`);
      writeFileSync(parentPath, `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'p' })
</script>
<template>
  <slot-child>
${[1,2,3,4,5].map(n => `    <template slot="slot${n}"><span>${n}</span></template>`).join('\n')}
  </slot-child>
</template>`);
      const { code } = await compile(parentPath);
      expect(code.length).toBeGreaterThan(100);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('compiles default slot with direct children', async () => {
    const dir = createTempDir();
    try {
      const childPath = join(dir, 'child.wcc');
      const parentPath = join(dir, 'parent.wcc');
      writeFileSync(childPath, `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'slot-child' })
</script>
<template><div><slot>Default</slot></div></template>`);
      writeFileSync(parentPath, `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'p' })
</script>
<template>
  <slot-child><p>Custom default</p></slot-child>
</template>`);
      const { code } = await compile(parentPath);
      expect(code).not.toContain('Error');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('compiles nested components with template slots', async () => {
    const dir = createTempDir();
    try {
      const grandchildPath = join(dir, 'gc.wcc');
      const childPath = join(dir, 'child.wcc');
      const parentPath = join(dir, 'parent.wcc');
      writeFileSync(grandchildPath, `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'g-child' })
</script>
<template><div><slot name="content"></slot></div></template>`);
      writeFileSync(childPath, `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'child' })
</script>
<template>
  <div>
    <g-child><template slot="content"><span>Nested</span></template></g-child>
    <slot name="body"></slot>
  </div>
</template>`);
      writeFileSync(parentPath, `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'p' })
</script>
<template>
  <child><template slot="body"><p>Body</p></template></child>
</template>`);
      const { code } = await compile(parentPath);
      expect(code).not.toContain('Error');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('compiles slot with complex HTML content', async () => {
    const dir = createTempDir();
    try {
      const childPath = join(dir, 'child.wcc');
      const parentPath = join(dir, 'parent.wcc');
      writeFileSync(childPath, `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'slot-child' })
</script>
<template><div><slot name="main"></slot></div></template>`);
      writeFileSync(parentPath, `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'p' })
</script>
<template>
  <slot-child>
    <template slot="main">
      <div class="wrapper"><h2>Title</h2><ul><li>A</li><li>B</li></ul></div>
    </template>
  </slot-child>
</template>`);
      const { code } = await compile(parentPath);
      expect(code).toContain('slot');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('compiles slot with nested if directive inside template slot', async () => {
    const dir = createTempDir();
    try {
      const childPath = join(dir, 'child.wcc');
      const parentPath = join(dir, 'parent.wcc');
      writeFileSync(childPath, `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'slot-child' })
</script>
<template><div><slot name="content"></slot></div></template>`);
      writeFileSync(parentPath, `<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'p' })
const show = signal(true)
</script>
<template>
  <slot-child>
    <template slot="content">
      <div if="show()"><p>Conditional content</p></div>
    </template>
  </slot-child>
</template>`);
      const { code } = await compile(parentPath);
      expect(code).not.toContain('Error');
      expect(code).not.toContain('duplicate');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('compiles slot with style blocks in both parent and child', async () => {
    const dir = createTempDir();
    try {
      const childPath = join(dir, 'child.wcc');
      const parentPath = join(dir, 'parent.wcc');
      writeFileSync(childPath, `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'slot-child' })
</script>
<template><div class="c"><slot name="content"></slot></div></template>
<style>.c { padding: 10px; }</style>`);
      writeFileSync(parentPath, `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'p' })
</script>
<template>
  <slot-child>
    <template slot="content"><p>Styled</p></template>
  </slot-child>
</template>
<style>p { color: blue; }</style>`);
      const { code: childCode } = await compile(childPath);
      const { code: parentCode } = await compile(parentPath);
      expect(childCode).toBeDefined();
      expect(parentCode).toBeDefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('compiles the exact QA component from BUG-0008 report', async () => {
    const dir = createTempDir();
    try {
      const childPath = join(dir, 'child.wcc');
      const parentPath = join(dir, 'parent.wcc');
      writeFileSync(childPath, `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'test-slot-child' })
</script>
<template>
  <div class="slot-container">
    <header><slot name="header"><h3>Default Header</h3></slot></header>
    <main><slot>Default content</slot></main>
    <footer><slot name="footer"><p>Default Footer</p></slot></footer>
  </div>
</template>`);
      writeFileSync(parentPath, `<script>
import { defineComponent } from 'wcc'
export default defineComponent({ tag: 'test-template-slot-syntax' })
</script>
<template>
  <div class="template-slot-test">
    <test-slot-child>
      <template slot="header"><h4>Header</h4></template>
      <p>Default</p>
      <template slot="footer"><button>Footer</button></template>
    </test-slot-child>
    <test-slot-child>
      <template slot="header"><h4>H</h4></template>
      <div slot="body"><p>Body mixed</p></div>
      <template slot="footer"><p>F</p></template>
    </test-slot-child>
    <test-slot-child>
      <template slot="header"><h4>A</h4><p>B</p><span>C</span></template>
      <p>Default</p>
      <template slot="footer"><button>1</button><button>2</button></template>
    </test-slot-child>
  </div>
</template>
<style>
.template-slot-test { border: 2px solid #4caf50; padding: 15px; }
</style>`);
      const { code: childCode } = await compile(childPath);
      const { code: parentCode } = await compile(parentPath);
      expect(childCode.length).toBeGreaterThan(100);
      expect(parentCode.length).toBeGreaterThan(100);
      expect(childCode).not.toContain('Error');
      expect(parentCode).not.toContain('Error');
      expect(parentCode).not.toContain('duplicate');
      expect(parentCode).toContain('slot');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
