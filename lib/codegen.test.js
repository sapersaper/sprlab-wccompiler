/**
 * Tests for wcCompiler v2 Code Generator.
 *
 * Includes:
 * - Unit tests for transformExpr, transformMethodBody, pathExpr
 * - Integration test for full component generation
 * - Property tests for structural completeness (Property 10),
 *   signal/computed initialization (Property 11),
 *   and connectedCallback setup (Property 12)
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  generateComponent,
  transformExpr,
  transformMethodBody,
  pathExpr,
} from './codegen.js';

// ── Unit Tests ──────────────────────────────────────────────────────

describe('pathExpr', () => {
  it('returns rootVar when parts is empty', () => {
    expect(pathExpr([], '__root')).toBe('__root');
  });

  it('joins parts with dots after rootVar', () => {
    expect(pathExpr(['childNodes[0]', 'childNodes[1]'], '__root')).toBe(
      '__root.childNodes[0].childNodes[1]'
    );
  });

  it('handles a single part', () => {
    expect(pathExpr(['childNodes[2]'], '__root')).toBe(
      '__root.childNodes[2]'
    );
  });
});

describe('transformExpr', () => {
  it('transforms signal references to this._name()', () => {
    const result = transformExpr('count + 1', ['count'], []);
    expect(result).toBe('this._count() + 1');
  });

  it('transforms computed references to this._c_name()', () => {
    const result = transformExpr('doubled * 2', [], ['doubled']);
    expect(result).toBe('this._c_doubled() * 2');
  });

  it('transforms both signals and computeds in the same expression', () => {
    const result = transformExpr('count + doubled', ['count'], ['doubled']);
    expect(result).toBe('this._count() + this._c_doubled()');
  });

  it('does not transform names followed by .set(', () => {
    const result = transformExpr('count.set(5)', ['count'], []);
    expect(result).toBe('count.set(5)');
  });

  it('does not transform unrelated identifiers', () => {
    const result = transformExpr('x + y', ['count'], []);
    expect(result).toBe('x + y');
  });

  it('handles multiple occurrences of the same signal', () => {
    const result = transformExpr('count + count', ['count'], []);
    expect(result).toBe('this._count() + this._count()');
  });
});

describe('transformMethodBody', () => {
  it('transforms signal writes: x.set(value) → this._x(value)', () => {
    const result = transformMethodBody('count.set(count() + 1)', ['count'], []);
    expect(result).toBe('this._count(this._count() + 1)');
  });

  it('transforms signal reads: x() → this._x()', () => {
    const result = transformMethodBody('console.log(count())', ['count'], []);
    expect(result).toBe('console.log(this._count())');
  });

  it('transforms computed reads: x() → this._c_x()', () => {
    const result = transformMethodBody('console.log(doubled())', [], ['doubled']);
    expect(result).toBe('console.log(this._c_doubled())');
  });

  it('transforms both signal writes and reads in the same body', () => {
    const result = transformMethodBody(
      'count.set(count() + doubled())',
      ['count'],
      ['doubled']
    );
    expect(result).toBe('this._count(this._count() + this._c_doubled())');
  });

  it('leaves unrelated code untouched', () => {
    const result = transformMethodBody('console.log("hello")', ['count'], []);
    expect(result).toBe('console.log("hello")');
  });
});

describe('generateComponent — integration', () => {
  it('generates a complete component with all sections', () => {
    /** @type {import('./types.js').ParseResult} */
    const ir = {
      tagName: 'wcc-counter',
      className: 'WccCounter',
      template: '<div>{{count}}</div>',
      style: '.counter { color: red; }',
      signals: [{ name: 'count', value: '0' }],
      computeds: [{ name: 'doubled', body: 'count() * 2' }],
      effects: [{ body: "console.log('count changed:', count())" }],
      methods: [{ name: 'increment', params: '', body: 'count.set(count() + 1)' }],
      bindings: [
        { varName: '__b0', name: 'count', type: 'signal', path: ['childNodes[0]'] },
      ],
      events: [
        { varName: '__e0', event: 'click', handler: 'increment', path: ['childNodes[0]', 'childNodes[1]'] },
      ],
      processedTemplate: '<div></div>',
    };

    const output = generateComponent(ir);

    // 1. Reactive runtime
    expect(output).toContain('function __signal(initial)');
    expect(output).toContain('function __computed(fn)');
    expect(output).toContain('function __effect(fn)');

    // 2. CSS injection
    expect(output).toContain("document.createElement('style')");
    expect(output).toContain('document.head.appendChild');
    expect(output).toContain('wcc-counter .counter');

    // 3. Template
    expect(output).toContain("document.createElement('template')");
    expect(output).toContain('<div></div>');

    // 4. Class
    expect(output).toContain('class WccCounter extends HTMLElement');
    expect(output).toContain('constructor()');
    expect(output).toContain('connectedCallback()');

    // Signal init
    expect(output).toContain('this._count = __signal(0)');

    // Computed init
    expect(output).toContain('this._c_doubled = __computed(');

    // Binding effect
    expect(output).toContain('this.__b0.textContent = this._count()');

    // User effect
    expect(output).toContain("console.log('count changed:', this._count())");

    // Event listener (with AbortController signal)
    expect(output).toContain("this.__e0.addEventListener('click', this._increment.bind(this), { signal: this.__ac.signal })");

    // Method
    expect(output).toContain('_increment()');
    expect(output).toContain('this._count(this._count() + 1)');

    // 5. Registration
    expect(output).toContain("customElements.define('wcc-counter', WccCounter)");
  });

  it('omits CSS injection when style is empty', () => {
    const ir = {
      tagName: 'wcc-hello',
      className: 'WccHello',
      template: '<p>{{msg}}</p>',
      style: '',
      signals: [{ name: 'msg', value: "'hello'" }],
      computeds: [],
      effects: [],
      methods: [],
      bindings: [
        { varName: '__b0', name: 'msg', type: 'signal', path: ['childNodes[0]'] },
      ],
      events: [],
      processedTemplate: '<p></p>',
    };

    const output = generateComponent(ir);

    expect(output).not.toContain("document.createElement('style')");
    expect(output).not.toContain('document.head.appendChild');
    expect(output).toContain('class WccHello extends HTMLElement');
  });
});

