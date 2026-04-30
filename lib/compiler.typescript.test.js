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
import { parse } from './parser.js';

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

    const tsSource = `import { defineComponent, signal, computed, effect, defineProps, defineEmits } from 'wcc'
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

export default defineComponent({
  tag: 'wcc-ts-counter',
  template: './wcc-ts-counter.html',
  styles: './wcc-ts-counter.css',
})

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
`;

    const template = `<div>
  <span>{{display}}</span>
  <span>{{doubled}}</span>
  <button @click="increment">+</button>
  <button @click="reset">Reset</button>
</div>`;

    const styles = `.container { color: blue; }`;

    writeFileSync(join(dir, 'wcc-ts-counter.ts'), tsSource);
    writeFileSync(join(dir, 'wcc-ts-counter.html'), template);
    writeFileSync(join(dir, 'wcc-ts-counter.css'), styles);

    // Compile
    const output = await compile(join(dir, 'wcc-ts-counter.ts'));

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

  it('parses TypeScript component and extracts props from generic', async () => {
    const dir = createTempDir();

    const tsSource = `import { defineComponent, defineProps } from 'wcc'

export default defineComponent({
  tag: 'wcc-props',
  template: './wcc-props.html',
})

const props = defineProps<{ label: string, count: number, active?: boolean }>()
`;

    writeFileSync(join(dir, 'wcc-props.ts'), tsSource);
    writeFileSync(join(dir, 'wcc-props.html'), '<div>{{label}}</div>');

    const result = await parse(join(dir, 'wcc-props.ts'));

    // Props should be extracted from generic
    expect(result.propDefs).toHaveLength(3);
    expect(result.propDefs.map(p => p.name)).toEqual(['label', 'count', 'active']);
    expect(result.propsObjectName).toBe('props');

    // All defaults should be 'undefined' since no runtime defaults provided
    for (const p of result.propDefs) {
      expect(p.default).toBe('undefined');
    }
  });

  it('parses TypeScript component and extracts emits from generic', async () => {
    const dir = createTempDir();

    const tsSource = `import { defineComponent, defineEmits } from 'wcc'

export default defineComponent({
  tag: 'wcc-emits',
  template: './wcc-emits.html',
})

const emit = defineEmits<{
  (e: 'change', value: number): void;
  (e: 'reset'): void;
  (e: 'submit', data: string): void
}>()
`;

    writeFileSync(join(dir, 'wcc-emits.ts'), tsSource);
    writeFileSync(join(dir, 'wcc-emits.html'), '<div>hello</div>');

    const result = await parse(join(dir, 'wcc-emits.ts'));

    // Emits should be extracted from generic
    expect(result.emits).toEqual(['change', 'reset', 'submit']);
    expect(result.emitsObjectName).toBe('emit');
  });

  it('parses TypeScript component with generic props AND runtime defaults', async () => {
    const dir = createTempDir();

    const tsSource = `import { defineComponent, defineProps } from 'wcc'

export default defineComponent({
  tag: 'wcc-defaults',
  template: './wcc-defaults.html',
})

const props = defineProps<{ label: string, count: number }>({ label: 'Hello', count: 0 })
`;

    writeFileSync(join(dir, 'wcc-defaults.ts'), tsSource);
    writeFileSync(join(dir, 'wcc-defaults.html'), '<div>{{label}}</div>');

    const result = await parse(join(dir, 'wcc-defaults.ts'));

    // Props names from generic, defaults from runtime
    expect(result.propDefs).toHaveLength(2);
    expect(result.propDefs[0].name).toBe('label');
    expect(result.propDefs[1].name).toBe('count');
  });

  it('throws TS_SYNTAX_ERROR for invalid TypeScript', async () => {
    const dir = createTempDir();

    const tsSource = `import { defineComponent } from 'wcc'

export default defineComponent({
  tag: 'wcc-bad',
  template: './wcc-bad.html',
})

const x: [string, = 5;
`;

    writeFileSync(join(dir, 'wcc-bad.ts'), tsSource);
    writeFileSync(join(dir, 'wcc-bad.html'), '<div>hello</div>');

    try {
      await parse(join(dir, 'wcc-bad.ts'));
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.code).toBe('TS_SYNTAX_ERROR');
    }
  });

  it('compiles .js files without error (transparent handling)', async () => {
    const dir = createTempDir();

    const jsSource = `import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'wcc-js',
  template: './wcc-js.html',
})

const count = signal(0)

function increment() {
  count.set(count() + 1)
}
`;

    writeFileSync(join(dir, 'wcc-js.js'), jsSource);
    writeFileSync(join(dir, 'wcc-js.html'), '<div>{{count}}</div>');

    const output = await compile(join(dir, 'wcc-js.js'));
    expect(output).toContain('WccJs');
    expect(output).toContain('increment');
  });
});
