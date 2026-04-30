/**
 * Tests for wcCompiler v2 Tree Walker — model directive extensions.
 *
 * Includes:
 * - Property tests for model attribute detection (Property 1)
 * - Property tests for element type detection (Property 2)
 * - Property tests for model attribute removal (Property 3)
 * - Property tests for invalid model element error (Property 6)
 * - Property tests for invalid model target error (Property 7)
 * - Unit tests for edge cases
 */

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import fc from 'fast-check';
import { walkTree } from './tree-walker.js';

// ── Helper: create a root element from HTML ─────────────────────────

function makeRoot(html) {
  const dom = new JSDOM(`<div id="__root">${html}</div>`);
  return dom.window.document.getElementById('__root');
}

// ── Property Tests ──────────────────────────────────────────────────

/**
 * **Validates: Requirements 1.1, 1.2, 1.4, 1.5, 3.1, 3.2, 3.3, 9.1**
 *
 * Property 1: Model Attribute Detection and ModelBinding Structure
 *
 * For any valid HTML template containing one or more form elements with
 * `model` attributes at various nesting depths, the Tree Walker SHALL
 * produce one ModelBinding per `model` element, each with a sequential
 * variable name (__model0, __model1, ...), the correct signal name, and
 * a valid DOM path from the template root to the target element.
 *
 * Feature: model-directive, Property 1: Model Attribute Detection and ModelBinding Structure
 */
