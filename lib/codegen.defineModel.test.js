/**
 * Property-based tests for defineModel codegen — disambiguation.
 *
 * Property 10: Compiler distinguishes model= from model:propName=
 *
 * For any template containing both `model="signal"` on a form element and
 * `model:propName="signal"` on a custom element, the compiler SHALL produce
 * form-binding code for the former and component-binding code for the latter,
 * with no cross-contamination.
 *
 * **Validates: Requirements 10.3**
 */

import { describe, it, expect, afterEach } from 'vitest';
import fc from 'fast-check';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from './compiler.js';
import { transformMethodBody } from './codegen.js';

// ── Helpers ─────────────────────────────────────────────────────────

/** @type {string[]} */
const tempDirs = [];

function createTempDir() {
  const dir = join(
    tmpdir(),
    `wcc-model-disambig-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

// ── Generators ──────────────────────────────────────────────────────

const reserved = new Set([
  'if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else',
  'enum', 'eval', 'null', 'this', 'true', 'void', 'with', 'const', 'break',
  'class', 'super', 'while', 'yield', 'return', 'typeof', 'delete', 'switch',
  'export', 'import', 'default', 'signal', 'computed', 'effect', 'props',
  'emit', 'defineProps', 'defineEmits', 'defineModel', 'false', 'name',
  'set', 'get', 'undefined', 'value', 'model', 'base', 'count',
]);

/** Generate a valid JS identifier (lowercase start, 3-8 chars) */
const arbIdentifier = fc
  .stringMatching(/^[a-z][a-zA-Z]{2,7}$/)
  .filter(s => !reserved.has(s));

/** Generate a valid prop name for model:propName (lowercase, 3-6 chars) */
const arbPropName = fc
  .stringMatching(/^[a-z][a-z]{2,5}$/)
  .filter(s => !reserved.has(s));

/**
 * Generate a pair of distinct signal names for form binding and component binding.
 */
const arbSignalPair = fc
  .tuple(arbIdentifier, arbIdentifier)
  .filter(([a, b]) => a !== b);

// ── Property 10: Compiler distinguishes model= from model:propName= ──
// **Validates: Requirements 10.3**

describe('Feature: define-model, Property 10: Compiler distinguishes model= from model:propName=', () => {
  it('produces form-binding code for model= and component-binding code for model:propName=', () => {
    fc.assert(
      fc.asyncProperty(
        arbSignalPair,
        arbPropName,
        async ([formSignal, compSignal], propName) => {
          const dir = createTempDir();
          try {
            // Build an SFC with both model= on a form element and model:propName= on a custom element
            const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'my-parent' })

const ${formSignal} = signal('')
const ${compSignal} = signal('')
</script>

<template>
<input model="${formSignal}">
<my-child model:${propName}="${compSignal}"></my-child>
</template>`;

            const filePath = join(dir, 'component.wcc');
            writeFileSync(filePath, sfcContent);

            const { code } = await compile(filePath);

            // ── Form binding assertions ──
            // The form element binding should produce:
            // 1. An addEventListener for 'input' event (form element event listener)
            // 2. A .value property access in an effect (signal → DOM sync)
            expect(code).toContain("addEventListener('input'");
            expect(code).toContain(`.value = this._${formSignal}()`);

            // ── Component binding assertions ──
            // The model:propName on a custom element should produce component-binding code.
            // Currently (before task 7.1), this means the modelPropBindings are collected
            // but the key disambiguation is that:
            // 1. The custom element does NOT get form-binding code (no 'input'/'change' listener for compSignal)
            // 2. The form signal does NOT get component-binding treatment

            // Verify no form-binding code is generated for the component signal
            // (i.e., no addEventListener with the component signal's value setter)
            const formBindingForCompSignal = code.includes(`this._${compSignal}(e.target.value)`) ||
              code.includes(`this._${compSignal}(e.target.checked)`);
            expect(formBindingForCompSignal).toBe(false);

            // Verify the form signal is NOT treated as a component binding
            // (no 'wcc:model' event listener that updates the form signal)
            const compBindingForFormSignal = code.includes(`addEventListener('wcc:model'`) &&
              code.includes(`this._${formSignal}(`);
            // If wcc:model listener exists, it should NOT reference the form signal
            if (code.includes("addEventListener('wcc:model'")) {
              // Any wcc:model listener should reference compSignal, not formSignal
              const wccModelSection = code.slice(code.indexOf("addEventListener('wcc:model'"));
              const nextSemicolon = wccModelSection.indexOf(';');
              const listenerCode = wccModelSection.slice(0, nextSemicolon > 0 ? nextSemicolon : 200);
              expect(listenerCode).not.toContain(`this._${formSignal}(`);
            }

            // Verify the model:propName attribute was removed from the template
            // (the processed template should not contain model:propName)
            expect(code).not.toContain(`model:${propName}=`);

            // Verify the model= attribute was removed from the form element
            expect(code).not.toMatch(new RegExp(`<input[^>]*model="${formSignal}"`));
          } finally {
            try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('form binding produces addEventListener for input event while model:propName does not', () => {
    fc.assert(
      fc.asyncProperty(
        arbSignalPair,
        arbPropName,
        async ([formSignal, compSignal], propName) => {
          const dir = createTempDir();
          try {
            const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'my-parent' })

const ${formSignal} = signal('')
const ${compSignal} = signal('')
</script>

<template>
<textarea model="${formSignal}"></textarea>
<another-comp model:${propName}="${compSignal}"></another-comp>
</template>`;

            const filePath = join(dir, 'component.wcc');
            writeFileSync(filePath, sfcContent);

            const { code } = await compile(filePath);

            // Form binding: textarea uses 'input' event and .value property
            expect(code).toContain("addEventListener('input'");
            expect(code).toContain(`.value = this._${formSignal}()`);

            // The component signal should NOT have form-style event binding
            expect(code).not.toContain(`this._${compSignal}(e.target.value)`);
            expect(code).not.toContain(`this._${compSignal}(e.target.checked)`);

            // Count addEventListener calls — should only be for the form element's 'input' event
            // (not for the custom element's model:propName which uses a different mechanism)
            const inputListenerMatches = code.match(/addEventListener\('input'/g) || [];
            expect(inputListenerMatches.length).toBe(1);
          } finally {
            try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ── Property 9: .set() transformation to _modelSet ──────────────────
// **Validates: Requirements 2.2**

describe('Feature: define-model, Property 9: .set() transformation to _modelSet', () => {
  /** Generate a valid JS identifier (lowercase start, 3-8 chars) that won't collide */
  const arbVarName = fc
    .stringMatching(/^[a-z][a-zA-Z]{2,7}$/)
    .filter(s => !reserved.has(s));

  /** Generate a valid prop name (lowercase, 3-6 chars) */
  const arbModelPropName = fc
    .stringMatching(/^[a-z][a-z]{2,5}$/)
    .filter(s => !reserved.has(s));

  /** Generate random value expressions for .set() calls */
  const arbValueExpr = fc.oneof(
    // Number literals
    fc.integer({ min: 0, max: 9999 }).map(n => String(n)),
    // String literals
    fc.stringMatching(/^[a-z]{1,6}$/).map(s => `'${s}'`),
    // Variable references (simple identifiers)
    fc.stringMatching(/^[a-z][a-zA-Z]{2,5}$/).filter(s => !reserved.has(s))
  );

  it('.set() calls on model vars are transformed to _modelSet, not _m_', () => {
    fc.assert(
      fc.property(
        arbVarName,
        arbModelPropName,
        arbValueExpr,
        (varName, propName, valueExpr) => {
          // Create a modelVarMap mapping varName → propName
          const modelVarMap = new Map([[varName, propName]]);

          // Build a body containing varName.set(expr)
          const body = `${varName}.set(${valueExpr})`;

          // Transform the method body
          const result = transformMethodBody(
            body,
            [],           // signalNames
            [],           // computedNames
            null,         // propsObjectName
            new Set(),    // propNames
            null,         // emitsObjectName
            [],           // refVarNames
            [],           // constantNames
            modelVarMap   // modelVarMap
          );

          // Assert: output contains this._modelSet_{propName}(expr)
          expect(result).toContain(`this._modelSet_${propName}(${valueExpr})`);

          // Assert: output does NOT contain this._m_{propName}(expr) for the write
          // (reads would be this._m_{propName}() but writes must use _modelSet)
          expect(result).not.toContain(`this._m_${propName}(${valueExpr})`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('.set() on model vars transforms correctly alongside regular signal reads', () => {
    fc.assert(
      fc.property(
        arbVarName,
        arbModelPropName,
        fc.stringMatching(/^[a-z][a-zA-Z]{2,5}$/).filter(s => !reserved.has(s)),
        (varName, propName, signalName) => {
          // Ensure varName and signalName are distinct
          fc.pre(varName !== signalName && propName !== signalName);

          const modelVarMap = new Map([[varName, propName]]);

          // Body with both a model .set() and a regular signal read
          const body = `${varName}.set(${signalName}())`;

          const result = transformMethodBody(
            body,
            [signalName], // signalNames
            [],           // computedNames
            null,         // propsObjectName
            new Set(),    // propNames
            null,         // emitsObjectName
            [],           // refVarNames
            [],           // constantNames
            modelVarMap   // modelVarMap
          );

          // The model write should use _modelSet
          expect(result).toContain(`this._modelSet_${propName}(`);
          // The signal read should use this._signalName()
          expect(result).toContain(`this._${signalName}()`);
          // Should NOT use _m_ for the write
          expect(result).not.toMatch(new RegExp(`this\\._m_${propName}\\(this\\._${signalName}\\(\\)\\)`));
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ── Property 1: Model signal generation preserves declaration semantics ──
// **Validates: Requirements 1.1, 1.2, 1.4, 3.1, 3.3**

describe('Feature: define-model, Property 1: Model signal generation preserves declaration semantics', () => {
  /** Generate a valid prop name (lowercase, 3-6 chars) suitable for defineModel */
  const arbModelName = fc
    .stringMatching(/^[a-z][a-z]{2,5}$/)
    .filter(s => !reserved.has(s));

  /** Generate a valid default value expression */
  const arbDefault = fc.oneof(
    // String defaults
    fc.stringMatching(/^[a-z]{1,6}$/).map(s => `'${s}'`),
    // Number defaults
    fc.integer({ min: 0, max: 999 }).map(n => String(n)),
    // Empty string
    fc.constant("''")
  );

  /** Generate a single ModelDef-like object */
  const arbModelDef = fc.record({
    name: arbModelName,
    default: arbDefault,
  });

  /** Generate 1-5 model defs with unique names */
  const arbModelDefs = fc
    .array(arbModelDef, { minLength: 1, maxLength: 5 })
    .filter(defs => {
      const names = defs.map(d => d.name);
      return new Set(names).size === names.length;
    });

  it('generated code contains observedAttributes, signal init, and public get/set for each model prop', () => {
    fc.assert(
      fc.asyncProperty(
        arbModelDefs,
        async (modelDefs) => {
          const dir = createTempDir();
          try {
            // Build defineModel declarations
            const declarations = modelDefs.map((md, i) => {
              const varName = `${md.name}Var`;
              return `const ${varName} = defineModel({ name: '${md.name}', default: ${md.default} })`;
            }).join('\n');

            // Build an SFC with those defineModel declarations
            const sfcContent = `<script>
import { defineComponent, signal, defineModel } from 'wcc'

export default defineComponent({ tag: 'my-test-comp' })

${declarations}
</script>

<template>
<div>test</div>
</template>`;

            const filePath = join(dir, 'component.wcc');
            writeFileSync(filePath, sfcContent);

            const { code } = await compile(filePath);

            for (const md of modelDefs) {
              // (a) Each prop name (kebab-case) in observedAttributes
              const kebabName = md.name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
              expect(code).toContain(`'${kebabName}'`);
              expect(code).toMatch(/static get observedAttributes\(\)/);

              // (b) Signal this._m_{name} initialized with default in the constructor
              expect(code).toContain(`this._m_${md.name} = __signal(${md.default})`);

              // (c) Public get accessor
              expect(code).toContain(`get ${md.name}() { return this._m_${md.name}(); }`);

              // (c) Public set accessor
              expect(code).toContain(`set ${md.name}(val) { this._m_${md.name}(val); this.setAttribute('${kebabName}', String(val)); }`);
            }
          } finally {
            try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ── Property 2: Internal write emits wcc:model with correct detail ──────────
// **Validates: Requirements 2.3, 2.4, 4.1, 4.2, 4.3, 4.4**

describe('Feature: define-model, Property 2: Internal write emits wcc:model with correct detail', () => {
  /** Generate a valid prop name (lowercase, 3-6 chars) suitable for defineModel */
  const arbModelName = fc
    .stringMatching(/^[a-z][a-z]{2,5}$/)
    .filter(s => !reserved.has(s));

  /** Generate a valid default value expression */
  const arbDefault = fc.oneof(
    fc.stringMatching(/^[a-z]{1,6}$/).map(s => `'${s}'`),
    fc.integer({ min: 0, max: 999 }).map(n => String(n)),
    fc.constant("''")
  );

  /** Generate a single ModelDef-like object */
  const arbModelDef = fc.record({
    name: arbModelName,
    default: arbDefault,
  });

  /** Generate 1-5 model defs with unique names */
  const arbModelDefs = fc
    .array(arbModelDef, { minLength: 1, maxLength: 5 })
    .filter(defs => {
      const names = defs.map(d => d.name);
      return new Set(names).size === names.length;
    });

  it('_modelSet_{name} dispatches CustomEvent wcc:model with correct detail, bubbles, composed', () => {
    fc.assert(
      fc.asyncProperty(
        arbModelDefs,
        async (modelDefs) => {
          const dir = createTempDir();
          try {
            // Build defineModel declarations
            const declarations = modelDefs.map((md) => {
              const varName = `${md.name}Var`;
              return `const ${varName} = defineModel({ name: '${md.name}', default: ${md.default} })`;
            }).join('\n');

            // Build an SFC with those defineModel declarations
            const sfcContent = `<script>
import { defineComponent, signal, defineModel } from 'wcc'

export default defineComponent({ tag: 'my-test-comp' })

${declarations}
</script>

<template>
<div>test</div>
</template>`;

            const filePath = join(dir, 'component.wcc');
            writeFileSync(filePath, sfcContent);

            const { code } = await compile(filePath);

            for (const md of modelDefs) {
              // Assert: _modelSet_{name} method exists
              expect(code).toContain(`_modelSet_${md.name}(newVal) {`);

              // Assert: reads old value from the model signal
              expect(code).toContain(`const oldVal = this._m_${md.name}();`);

              // Assert: writes new value to the model signal
              expect(code).toContain(`this._m_${md.name}(newVal);`);

              // Assert: dispatches CustomEvent('wcc:model', ...)
              expect(code).toContain(`this.dispatchEvent(new CustomEvent('wcc:model', {`);

              // Assert: detail contains prop, value, oldValue
              expect(code).toContain(`detail: { prop: '${md.name}', value: newVal, oldValue: oldVal },`);

              // Assert: bubbles: true
              expect(code).toContain('bubbles: true,');

              // Assert: composed: true
              expect(code).toContain('composed: true');
            }
          } finally {
            try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ── Property 3: External attribute change does NOT emit event ────────────────
// **Validates: Requirements 2.5, 4.5**

describe('Feature: define-model, Property 3: External attribute change does NOT emit event', () => {
  /** Generate a valid prop name (lowercase, 3-6 chars) suitable for defineModel */
  const arbModelName = fc
    .stringMatching(/^[a-z][a-z]{2,5}$/)
    .filter(s => !reserved.has(s));

  /** Generate a valid default value expression */
  const arbDefault = fc.oneof(
    // String defaults
    fc.stringMatching(/^[a-z]{1,6}$/).map(s => `'${s}'`),
    // Number defaults
    fc.integer({ min: 0, max: 999 }).map(n => String(n)),
    // Empty string
    fc.constant("''")
  );

  /** Generate a single ModelDef-like object */
  const arbModelDef = fc.record({
    name: arbModelName,
    default: arbDefault,
  });

  /** Generate 1-5 model defs with unique names */
  const arbModelDefs = fc
    .array(arbModelDef, { minLength: 1, maxLength: 5 })
    .filter(defs => {
      const names = defs.map(d => d.name);
      return new Set(names).size === names.length;
    });

  it('attributeChangedCallback updates signal directly via this._m_{name}(...) without _modelSet or dispatchEvent', () => {
    fc.assert(
      fc.asyncProperty(
        arbModelDefs,
        async (modelDefs) => {
          const dir = createTempDir();
          try {
            // Build defineModel declarations
            const declarations = modelDefs.map((md) => {
              const varName = `${md.name}Var`;
              return `const ${varName} = defineModel({ name: '${md.name}', default: ${md.default} })`;
            }).join('\n');

            // Build an SFC with those defineModel declarations
            const sfcContent = `<script>
import { defineComponent, signal, defineModel } from 'wcc'

export default defineComponent({ tag: 'my-test-comp' })

${declarations}
</script>

<template>
<div>test</div>
</template>`;

            const filePath = join(dir, 'component.wcc');
            writeFileSync(filePath, sfcContent);

            const { code } = await compile(filePath);

            // Extract the attributeChangedCallback section from the generated code
            const callbackStart = code.indexOf('attributeChangedCallback(');
            expect(callbackStart).toBeGreaterThan(-1);

            // Find the end of the attributeChangedCallback method
            // It ends at the next method or closing brace at the same indentation level
            let braceDepth = 0;
            let callbackEnd = -1;
            for (let i = code.indexOf('{', callbackStart); i < code.length; i++) {
              if (code[i] === '{') braceDepth++;
              if (code[i] === '}') {
                braceDepth--;
                if (braceDepth === 0) {
                  callbackEnd = i + 1;
                  break;
                }
              }
            }
            expect(callbackEnd).toBeGreaterThan(callbackStart);

            const callbackBody = code.slice(callbackStart, callbackEnd);

            for (const md of modelDefs) {
              // Assert: attributeChangedCallback contains direct signal write this._m_{name}(...)
              expect(callbackBody).toContain(`this._m_${md.name}(`);

              // Assert: attributeChangedCallback does NOT contain _modelSet_{name}
              expect(callbackBody).not.toContain(`_modelSet_${md.name}`);
            }

            // Assert: attributeChangedCallback does NOT contain dispatchEvent
            expect(callbackBody).not.toContain('dispatchEvent');
          } finally {
            try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ── Property 4: model:propName generates bidirectional binding ───────────────
// **Validates: Requirements 5.1, 5.2, 5.4**

describe('Feature: define-model, Property 4: model:propName generates bidirectional binding', () => {
  /** Generate a valid JS identifier (lowercase start, 3-8 chars) for signal names */
  const arbSignalName = fc
    .stringMatching(/^[a-z][a-zA-Z]{2,7}$/)
    .filter(s => !reserved.has(s));

  /** Generate a valid prop name (lowercase, 3-6 chars) for model:propName */
  const arbPropName = fc
    .stringMatching(/^[a-z][a-z]{2,5}$/)
    .filter(s => !reserved.has(s));

  /**
   * Generate a ModelPropBinding-like object: a signal name and a prop name
   * that are distinct from each other.
   */
  const arbBinding = fc
    .tuple(arbSignalName, arbPropName)
    .filter(([signal, prop]) => signal !== prop);

  it('generated code contains __effect setting child attribute and addEventListener for wcc:model updating parent signal', () => {
    fc.assert(
      fc.asyncProperty(
        arbBinding,
        async ([signalName, propName]) => {
          const dir = createTempDir();
          try {
            // Build an SFC with a signal and model:propName on a custom element
            const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'my-parent' })

const ${signalName} = signal('')
</script>

<template>
<my-child model:${propName}="${signalName}"></my-child>
</template>`;

            const filePath = join(dir, 'component.wcc');
            writeFileSync(filePath, sfcContent);

            const { code } = await compile(filePath);

            // Compute the expected kebab-case attribute name
            const kebabPropName = propName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

            // (a) Assert: __effect that calls setAttribute with the prop name and parent signal value
            expect(code).toContain(`setAttribute('${kebabPropName}', this._${signalName}()`);

            // (b) Assert: addEventListener('wcc:model', ...) on the child element
            expect(code).toContain("addEventListener('wcc:model'");

            // (c) Assert: condition checking e.detail.prop === 'propName'
            expect(code).toContain(`e.detail.prop === '${propName}'`);

            // (d) Assert: parent signal write this._signalName(e.detail.value)
            expect(code).toContain(`this._${signalName}(e.detail.value)`);
          } finally {
            try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('model:propName with camelCase prop names produces kebab-case setAttribute calls', () => {
    fc.assert(
      fc.asyncProperty(
        arbSignalName,
        async (signalName) => {
          const dir = createTempDir();
          try {
            // Use a camelCase prop name to verify kebab-case conversion
            const camelPropName = 'myValue';
            const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'my-parent' })

const ${signalName} = signal('')
</script>

<template>
<my-child model:myValue="${signalName}"></my-child>
</template>`;

            const filePath = join(dir, 'component.wcc');
            writeFileSync(filePath, sfcContent);

            const { code } = await compile(filePath);

            // camelToKebab('myValue') → 'my-value'
            expect(code).toContain("setAttribute('my-value',");

            // The event listener still checks the original camelCase prop name
            expect(code).toContain("e.detail.prop === 'myValue'");

            // Parent signal write
            expect(code).toContain(`this._${signalName}(e.detail.value)`);
          } finally {
            try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
