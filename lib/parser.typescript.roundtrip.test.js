/**
 * Property-based test: Parser Round-Trip with TypeScript Sources (Property 5)
 *
 * For any valid TypeScript component source containing defineComponent(),
 * signal<T>(), computed<T>(), effect(), function, defineProps<T>(), and
 * defineEmits<T>(), parsing the TypeScript source → printing the IR →
 * parsing the printed JavaScript SHALL produce an equivalent IR.
 *
 * Feature: typescript-support, Property 5: Parser Round-Trip (TypeScript Sources)
 * Validates: Requirements 10.1, 10.2, 10.3
 */

import { describe, it, expect, afterEach } from 'vitest';
import fc from 'fast-check';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse } from './parser.js';
import { prettyPrint } from './printer.js';

// ── Helpers ─────────────────────────────────────────────────────────

/** @type {string[]} */
const tempDirs = [];

function createTempDir() {
  const dir = join(
    tmpdir(),
    `wcc-ts-rt-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
  'emit', 'defineProps', 'defineEmits', 'defineComponent', 'false',
  'onMount', 'onDestroy', 'templateRef',
]);

const genTagPart = fc.stringMatching(/^[a-z]{2,6}$/);
const genTagName = fc.tuple(genTagPart, genTagPart).map(([a, b]) => `${a}-${b}`);

const genIdentifier = fc.stringMatching(/^[a-z][a-zA-Z]{1,8}$/).filter(s => !reserved.has(s));

const genSignalValue = fc.oneof(
  fc.integer().map(String),
  fc.constant("'hello'"),
  fc.constant('true'),
  fc.constant('false')
);

const genTypeAnnotation = fc.constantFrom('string', 'number', 'boolean');

/**
 * Generate a TypeScript component spec with optional generics.
 */
const genTsComponentSpec = fc.tuple(
  genTagName,
  fc.array(fc.tuple(genIdentifier, genSignalValue, genTypeAnnotation), { minLength: 0, maxLength: 3 }),
  fc.array(fc.tuple(genIdentifier, fc.constant(null)), { minLength: 0, maxLength: 2 }),
  fc.boolean(), // has effect
  fc.array(fc.tuple(genIdentifier, fc.constant(null)), { minLength: 0, maxLength: 2 }),
  fc.boolean(), // has defineProps generic
  fc.boolean(), // has defineEmits generic
).chain(([tagName, signalTriples, computedPairs, hasEffect, methodPairs, hasPropsGeneric, hasEmitsGeneric]) => {
  const usedNames = new Set();
  const signals = [];
  for (const [name, value, type] of signalTriples) {
    if (!usedNames.has(name)) {
      usedNames.add(name);
      signals.push({ name, value, type });
    }
  }

  const computeds = [];
  for (const [name] of computedPairs) {
    if (!usedNames.has(name)) {
      usedNames.add(name);
      const body = signals.length > 0 ? `${signals[0].name}() * 2` : '42';
      computeds.push({ name, body });
    }
  }

  const effects = [];
  if (hasEffect && signals.length > 0) {
    effects.push({ body: `console.log(${signals[0].name}())` });
  }

  const methods = [];
  for (const [name] of methodPairs) {
    if (!usedNames.has(name)) {
      usedNames.add(name);
      const body = signals.length > 0
        ? `${signals[0].name}.set(${signals[0].name}() + 1)`
        : `console.log('${name}')`;
      methods.push({ name, params: '', body });
    }
  }

  // Generate prop names (distinct from signals/computeds/methods)
  const propNames = [];
  if (hasPropsGeneric) {
    // Generate 1-3 prop names
    return fc.uniqueArray(genIdentifier.filter(n => !usedNames.has(n)), { minLength: 1, maxLength: 3 })
      .chain(pNames => {
        for (const p of pNames) usedNames.add(p);

        // Generate event names
        const eventNames = [];
        if (hasEmitsGeneric) {
          return fc.uniqueArray(
            fc.stringMatching(/^[a-z][a-z\-]{1,8}$/),
            { minLength: 1, maxLength: 2 }
          ).map(eNames => ({
            tagName, signals, computeds, effects, methods,
            propNames: pNames, eventNames: eNames,
            hasPropsGeneric, hasEmitsGeneric,
          }));
        }

        return fc.constant({
          tagName, signals, computeds, effects, methods,
          propNames: pNames, eventNames,
          hasPropsGeneric, hasEmitsGeneric,
        });
      });
  }

  if (hasEmitsGeneric) {
    return fc.uniqueArray(
      fc.stringMatching(/^[a-z][a-z\-]{1,8}$/),
      { minLength: 1, maxLength: 2 }
    ).map(eNames => ({
      tagName, signals, computeds, effects, methods,
      propNames: [], eventNames: eNames,
      hasPropsGeneric, hasEmitsGeneric,
    }));
  }

  return fc.constant({
    tagName, signals, computeds, effects, methods,
    propNames: [], eventNames: [],
    hasPropsGeneric, hasEmitsGeneric,
  });
});

/**
 * Build a TypeScript source string from a component spec.
 */
function buildTsSource(spec) {
  const lines = [];

  // Import
  const macros = ['defineComponent'];
  if (spec.propNames.length > 0) macros.push('defineProps');
  if (spec.eventNames.length > 0) macros.push('defineEmits');
  if (spec.signals.length > 0) macros.push('signal');
  if (spec.computeds.length > 0) macros.push('computed');
  if (spec.effects.length > 0) macros.push('effect');
  lines.push(`import { ${macros.join(', ')} } from 'wcc'`);
  lines.push('');

  // defineComponent
  lines.push('export default defineComponent({');
  lines.push(`  tag: '${spec.tagName}',`);
  lines.push(`  template: './${spec.tagName}.html',`);
  lines.push('})');
  lines.push('');

  // defineProps with generic
  if (spec.propNames.length > 0) {
    const entries = spec.propNames.map(n => `${n}: string`).join(', ');
    lines.push(`const props = defineProps<{ ${entries} }>()`);
    lines.push('');
  }

  // defineEmits with generic
  if (spec.eventNames.length > 0) {
    const sigs = spec.eventNames.map(n => `(e: '${n}'): void`).join('; ');
    lines.push(`const emit = defineEmits<{ ${sigs} }>()`);
    lines.push('');
  }

  // Signals with type annotations
  for (const s of spec.signals) {
    lines.push(`const ${s.name} = signal<${s.type}>(${s.value})`);
  }
  if (spec.signals.length > 0) lines.push('');

  // Computeds
  for (const c of spec.computeds) {
    lines.push(`const ${c.name} = computed(() => ${c.body})`);
  }
  if (spec.computeds.length > 0) lines.push('');

  // Effects
  for (const e of spec.effects) {
    lines.push('effect(() => {');
    lines.push(`  ${e.body}`);
    lines.push('})');
  }
  if (spec.effects.length > 0) lines.push('');

  // Methods
  for (const m of spec.methods) {
    lines.push(`function ${m.name}(${m.params}) {`);
    lines.push(`  ${m.body}`);
    lines.push('}');
  }

  return lines.join('\n') + '\n';
}

// ── Comparison helper ───────────────────────────────────────────────

function compareIRs(ir1, ir2) {
  expect(ir2.tagName).toBe(ir1.tagName);
  expect(ir2.className).toBe(ir1.className);

  // Signals
  expect(ir2.signals).toEqual(ir1.signals);

  // Computeds
  expect(ir2.computeds).toEqual(ir1.computeds);

  // Effects
  expect(ir2.effects.length).toBe(ir1.effects.length);
  for (let i = 0; i < ir1.effects.length; i++) {
    expect(ir2.effects[i].body.trim()).toBe(ir1.effects[i].body.trim());
  }

  // Methods
  expect(ir2.methods.length).toBe(ir1.methods.length);
  for (let i = 0; i < ir1.methods.length; i++) {
    expect(ir2.methods[i].name).toBe(ir1.methods[i].name);
    expect(ir2.methods[i].params).toBe(ir1.methods[i].params);
    expect(ir2.methods[i].body.trim()).toBe(ir1.methods[i].body.trim());
  }

  // Props
  expect(ir2.propDefs.length).toBe(ir1.propDefs.length);
  for (let i = 0; i < ir1.propDefs.length; i++) {
    expect(ir2.propDefs[i].name).toBe(ir1.propDefs[i].name);
    expect(ir2.propDefs[i].attrName).toBe(ir1.propDefs[i].attrName);
    // Defaults should match (generic-extracted props get 'undefined')
    expect(ir2.propDefs[i].default).toBe(ir1.propDefs[i].default);
  }

  // Emits
  expect(ir2.emits).toEqual(ir1.emits);
}

// ── Property test ───────────────────────────────────────────────────

describe('Feature: typescript-support, Property 5: Parser Round-Trip (TypeScript Sources)', () => {
  it('parse(ts) → prettyPrint(js) → parse(js) produces equivalent IR', async () => {
    await fc.assert(
      fc.asyncProperty(genTsComponentSpec, async (spec) => {
        const dir1 = createTempDir();

        // Write TypeScript source + template
        const tsSource = buildTsSource(spec);
        const tsPath = join(dir1, 'comp.ts');
        writeFileSync(tsPath, tsSource);
        writeFileSync(join(dir1, `${spec.tagName}.html`), '<div>hello</div>');

        // First parse (TypeScript)
        const ir1 = await parse(tsPath);

        // Pretty-print to JavaScript
        const printed = prettyPrint(ir1);

        // Write printed JavaScript + template for second parse
        const dir2 = createTempDir();
        const jsPath = join(dir2, 'comp.js');
        writeFileSync(jsPath, printed);
        writeFileSync(join(dir2, `${spec.tagName}.html`), '<div>hello</div>');

        // Second parse (JavaScript)
        const ir2 = await parse(jsPath);

        // Compare
        compareIRs(ir1, ir2);
      }),
      { numRuns: 100 }
    );
  });
});
