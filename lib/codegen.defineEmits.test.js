/**
 * Tests for wcCompiler v2 Code Generator — defineEmits feature.
 *
 * Includes:
 * - Unit tests for _emit method generation, emit call transformation,
 *   emitsObjectName exclusion from reactive transforms
 * - Property tests for emit call transformation (Property 6),
 *   emits object name exclusion (Property 7)
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  generateComponent,
  transformExpr,
  transformMethodBody,
} from './codegen.js';

// ── Helper: build a minimal ParseResult with emits ──────────────────

function makeIR(overrides = {}) {
  return {
    tagName: 'my-comp',
    className: 'MyComp',
    template: '<div>hello</div>',
    style: '',
    signals: [],
    computeds: [],
    effects: [],
    methods: [],
    bindings: [],
    events: [],
    processedTemplate: '<div>hello</div>',
    propDefs: [],
    propsObjectName: null,
    emits: [],
    emitsObjectName: null,
    ...overrides,
  };
}

// ── Unit Tests: _emit method generation ─────────────────────────────

describe('generateComponent — _emit method', () => {
  it('generates _emit method when emits are declared', () => {
    const ir = makeIR({
      emits: ['change', 'reset'],
      emitsObjectName: 'emit',
    });

    const output = generateComponent(ir);
    expect(output).toContain('_emit(name, detail)');
    expect(output).toContain('this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))');
  });

  it('does not generate _emit method when no emits declared', () => {
    const ir = makeIR();
    const output = generateComponent(ir);
    expect(output).not.toContain('_emit');
  });
});

// ── Unit Tests: emit call transformation ────────────────────────────

describe('transformMethodBody — emit call transformation', () => {
  it('transforms emit calls to this._emit calls', () => {
    const result = transformMethodBody(
      "emit('change', count())",
      ['count'],
      [],
      null,
      new Set(),
      'emit'
    );
    expect(result).toBe("this._emit('change', this._count())");
  });

  it('transforms emit calls without payload', () => {
    const result = transformMethodBody(
      "emit('reset')",
      [],
      [],
      null,
      new Set(),
      'emit'
    );
    expect(result).toBe("this._emit('reset')");
  });

  it('does not transform non-emit function calls', () => {
    const result = transformMethodBody(
      "otherFunc('change')",
      [],
      [],
      null,
      new Set(),
      'emit'
    );
    expect(result).toBe("otherFunc('change')");
  });

  it('transforms emit calls in effect bodies', () => {
    const result = transformMethodBody(
      "emit('update', value())",
      ['value'],
      [],
      null,
      new Set(),
      'emit'
    );
    expect(result).toBe("this._emit('update', this._value())");
  });
});

describe('transformExpr — emit call transformation', () => {
  it('transforms emit calls in expressions', () => {
    const result = transformExpr(
      "emit('change', count())",
      ['count'],
      [],
      null,
      new Set(),
      'emit'
    );
    expect(result).toContain('this._emit(');
  });
});

// ── Unit Tests: emitsObjectName exclusion ───────────────────────────

describe('transformMethodBody — emitsObjectName exclusion', () => {
  it('excludes emitsObjectName from signal transforms', () => {
    const result = transformMethodBody(
      "emit('change')",
      ['emit'],
      [],
      null,
      new Set(),
      'emit'
    );
    // Should be transformed to this._emit('change'), NOT this._emit()('change')
    expect(result).toBe("this._emit('change')");
    expect(result).not.toContain('this._emit()');
  });

  it('excludes emitsObjectName from computed transforms', () => {
    const result = transformMethodBody(
      "emit('change')",
      [],
      ['emit'],
      null,
      new Set(),
      'emit'
    );
    expect(result).toBe("this._emit('change')");
    expect(result).not.toContain('this._c_emit');
  });

  it('transforms signals alongside emit calls correctly', () => {
    const result = transformMethodBody(
      "emit('change', count())",
      ['count'],
      [],
      null,
      new Set(),
      'emit'
    );
    expect(result).toBe("this._emit('change', this._count())");
  });
});

describe('transformExpr — emitsObjectName exclusion', () => {
  it('excludes emitsObjectName from signal transforms in expressions', () => {
    const result = transformExpr(
      'emit + count',
      ['count', 'emit'],
      [],
      null,
      new Set(),
      'emit'
    );
    // emit should NOT be transformed as a signal
    expect(result).not.toContain('this._emit()');
    expect(result).toContain('this._count()');
  });

  it('excludes emitsObjectName from computed transforms in expressions', () => {
    const result = transformExpr(
      'emit + doubled',
      [],
      ['doubled', 'emit'],
      null,
      new Set(),
      'emit'
    );
    expect(result).not.toContain('this._c_emit');
    expect(result).toContain('this._c_doubled()');
  });
});

// ── Unit Tests: full generateComponent with emits ───────────────────

describe('generateComponent — emit call transformation in methods', () => {
  it('transforms emit calls in generated method bodies', () => {
    const ir = makeIR({
      emits: ['change'],
      emitsObjectName: 'emit',
      signals: [{ name: 'count', value: '0' }],
      methods: [{ name: 'handleClick', params: '', body: "emit('change', count())" }],
    });

    const output = generateComponent(ir);
    expect(output).toContain("this._emit('change', this._count())");
  });

  it('transforms emit calls in generated effect bodies', () => {
    const ir = makeIR({
      emits: ['update'],
      emitsObjectName: 'emit',
      signals: [{ name: 'value', value: '0' }],
      effects: [{ body: "emit('update', value())" }],
    });

    const output = generateComponent(ir);
    expect(output).toContain("this._emit('update', this._value())");
  });

  it('does not treat emitsObjectName as a signal in generated output', () => {
    const ir = makeIR({
      emits: ['change'],
      emitsObjectName: 'emit',
      signals: [{ name: 'count', value: '0' }],
      methods: [{ name: 'handleClick', params: '', body: "emit('change')" }],
    });

    const output = generateComponent(ir);
    // Should NOT contain this._emit() as a signal read pattern
    expect(output).not.toMatch(/this\._emit\(\)(?!\s*\{)/);
  });
});

// ── Property-Based Tests ────────────────────────────────────────────

const reserved = new Set([
  'if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else',
  'enum', 'eval', 'null', 'this', 'true', 'void', 'with', 'const', 'break',
  'class', 'super', 'while', 'yield', 'return', 'typeof', 'delete', 'switch',
  'export', 'import', 'default', 'signal', 'computed', 'effect', 'props',
  'emit', 'defineProps', 'defineEmits', 'defineComponent', 'false', 'name',
  'detail', 'set',
]);

const arbIdentifier = fc
  .stringMatching(/^[a-z][a-zA-Z]{2,8}$/)
  .filter(s => !reserved.has(s));

const arbEventName = fc
  .stringMatching(/^[a-z][a-z]{1,8}$/)
  .filter(s => !reserved.has(s));

const arbEmitsObjectName = fc.constantFrom('emit', 'fire', 'dispatch');

/**
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
 *
 * Property 6: Emit Call Transformation
 *
 * For any method body containing emitsObjectName('eventName', payload) calls,
 * the transformation SHALL replace every emitsObjectName( with this._emit(
 * and SHALL NOT transform other function calls.
 *
 * Feature: define-emits, Property 6: Emit Call Transformation
 */
