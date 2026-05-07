/**
 * Tests for wcCompiler v2 Code Generator — attr-bindings extensions.
 *
 * Includes:
 * - Property tests for regular attr effect (Property 4),
 *   boolean attr effect (Property 5),
 *   class binding effect (Property 6),
 *   and style binding effect (Property 7)
 * - Unit tests for edge cases
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateComponent, transformExpr, pathExpr } from './codegen.js';
import { BOOLEAN_ATTRIBUTES } from './types.js';

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
  .filter(s => !['if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else', 'enum', 'eval', 'null', 'this', 'true', 'void', 'with', 'class', 'super', 'const', 'break', 'style'].includes(s));

/** Generate a DOM path */
const arbPath = fc.array(fc.nat({ max: 4 }).map(n => `childNodes[${n}]`), { minLength: 1, maxLength: 3 });

/** Helper to create a minimal ParseResult with attrBindings */
function makeIR(attrBindings, signals = [], computeds = []) {
  return {
    tagName: 'wcc-test',
    className: 'WccTest',
    template: '<div>test</div>',
    style: '',
    signals,
    computeds,
    effects: [],
    methods: [],
    bindings: [],
    events: [],
    processedTemplate: '<div>test</div>',
    showBindings: [],
    modelBindings: [],
    attrBindings,
  };
}

// ── Property Tests ──────────────────────────────────────────────────

/**
 * **Validates: Requirements 4.1, 4.2, 4.3, 10.1, 10.2, 10.3, 11.1, 11.2, 11.3**
 *
 * Property 4: Codegen Regular Attribute Effect
 *
 * For any ParseResult containing AttrBindings with kind 'attr', the generated
 * JavaScript contains: DOM element reference in constructor, __effect in
 * connectedCallback with setAttribute/removeAttribute logic and transformExpr-ed expression.
 *
 * Feature: attr-bindings, Property 4: Codegen Regular Attribute Effect
 */
