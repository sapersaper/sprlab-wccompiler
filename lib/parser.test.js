import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parse,
  stripMacroImport,
  toClassName,
  extractSignals,
  extractComputeds,
  extractEffects,
  extractFunctions,
} from './parser.js';

// ── Helper: create temp component files ─────────────────────────────

function createTempDir() {
  const dir = join(tmpdir(), `wcc-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

// ── stripMacroImport ────────────────────────────────────────────────

describe('stripMacroImport', () => {
  it('removes import from wcc', () => {
    const input = `import { signal, computed } from 'wcc'\nconst x = signal(0)`;
    const result = stripMacroImport(input);
    expect(result).not.toContain("from 'wcc'");
    expect(result).toContain('const x = signal(0)');
  });

  it('removes import from @sprlab/wccompiler', () => {
    const input = `import { defineComponent } from '@sprlab/wccompiler';\nconst x = 1;`;
    const result = stripMacroImport(input);
    expect(result).not.toContain("from '@sprlab/wccompiler'");
    expect(result).toContain('const x = 1;');
  });

  it('leaves non-macro imports untouched', () => {
    const input = `import { foo } from 'bar';\nconst x = 1;`;
    const result = stripMacroImport(input);
    expect(result).toContain("import { foo } from 'bar'");
  });
});

// ── toClassName ─────────────────────────────────────────────────────

describe('toClassName', () => {
  it('converts kebab-case to PascalCase', () => {
    expect(toClassName('wcc-counter')).toBe('WccCounter');
  });

  it('handles multi-segment names', () => {
    expect(toClassName('my-cool-widget')).toBe('MyCoolWidget');
  });

  it('handles single segment', () => {
    expect(toClassName('counter')).toBe('Counter');
  });
});

// ── extractSignals ──────────────────────────────────────────────────

describe('extractSignals', () => {
  it('extracts simple signal', () => {
    const signals = extractSignals('const count = signal(0)');
    expect(signals).toEqual([{ name: 'count', value: '0' }]);
  });

  it('extracts signal with nested parens', () => {
    const signals = extractSignals('const items = signal([1, 2, 3])');
    expect(signals).toEqual([{ name: 'items', value: '[1, 2, 3]' }]);
  });

  it('extracts signal with string value', () => {
    const signals = extractSignals("const name = signal('hello')");
    expect(signals).toEqual([{ name: 'name', value: "'hello'" }]);
  });

  it('extracts multiple signals', () => {
    const source = `const a = signal(1)\nconst b = signal('two')`;
    const signals = extractSignals(source);
    expect(signals).toHaveLength(2);
    expect(signals[0].name).toBe('a');
    expect(signals[1].name).toBe('b');
  });

  it('extracts signal with empty args as undefined', () => {
    const signals = extractSignals('const x = signal()');
    expect(signals).toEqual([{ name: 'x', value: 'undefined' }]);
  });
});

// ── extractComputeds ────────────────────────────────────────────────

describe('extractComputeds', () => {
  it('extracts computed declaration', () => {
    const computeds = extractComputeds('const doubled = computed(() => count() * 2)');
    expect(computeds).toEqual([{ name: 'doubled', body: 'count() * 2' }]);
  });

  it('extracts multiple computeds', () => {
    const source = `const a = computed(() => x() + 1)\nconst b = computed(() => y() * 2)`;
    const computeds = extractComputeds(source);
    expect(computeds).toHaveLength(2);
  });
});

// ── extractEffects ──────────────────────────────────────────────────

describe('extractEffects', () => {
  it('extracts single-line effect', () => {
    const effects = extractEffects("effect(() => {\n  console.log('hi')\n})");
    expect(effects).toHaveLength(1);
    expect(effects[0].body).toContain("console.log('hi')");
  });

  it('extracts multi-line effect', () => {
    const source = `effect(() => {
  const x = count()
  console.log(x)
})`;
    const effects = extractEffects(source);
    expect(effects).toHaveLength(1);
    expect(effects[0].body).toContain('const x = count()');
    expect(effects[0].body).toContain('console.log(x)');
  });
});

// ── extractFunctions ────────────────────────────────────────────────

describe('extractFunctions', () => {
  it('extracts function declaration', () => {
    const fns = extractFunctions('function increment() {\n  count.set(count() + 1)\n}');
    expect(fns).toHaveLength(1);
    expect(fns[0].name).toBe('increment');
    expect(fns[0].params).toBe('');
    expect(fns[0].body).toContain('count.set(count() + 1)');
  });

  it('extracts function with params', () => {
    const fns = extractFunctions('function add(a, b) {\n  return a + b\n}');
    expect(fns).toHaveLength(1);
    expect(fns[0].name).toBe('add');
    expect(fns[0].params).toBe('a, b');
  });
});

// ── parse (integration) ─────────────────────────────────────────────

describe('parse', () => {
  it('parses a minimal JS component', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'counter.html'), '<div>{{count}}</div>');
      writeFileSync(
        join(dir, 'counter.js'),
        `import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'wcc-counter',
  template: './counter.html',
})

