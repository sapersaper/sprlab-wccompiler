/**
 * Tests for wcCompiler v2 Code Generator — show directive extensions.
 *
 * Includes:
 * - Property tests for codegen effect structure (Property 3)
 *   and expression auto-unwrap (Property 4)
 * - Unit tests for edge cases
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateComponent, transformExpr, pathExpr } from './codegen.js';

// ── Helpers ─────────────────────────────────────────────────────────

/** Generate a valid kebab-case tag name */
const arbTagName = fc
  .tuple(
    fc.stringMatching(/^[a-z]{2,5}$/),
    fc.stringMatching(/^[a-z]{2,5}$/)
  )
  .map(([a, b]) => `${a}-${b}`);

/** Convert kebab-case to PascalCase */
function toClassName(tag) {
  return tag
    .split('-')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

/** Generate a valid JS identifier (avoiding reserved words) */
const arbIdentifier = fc
  .stringMatching(/^[a-z][a-z]{1,6}$/)
  .filter(s => !['if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else', 'enum', 'eval', 'null', 'this', 'true', 'void', 'with', 'class', 'super', 'const', 'break'].includes(s));

/** Generate a ShowBinding */
const arbShowBinding = fc.record({
  varName: fc.nat({ max: 20 }).map(n => `__show${n}`),
  expression: fc.constantFrom('isVisible', 'count > 0', 'flag', 'active && ready'),
  path: fc.array(fc.nat({ max: 4 }).map(n => `childNodes[${n}]`), { minLength: 1, maxLength: 3 }),
});

/** Generate a ParseResult with ShowBindings */
const arbParseResultWithShow = fc.record({
  tagName: arbTagName,
  signals: fc.array(fc.record({
    name: arbIdentifier,
    value: fc.constantFrom('0', "'hello'", 'true', 'false'),
  }), { minLength: 0, maxLength: 2 }),
  showBindings: fc.array(arbShowBinding, { minLength: 1, maxLength: 4 }),
}).map(r => {
  const usedNames = new Set();
  const signals = r.signals.filter(s => {
    if (usedNames.has(s.name)) return false;
    usedNames.add(s.name);
    return true;
  });

  // Assign sequential varNames
  const showBindings = r.showBindings.map((sb, i) => ({
    ...sb,
    varName: `__show${i}`,
  }));

  return {
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
    processedTemplate: '<div>test</div>',
    showBindings,
  };
});

// ── Property Tests ──────────────────────────────────────────────────

/**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3, 7.2, 7.3**
 *
 * Property 3: Codegen Effect Structure
 *
 * For any ParseResult containing ShowBindings, the generated JavaScript SHALL
 * contain: a DOM element reference assignment per ShowBinding in the constructor
 * (navigating from __root via the path), and an __effect per ShowBinding in
 * connectedCallback that evaluates the expression (with transformExpr-applied
 * transformation) and sets element.style.display to '' or 'none'.
 *
 * Feature: show-directive, Property 3: Codegen Effect Structure
 */
describe('Feature: show-directive, Property 3: Codegen Effect Structure', () => {
  it('generates DOM refs in connectedCallback and __effect with style.display in connectedCallback per ShowBinding', () => {
    fc.assert(
      fc.property(arbParseResultWithShow, (ir) => {
        const output = generateComponent(ir);

        for (const sb of ir.showBindings) {
          // DOM element reference in connectedCallback
          const expectedRef = `this.${sb.varName} = __root.${sb.path.join('.')}`;
          expect(output).toContain(expectedRef);

          // style.display assignment in connectedCallback
          expect(output).toContain(`this.${sb.varName}.style.display`);
          expect(output).toContain("? '' : 'none'");
        }

        // DOM refs must appear before appendChild (both now in connectedCallback)
        const ccSection = output.slice(output.indexOf('connectedCallback()'));
        for (const sb of ir.showBindings) {
          const refPos = ccSection.indexOf(`this.${sb.varName} = __root`);
          const appendPos = ccSection.indexOf('this.appendChild(__root)');
          expect(refPos).toBeGreaterThan(-1);
          expect(appendPos).toBeGreaterThan(-1);
          expect(refPos).toBeLessThan(appendPos);
        }

        // Each ShowBinding gets its own __effect
        for (const sb of ir.showBindings) {
          expect(ccSection).toContain(`this.${sb.varName}.style.display`);
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 4.1, 4.2, 4.3**
 *
 * Property 4: Expression Auto-Unwrap
 *
 * For any show expression containing signal, computed, or prop references,
 * the Code Generator SHALL transform signal x to this._x(), computed y to
 * this._c_y(), and prop z to this._s_z() using transformExpr.
 *
 * Feature: show-directive, Property 4: Expression Auto-Unwrap
 */
describe('Feature: show-directive, Property 4: Expression Auto-Unwrap', () => {
  // Generate unique names for signal, computed, and prop
  const arbNames = fc.record({
    signalName: arbIdentifier,
    computedName: arbIdentifier,
    propName: arbIdentifier,
  }).filter(n =>
    n.signalName !== n.computedName &&
    n.signalName !== n.propName &&
    n.computedName !== n.propName
  );

  it('transforms signal to this._x(), computed to this._c_y(), prop to this._s_z()', () => {
    fc.assert(
      fc.property(arbNames, ({ signalName, computedName, propName }) => {
        // Test signal transformation
        const signalResult = transformExpr(signalName, [signalName], [], null, new Set());
        expect(signalResult).toBe(`this._${signalName}()`);

        // Test computed transformation
        const computedResult = transformExpr(computedName, [], [computedName], null, new Set());
        expect(computedResult).toBe(`this._c_${computedName}()`);

        // Test prop transformation
        const propResult = transformExpr(
          `props.${propName}`,
          [],
          [],
          'props',
          new Set([propName])
        );
        expect(propResult).toBe(`this._s_${propName}()`);
      }),
      { numRuns: 100 }
    );
  });

  it('transforms mixed expressions with signals and computeds', () => {
    fc.assert(
      fc.property(arbNames, ({ signalName, computedName }) => {
        const expr = `${signalName} > 0 && ${computedName}`;
        const result = transformExpr(expr, [signalName], [computedName]);
        expect(result).toContain(`this._${signalName}()`);
        expect(result).toContain(`this._c_${computedName}()`);
      }),
      { numRuns: 100 }
    );
  });
});

// ── Unit Tests for Edge Cases ───────────────────────────────────────

describe('codegen show — unit tests', () => {
  /** Helper to create a minimal ParseResult with showBindings */
  function makeIR(showBindings, signals = []) {
    return {
      tagName: 'wcc-test',
      className: 'WccTest',
      template: '<div>test</div>',
      style: '',
      signals,
      computeds: [],
      effects: [],
      methods: [],
      bindings: [],
      events: [],
      processedTemplate: '<div>test</div>',
      showBindings,
    };
  }

  it('transforms complex expression: count > 0 && isActive', () => {
    const ir = makeIR(
      [{ varName: '__show0', expression: 'count > 0 && isActive', path: ['childNodes[0]'] }],
      [{ name: 'count', value: '0' }, { name: 'isActive', value: 'true' }]
    );

    const output = generateComponent(ir);
    expect(output).toContain('this._count() > 0 && this._isActive()');
  });

  it('generates multiple show effects in document order', () => {
    const ir = makeIR(
      [
        { varName: '__show0', expression: 'first', path: ['childNodes[0]'] },
        { varName: '__show1', expression: 'second', path: ['childNodes[1]'] },
        { varName: '__show2', expression: 'third', path: ['childNodes[2]'] },
      ],
      [
        { name: 'first', value: 'true' },
        { name: 'second', value: 'true' },
        { name: 'third', value: 'true' },
      ]
    );

    const output = generateComponent(ir);
    const show0Pos = output.indexOf('this.__show0.style.display');
    const show1Pos = output.indexOf('this.__show1.style.display');
    const show2Pos = output.indexOf('this.__show2.style.display');

    expect(show0Pos).toBeGreaterThan(-1);
    expect(show1Pos).toBeGreaterThan(show0Pos);
    expect(show2Pos).toBeGreaterThan(show1Pos);
  });

  it('generates show effects alongside text binding and event effects', () => {
    const ir = {
      tagName: 'wcc-test',
      className: 'WccTest',
      template: '<div>test</div>',
      style: '',
      signals: [{ name: 'count', value: '0' }, { name: 'isVisible', value: 'true' }],
      computeds: [],
      effects: [],
      methods: [{ name: 'increment', params: '', body: 'count.set(count() + 1)' }],
      bindings: [{ varName: '__b0', name: 'count', type: 'signal', path: ['childNodes[0]'] }],
      events: [{ varName: '__e0', event: 'click', handler: 'increment', path: ['childNodes[1]'] }],
      processedTemplate: '<div></div><button>+</button><p>visible</p>',
      showBindings: [{ varName: '__show0', expression: 'isVisible', path: ['childNodes[2]'] }],
    };

    const output = generateComponent(ir);

    // Text binding effect
    expect(output).toContain('this.__b0.textContent = this._count()');
    // Event listener
    expect(output).toContain("this.__e0.addEventListener('click'");
    // Show effect
    expect(output).toContain('this.__show0.style.display = (this._isVisible()) ?');
  });

  it('assigns DOM references before appendChild', () => {
    const ir = makeIR(
      [{ varName: '__show0', expression: 'isVisible', path: ['childNodes[0]'] }],
      [{ name: 'isVisible', value: 'true' }]
    );

    const output = generateComponent(ir);
    const refPos = output.indexOf('this.__show0 = __root.childNodes[0]');
    const appendPos = output.indexOf('this.appendChild(__root)');

    expect(refPos).toBeGreaterThan(-1);
    expect(appendPos).toBeGreaterThan(-1);
    expect(refPos).toBeLessThan(appendPos);
  });
});