describe('Feature: model-directive, Property 1: Model Attribute Detection and ModelBinding Structure', () => {
  const signalNameArb = fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,7}$/)
    .filter(s => !['if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else', 'enum', 'eval', 'null', 'this', 'true', 'void', 'with'].includes(s));

  const formElementArb = fc.constantFrom('input', 'textarea', 'select');

  // Generator for a model element at root level
  const flatModelArb = fc.record({
    tag: formElementArb,
    signal: signalNameArb,
    nested: fc.constant(false),
  });

  // Generator for a model element nested inside a div
  const nestedModelArb = fc.record({
    tag: formElementArb,
    signal: signalNameArb,
    nested: fc.constant(true),
  });

  const modelElementArb = fc.oneof(flatModelArb, nestedModelArb);

  const templateArb = fc.array(modelElementArb, { minLength: 1, maxLength: 5 })
    .filter(els => {
      // Ensure unique signal names
      const names = els.map(e => e.signal);
      return new Set(names).size === names.length;
    });

  it('discovers every model attribute with correct signal name, sequential varNames, and valid paths', () => {
    fc.assert(
      fc.property(templateArb, (elements) => {
        const signalNames = new Set(elements.map(e => e.signal));

        // Build HTML
        let html = '';
        for (const el of elements) {
          const elHtml = el.tag === 'select'
            ? `<select model="${el.signal}"><option value="a">A</option></select>`
            : el.tag === 'textarea'
              ? `<textarea model="${el.signal}"></textarea>`
              : `<input model="${el.signal}">`;

          if (el.nested) {
            html += `<div>${elHtml}</div>`;
          } else {
            html += elHtml;
          }
        }

        const root = makeRoot(html);
        const { modelBindings } = walkTree(root, signalNames, new Set());

        // One ModelBinding per model element
        expect(modelBindings).toHaveLength(elements.length);

        // Sequential varNames
        for (let i = 0; i < modelBindings.length; i++) {
          expect(modelBindings[i].varName).toBe(`__model${i}`);
        }

        // Correct signal names in order
        for (let i = 0; i < elements.length; i++) {
          expect(modelBindings[i].signal).toBe(elements[i].signal);
        }

        // Valid DOM paths
        for (const mb of modelBindings) {
          expect(Array.isArray(mb.path)).toBe(true);
          expect(mb.path.length).toBeGreaterThan(0);
          for (const segment of mb.path) {
            expect(segment).toMatch(/^childNodes\[\d+\]$/);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 3.4, 3.5**
 *
 * Property 2: Element Type Detection Correctness
 *
 * For any form element with a `model` attribute, the Tree Walker SHALL
 * assign the correct `prop` and `event` based on the element tag and
 * type attribute.
 *
 * Feature: model-directive, Property 2: Element Type Detection Correctness
 */
describe('Feature: model-directive, Property 2: Element Type Detection Correctness', () => {
  const signalNameArb = fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,7}$/)
    .filter(s => !['if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else', 'enum', 'eval', 'null', 'this', 'true', 'void', 'with'].includes(s));

  // Each element type with expected prop/event/coerce/radioValue
  const elementTypeArb = fc.oneof(
    // checkbox
    fc.record({
      html: signalNameArb.map(s => `<input type="checkbox" model="${s}">`),
      signal: signalNameArb,
      expectedProp: fc.constant('checked'),
      expectedEvent: fc.constant('change'),
      expectedCoerce: fc.constant(false),
      hasRadioValue: fc.constant(false),
    }).map(r => ({ ...r, html: `<input type="checkbox" model="${r.signal}">` })),
    // radio
    fc.record({
      signal: signalNameArb,
      radioValue: fc.constantFrom('red', 'blue', 'green', 'yes', 'no'),
      expectedProp: fc.constant('checked'),
      expectedEvent: fc.constant('change'),
      expectedCoerce: fc.constant(false),
      hasRadioValue: fc.constant(true),
    }).map(r => ({ ...r, html: `<input type="radio" model="${r.signal}" value="${r.radioValue}">` })),
    // number
    fc.record({
      signal: signalNameArb,
      expectedProp: fc.constant('value'),
      expectedEvent: fc.constant('input'),
      expectedCoerce: fc.constant(true),
      hasRadioValue: fc.constant(false),
    }).map(r => ({ ...r, html: `<input type="number" model="${r.signal}">` })),
    // text (explicit)
    fc.record({
      signal: signalNameArb,
      expectedProp: fc.constant('value'),
      expectedEvent: fc.constant('input'),
      expectedCoerce: fc.constant(false),
      hasRadioValue: fc.constant(false),
    }).map(r => ({ ...r, html: `<input type="text" model="${r.signal}">` })),
    // text (no type)
    fc.record({
      signal: signalNameArb,
      expectedProp: fc.constant('value'),
      expectedEvent: fc.constant('input'),
      expectedCoerce: fc.constant(false),
      hasRadioValue: fc.constant(false),
    }).map(r => ({ ...r, html: `<input model="${r.signal}">` })),
    // select
    fc.record({
      signal: signalNameArb,
      expectedProp: fc.constant('value'),
      expectedEvent: fc.constant('change'),
      expectedCoerce: fc.constant(false),
      hasRadioValue: fc.constant(false),
    }).map(r => ({ ...r, html: `<select model="${r.signal}"><option>A</option></select>` })),
    // textarea
    fc.record({
      signal: signalNameArb,
      expectedProp: fc.constant('value'),
      expectedEvent: fc.constant('input'),
      expectedCoerce: fc.constant(false),
      hasRadioValue: fc.constant(false),
    }).map(r => ({ ...r, html: `<textarea model="${r.signal}"></textarea>` })),
  );

  it('assigns correct prop, event, coerce, and radioValue for each element type', () => {
    fc.assert(
      fc.property(elementTypeArb, (el) => {
        const root = makeRoot(el.html);
        const { modelBindings } = walkTree(root, new Set([el.signal]), new Set());

        expect(modelBindings).toHaveLength(1);
        const mb = modelBindings[0];
        expect(mb.prop).toBe(el.expectedProp);
        expect(mb.event).toBe(el.expectedEvent);
        expect(mb.coerce).toBe(el.expectedCoerce);
        if (el.hasRadioValue) {
          expect(mb.radioValue).toBe(el.radioValue);
        } else {
          expect(mb.radioValue).toBeNull();
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 1.3**
 *
 * Property 3: Model Attribute Removal
 *
 * For any HTML template containing form elements with `model` attributes,
 * the processed template returned by the Tree Walker SHALL NOT contain
 * any `model` attributes.
 *
 * Feature: model-directive, Property 3: Model Attribute Removal
 */
describe('Feature: model-directive, Property 3: Model Attribute Removal', () => {
  const signalNameArb = fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,7}$/)
    .filter(s => !['if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else', 'enum', 'eval', 'null', 'this', 'true', 'void', 'with'].includes(s));

  const formElementArb = fc.constantFrom('input', 'textarea', 'select');

  const templateArb = fc.array(
    fc.record({ tag: formElementArb, signal: signalNameArb }),
    { minLength: 1, maxLength: 5 }
  ).filter(els => {
    const names = els.map(e => e.signal);
    return new Set(names).size === names.length;
  });

  it('removes all model attributes from the processed template', () => {
    fc.assert(
      fc.property(templateArb, (elements) => {
        const signalNames = new Set(elements.map(e => e.signal));

        let html = '';
        for (const el of elements) {
          if (el.tag === 'select') {
            html += `<select model="${el.signal}"><option>A</option></select>`;
          } else if (el.tag === 'textarea') {
            html += `<textarea model="${el.signal}"></textarea>`;
          } else {
            html += `<input model="${el.signal}">`;
          }
        }

        const root = makeRoot(html);
        walkTree(root, signalNames, new Set());

        // No element in the processed DOM should have a model attribute
        const allElements = root.querySelectorAll('*');
        for (const el of allElements) {
          expect(el.hasAttribute('model')).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 7.1**
 *
 * Property 6: Invalid Model Element Error
 *
 * For any element that has a `model` attribute but is not an <input>,
 * <textarea>, or <select>, the Tree Walker SHALL throw an error with
 * code INVALID_MODEL_ELEMENT.
 *
 * Feature: model-directive, Property 6: Invalid Model Element Error
 */
describe('Feature: model-directive, Property 6: Invalid Model Element Error', () => {
  const nonFormTagArb = fc.constantFrom('div', 'span', 'p', 'section', 'h1', 'h2', 'h3', 'article', 'main', 'nav', 'footer', 'header', 'li', 'ul', 'ol', 'a', 'button', 'label');

  const signalNameArb = fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,7}$/)
    .filter(s => !['if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else', 'enum', 'eval', 'null', 'this', 'true', 'void', 'with'].includes(s));

  it('throws INVALID_MODEL_ELEMENT for non-form elements', () => {
    fc.assert(
      fc.property(nonFormTagArb, signalNameArb, (tag, signal) => {
        const html = `<${tag} model="${signal}">content</${tag}>`;
        const root = makeRoot(html);

        try {
          walkTree(root, new Set([signal]), new Set());
          expect.unreachable('Should have thrown');
        } catch (err) {
          expect(err.code).toBe('INVALID_MODEL_ELEMENT');
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 8.1, 8.2**
 *
 * Property 7: Invalid Model Target Error
 *
 * For any form element with a `model` attribute containing empty strings
 * or invalid identifiers, the Tree Walker SHALL throw an error with code
 * INVALID_MODEL_TARGET.
 *
 * Feature: model-directive, Property 7: Invalid Model Target Error
 */
describe('Feature: model-directive, Property 7: Invalid Model Target Error', () => {
  // Invalid identifiers: start with number, contain spaces, special chars, empty
  const invalidIdentifierArb = fc.oneof(
    fc.constant(''),                                          // empty
    fc.stringMatching(/^[0-9][a-z]{0,5}$/),                  // starts with number
    fc.stringMatching(/^[a-z]+ [a-z]+$/),                    // contains space
    fc.stringMatching(/^[a-z]+[-][a-z]+$/),                  // contains hyphen
    fc.stringMatching(/^[a-z]+[.][a-z]+$/),                  // contains dot
  );

  const formTagArb = fc.constantFrom('input', 'textarea', 'select');

  it('throws INVALID_MODEL_TARGET for invalid identifiers', () => {
    fc.assert(
      fc.property(formTagArb, invalidIdentifierArb, (tag, value) => {
        let html;
        if (tag === 'select') {
          html = `<select model="${value}"><option>A</option></select>`;
        } else if (tag === 'textarea') {
          html = `<textarea model="${value}"></textarea>`;
        } else {
          html = `<input model="${value}">`;
        }

        const root = makeRoot(html);

        try {
          walkTree(root, new Set(), new Set());
          expect.unreachable('Should have thrown');
        } catch (err) {
          expect(err.code).toBe('INVALID_MODEL_TARGET');
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ── Unit Tests for Edge Cases ───────────────────────────────────────

describe('walkTree — model edge cases', () => {
  it('handles multiple model directives in same parent element', () => {
    const html = '<input model="name"><input model="email"><textarea model="bio"></textarea>';
    const root = makeRoot(html);
    const { modelBindings } = walkTree(root, new Set(['name', 'email', 'bio']), new Set());

    expect(modelBindings).toHaveLength(3);
    expect(modelBindings[0].signal).toBe('name');
    expect(modelBindings[0].varName).toBe('__model0');
    expect(modelBindings[1].signal).toBe('email');
    expect(modelBindings[1].varName).toBe('__model1');
    expect(modelBindings[2].signal).toBe('bio');
    expect(modelBindings[2].varName).toBe('__model2');
  });

  it('handles deeply nested model elements', () => {
    const html = '<div><div><div><input model="deep"></div></div></div>';
    const root = makeRoot(html);
    const { modelBindings } = walkTree(root, new Set(['deep']), new Set());

    expect(modelBindings).toHaveLength(1);
    expect(modelBindings[0].signal).toBe('deep');
    expect(modelBindings[0].path.length).toBe(4); // div > div > div > input
  });

  it('records correct radioValue from element value attribute', () => {
    const html = '<input type="radio" model="color" value="red">';
    const root = makeRoot(html);
    const { modelBindings } = walkTree(root, new Set(['color']), new Set());

    expect(modelBindings).toHaveLength(1);
    expect(modelBindings[0].radioValue).toBe('red');
    expect(modelBindings[0].prop).toBe('checked');
    expect(modelBindings[0].event).toBe('change');
  });

  it('sets coerce to true for input type="number"', () => {
    const html = '<input type="number" model="age">';
    const root = makeRoot(html);
    const { modelBindings } = walkTree(root, new Set(['age']), new Set());

    expect(modelBindings).toHaveLength(1);
    expect(modelBindings[0].coerce).toBe(true);
    expect(modelBindings[0].prop).toBe('value');
    expect(modelBindings[0].event).toBe('input');
  });

  it('handles model alongside other bindings on sibling elements', () => {
    const html = '<div>{{count}}</div><input model="name"><button @click="submit">Go</button><div show="visible">shown</div>';
    const root = makeRoot(html);
    const { bindings, events, showBindings, modelBindings } = walkTree(
      root,
      new Set(['count', 'name', 'visible']),
      new Set()
    );

    expect(bindings).toHaveLength(1);
    expect(bindings[0].name).toBe('count');
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('click');
    expect(showBindings).toHaveLength(1);
    expect(showBindings[0].expression).toBe('visible');
    expect(modelBindings).toHaveLength(1);
    expect(modelBindings[0].signal).toBe('name');
  });
});
