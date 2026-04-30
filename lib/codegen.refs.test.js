/**
 * Tests for code generation of template-refs.
 *
 * Includes:
 * - Property test for codegen constructor and getter structure (Property 3)
 * - Unit tests for codegen edge cases
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateComponent, transformMethodBody } from './codegen.js';

// ── Helpers ─────────────────────────────────────────────────────────

/** Build a minimal ParseResult with refs */
function makeParseResult(overrides = {}) {
  return {
    tagName: 'wcc-test',
    className: 'WccTest',
    template: '<div></div>',
    style: '',
    signals: [],
    computeds: [],
    effects: [],
    methods: [],
    bindings: [],
    events: [],
    processedTemplate: '<div></div>',
    propDefs: [],
    propsObjectName: null,
    emits: [],
    emitsObjectName: null,
    ifBlocks: [],
    showBindings: [],
    forBlocks: [],
    onMountHooks: [],
    onDestroyHooks: [],
    modelBindings: [],
    attrBindings: [],
    slots: [],
    refs: [],
    refBindings: [],
    ...overrides,
  };
}

/** Generate a valid JS identifier */
const identifierArb = fc
  .stringMatching(/^[a-z][a-z]{1,7}$/)
  .filter(s => !['if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else', 'enum', 'eval', 'null', 'this', 'true', 'void', 'with'].includes(s));

/** Generate a valid DOM path segment */
const pathSegArb = fc.nat({ max: 10 }).map(n => `childNodes[${n}]`);

// ── Property Test: Codegen Constructor and Getter Structure (Property 3) ──

describe('Feature: template-refs, Property 3: Codegen Constructor and Getter Structure', () => {
  /**
   * **Validates: Requirements 3.1, 3.2, 4.1, 4.2, 8.1**
   */
  it('generates constructor assignments and getter methods for all matched refs', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(identifierArb, identifierArb, fc.array(pathSegArb, { minLength: 1, maxLength: 3 })),
          { minLength: 1, maxLength: 4 }
        ),
        (refSpecs) => {
          // Deduplicate by varName and refName
          const seenVar = new Set();
          const seenRef = new Set();
          const unique = refSpecs.filter(([varName, refName]) => {
            if (seenVar.has(varName) || seenRef.has(refName)) return false;
            seenVar.add(varName);
            seenRef.add(refName);
            return true;
          });
          if (unique.length === 0) return;

          const refs = unique.map(([varName, refName]) => ({ varName, refName }));
          const refBindings = unique.map(([, refName, path]) => ({ refName, path }));

          const pr = makeParseResult({ refs, refBindings });
          const output = generateComponent(pr);

          for (const [varName, refName, path] of unique) {
            // Constructor assignment: this._ref_<refName> = __root.<path>
            const pathStr = path.join('.');
            expect(output).toContain(`this._ref_${refName} = __root.${pathStr}`);

            // Getter: get _<varName>() { return { value: this._ref_<refName> }; }
            expect(output).toContain(`get _${varName}() { return { value: this._ref_${refName} }; }`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Unit Tests: Codegen Edge Cases ──────────────────────────────────

describe('codegen refs — unit tests', () => {
  it('ref assignment appears before appendChild in constructor', () => {
    const pr = makeParseResult({
      refs: [{ varName: 'canvas', refName: 'canvas' }],
      refBindings: [{ refName: 'canvas', path: ['childNodes[0]'] }],
    });
    const output = generateComponent(pr);

    const refAssignIdx = output.indexOf('this._ref_canvas = __root.childNodes[0]');
    const appendIdx = output.indexOf('this.appendChild(__root)');
    expect(refAssignIdx).toBeGreaterThan(-1);
    expect(appendIdx).toBeGreaterThan(-1);
    expect(refAssignIdx).toBeLessThan(appendIdx);
  });

  it('getter returns object with .value property', () => {
    const pr = makeParseResult({
      refs: [{ varName: 'canvas', refName: 'canvas' }],
      refBindings: [{ refName: 'canvas', path: ['childNodes[0]'] }],
    });
    const output = generateComponent(pr);

    expect(output).toContain('get _canvas() { return { value: this._ref_canvas }; }');
  });

  it('multiple refs generate multiple assignments and getters', () => {
    const pr = makeParseResult({
      refs: [
        { varName: 'canvas', refName: 'canvas' },
        { varName: 'input', refName: 'input' },
      ],
      refBindings: [
        { refName: 'canvas', path: ['childNodes[0]'] },
        { refName: 'input', path: ['childNodes[1]'] },
      ],
    });
    const output = generateComponent(pr);

    expect(output).toContain('this._ref_canvas = __root.childNodes[0]');
    expect(output).toContain('this._ref_input = __root.childNodes[1]');
    expect(output).toContain('get _canvas()');
    expect(output).toContain('get _input()');
  });

  it('ref with different varName and refName generates correct mapping', () => {
    const pr = makeParseResult({
      refs: [{ varName: 'myCanvas', refName: 'canvas' }],
      refBindings: [{ refName: 'canvas', path: ['childNodes[0]'] }],
    });
    const output = generateComponent(pr);

    expect(output).toContain('this._ref_canvas = __root.childNodes[0]');
    expect(output).toContain('get _myCanvas() { return { value: this._ref_canvas }; }');
  });

  it('transformMethodBody rewrites canvas.value to this._canvas.value', () => {
    const result = transformMethodBody(
      'canvas.value.getContext("2d")',
      [], [], null, new Set(), null,
      ['canvas']
    );
    expect(result).toBe('this._canvas.value.getContext("2d")');
  });
});
