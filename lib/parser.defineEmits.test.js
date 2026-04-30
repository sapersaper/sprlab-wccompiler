/**
 * Tests for wcCompiler v2 Parser — defineEmits feature.
 *
 * Includes:
 * - Unit tests for array form, call signatures form, validation errors
 * - Property tests for round-trip (Property 1), bare call detection (Property 2),
 *   duplicate detection (Property 3), conflict detection (Property 4),
 *   undeclared emit detection (Property 5)
 */

import { describe, it, expect, afterEach } from 'vitest';
import fc from 'fast-check';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse, extractEmitsObjectName } from './parser.js';
import { prettyPrint } from './printer.js';

// ── Helpers ─────────────────────────────────────────────────────────

/** @type {string[]} */
const tempDirs = [];

function createTempDir() {
  const dir = join(
    tmpdir(),
    `wcc-emits-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
  const ext = source.includes(': string') || source.includes(': number') || source.includes(': void') ? 'ts' : 'js';
  const filePath = join(dir, `comp.${ext}`);
  writeFileSync(filePath, source);
  return filePath;
}

// ── extractEmitsObjectName ──────────────────────────────────────────

describe('extractEmitsObjectName', () => {
  it('extracts const assignment', () => {
    expect(extractEmitsObjectName("const emit = defineEmits(['change'])")).toBe('emit');
  });

  it('extracts let assignment', () => {
    expect(extractEmitsObjectName("let fire = defineEmits(['change'])")).toBe('fire');
  });

  it('extracts var assignment', () => {
    expect(extractEmitsObjectName("var e = defineEmits(['change'])")).toBe('e');
  });

  it('returns null when no assignment', () => {
    expect(extractEmitsObjectName("defineEmits(['change'])")).toBeNull();
  });

  it('returns null when no defineEmits', () => {
    expect(extractEmitsObjectName("const x = signal(0)")).toBeNull();
  });
});

// ── parse() with defineEmits — array form ───────────────────────────

describe('parse — defineEmits array form', () => {
  it('extracts event names from array form', async () => {
    const dir = createTempDir();
    const source = `import { defineComponent, defineEmits } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const emit = defineEmits(['change', 'reset'])
`;
    const filePath = writeComponent(dir, 'my-comp', source);
    const result = await parse(filePath);

    expect(result.emits).toEqual(['change', 'reset']);
    expect(result.emitsObjectName).toBe('emit');
  });

  it('supports single-quoted and double-quoted strings', async () => {
    const dir = createTempDir();
    const source = `import { defineComponent, defineEmits } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const emit = defineEmits(["change", 'reset'])
`;
    const filePath = writeComponent(dir, 'my-comp', source);
    const result = await parse(filePath);

    expect(result.emits).toEqual(['change', 'reset']);
  });

  it('preserves order of event names', async () => {
    const dir = createTempDir();
    const source = `import { defineComponent, defineEmits } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const emit = defineEmits(['zebra', 'alpha', 'middle'])
`;
    const filePath = writeComponent(dir, 'my-comp', source);
    const result = await parse(filePath);

    expect(result.emits).toEqual(['zebra', 'alpha', 'middle']);
  });
});

// ── parse() with defineEmits — call signatures form ─────────────────

describe('parse — defineEmits call signatures form', () => {
  it('extracts event names from TypeScript call signatures', async () => {
    const dir = createTempDir();
    const source = `import { defineComponent, defineEmits } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const emit = defineEmits<{ (e: 'change', value: number): void; (e: 'reset'): void }>()
`;
    const filePath = writeComponent(dir, 'my-comp', source);
    const result = await parse(filePath);

    expect(result.emits).toEqual(['change', 'reset']);
    expect(result.emitsObjectName).toBe('emit');
  });

  it('supports double-quoted strings in call signatures', async () => {
    const dir = createTempDir();
    const source = `import { defineComponent, defineEmits } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const emit = defineEmits<{ (e: "change"): void; (e: "reset"): void }>()
`;
    const filePath = writeComponent(dir, 'my-comp', source);
    const result = await parse(filePath);

    expect(result.emits).toEqual(['change', 'reset']);
  });
});

// ── parse() — validation errors ─────────────────────────────────────

describe('parse — defineEmits validation', () => {
  it('throws EMITS_ASSIGNMENT_REQUIRED for bare defineEmits call', async () => {
    const dir = createTempDir();
    const source = `import { defineComponent, defineEmits } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

defineEmits(['change'])
`;
    const filePath = writeComponent(dir, 'my-comp', source);
    try {
      await parse(filePath);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err.code).toBe('EMITS_ASSIGNMENT_REQUIRED');
    }
  });

  it('throws DUPLICATE_EMITS for duplicate event names', async () => {
    const dir = createTempDir();
    const source = `import { defineComponent, defineEmits } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const emit = defineEmits(['change', 'change'])
`;
    const filePath = writeComponent(dir, 'my-comp', source);
    try {
      await parse(filePath);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err.code).toBe('DUPLICATE_EMITS');
    }
  });

  it('throws EMITS_OBJECT_CONFLICT when emitsObjectName matches a signal', async () => {
    const dir = createTempDir();
    const source = `import { defineComponent, defineEmits, signal } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const count = signal(0)
const count = defineEmits(['change'])
`;
    const filePath = writeComponent(dir, 'my-comp', source);
    try {
      await parse(filePath);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err.code).toBe('EMITS_OBJECT_CONFLICT');
    }
  });

  it('throws EMITS_OBJECT_CONFLICT when emitsObjectName matches propsObjectName', async () => {
    const dir = createTempDir();
    const source = `import { defineComponent, defineProps, defineEmits } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const props = defineProps(['label'])
const props = defineEmits(['change'])
`;
    const filePath = writeComponent(dir, 'my-comp', source);
    try {
      await parse(filePath);
      expect.unreachable('Should have thrown');
    } catch (err) {
      // Could be EMITS_OBJECT_CONFLICT or PROPS_OBJECT_CONFLICT depending on order
      expect(['EMITS_OBJECT_CONFLICT', 'PROPS_OBJECT_CONFLICT']).toContain(err.code);
    }
  });

  it('throws UNDECLARED_EMIT for emit calls with undeclared event names', async () => {
    const dir = createTempDir();
    const source = `import { defineComponent, defineEmits } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const emit = defineEmits(['change'])

function handleClick() {
  emit('nonexistent')
}
`;
    const filePath = writeComponent(dir, 'my-comp', source);
    try {
      await parse(filePath);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err.code).toBe('UNDECLARED_EMIT');
    }
  });

  it('does not throw for declared emit calls', async () => {
    const dir = createTempDir();
    const source = `import { defineComponent, defineEmits } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const emit = defineEmits(['change', 'reset'])

function handleClick() {
  emit('change')
  emit('reset')
}
`;
    const filePath = writeComponent(dir, 'my-comp', source);
    const result = await parse(filePath);
    expect(result.emits).toEqual(['change', 'reset']);
  });
});

// ── parse() — no defineEmits ────────────────────────────────────────

describe('parse — no defineEmits', () => {
  it('returns empty emits and null emitsObjectName', async () => {
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

    expect(result.emits).toEqual([]);
    expect(result.emitsObjectName).toBeNull();
  });
});


// ── Property Tests ──────────────────────────────────────────────────

const reserved = new Set([
  'if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else',
  'enum', 'eval', 'null', 'this', 'true', 'void', 'with', 'const', 'break',
  'class', 'super', 'while', 'yield', 'return', 'typeof', 'delete', 'switch',
  'export', 'import', 'default', 'signal', 'computed', 'effect', 'props',
  'emit', 'defineProps', 'defineEmits', 'defineComponent', 'false',
]);

const arbEventName = fc
  .stringMatching(/^[a-z][a-z]{1,8}$/)
  .filter(s => !reserved.has(s));

const arbEmitsObjectName = fc.constantFrom('emit', 'fire', 'dispatch');

/**
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**
 *
 * Property 1: Emits Parser Round-Trip
 *
 * For any valid component source containing defineEmits with arbitrary event names,
 * parsing → prettyPrint → parsing again should produce equivalent emits and emitsObjectName.
 *
 * Feature: define-emits, Property 1: Emits Parser Round-Trip
 */
describe('Feature: define-emits, Property 1: Emits Parser Round-Trip', () => {
  it('parse → prettyPrint → parse produces equivalent emits and emitsObjectName', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.uniqueArray(arbEventName, { minLength: 1, maxLength: 5 }),
          arbEmitsObjectName
        ),
        async ([eventNames, objName]) => {
          const dir1 = createTempDir();
          const tagName = 'my-comp';

          const emitsArray = eventNames.map(n => `'${n}'`).join(', ');
          const source = `import { defineComponent, defineEmits } from 'wcc'

export default defineComponent({
  tag: '${tagName}',
  template: './${tagName}.html',
})

const ${objName} = defineEmits([${emitsArray}])
`;

          writeFileSync(join(dir1, `${tagName}.html`), '<div>hello</div>');
          writeFileSync(join(dir1, 'comp.js'), source);

          // First parse
          const ir1 = await parse(join(dir1, 'comp.js'));

          // Pretty-print
          const printed = prettyPrint(ir1);

          // Second parse
          const dir2 = createTempDir();
          writeFileSync(join(dir2, `${tagName}.html`), '<div>hello</div>');
          writeFileSync(join(dir2, 'comp.js'), printed);

          const ir2 = await parse(join(dir2, 'comp.js'));

          // Compare emits
          expect(ir2.emits).toEqual(ir1.emits);
          expect(ir2.emitsObjectName).toBe(ir1.emitsObjectName);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 3.1**
 *
 * Property 2: Bare Call Error Detection
 *
 * For any component source containing defineEmits() NOT assigned to a variable,
 * the Parser SHALL throw EMITS_ASSIGNMENT_REQUIRED.
 *
 * Feature: define-emits, Property 2: Bare Call Error Detection
 */
describe('Feature: define-emits, Property 2: Bare Call Error Detection', () => {
  it('throws EMITS_ASSIGNMENT_REQUIRED for bare defineEmits calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(arbEventName, { minLength: 1, maxLength: 4 }),
        async (eventNames) => {
          const dir = createTempDir();
          const emitsArray = eventNames.map(n => `'${n}'`).join(', ');
          const source = `import { defineComponent, defineEmits } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

defineEmits([${emitsArray}])
`;
          const filePath = writeComponent(dir, 'my-comp', source);
          try {
            await parse(filePath);
            expect.unreachable('Should have thrown EMITS_ASSIGNMENT_REQUIRED');
          } catch (err) {
            expect(err.code).toBe('EMITS_ASSIGNMENT_REQUIRED');
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
 * Property 3: Duplicate Emits Detection
 *
 * For any defineEmits declaration containing at least one duplicate event name,
 * the Parser SHALL throw DUPLICATE_EMITS.
 *
 * Feature: define-emits, Property 3: Duplicate Emits Detection
 */
describe('Feature: define-emits, Property 3: Duplicate Emits Detection', () => {
  it('throws DUPLICATE_EMITS when event names contain duplicates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.uniqueArray(arbEventName, { minLength: 1, maxLength: 4 }),
          arbEventName
        ).map(([unique, dup]) => {
          const base = unique.includes(dup) ? unique : [dup, ...unique];
          return [...base, dup];
        }),
        async (eventNames) => {
          const dir = createTempDir();
          const emitsArray = eventNames.map(n => `'${n}'`).join(', ');
          const source = `import { defineComponent, defineEmits } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const emit = defineEmits([${emitsArray}])
`;
          const filePath = writeComponent(dir, 'my-comp', source);
          try {
            await parse(filePath);
            expect.unreachable('Should have thrown DUPLICATE_EMITS');
          } catch (err) {
            expect(err.code).toBe('DUPLICATE_EMITS');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 4.2**
 *
 * Property 4: Emits Object Conflict Detection
 *
 * For any component source where emitsObjectName matches a signal name,
 * the Parser SHALL throw EMITS_OBJECT_CONFLICT.
 *
 * Feature: define-emits, Property 4: Emits Object Conflict Detection
 */
describe('Feature: define-emits, Property 4: Emits Object Conflict Detection', () => {
  const arbIdentifier = fc
    .stringMatching(/^[a-z][a-zA-Z]{2,8}$/)
    .filter(s => !reserved.has(s));

  it('throws EMITS_OBJECT_CONFLICT when emitsObjectName matches a signal', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbIdentifier,
        async (conflictName) => {
          const dir = createTempDir();
          const source = `import { defineComponent, defineEmits, signal } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const ${conflictName} = signal(0)
const ${conflictName} = defineEmits(['change'])
`;
          const filePath = writeComponent(dir, 'my-comp', source);
          try {
            await parse(filePath);
            expect.unreachable('Should have thrown EMITS_OBJECT_CONFLICT');
          } catch (err) {
            expect(err.code).toBe('EMITS_OBJECT_CONFLICT');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 5.1, 5.2, 5.3**
 *
 * Property 5: Undeclared Emit Detection
 *
 * For any component source with emit calls using event names NOT in the declared emits array,
 * the Parser SHALL throw UNDECLARED_EMIT.
 *
 * Feature: define-emits, Property 5: Undeclared Emit Detection
 */
describe('Feature: define-emits, Property 5: Undeclared Emit Detection', () => {
  it('throws UNDECLARED_EMIT for emit calls with undeclared event names', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.uniqueArray(arbEventName, { minLength: 1, maxLength: 3 }),
          arbEventName
        ).filter(([declared, undeclared]) => !declared.includes(undeclared)),
        async ([declaredEvents, undeclaredEvent]) => {
          const dir = createTempDir();
          const emitsArray = declaredEvents.map(n => `'${n}'`).join(', ');
          const source = `import { defineComponent, defineEmits } from 'wcc'

export default defineComponent({
  tag: 'my-comp',
  template: './my-comp.html',
})

const emit = defineEmits([${emitsArray}])

function handleClick() {
  emit('${undeclaredEvent}')
}
`;
          const filePath = writeComponent(dir, 'my-comp', source);
          try {
            await parse(filePath);
            expect.unreachable('Should have thrown UNDECLARED_EMIT');
          } catch (err) {
            expect(err.code).toBe('UNDECLARED_EMIT');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
