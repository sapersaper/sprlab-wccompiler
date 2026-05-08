/**
 * Unit tests for defineModel compile-time validations.
 *
 * Tests the three validation errors:
 * - MODEL_MISSING_NAME: defineModel() without a 'name' property
 * - MODEL_NO_ASSIGNMENT: defineModel() not assigned to a variable
 * - MODEL_NAME_CONFLICT: model prop name conflicts with signal/computed/constant/prop
 *
 * Also tests macro stripping behavior:
 * - defineModel() calls are stripped from the compiled output (Requirement 1.5)
 *
 * Property-based tests:
 * - Property 8: defineModel name conflict detection
 */

import { describe, it, expect, afterEach } from 'vitest';
import fc from 'fast-check';
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
    `wcc-model-validation-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

function writeSFC(dir, script) {
  const sfcContent = `<script>
import { defineComponent, defineModel, signal, computed } from 'wcc'

export default defineComponent({ tag: 'my-comp' })

${script}
</script>

<template>
<div>hello</div>
</template>`;
  const filePath = join(dir, 'component.wcc');
  writeFileSync(filePath, sfcContent);
  return filePath;
}

// ── MODEL_MISSING_NAME ──────────────────────────────────────────────

describe('compile() — MODEL_MISSING_NAME', () => {
  it('throws when defineModel() has no name property', async () => {
    const dir = createTempDir();
    const filePath = writeSFC(dir, `const value = defineModel({ default: '' })`);

    await expect(compile(filePath)).rejects.toMatchObject({
      code: 'MODEL_MISSING_NAME',
      message: expect.stringContaining("defineModel() requires a 'name' property in the options object"),
    });
  });

  it('throws when defineModel() has an empty name', async () => {
    const dir = createTempDir();
    const filePath = writeSFC(dir, `const value = defineModel({ name: '', default: '' })`);

    await expect(compile(filePath)).rejects.toMatchObject({
      code: 'MODEL_MISSING_NAME',
      message: expect.stringContaining("defineModel() requires a 'name' property in the options object"),
    });
  });
});

// ── MODEL_NO_ASSIGNMENT ─────────────────────────────────────────────

describe('compile() — MODEL_NO_ASSIGNMENT', () => {
  it('throws when defineModel() is not assigned to a variable', async () => {
    const dir = createTempDir();
    const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'my-comp' })

defineModel({ name: 'value', default: '' })
</script>

<template>
<div>hello</div>
</template>`;
    const filePath = join(dir, 'component.wcc');
    writeFileSync(filePath, sfcContent);

    await expect(compile(filePath)).rejects.toMatchObject({
      code: 'MODEL_NO_ASSIGNMENT',
      message: expect.stringContaining('defineModel() must be assigned to a variable'),
    });
  });

  it('does not throw when defineModel() is properly assigned', async () => {
    const dir = createTempDir();
    const filePath = writeSFC(dir, `const value = defineModel({ name: 'value', default: '' })`);

    await expect(compile(filePath)).resolves.toBeDefined();
  });
});

// ── MODEL_NAME_CONFLICT ─────────────────────────────────────────────

describe('compile() — MODEL_NAME_CONFLICT', () => {
  it('throws when model prop name conflicts with a signal', async () => {
    const dir = createTempDir();
    const filePath = writeSFC(dir, `
const count = signal(0)
const value = defineModel({ name: 'count', default: 0 })
`);

    await expect(compile(filePath)).rejects.toMatchObject({
      code: 'MODEL_NAME_CONFLICT',
      message: expect.stringContaining("defineModel prop 'count' conflicts with existing signal 'count'"),
    });
  });

  it('throws when model prop name conflicts with a computed', async () => {
    const dir = createTempDir();
    const filePath = writeSFC(dir, `
const base = signal(1)
const doubled = computed(() => base() * 2)
const value = defineModel({ name: 'doubled', default: 0 })
`);

    await expect(compile(filePath)).rejects.toMatchObject({
      code: 'MODEL_NAME_CONFLICT',
      message: expect.stringContaining("defineModel prop 'doubled' conflicts with existing computed 'doubled'"),
    });
  });

  it('throws when model prop name conflicts with a constant', async () => {
    const dir = createTempDir();
    const filePath = writeSFC(dir, `
const MAX = 100
const value = defineModel({ name: 'MAX', default: 0 })
`);

    await expect(compile(filePath)).rejects.toMatchObject({
      code: 'MODEL_NAME_CONFLICT',
      message: expect.stringContaining("defineModel prop 'MAX' conflicts with existing constant 'MAX'"),
    });
  });

  it('throws when model prop name conflicts with a defineProps prop', async () => {
    const dir = createTempDir();
    const sfcContent = `<script>
import { defineComponent, defineModel, defineProps } from 'wcc'

export default defineComponent({ tag: 'my-comp' })

const props = defineProps(['label'])
const value = defineModel({ name: 'label', default: '' })
</script>

<template>
<div>hello</div>
</template>`;
    const filePath = join(dir, 'component.wcc');
    writeFileSync(filePath, sfcContent);

    await expect(compile(filePath)).rejects.toMatchObject({
      code: 'MODEL_NAME_CONFLICT',
      message: expect.stringContaining("defineModel prop 'label' conflicts with existing prop 'label'"),
    });
  });

  it('does not throw when model prop name is unique', async () => {
    const dir = createTempDir();
    const filePath = writeSFC(dir, `
const count = signal(0)
const value = defineModel({ name: 'modelValue', default: '' })
`);

    await expect(compile(filePath)).resolves.toBeDefined();
  });
});

