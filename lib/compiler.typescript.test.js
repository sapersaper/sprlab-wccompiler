/**
 * Integration test: End-to-end compiler test with TypeScript
 *
 * Creates a temp TypeScript component with: type annotations, interface,
 * defineProps<T>(), defineEmits<T>(), signal<number>(), computed<string>(),
 * type-only imports, as const, enum. Compiles and verifies output.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 3.1, 4.1, 5.1, 5.2, 5.3
 */

import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from './compiler.js';
import { parseSFC } from './sfc-parser.js';
import {
  extractPropsGeneric,
  extractPropsObjectName,
  extractEmitsFromCallSignatures,
  extractEmitsObjectNameFromGeneric,
  extractPropsDefaults,
} from './parser-extractors.js';
import { stripTypes } from './parser.js';

// ── Helpers ─────────────────────────────────────────────────────────

/** @type {string[]} */
const tempDirs = [];

function createTempDir() {
  const dir = join(
    tmpdir(),
    `wcc-ts-int-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

// ── Integration tests ───────────────────────────────────────────────

describe('TypeScript integration — end-to-end compiler', () => {
  it('compiles a full TypeScript component with all TS features', async () => {
    const dir = createTempDir();

    const sfcContent = `<script lang="ts">
import { defineComponent, signal, computed, effect, defineProps, defineEmits } from 'wcc'
import type { SomeType } from './types'

interface CounterConfig {
  step: number;
  max: number;
}

type CounterState = 'idle' | 'counting';

enum Direction {
  Up = 'up',
  Down = 'down',
}

export default defineComponent({ tag: 'wcc-ts-counter' })

const props = defineProps<{ label: string, step?: number }>({ step: 1 })

const emit = defineEmits<{
  (e: 'change', value: number): void;
  (e: 'reset'): void
}>()

const count = signal<number>(0)
const direction = signal<string>('up')

const doubled = computed<number>(() => count() * 2)
const display = computed<string>(() => \`Count: \${count()}\`)

const config = { maxCount: 100 } as const

effect(() => {
  console.log(count())
})

function increment() {
  count.set(count() + 1)
  emit('change', count())
}

function reset() {
  count.set(0)
  emit('reset')
}
</script>

<template>
<div>
  <span>{{display()}}</span>
  <span>{{doubled()}}</span>
  <button @click="increment">+</button>
  <button @click="reset">Reset</button>
</div>
</template>

<style>
.container { color: blue; }
</style>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    // Compile
    const { code: output } = await compile(join(dir, 'component.wcc'));

    // Output should be valid JavaScript (no TypeScript syntax)
    expect(output).not.toContain('interface ');
    expect(output).not.toMatch(/\btype\s+\w+\s*=/);
    expect(output).not.toContain('import type');
    expect(output).not.toContain('as const');
    expect(output).not.toMatch(/\benum\b/);
    expect(output).not.toContain('<number>');
    expect(output).not.toContain('<string>');
    expect(output).not.toContain('sourceMappingURL');

    // Output should contain the component class
    expect(output).toContain('WccTsCounter');
    expect(output).toContain('wcc-ts-counter');

    // Output should contain runtime code
    expect(output).toContain('increment');
    expect(output).toContain('reset');
    expect(output).toContain('console.log');
  });

  it('parses TypeScript SFC component and extracts props from generic', async () => {
    const dir = createTempDir();

    const sfcContent = `<script lang="ts">
import { defineComponent, defineProps } from 'wcc'

export default defineComponent({ tag: 'wcc-props' })

const props = defineProps<{ label: string, count: number, active?: boolean }>()
</script>

<template>
<div>{{label}}</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    // Parse the SFC and extract props manually (mirrors what compile() does internally)
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(join(dir, 'component.wcc'), 'utf-8');
    const descriptor = parseSFC(source, 'component.wcc');

    const propsFromGeneric = extractPropsGeneric(descriptor.script);
    const propsObjectName = extractPropsObjectName(descriptor.script);
    const propsDefaults = extractPropsDefaults(descriptor.script);

    // Props should be extracted from generic
    expect(propsFromGeneric).toHaveLength(3);
    expect(propsFromGeneric).toEqual(['label', 'count', 'active']);
    expect(propsObjectName).toBe('props');

    // All defaults should be 'undefined' since no runtime defaults provided
    for (const name of propsFromGeneric) {
      expect(propsDefaults[name] ?? 'undefined').toBe('undefined');
    }
  });

  it('parses TypeScript SFC component and extracts emits from generic', async () => {
    const dir = createTempDir();

    const sfcContent = `<script lang="ts">
import { defineComponent, defineEmits } from 'wcc'

export default defineComponent({ tag: 'wcc-emits' })

const emit = defineEmits<{
  (e: 'change', value: number): void;
  (e: 'reset'): void;
  (e: 'submit', data: string): void
}>()
</script>

<template>
<div>hello</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const { readFileSync } = await import('node:fs');
    const source = readFileSync(join(dir, 'component.wcc'), 'utf-8');
    const descriptor = parseSFC(source, 'component.wcc');

    const emitsFromCallSignatures = extractEmitsFromCallSignatures(descriptor.script);
    const emitsObjectName = extractEmitsObjectNameFromGeneric(descriptor.script);

    // Emits should be extracted from generic
    expect(emitsFromCallSignatures).toEqual(['change', 'reset', 'submit']);
    expect(emitsObjectName).toBe('emit');
  });

  it('parses TypeScript SFC component with generic props AND runtime defaults', async () => {
    const dir = createTempDir();

    const sfcContent = `<script lang="ts">
import { defineComponent, defineProps } from 'wcc'

export default defineComponent({ tag: 'wcc-defaults' })

const props = defineProps<{ label: string, count: number }>({ label: 'Hello', count: 0 })
</script>

<template>
<div>{{label}}</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const { readFileSync } = await import('node:fs');
    const source = readFileSync(join(dir, 'component.wcc'), 'utf-8');
    const descriptor = parseSFC(source, 'component.wcc');

    const propsFromGeneric = extractPropsGeneric(descriptor.script);

    // Props names from generic
    expect(propsFromGeneric).toHaveLength(2);
    expect(propsFromGeneric[0]).toBe('label');
    expect(propsFromGeneric[1]).toBe('count');

    // Strip types first, then extract defaults (mirrors what compile() does internally)
    const strippedScript = await stripTypes(descriptor.script);
    const propsDefaults = extractPropsDefaults(strippedScript);

    // Defaults should be extracted after type stripping
    expect(propsDefaults['label']).toBeDefined();
    expect(propsDefaults['count']).toBeDefined();
  });

  it('throws TS_SYNTAX_ERROR for invalid TypeScript', async () => {
    const tsSource = `import { defineComponent } from 'wcc'

export default defineComponent({ tag: 'wcc-bad' })

const x: [string, = 5;
`;

    try {
      await stripTypes(tsSource);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.code).toBe('TS_SYNTAX_ERROR');
    }
  });

  it('compiles .wcc files without error (transparent handling)', async () => {
    const dir = createTempDir();

    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-js' })

const count = signal(0)

function increment() {
  count.set(count() + 1)
}
</script>

<template>
<div>{{count()}}</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);

    const { code: output } = await compile(join(dir, 'component.wcc'));
    expect(output).toContain('WccJs');
    expect(output).toContain('increment');
  });
});
