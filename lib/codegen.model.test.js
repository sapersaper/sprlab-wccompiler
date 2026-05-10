/**
 * Tests for wcCompiler v2 Code Generator — model directive extensions.
 *
 * Includes:
 * - Property tests for signal-to-DOM effect structure (Property 4)
 * - Property tests for DOM-to-signal event listener structure (Property 5)
 * - Unit tests for codegen edge cases
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateComponent, pathExpr } from './codegen.js';

// ── Generators ──────────────────────────────────────────────────────

/** Generate a valid kebab-case tag name */
const arbTagName = fc
  .tuple(
    fc.stringMatching(/^[a-z]{2,6}$/),
    fc.stringMatching(/^[a-z]{2,6}$/)
  )
  .map(([a, b]) => `${a}-${b}`);

/** Convert kebab-case to PascalCase */
function toClassName(tag) {
  return tag
    .split('-')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

/** Generate a valid JS identifier */
const arbIdentifier = fc
  .stringMatching(/^[a-z][a-z]{1,7}$/)
  .filter(s => !['if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else', 'enum', 'eval', 'null', 'this', 'true', 'void', 'with'].includes(s));

/** Generate a ModelBinding */
const arbModelBinding = fc.record({
  signal: arbIdentifier,
  prop: fc.constantFrom('value', 'checked'),
  event: fc.constantFrom('input', 'change'),
  coerce: fc.boolean(),
  radioValue: fc.oneof(fc.constant(null), fc.constantFrom('red', 'blue', 'green')),
  path: fc.array(fc.nat({ max: 5 }).map(n => `childNodes[${n}]`), { minLength: 1, maxLength: 3 }),
}).chain(mb => {
  // Ensure consistency: checked → change, value → input/change
  if (mb.prop === 'checked') {
    return fc.constant({ ...mb, event: 'change', coerce: false });
  }
  // value prop: coerce only with input event
  if (mb.coerce) {
    return fc.constant({ ...mb, event: 'input', radioValue: null });
  }
  return fc.constant({ ...mb, radioValue: null });
});

/** Generate a ParseResult with ModelBindings */
const arbParseResultWithModel = fc.record({
  tagName: arbTagName,
  signals: fc.array(fc.record({ name: arbIdentifier, value: fc.constantFrom('0', "''", 'null') }), { minLength: 1, maxLength: 3 }),
  modelBindings: fc.array(arbModelBinding, { minLength: 1, maxLength: 4 }),
}).chain(r => {
  // Deduplicate signal names
  const usedNames = new Set();
  const signals = r.signals.filter(s => {
    if (usedNames.has(s.name)) return false;
    usedNames.add(s.name);
    return true;
  });

  // Assign sequential varNames and ensure signal names exist
  const modelBindings = r.modelBindings.map((mb, i) => {
    // Pick a signal name from the available signals
    const signalName = signals[i % signals.length].name;
    return { ...mb, varName: `__model${i}`, signal: signalName };
  });

  return fc.constant({
    tagName: r.tagName,
    className: toClassName(r.tagName),
    template: '<div>test</div>',
    style: '',
    signals,
    computeds: [],
    effects: [],
    methods: [],
    bindings: [],
    events: [],
    showBindings: [],
    processedTemplate: '<div>test</div>',
    modelBindings,
  });
});

// ── Property Tests ──────────────────────────────────────────────────

/**
 * **Validates: Requirements 4.1, 4.2, 4.3, 6.1, 6.2, 6.3, 9.2, 9.4**
 *
 * Property 4: Codegen Signal-to-DOM Effect Structure
 *
 * For any ParseResult containing ModelBindings, the generated JavaScript
 * SHALL contain: a DOM element reference assignment per ModelBinding in
 * the constructor, and an __effect per ModelBinding in connectedCallback
 * that reads the signal and sets the appropriate DOM property.
 *
 * Feature: model-directive, Property 4: Codegen Signal-to-DOM Effect Structure
 */
describe('Feature: model-directive, Property 4: Codegen Signal-to-DOM Effect Structure', () => {
  it('generates DOM refs in connectedCallback and __effect per ModelBinding in connectedCallback', () => {
    fc.assert(
      fc.property(arbParseResultWithModel, (ir) => {
        const output = generateComponent(ir);

        // connectedCallback: DOM element reference per ModelBinding
        for (const mb of ir.modelBindings) {
          const expectedRef = `this.${mb.varName} = ${pathExpr(mb.path, '__root')}`;
          expect(output).toContain(expectedRef);
        }

        // connectedCallback: __effect per ModelBinding
        const ccStart = output.indexOf('connectedCallback()');
        expect(ccStart).toBeGreaterThan(-1);
        const afterCC = output.slice(ccStart);

        for (const mb of ir.modelBindings) {
          if (mb.prop === 'checked' && mb.radioValue !== null) {
            // Radio: compare to radioValue
            expect(afterCC).toContain(`this.${mb.varName}.checked = (this._${mb.signal}() === '${mb.radioValue}')`);
          } else if (mb.prop === 'checked') {
            // Checkbox: coerce to boolean
            expect(afterCC).toContain(`this.${mb.varName}.checked = !!this._${mb.signal}()`);
          } else {
            // Value-based
            expect(afterCC).toContain(`this.${mb.varName}.value = this._${mb.signal}() ?? ''`);
          }
        }

        // DOM refs must appear before appendChild (both now in connectedCallback)
        const ccSection = output.slice(output.indexOf('connectedCallback()'));
        const appendIdx = ccSection.indexOf('this.appendChild(__root)');
        for (const mb of ir.modelBindings) {
          const refIdx = ccSection.indexOf(`this.${mb.varName} = `);
          expect(refIdx).toBeGreaterThan(-1);
          expect(refIdx).toBeLessThan(appendIdx);
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 9.3**
 *
 * Property 5: Codegen DOM-to-Signal Event Listener Structure
 *
 * For any ParseResult containing ModelBindings, the generated JavaScript
 * SHALL contain one addEventListener call per ModelBinding with the correct
 * event name, correct DOM property read, and Number() wrapping for coerced bindings.
 *
 * Feature: model-directive, Property 5: Codegen DOM-to-Signal Event Listener Structure
 */
describe('Feature: model-directive, Property 5: Codegen DOM-to-Signal Event Listener Structure', () => {
  it('generates one addEventListener per ModelBinding with correct event and value read', () => {
    fc.assert(
      fc.property(arbParseResultWithModel, (ir) => {
        const output = generateComponent(ir);

        const ccStart = output.indexOf('connectedCallback()');
        const afterCC = output.slice(ccStart);

        for (const mb of ir.modelBindings) {
          // Check addEventListener with correct event
          expect(afterCC).toContain(`this.${mb.varName}.addEventListener('${mb.event}'`);

          if (mb.prop === 'checked' && mb.radioValue === null) {
            // Checkbox: e.target.checked
            expect(afterCC).toContain(`this._${mb.signal}(e.target.checked)`);
          } else if (mb.coerce) {
            // Number: Number(e.target.value)
            expect(afterCC).toContain(`this._${mb.signal}(Number(e.target.value))`);
          } else {
            // All others: e.target.value
            expect(afterCC).toContain(`this._${mb.signal}(e.target.value)`);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ── Unit Tests for Edge Cases ───────────────────────────────────────

describe('generateComponent — model edge cases', () => {
  /** Helper to create a minimal ParseResult with model bindings */
  function makeIR(modelBindings) {
    return {
      tagName: 'wcc-form',
      className: 'WccForm',
      template: '<div>test</div>',
      style: '',
      signals: [
        { name: 'name', value: "''" },
        { name: 'agreed', value: 'false' },
        { name: 'color', value: "'red'" },
        { name: 'age', value: '0' },
        { name: 'category', value: "'a'" },
      ],
      computeds: [],
      effects: [],
      methods: [],
      bindings: [],
      events: [],
      showBindings: [],
      processedTemplate: '<div>test</div>',
      modelBindings,
    };
  }

  it('generates Number() coercion for input type="number"', () => {
    const ir = makeIR([
      { varName: '__model0', signal: 'age', prop: 'value', event: 'input', coerce: true, radioValue: null, path: ['childNodes[0]'] },
    ]);
    const output = generateComponent(ir);

    expect(output).toContain('this._age(Number(e.target.value))');
  });

  it('generates radio checked comparison with radioValue', () => {
    const ir = makeIR([
      { varName: '__model0', signal: 'color', prop: 'checked', event: 'change', coerce: false, radioValue: 'red', path: ['childNodes[0]'] },
    ]);
    const output = generateComponent(ir);

    expect(output).toContain("this.__model0.checked = (this._color() === 'red')");
    expect(output).toContain("this.__model0.addEventListener('change'");
    expect(output).toContain('this._color(e.target.value)');
  });

  it('generates multiple model effects in document order', () => {
    const ir = makeIR([
      { varName: '__model0', signal: 'name', prop: 'value', event: 'input', coerce: false, radioValue: null, path: ['childNodes[0]'] },
      { varName: '__model1', signal: 'agreed', prop: 'checked', event: 'change', coerce: false, radioValue: null, path: ['childNodes[1]'] },
      { varName: '__model2', signal: 'age', prop: 'value', event: 'input', coerce: true, radioValue: null, path: ['childNodes[2]'] },
    ]);
    const output = generateComponent(ir);

    // Effects should appear in order
    const effect0 = output.indexOf("this.__model0.value = this._name()");
    const effect1 = output.indexOf("this.__model1.checked = !!this._agreed()");
    const effect2 = output.indexOf("this.__model2.value = this._age()");

    expect(effect0).toBeGreaterThan(-1);
    expect(effect1).toBeGreaterThan(effect0);
    expect(effect2).toBeGreaterThan(effect1);
  });

  it('generates model effects alongside other effects', () => {
    const ir = {
      tagName: 'wcc-form',
      className: 'WccForm',
      template: '<div>{{name}}</div><input>',
      style: '',
      signals: [{ name: 'name', value: "''" }],
      computeds: [],
      effects: [],
      methods: [],
      bindings: [
        { varName: '__b0', name: 'name', type: 'signal', path: ['childNodes[0]'] },
      ],
      events: [],
      showBindings: [],
      processedTemplate: '<div></div><input>',
      modelBindings: [
        { varName: '__model0', signal: 'name', prop: 'value', event: 'input', coerce: false, radioValue: null, path: ['childNodes[1]'] },
      ],
    };
    const output = generateComponent(ir);

    // Both text binding effect and model effect should exist
    expect(output).toContain("this.__b0.textContent = this._name()");
    expect(output).toContain("this.__model0.value = this._name()");
    expect(output).toContain("this.__model0.addEventListener('input'");
  });

  it('assigns DOM references before appendChild', () => {
    const ir = makeIR([
      { varName: '__model0', signal: 'name', prop: 'value', event: 'input', coerce: false, radioValue: null, path: ['childNodes[0]'] },
    ]);
    const output = generateComponent(ir);

    const refIdx = output.indexOf('this.__model0 = __root.childNodes[0]');
    const appendIdx = output.indexOf('this.appendChild(__root)');

    expect(refIdx).toBeGreaterThan(-1);
    expect(appendIdx).toBeGreaterThan(-1);
    expect(refIdx).toBeLessThan(appendIdx);
  });
});