// ── MACRO STRIPPING (Requirement 1.5) ───────────────────────────────

describe('compile() — defineModel macro stripping', () => {
  it('strips defineModel() call from compiled output', async () => {
    const dir = createTempDir();
    const filePath = writeSFC(dir, `const value = defineModel({ name: 'modelValue', default: '' })`);

    const { code } = await compile(filePath);
    expect(code).not.toContain('defineModel');
  });

  it('strips multiple defineModel() calls from compiled output', async () => {
    const dir = createTempDir();
    const filePath = writeSFC(dir, `
const value = defineModel({ name: 'modelValue', default: '' })
const count = defineModel({ name: 'count', default: 0 })
`);

    const { code } = await compile(filePath);
    expect(code).not.toContain('defineModel');
  });

  it('strips defineModel() alongside other macros (signal, computed)', async () => {
    const dir = createTempDir();
    const filePath = writeSFC(dir, `
const name = signal('hello')
const upper = computed(() => name().toUpperCase())
const value = defineModel({ name: 'modelValue', default: '' })
`);

    const { code } = await compile(filePath);
    expect(code).not.toContain('defineModel');
    // Verify other declarations are still present
    expect(code).toContain('__signal');
    expect(code).toContain('__computed');
  });

  it('strips defineModel() with complex default values', async () => {
    const dir = createTempDir();
    const filePath = writeSFC(dir, `const value = defineModel({ name: 'items', default: [] })`);

    const { code } = await compile(filePath);
    expect(code).not.toContain('defineModel');
  });
});


// ── MODEL_PROP_UNKNOWN_VAR ───────────────────────────────────────────

describe('compile() — MODEL_PROP_UNKNOWN_VAR', () => {
  it('throws when model:propName references an undeclared variable', async () => {
    const dir = createTempDir();
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'my-parent' })

const count = signal(0)
</script>

<template>
<my-child model:value="nonExistent"></my-child>
</template>`;
    const filePath = join(dir, 'component.wcc');
    writeFileSync(filePath, sfcContent);

    await expect(compile(filePath)).rejects.toMatchObject({
      code: 'MODEL_PROP_UNKNOWN_VAR',
      message: expect.stringContaining("model:propName references undeclared variable 'nonExistent'"),
    });
  });

  it('does not throw when model:propName references a declared signal', async () => {
    const dir = createTempDir();
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'my-parent' })

const count = signal(0)
</script>

<template>
<my-child model:value="count"></my-child>
</template>`;
    const filePath = join(dir, 'component.wcc');
    writeFileSync(filePath, sfcContent);

    await expect(compile(filePath)).resolves.toBeDefined();
  });

  it('does not throw when model:propName references a model var', async () => {
    const dir = createTempDir();
    const sfcContent = `<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'my-parent' })

const value = defineModel({ name: 'value', default: '' })
</script>

<template>
<my-child model:text="value"></my-child>
</template>`;
    const filePath = join(dir, 'component.wcc');
    writeFileSync(filePath, sfcContent);

    await expect(compile(filePath)).resolves.toBeDefined();
  });
});

// ── MODEL_PROP_READONLY ─────────────────────────────────────────────