// ── Property-Based Tests ────────────────────────────────────────────

// Generators for valid ParseResult IRs

/** Generate a valid kebab-case tag name like 'wcc-xxx' */
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

/** Generate a signal */
const arbSignal = fc.record({
  name: arbIdentifier,
  value: fc.constantFrom('0', '1', "''", "'hello'", '[]', 'null', 'true', 'false'),
});

/** Generate a computed */
const arbComputed = fc.record({
  name: arbIdentifier,
  body: fc.constant('1 + 1'),
});

/** Generate an effect */
const arbEffect = fc.record({
  body: fc.constant("console.log('effect')"),
});

/** Generate a method */
const arbMethod = fc.record({
  name: arbIdentifier,
  params: fc.constant(''),
  body: fc.constant("console.log('method')"),
});

/** Generate a binding */
const arbBinding = fc.record({
  varName: fc.nat({ max: 99 }).map(n => `__b${n}`),
  name: arbIdentifier,
  type: fc.constantFrom('signal', 'computed', 'method'),
  path: fc.array(fc.nat({ max: 5 }).map(n => `childNodes[${n}]`), { minLength: 1, maxLength: 3 }),
});

/** Generate an event binding */
const arbEvent = fc.record({
  varName: fc.nat({ max: 99 }).map(n => `__e${n}`),
  event: fc.constantFrom('click', 'input', 'change', 'submit', 'keydown'),
  handler: arbIdentifier,
  path: fc.array(fc.nat({ max: 5 }).map(n => `childNodes[${n}]`), { minLength: 1, maxLength: 3 }),
});

/**
 * Generate a valid ParseResult IR.
 * Ensures unique signal/computed/method names to avoid collisions.
 */