describe('Feature: define-emits, Property 6: Emit Call Transformation', () => {
  it('transforms every emitsObjectName( to this._emit( and leaves other calls unchanged', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          arbEmitsObjectName,
          fc.uniqueArray(arbEventName, { minLength: 1, maxLength: 3 }),
          arbIdentifier
        ),
        ([emitsObjName, eventNames, otherFn]) => {
          // Build a method body with emit calls and a non-emit call
          const emitCalls = eventNames.map(e => `${emitsObjName}('${e}', data)`).join('\n');
          const body = `${emitCalls}\n${otherFn}('test')`;

          const result = transformMethodBody(body, [], [], null, new Set(), emitsObjName);

          // Every emit call should be transformed
          for (const e of eventNames) {
            expect(result).toContain(`this._emit('${e}', data)`);
            // The original emitsObjName( pattern should be replaced
            expect(result).not.toMatch(new RegExp(`(?<!\\.)\\b${emitsObjName}\\(`));
          }

          // Non-emit call should be unchanged
          expect(result).toContain(`${otherFn}('test')`);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 7.5, 8.1, 8.2, 8.3**
 *
 * Property 7: Emits Object Name Exclusion from Reactive Transforms
 *
 * For any method body where emitsObjectName appears alongside signal/computed references,
 * the transformation SHALL NOT apply signal/computed transforms to emitsObjectName.
 *
 * Feature: define-emits, Property 7: Emits Object Name Exclusion from Reactive Transforms
 */
describe('Feature: define-emits, Property 7: Emits Object Name Exclusion from Reactive Transforms', () => {
  it('does not apply signal/computed transforms to emitsObjectName', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          arbEmitsObjectName,
          fc.uniqueArray(arbIdentifier, { minLength: 1, maxLength: 3 })
        ),
        ([emitsObjName, signalNames]) => {
          // Build a body with emit call and signal reads
          const signalReads = signalNames.map(s => `${s}()`).join(' + ');
          const body = `${emitsObjName}('change', ${signalReads})`;

          const result = transformMethodBody(
            body,
            signalNames,
            [],
            null,
            new Set(),
            emitsObjName
          );

          // emitsObjectName should be transformed to this._emit(, not this._<name>()
          expect(result).toContain("this._emit('change'");
          expect(result).not.toContain(`this._${emitsObjName}()`);
          expect(result).not.toContain(`this._c_${emitsObjName}()`);

          // Signal reads should be transformed
          for (const s of signalNames) {
            expect(result).toContain(`this._${s}()`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