describe('compile() — MODEL_PROP_READONLY', () => {
  it('throws when model:propName references a prop (read-only)', async () => {
    const dir = createTempDir();
    const sfcContent = `<script>
import { defineComponent, defineProps } from 'wcc'

export default defineComponent({ tag: 'my-parent' })

const props = defineProps(['label'])
</script>

<template>
<my-child model:value="label"></my-child>
</template>`;
    const filePath = join(dir, 'component.wcc');
    writeFileSync(filePath, sfcContent);

    await expect(compile(filePath)).rejects.toMatchObject({
      code: 'MODEL_PROP_READONLY',
      message: expect.stringContaining("model:propName cannot bind to prop 'label' (read-only)"),
    });
  });

  it('throws when model:propName references a computed (read-only)', async () => {
    const dir = createTempDir();
    const sfcContent = `<script>
import { defineComponent, signal, computed } from 'wcc'

export default defineComponent({ tag: 'my-parent' })

const base = signal(1)
const doubled = computed(() => base() * 2)
</script>

<template>
<my-child model:value="doubled"></my-child>
</template>`;
    const filePath = join(dir, 'component.wcc');
    writeFileSync(filePath, sfcContent);

    await expect(compile(filePath)).rejects.toMatchObject({
      code: 'MODEL_PROP_READONLY',
      message: expect.stringContaining("model:propName cannot bind to computed 'doubled' (read-only)"),
    });
  });

  it('throws when model:propName references a constant (read-only)', async () => {
    const dir = createTempDir();
    const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'my-parent' })

const MAX = 100
const count = signal(0)
</script>

<template>
<my-child model:value="MAX"></my-child>
</template>`;
    const filePath = join(dir, 'component.wcc');
    writeFileSync(filePath, sfcContent);

    await expect(compile(filePath)).rejects.toMatchObject({
      code: 'MODEL_PROP_READONLY',
      message: expect.stringContaining("model:propName cannot bind to constant 'MAX' (read-only)"),
    });
  });
});

// ── Property 7: model:propName validation rejects invalid targets ────
// **Validates: Requirements 5.5, 5.6**

/**
 * Generators for property-based model:propName validation tests.
 */

const reservedP7 = new Set([
  'if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else',
  'enum', 'eval', 'null', 'this', 'true', 'void', 'with', 'const', 'break',
  'class', 'super', 'while', 'yield', 'return', 'typeof', 'delete', 'switch',
  'export', 'import', 'default', 'signal', 'computed', 'effect', 'props',
  'emit', 'defineProps', 'defineEmits', 'defineModel', 'false', 'name',
  'set', 'get', 'undefined', 'value', 'model', 'base',
]);

/** Generate a valid JS identifier (lowercase start, 3-8 chars) for Property 7 */
const arbIdentifierP7 = fc
  .stringMatching(/^[a-z][a-zA-Z]{2,7}$/)
  .filter(s => !reservedP7.has(s));

/**
 * Build an SFC where model:propName references an undeclared variable.
 */
function buildUnknownVarSFC(varName) {
  return `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'my-parent' })

const count = signal(0)
</script>

<template>
<my-child model:value="${varName}"></my-child>
</template>`;
}

/**
 * Build an SFC where model:propName references a prop (read-only).
 */
function buildPropReadonlySFC(propName) {
  return `<script>
import { defineComponent, defineProps } from 'wcc'

export default defineComponent({ tag: 'my-parent' })

const props = defineProps(['${propName}'])
</script>

<template>
<my-child model:value="${propName}"></my-child>
</template>`;
}

/**
 * Build an SFC where model:propName references a computed (read-only).
 */
function buildComputedReadonlySFC(computedName) {
  return `<script>
import { defineComponent, signal, computed } from 'wcc'

export default defineComponent({ tag: 'my-parent' })

const base = signal(1)
const ${computedName} = computed(() => base() * 2)
</script>

<template>
<my-child model:value="${computedName}"></my-child>
</template>`;
}

/**
 * Build an SFC where model:propName references a constant (read-only).
 */
function buildConstantReadonlySFC(constName) {
  return `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'my-parent' })

const ${constName} = 42
const count = signal(0)
</script>