const count = signal(0)

function increment() {
  count.set(count() + 1)
}
`
      );

      const result = await parse(join(dir, 'counter.js'));
      expect(result.tagName).toBe('wcc-counter');
      expect(result.className).toBe('WccCounter');
      expect(result.template).toBe('<div>{{count}}</div>');
      expect(result.style).toBe('');
      expect(result.signals).toEqual([{ name: 'count', value: '0' }]);
      expect(result.methods).toHaveLength(1);
      expect(result.methods[0].name).toBe('increment');
      expect(result.bindings).toEqual([]);
      expect(result.events).toEqual([]);
      expect(result.processedTemplate).toBeNull();
    } finally {
      cleanupDir(dir);
    }
  });

  it('parses a component with styles', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'comp.html'), '<div>hello</div>');
      writeFileSync(join(dir, 'comp.css'), '.container { color: red; }');
      writeFileSync(
        join(dir, 'comp.js'),
        `import { defineComponent } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './comp.html',
  styles: './comp.css',
})
`
      );

      const result = await parse(join(dir, 'comp.js'));
      expect(result.tagName).toBe('my-comp');
      expect(result.style).toBe('.container { color: red; }');
    } finally {
      cleanupDir(dir);
    }
  });

  it('parses a TS component and strips types', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'counter.html'), '<div>{{count}}</div>');
      writeFileSync(
        join(dir, 'counter.ts'),
        `import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'wcc-counter',
  template: './counter.html',
})

const count = signal(0)
`
      );

      const result = await parse(join(dir, 'counter.ts'));
      expect(result.tagName).toBe('wcc-counter');
      expect(result.signals).toEqual([{ name: 'count', value: '0' }]);
    } finally {
      cleanupDir(dir);
    }
  });

  it('throws MISSING_DEFINE_COMPONENT when not found', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'bad.js'), 'const x = 1;');
      await expect(parse(join(dir, 'bad.js'))).rejects.toThrow();
      try {
        await parse(join(dir, 'bad.js'));
      } catch (err) {
        expect(err.code).toBe('MISSING_DEFINE_COMPONENT');
      }
    } finally {
      cleanupDir(dir);
    }
  });

  it('throws TEMPLATE_NOT_FOUND when template missing', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(
        join(dir, 'comp.js'),
        `defineComponent({ tag: 'my-comp', template: './missing.html' })`
      );
      try {
        await parse(join(dir, 'comp.js'));
      } catch (err) {
        expect(err.code).toBe('TEMPLATE_NOT_FOUND');
      }
    } finally {
      cleanupDir(dir);
    }
  });

  it('throws STYLES_NOT_FOUND when styles file missing', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'comp.html'), '<div>hi</div>');
      writeFileSync(
        join(dir, 'comp.js'),
        `defineComponent({ tag: 'my-comp', template: './comp.html', styles: './missing.css' })`
      );
      try {
        await parse(join(dir, 'comp.js'));
      } catch (err) {
        expect(err.code).toBe('STYLES_NOT_FOUND');
      }
    } finally {
      cleanupDir(dir);
    }
  });

  it('extracts computeds and effects', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'comp.html'), '<div>{{doubled}}</div>');
      writeFileSync(
        join(dir, 'comp.js'),
        `defineComponent({ tag: 'my-comp', template: './comp.html' })

const count = signal(0)
const doubled = computed(() => count() * 2)

effect(() => {
  console.log(count())
})
`
      );

      const result = await parse(join(dir, 'comp.js'));
      expect(result.signals).toHaveLength(1);
      expect(result.computeds).toHaveLength(1);
      expect(result.computeds[0].name).toBe('doubled');
      expect(result.effects).toHaveLength(1);
      expect(result.effects[0].body).toContain('console.log(count())');
    } finally {
      cleanupDir(dir);
    }
  });
});
