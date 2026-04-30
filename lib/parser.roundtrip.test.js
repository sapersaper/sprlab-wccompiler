/**
 * Property-based test: Parser Round-Trip (Property 1)
 *
 * For any valid component source, parsing into IR, printing back to source,
 * and parsing again should produce an equivalent IR.
 *
 * Feature: core, Property 1: Parser Round-Trip
 * Validates: Requirements 1.1, 1.4, 1.5, 1.6, 1.7, 11.1, 11.2
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
    `wcc-rt-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
  tempDirs.length = 0;
});

// ── Generators ──────────────────────────────────────────────────────

const genTagPart = fc.stringMatching(/^[a-z]{2,6}$/);
const genTagName = fc.tuple(genTagPart, genTagPart).map(([a, b]) => `${a}-${b}`);

const genSignalName = fc.stringMatching(/^[a-z][a-zA-Z]{1,8}$/);
const genSignalValue = fc.oneof(
  fc.integer().map(String),
  fc.constant("'hello'"),
  fc.constant('true'),
  fc.constant('false')
);

const genComputedName = fc.stringMatching(/^[a-z][a-zA-Z]{1,8}$/);

const genFunctionName = fc.stringMatching(/^[a-z][a-zA-Z]{1,8}$/);

// ── Component source generator ──────────────────────────────────────

/**
 * @typedef {Object} ComponentSpec
 * @property {string} tagName
 * @property {{ name: string, value: string }[]} signals
 * @property {{ name: string, signalRef: string }[]} computeds
 * @property {{ signalRef: string }[]} effects
 * @property {{ name: string, signalRef: string }[]} methods
 */

const genComponentSpec = fc
  .tuple(
    genTagName,
    fc.array(fc.tuple(genSignalName, genSignalValue), { minLength: 0, maxLength: 3 }),
    fc.array(fc.tuple(genComputedName, fc.constant(null)), { minLength: 0, maxLength: 2 }),
    fc.boolean(), // has effect
    fc.array(fc.tuple(genFunctionName, fc.constant(null)), { minLength: 0, maxLength: 2 })
  )
  .chain(([tagName, signalPairs, computedPairs, hasEffect, methodPairs]) => {
    // Deduplicate names across all categories
    const usedNames = new Set();
    const signals = [];
    for (const [name, value] of signalPairs) {
      if (!usedNames.has(name)) {
        usedNames.add(name);
        signals.push({ name, value });
      }
    }

    const computeds = [];
    for (const [name] of computedPairs) {
      if (!usedNames.has(name)) {
        usedNames.add(name);
        // If we have signals, reference one; otherwise use a literal
        const body =
          signals.length > 0 ? `${signals[0].name}() * 2` : '42';
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
        // If we have signals, reference one; otherwise use a simple body
        const body =
          signals.length > 0
            ? `${signals[0].name}.set(${signals[0].name}() + 1)`
            : `console.log('${name}')`;
        methods.push({ name, params: '', body });
      }
    }

    return fc.constant({
      tagName,
      signals,
      computeds,
      effects,
      methods,
    });
  });

/**
 * Build a .js source string from a component spec.
 */
function buildSource(spec) {
  const lines = [];

  // Import
  const macros = ['defineComponent'];
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

  // Signals
  for (const s of spec.signals) {
    lines.push(`const ${s.name} = signal(${s.value})`);
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
}

// ── Property test ───────────────────────────────────────────────────

describe('Feature: core, Property 1: Parser Round-Trip', () => {
  it('parse → prettyPrint → parse produces equivalent IR', async () => {
    await fc.assert(
      fc.asyncProperty(genComponentSpec, async (spec) => {
        const dir = createTempDir();

        // Write source + template for first parse
        const source = buildSource(spec);
        const srcPath = join(dir, 'comp.js');
        writeFileSync(srcPath, source);
        writeFileSync(join(dir, `${spec.tagName}.html`), '<div>hello</div>');

        // First parse
        const ir1 = await parse(srcPath);

        // Pretty-print
        const printed = prettyPrint(ir1);

        // Write printed source + template for second parse
        const dir2 = createTempDir();
        const srcPath2 = join(dir2, 'comp.js');
        writeFileSync(srcPath2, printed);
        writeFileSync(join(dir2, `${spec.tagName}.html`), '<div>hello</div>');

        // Second parse
        const ir2 = await parse(srcPath2);

        // Compare
        compareIRs(ir1, ir2);
      }),
      { numRuns: 100 }
    );
  });
});