<template>
<my-child model:value="${constName}"></my-child>
</template>`;
}

describe('Property 7: model:propName validation rejects invalid targets', () => {
  it('compiler throws MODEL_PROP_UNKNOWN_VAR when model:propName references an undeclared variable', () => {
    fc.assert(
      fc.asyncProperty(
        arbIdentifierP7,
        async (varName) => {
          const dir = createTempDir();
          try {
            const sfcContent = buildUnknownVarSFC(varName);
            const filePath = join(dir, 'component.wcc');
            writeFileSync(filePath, sfcContent);

            let thrownError = null;
            try {
              await compile(filePath);
            } catch (err) {
              thrownError = err;
            }

            expect(thrownError).not.toBeNull();
            expect(thrownError.code).toBe('MODEL_PROP_UNKNOWN_VAR');
            expect(thrownError.message).toContain(`model:propName references undeclared variable '${varName}'`);
          } finally {
            try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('compiler throws MODEL_PROP_READONLY when model:propName references a prop', () => {
    fc.assert(
      fc.asyncProperty(
        arbIdentifierP7,
        async (propName) => {
          const dir = createTempDir();
          try {
            const sfcContent = buildPropReadonlySFC(propName);
            const filePath = join(dir, 'component.wcc');
            writeFileSync(filePath, sfcContent);

            let thrownError = null;
            try {
              await compile(filePath);
            } catch (err) {
              thrownError = err;
            }

            expect(thrownError).not.toBeNull();
            expect(thrownError.code).toBe('MODEL_PROP_READONLY');
            expect(thrownError.message).toContain(`model:propName cannot bind to prop '${propName}' (read-only)`);
          } finally {
            try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('compiler throws MODEL_PROP_READONLY when model:propName references a computed', () => {
    fc.assert(
      fc.asyncProperty(
        arbIdentifierP7,
        async (computedName) => {
          const dir = createTempDir();
          try {
            const sfcContent = buildComputedReadonlySFC(computedName);
            const filePath = join(dir, 'component.wcc');
            writeFileSync(filePath, sfcContent);

            let thrownError = null;
            try {
              await compile(filePath);
            } catch (err) {
              thrownError = err;
            }

            expect(thrownError).not.toBeNull();
            expect(thrownError.code).toBe('MODEL_PROP_READONLY');
            expect(thrownError.message).toContain(`model:propName cannot bind to computed '${computedName}' (read-only)`);
          } finally {
            try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('compiler throws MODEL_PROP_READONLY when model:propName references a constant', () => {
    fc.assert(
      fc.asyncProperty(
        arbIdentifierP7,
        async (constName) => {
          const dir = createTempDir();
          try {
            const sfcContent = buildConstantReadonlySFC(constName);
            const filePath = join(dir, 'component.wcc');
            writeFileSync(filePath, sfcContent);

            let thrownError = null;
            try {
              await compile(filePath);
            } catch (err) {
              thrownError = err;
            }

            expect(thrownError).not.toBeNull();
            expect(thrownError.code).toBe('MODEL_PROP_READONLY');
            expect(thrownError.message).toContain(`model:propName cannot bind to constant '${constName}' (read-only)`);
          } finally {
            try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 8: defineModel name conflict detection ─────────────────
// **Validates: Requirements 9.2**

/**
 * Generators for property-based conflict detection tests.
 */

const reserved = new Set([
  'if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else',
  'enum', 'eval', 'null', 'this', 'true', 'void', 'with', 'const', 'break',
  'class', 'super', 'while', 'yield', 'return', 'typeof', 'delete', 'switch',
  'export', 'import', 'default', 'signal', 'computed', 'effect', 'props',
  'emit', 'defineProps', 'defineEmits', 'defineModel', 'false', 'name',
  'set', 'get', 'undefined', 'value', 'model',
]);

/** Generate a valid JS identifier (lowercase start, 3-8 chars) */
const arbIdentifier = fc
  .stringMatching(/^[a-z][a-zA-Z]{2,7}$/)
  .filter(s => !reserved.has(s));

/**
 * Generate a conflict type: signal, computed, constant, or prop.
 * Each returns the source line that declares the conflicting name,
 * and the expected conflict type string in the error message.
 */
const arbConflictType = fc.constantFrom('signal', 'computed', 'constant', 'prop');

/**
 * Build an SFC source where a name is declared as the given type,
 * then a defineModel uses the same name.
 */
function buildConflictSFC(name, conflictType) {
  let declaration;
  let imports = "import { defineComponent, defineModel, signal, computed } from 'wcc'";

  switch (conflictType) {
    case 'signal':
      declaration = `const ${name} = signal(0)`;
      break;
    case 'computed':
      // computed needs a signal to reference
      declaration = `const base = signal(1)\nconst ${name} = computed(() => base() * 2)`;
      break;
    case 'constant':
      declaration = `const ${name} = 42`;
      break;
    case 'prop':
      imports = "import { defineComponent, defineModel, defineProps } from 'wcc'";
      declaration = `const myProps = defineProps(['${name}'])`;
      break;
  }

  return `<script>
${imports}

export default defineComponent({ tag: 'my-comp' })

${declaration}
const mdVar = defineModel({ name: '${name}', default: 0 })
</script>

<template>
<div>hello</div>
</template>`;
}

describe('Property 8: defineModel name conflict detection', () => {
  it('compiler throws MODEL_NAME_CONFLICT when defineModel prop name conflicts with existing signal/computed/constant/prop', () => {
    fc.assert(
      fc.asyncProperty(
        arbIdentifier,
        arbConflictType,
        async (name, conflictType) => {
          const dir = createTempDir();
          try {
            const sfcContent = buildConflictSFC(name, conflictType);
            const filePath = join(dir, 'component.wcc');
            writeFileSync(filePath, sfcContent);

            // The compiler should throw with MODEL_NAME_CONFLICT
            let thrownError = null;
            try {
              await compile(filePath);
            } catch (err) {
              thrownError = err;
            }

            // Assert error was thrown
            expect(thrownError).not.toBeNull();
            expect(thrownError.code).toBe('MODEL_NAME_CONFLICT');
            expect(thrownError.message).toContain(`defineModel prop '${name}' conflicts with existing ${conflictType} '${name}'`);
          } finally {
            try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