describe('Feature: attr-bindings, Property 4: Codegen Regular Attribute Effect', () => {
  const regularAttrs = ['href', 'src', 'title', 'alt', 'id', 'name', 'placeholder', 'data-id'];

  const arbAttrBinding = fc.record({
    attr: fc.constantFrom(...regularAttrs),
    expression: arbIdentifier,
    path: arbPath,
  });

  const arbIR = fc.record({
    tagName: arbTagName,
    signals: fc.array(fc.record({
      name: arbIdentifier,
      value: fc.constantFrom('0', "'hello'", 'true'),
    }), { minLength: 0, maxLength: 2 }),
    attrBindings: fc.array(arbAttrBinding, { minLength: 1, maxLength: 3 }),
  }).map(r => {
    const usedNames = new Set();
    const signals = r.signals.filter(s => {
      if (usedNames.has(s.name)) return false;
      usedNames.add(s.name);
      return true;
    });

    const attrBindings = r.attrBindings.map((ab, i) => ({
      varName: `__attr${i}`,
      attr: ab.attr,
      expression: ab.expression,
      kind: 'attr',
      path: ab.path,
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
      showBindings: [],
      modelBindings: [],
      attrBindings,
    };
  });

  it('generates DOM refs and __effect with setAttribute/removeAttribute per attr binding', () => {
    fc.assert(
      fc.property(arbIR, (ir) => {
        const output = generateComponent(ir);

        for (const ab of ir.attrBindings) {
          // DOM element reference in connectedCallback
          expect(output).toContain(`this.${ab.varName} =`);

          // setAttribute and removeAttribute in connectedCallback
          expect(output).toContain(`this.${ab.varName}.setAttribute('${ab.attr}'`);
          expect(output).toContain(`this.${ab.varName}.removeAttribute('${ab.attr}')`);
        }

        // DOM refs must appear before appendChild (both now in connectedCallback)
        const ccSection = output.slice(output.indexOf('connectedCallback()'));
        for (const ab of ir.attrBindings) {
          const refPos = ccSection.indexOf(`this.${ab.varName} =`);
          const appendPos = ccSection.indexOf('this.appendChild(__root)');
          expect(refPos).toBeGreaterThan(-1);
          expect(appendPos).toBeGreaterThan(-1);
          expect(refPos).toBeLessThan(appendPos);
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 5.1, 5.2, 5.3**
 *
 * Property 5: Codegen Boolean Attribute Effect
 *
 * For any ParseResult containing AttrBindings with kind 'bool', the generated
 * JavaScript contains: __effect with property assignment using !! coercion.
 *
 * Feature: attr-bindings, Property 5: Codegen Boolean Attribute Effect
 */
describe('Feature: attr-bindings, Property 5: Codegen Boolean Attribute Effect', () => {
  const boolAttrs = [...BOOLEAN_ATTRIBUTES];

  const arbBoolBinding = fc.record({
    attr: fc.constantFrom(...boolAttrs),
    expression: arbIdentifier,
    path: arbPath,
  });

  const arbIR = fc.record({
    tagName: arbTagName,
    attrBindings: fc.array(arbBoolBinding, { minLength: 1, maxLength: 3 }),
  }).map(r => {
    const attrBindings = r.attrBindings.map((ab, i) => ({
      varName: `__attr${i}`,
      attr: ab.attr,
      expression: ab.expression,
      kind: 'bool',
      path: ab.path,
    }));

    return {
      tagName: r.tagName,
      className: toClassName(r.tagName),
      template: '<div>test</div>',
      style: '',
      signals: [],
      computeds: [],
      effects: [],
      methods: [],
      bindings: [],
      events: [],
      processedTemplate: '<div>test</div>',
      showBindings: [],
      modelBindings: [],
      attrBindings,
    };
  });

  it('generates __effect with property assignment using !! coercion per bool binding', () => {
    fc.assert(
      fc.property(arbIR, (ir) => {
        const output = generateComponent(ir);

        for (const ab of ir.attrBindings) {
          // Property assignment with !! coercion
          expect(output).toContain(`this.${ab.varName}.${ab.attr} = !!(`);
        }

        // Should NOT use setAttribute/removeAttribute for bool bindings
        for (const ab of ir.attrBindings) {
          expect(output).not.toContain(`this.${ab.varName}.setAttribute('${ab.attr}'`);
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 7.1, 7.2**
 *
 * Property 6: Codegen Class Binding Effect
 *
 * For any ParseResult containing AttrBindings with kind 'class' with both object
 * expressions (starting with {) and string expressions, the generated JavaScript
 * contains: classList.add/classList.remove for object expressions, className = for
 * string expressions.
 *
 * Feature: attr-bindings, Property 6: Codegen Class Binding Effect
 */
describe('Feature: attr-bindings, Property 6: Codegen Class Binding Effect', () => {
  // Object expression (starts with {)
  const objExprArb = fc.constantFrom(
    "{ active: isActive }",
    "{ bold: isBold, italic: isItalic }",
    "{ 'text-red': hasError }",
  );

  // String expression (does not start with {)
  const strExprArb = arbIdentifier;

  const arbClassBinding = fc.oneof(
    objExprArb.map(expr => ({ expression: expr, isObject: true })),
    strExprArb.map(expr => ({ expression: expr, isObject: false })),
  );

  const arbIR = fc.record({
    tagName: arbTagName,
    classBindings: fc.array(arbClassBinding, { minLength: 1, maxLength: 3 }),
  }).map(r => {
    const attrBindings = r.classBindings.map((cb, i) => ({
      varName: `__attr${i}`,
      attr: 'class',
      expression: cb.expression,
      kind: 'class',
      path: [`childNodes[${i}]`],
    }));

    return {
      ir: {
        tagName: r.tagName,
        className: toClassName(r.tagName),
        template: '<div>test</div>',
        style: '',
        signals: [],
        computeds: [],
        effects: [],
        methods: [],
        bindings: [],
        events: [],
        processedTemplate: '<div>test</div>',
        showBindings: [],
        modelBindings: [],
        attrBindings,
      },
      classBindings: r.classBindings,
    };
  });

  it('generates classList.add/remove for object expressions and className for string expressions', () => {
    fc.assert(
      fc.property(arbIR, ({ ir, classBindings }) => {
        const output = generateComponent(ir);

        for (let i = 0; i < classBindings.length; i++) {
          const ab = ir.attrBindings[i];
          const cb = classBindings[i];

          if (cb.isObject) {
            // Object expression: classList.add/remove
            expect(output).toContain(`this.${ab.varName}.classList.add(__k)`);
            expect(output).toContain(`this.${ab.varName}.classList.remove(__k)`);
          } else {
            // String expression: className =
            expect(output).toContain(`this.${ab.varName}.className =`);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 8.1, 8.2, 8.3, 9.1, 9.2**
 *
 * Property 7: Codegen Style Binding Effect
 *
 * For any ParseResult containing AttrBindings with kind 'style' with both object
 * expressions (starting with {) and string expressions, the generated JavaScript
 * contains: style[key] = value for object expressions, style.cssText = for string
 * expressions.
 *
 * Feature: attr-bindings, Property 7: Codegen Style Binding Effect
 */
describe('Feature: attr-bindings, Property 7: Codegen Style Binding Effect', () => {
  // Object expression (starts with {)
  const objExprArb = fc.constantFrom(
    "{ color: textColor }",
    "{ fontSize: size, color: clr }",
    "{ backgroundColor: bg }",
  );

  // String expression (does not start with {)
  const strExprArb = arbIdentifier;

  const arbStyleBinding = fc.oneof(
    objExprArb.map(expr => ({ expression: expr, isObject: true })),
    strExprArb.map(expr => ({ expression: expr, isObject: false })),
  );

  const arbIR = fc.record({
    tagName: arbTagName,
    styleBindings: fc.array(arbStyleBinding, { minLength: 1, maxLength: 3 }),
  }).map(r => {
    const attrBindings = r.styleBindings.map((sb, i) => ({
      varName: `__attr${i}`,
      attr: 'style',
      expression: sb.expression,
      kind: 'style',
      path: [`childNodes[${i}]`],
    }));

    return {
      ir: {
        tagName: r.tagName,
        className: toClassName(r.tagName),
        template: '<div>test</div>',
        style: '',
        signals: [],
        computeds: [],
        effects: [],
        methods: [],
        bindings: [],
        events: [],
        processedTemplate: '<div>test</div>',
        showBindings: [],
        modelBindings: [],
        attrBindings,
      },
      styleBindings: r.styleBindings,
    };
  });

  it('generates style[key] for object expressions and style.cssText for string expressions', () => {
    fc.assert(
      fc.property(arbIR, ({ ir, styleBindings }) => {
        const output = generateComponent(ir);

        for (let i = 0; i < styleBindings.length; i++) {
          const ab = ir.attrBindings[i];
          const sb = styleBindings[i];

          if (sb.isObject) {
            // Object expression: style[key] = value
            expect(output).toContain(`this.${ab.varName}.style[__k] = __val`);
          } else {
            // String expression: style.cssText =
            expect(output).toContain(`this.${ab.varName}.style.cssText =`);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ── Unit Tests for Edge Cases ───────────────────────────────────────

describe('codegen attr-bindings — unit tests', () => {
  it('reuses DOM references when multiple bindings target the same element', () => {
    const ir = makeIR([
      { varName: '__attr0', attr: 'href', expression: 'url', kind: 'attr', path: ['childNodes[0]'] },
      { varName: '__attr1', attr: 'class', expression: 'cls', kind: 'class', path: ['childNodes[0]'] },
    ]);

    const output = generateComponent(ir);

    // First binding gets __root path
    expect(output).toContain('this.__attr0 = __root.childNodes[0]');
    // Second binding reuses first reference
    expect(output).toContain('this.__attr1 = this.__attr0');
  });

  it('detects object vs string expression for :class', () => {
    const irObj = makeIR([
      { varName: '__attr0', attr: 'class', expression: '{ active: isActive }', kind: 'class', path: ['childNodes[0]'] },
    ]);
    const irStr = makeIR([
      { varName: '__attr0', attr: 'class', expression: 'className', kind: 'class', path: ['childNodes[0]'] },
    ]);

    const outputObj = generateComponent(irObj);
    const outputStr = generateComponent(irStr);

    expect(outputObj).toContain('classList.add');
    expect(outputObj).toContain('classList.remove');
    expect(outputObj).not.toContain('className =');

    expect(outputStr).toContain('className =');
    expect(outputStr).not.toContain('classList.add');
  });

  it('detects object vs string expression for :style', () => {
    const irObj = makeIR([
      { varName: '__attr0', attr: 'style', expression: '{ color: textColor }', kind: 'style', path: ['childNodes[0]'] },
    ]);
    const irStr = makeIR([
      { varName: '__attr0', attr: 'style', expression: 'styleStr', kind: 'style', path: ['childNodes[0]'] },
    ]);

    const outputObj = generateComponent(irObj);
    const outputStr = generateComponent(irStr);

    expect(outputObj).toContain('style[__k] = __val');
    expect(outputObj).not.toContain('style.cssText');

    expect(outputStr).toContain('style.cssText =');
    expect(outputStr).not.toContain('style[__k]');
  });

  it('transforms complex expression with signal references', () => {
    const ir = makeIR(
      [{ varName: '__attr0', attr: 'href', expression: "base + '/' + path", kind: 'attr', path: ['childNodes[0]'] }],
      [{ name: 'base', value: "'http://example.com'" }, { name: 'path', value: "'home'" }]
    );

    const output = generateComponent(ir);
    expect(output).toContain("this._base() + '/' + this._path()");
  });

  it('assigns DOM references before appendChild', () => {
    const ir = makeIR([
      { varName: '__attr0', attr: 'href', expression: 'url', kind: 'attr', path: ['childNodes[0]'] },
    ]);

    const output = generateComponent(ir);
    const refPos = output.indexOf('this.__attr0 = __root.childNodes[0]');
    const appendPos = output.indexOf('this.appendChild(__root)');

    expect(refPos).toBeGreaterThan(-1);
    expect(appendPos).toBeGreaterThan(-1);
    expect(refPos).toBeLessThan(appendPos);
  });

  it('generates multiple attr effects in document order', () => {
    const ir = makeIR([
      { varName: '__attr0', attr: 'href', expression: 'url', kind: 'attr', path: ['childNodes[0]'] },
      { varName: '__attr1', attr: 'disabled', expression: 'isOff', kind: 'bool', path: ['childNodes[1]'] },
      { varName: '__attr2', attr: 'class', expression: 'cls', kind: 'class', path: ['childNodes[2]'] },
    ]);

    const output = generateComponent(ir);
    const pos0 = output.indexOf("this.__attr0.setAttribute('href'");
    const pos1 = output.indexOf('this.__attr1.disabled = !!(');
    const pos2 = output.indexOf('this.__attr2.className =');

    expect(pos0).toBeGreaterThan(-1);
    expect(pos1).toBeGreaterThan(pos0);
    expect(pos2).toBeGreaterThan(pos1);
  });
});