const arbParseResult = fc
  .record({
    tagName: arbTagName,
    style: fc.constantFrom('', '.cls { color: red; }', 'p { margin: 0; }'),
    signals: fc.array(arbSignal, { minLength: 0, maxLength: 3 }),
    computeds: fc.array(arbComputed, { minLength: 0, maxLength: 2 }),
    effects: fc.array(arbEffect, { minLength: 0, maxLength: 2 }),
    methods: fc.array(arbMethod, { minLength: 0, maxLength: 2 }),
    bindings: fc.array(arbBinding, { minLength: 0, maxLength: 3 }),
    events: fc.array(arbEvent, { minLength: 0, maxLength: 2 }),
  })
  .map(r => {
    // Deduplicate names
    const usedNames = new Set();
    const dedup = (arr, key) =>
      arr.filter(item => {
        if (usedNames.has(item[key])) return false;
        usedNames.add(item[key]);
        return true;
      });

    const signals = dedup(r.signals, 'name');
    const computeds = dedup(r.computeds, 'name');
    const methods = dedup(r.methods, 'name');

    return {
      tagName: r.tagName,
      className: toClassName(r.tagName),
      template: '<div>test</div>',
      style: r.style,
      signals,
      computeds,
      effects: r.effects,
      methods,
      bindings: r.bindings,
      events: r.events,
      processedTemplate: '<div>test</div>',
    };
  });

describe('Property 10: Codegen Structural Completeness', () => {
  it('generated output contains reactive runtime, class, connectedCallback, and customElements.define', () => {
    fc.assert(
      fc.property(arbParseResult, (ir) => {
        const output = generateComponent(ir);

        // Reactive runtime
        expect(output).toContain('function __signal(initial)');
        expect(output).toContain('function __computed(fn)');
        expect(output).toContain('function __effect(fn)');

        // Class definition
        expect(output).toContain(`class ${ir.className} extends HTMLElement`);

        // connectedCallback
        expect(output).toContain('connectedCallback()');

        // customElements.define
        expect(output).toContain(`customElements.define('${ir.tagName}', ${ir.className})`);

        // CSS injection when styles provided
        if (ir.style) {
          expect(output).toContain("document.createElement('style')");
          expect(output).toContain('document.head.appendChild');
        }
      }),
      {
        numRuns: 100,
        verbose: true,
      }
    );
  });
});

describe('Property 11: Codegen Signal/Computed Initialization', () => {
  it('constructor contains __signal(value) for each signal and __computed( for each computed', () => {
    fc.assert(
      fc.property(arbParseResult, (ir) => {
        const output = generateComponent(ir);

        // Each signal should have __signal(value) in constructor
        for (const s of ir.signals) {
          expect(output).toContain(`this._${s.name} = __signal(${s.value})`);
        }

        // Each computed should have __computed( in constructor
        for (const c of ir.computeds) {
          expect(output).toContain(`this._c_${c.name} = __computed(`);
        }
      }),
      {
        numRuns: 100,
        verbose: true,
      }
    );
  });
});

describe('Property 12: Codegen ConnectedCallback Setup', () => {
  it('connectedCallback contains __effect for each effect/binding and addEventListener for each event', () => {
    fc.assert(
      fc.property(arbParseResult, (ir) => {
        const output = generateComponent(ir);

        // Extract connectedCallback section
        const ccStart = output.indexOf('connectedCallback()');
        expect(ccStart).toBeGreaterThan(-1);

        // Count __effect occurrences in connectedCallback
        // We need to find the section between connectedCallback and the next method/closing
        const afterCC = output.slice(ccStart);

        // Each binding should produce an __effect
        for (const b of ir.bindings) {
          expect(afterCC).toContain('__effect(');
        }

        // Each user effect should produce an __effect
        for (const eff of ir.effects) {
          expect(afterCC).toContain('__effect(');
        }

        // Each event should produce an addEventListener
        for (const e of ir.events) {
          expect(afterCC).toContain(`addEventListener('${e.event}'`);
        }
      }),
      {
        numRuns: 100,
        verbose: true,
      }
    );
  });
});
