/**
 * Tests for wcCompiler v2 Parser — defineProps feature.
 *
 * Includes:
 * - Unit tests for camelToKebab, generic form, array form, defaults, validation
 * - Property tests for extraction completeness (Property 2) and duplicate detection (Property 7)
 */

import { describe, it, expect, afterEach } from 'vitest';
import fc from 'fast-check';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse, camelToKebab, extractPropsObjectName } from './parser.js';

// ── Helpers ─────────────────────────────────────────────────────────

/** @type {string[]} */
const tempDirs = [];

function createTempDir() {
  const dir = join(
    tmpdir(),
    `wcc-props-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

function writeComponent(dir, tagName, source) {
  writeFileSync(join(dir, `${tagName}.html`), '<div>hello</div>');
  const ext = source.includes(': string') || source.includes(': number') ? 'ts' : 'js';
  const filePath = join(dir, `comp.${ext}`);
  writeFileSync(filePath, source);
  return filePath;
}

// ── camelToKebab ────────────────────────────────────────────────────

describe('camelToKebab', () => {
  it('converts camelCase to kebab-case', () => {
    expect(camelToKebab('itemCount')).toBe('item-count');
  });

  it('passes through lowercase names unchanged', () => {
    expect(camelToKebab('label')).toBe('label');
  });

  it('handles multi-word camelCase', () => {
    expect(camelToKebab('myLongPropName')).toBe('my-long-prop-name');
  });

  it('handles already-kebab names', () => {
    expect(camelToKebab('item-count')).toBe('item-count');
  });

  it('handles single character segments', () => {
    expect(camelToKebab('aB')).toBe('a-b');
  });
});

// ── extractPropsObjectName ──────────────────────────────────────────

describe('extractPropsObjectName', () => {
  it('extracts const assignment', () => {
    expect(extractPropsObjectName("const props = defineProps(['a'])")).toBe('props');
  });

  it('extracts let assignment', () => {
    expect(extractPropsObjectName("let myProps = defineProps(['a'])")).toBe('myProps');
  });

  it('extracts var assignment', () => {
    expect(extractPropsObjectName("var p = defineProps(['a'])")).toBe('p');
  });

  it('extracts from generic form', () => {
    expect(extractPropsObjectName("const props = defineProps<{ label: string }>()")).toBe('props');
  });

  it('returns null when no assignment', () => {
    expect(extractPropsObjectName("defineProps(['a'])")).toBeNull();
  });

  it('returns null when no defineProps', () => {
    expect(extractPropsObjectName("const x = signal(0)")).toBeNull();
  });
});

// ── parse() with defineProps — generic form ─────────────────────────

describe('parse — defineProps generic form', () => {
  it('extracts props with defaults from generic form', async () => {
    const dir = createTempDir();
    const source = `import { defineComponent, defineProps } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const props = defineProps<{ label: string, count: number }>({ label: 'Click', count: 0 })
`;
    const filePath = writeComponent(dir, 'my-comp', source);
    const result = await parse(filePath);

    expect(result.propDefs).toHaveLength(2);
    expect(result.propDefs[0].name).toBe('label');
    expect(result.propDefs[0].attrName).toBe('label');
    // esbuild converts single quotes to double quotes during type stripping
    expect(result.propDefs[0].default).toMatch(/^['"]Click['"]$/);
    expect(result.propDefs[1]).toEqual({ name: 'count', default: '0', attrName: 'count' });
    expect(result.propsObjectName).toBe('props');
  });

  it('extracts props without defaults (undefined)', async () => {
    const dir = createTempDir();
    const source = `import { defineComponent, defineProps } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const props = defineProps<{ label: string }>()
`;
    const filePath = writeComponent(dir, 'my-comp', source);
    const result = await parse(filePath);

    expect(result.propDefs).toHaveLength(1);
    expect(result.propDefs[0].name).toBe('label');
    expect(result.propDefs[0].default).toBe('undefined');
  });

  it('handles camelCase prop names with kebab-case attrName', async () => {
    const dir = createTempDir();
    const source = `import { defineComponent, defineProps } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const props = defineProps<{ itemCount: number }>({ itemCount: 5 })
`;
    const filePath = writeComponent(dir, 'my-comp', source);
    const result = await parse(filePath);

    expect(result.propDefs[0].name).toBe('itemCount');
    expect(result.propDefs[0].attrName).toBe('item-count');
  });
});

// ── parse() with defineProps — array form ───────────────────────────

describe('parse — defineProps array form', () => {
  it('extracts props from array form', async () => {
    const dir = createTempDir();
    const source = `import { defineComponent, defineProps } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const props = defineProps(['label', 'count'])
`;
    const filePath = writeComponent(dir, 'my-comp', source);
    const result = await parse(filePath);

    expect(result.propDefs).toHaveLength(2);
    expect(result.propDefs[0].name).toBe('label');
    expect(result.propDefs[0].default).toBe('undefined');
    expect(result.propDefs[1].name).toBe('count');
    expect(result.propDefs[1].default).toBe('undefined');
    expect(result.propsObjectName).toBe('props');
  });

  it('supports single-quoted and double-quoted strings', async () => {
    const dir = createTempDir();
    const source = `import { defineComponent, defineProps } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const props = defineProps(["label", 'count'])
`;
    const filePath = writeComponent(dir, 'my-comp', source);
    const result = await parse(filePath);

    expect(result.propDefs).toHaveLength(2);
    expect(result.propDefs[0].name).toBe('label');
    expect(result.propDefs[1].name).toBe('count');
  });
});

// ── parse() — validation errors ─────────────────────────────────────

describe('parse — defineProps validation', () => {
  it('throws PROPS_ASSIGNMENT_REQUIRED for bare defineProps call', async () => {
    const dir = createTempDir();
    const source = `import { defineComponent, defineProps } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

defineProps(['label'])
`;
    const filePath = writeComponent(dir, 'my-comp', source);
    try {
      await parse(filePath);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err.code).toBe('PROPS_ASSIGNMENT_REQUIRED');
    }
  });

  it('throws DUPLICATE_PROPS for duplicate prop names', async () => {
    const dir = createTempDir();
    const source = `import { defineComponent, defineProps } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const props = defineProps(['a', 'a'])
`;
    const filePath = writeComponent(dir, 'my-comp', source);
    try {
      await parse(filePath);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err.code).toBe('DUPLICATE_PROPS');
    }
  });

  it('throws PROPS_OBJECT_CONFLICT when propsObjectName matches a signal', async () => {
    const dir = createTempDir();
    const source = `import { defineComponent, defineProps, signal } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const count = signal(0)
const count = defineProps(['label'])
`;
    const filePath = writeComponent(dir, 'my-comp', source);
    try {
      await parse(filePath);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err.code).toBe('PROPS_OBJECT_CONFLICT');
    }
  });
});

// ── parse() — no defineProps ────────────────────────────────────────

describe('parse — no defineProps', () => {
  it('returns empty propDefs and null propsObjectName', async () => {
    const dir = createTempDir();
    const source = `import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const count = signal(0)
`;
    const filePath = writeComponent(dir, 'my-comp', source);
    const result = await parse(filePath);

    expect(result.propDefs).toEqual([]);
    expect(result.propsObjectName).toBeNull();
  });
});

// ── Property Tests ──────────────────────────────────────────────────

/**
 * **Validates: Requirements 1.1, 1.4, 2.1**
 *
 * Property 2: Props Extraction Completeness
 *
 * For any set of distinct valid JS identifiers as prop names declared in a
 * defineProps call, the Parser SHALL extract every prop name exactly once in order.
 *
 * Feature: define-props, Property 2: Props Extraction Completeness
 */
describe('Feature: define-props, Property 2: Props Extraction Completeness', () => {
  const arbPropName = fc
    .stringMatching(/^[a-z][a-zA-Z]{1,8}$/)
    .filter(s => !['if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else', 'enum', 'eval', 'null', 'this', 'true', 'void', 'with', 'const', 'break', 'class', 'super', 'while', 'yield', 'return', 'typeof', 'delete', 'switch', 'export', 'import', 'default', 'signal', 'computed', 'effect', 'props', 'count', 'defineProps', 'defineComponent'].includes(s));

  it('extracts all prop names from array form exactly once in order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(arbPropName, { minLength: 1, maxLength: 6 }),
        async (propNames) => {
          const dir = createTempDir();
          const propsArray = propNames.map(n => `'${n}'`).join(', ');
          const source = `import { defineComponent, defineProps } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const props = defineProps([${propsArray}])
`;
          const filePath = writeComponent(dir, 'my-comp', source);
          const result = await parse(filePath);

          expect(result.propDefs).toHaveLength(propNames.length);
          for (let i = 0; i < propNames.length; i++) {
            expect(result.propDefs[i].name).toBe(propNames[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 4.1**
 *
 * Property 7: Duplicate Props Detection
 *
 * For any prop name array containing at least one duplicate,
 * the Parser SHALL throw a DUPLICATE_PROPS error.
 *
 * Feature: define-props, Property 7: Duplicate Props Detection
 */
describe('Feature: define-props, Property 7: Duplicate Props Detection', () => {
  const arbPropName = fc
    .stringMatching(/^[a-z][a-zA-Z]{1,6}$/)
    .filter(s => !['if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else', 'enum', 'eval', 'null', 'this', 'true', 'void', 'with', 'const', 'break', 'class', 'super', 'while', 'yield', 'return', 'typeof', 'delete', 'switch', 'export', 'import', 'default', 'signal', 'computed', 'effect', 'props', 'defineProps', 'defineComponent'].includes(s));

  it('throws DUPLICATE_PROPS when prop names contain duplicates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.uniqueArray(arbPropName, { minLength: 1, maxLength: 4 }),
          arbPropName
        ).map(([unique, dup]) => {
          // Ensure dup is in the array, then add it again
          const base = unique.includes(dup) ? unique : [dup, ...unique];
          // Insert the duplicate at a random position
          return [...base, dup];
        }),
        async (propNames) => {
          const dir = createTempDir();
          const propsArray = propNames.map(n => `'${n}'`).join(', ');
          const source = `import { defineComponent, defineProps } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const props = defineProps([${propsArray}])
`;
          const filePath = writeComponent(dir, 'my-comp', source);
          try {
            await parse(filePath);
            expect.unreachable('Should have thrown DUPLICATE_PROPS');
          } catch (err) {
            expect(err.code).toBe('DUPLICATE_PROPS');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
