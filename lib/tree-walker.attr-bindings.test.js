/**
 * Tests for wcCompiler v2 Tree Walker — attr-bindings extensions.
 *
 * Includes:
 * - Property tests for attribute binding detection (Property 1),
 *   binding attribute removal (Property 2),
 *   and binding kind classification (Property 3)
 * - Unit tests for edge cases
 */

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import fc from 'fast-check';
import { walkTree } from './tree-walker.js';
import { BOOLEAN_ATTRIBUTES } from './types.js';

// ── Helper: create a root element from HTML ─────────────────────────

function makeRoot(html) {
  const dom = new JSDOM(`<div id="__root">${html}</div>`);
  return dom.window.document.getElementById('__root');
}

// ── Property Tests ──────────────────────────────────────────────────

/**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 12.1**
 *
 * Property 1: Attribute Binding Detection and AttrBinding Structure
 *
 * For any valid HTML template containing one or more elements with :attr or
 * bind:attr attributes at various nesting depths, the Tree Walker SHALL produce
 * one AttrBinding per binding attribute with sequential varNames (__attr0, __attr1, ...),
 * correct attr name (prefix removed), correct expression, correct kind classification,
 * and valid DOM path.
 *
 * Feature: attr-bindings, Property 1: Attribute Binding Detection and AttrBinding Structure
 */
describe('Feature: attr-bindings, Property 1: Attribute Binding Detection and AttrBinding Structure', () => {
  const boolAttrs = [...BOOLEAN_ATTRIBUTES];
  const regularAttrs = ['href', 'src', 'title', 'alt', 'id', 'name', 'placeholder', 'value', 'data-id'];
  const tags = ['div', 'span', 'p', 'a', 'button', 'input', 'img'];

  // Generator for a prefix form
  const prefixArb = fc.constantFrom(':', 'bind:');

  // Generator for an attr name from all categories
  const attrNameArb = fc.constantFrom(
    ...regularAttrs, 'class', 'style', ...boolAttrs
  );

  // Generator for a simple expression
  const exprArb = fc.constantFrom('myVar', 'count > 0', 'isActive', "name + ' suffix'", 'items.length');

  // Generator for a single binding element
  const bindingElementArb = fc.record({
    tag: fc.constantFrom(...tags),
    prefix: prefixArb,
    attr: attrNameArb,
    expr: exprArb,
    // Nesting depth: 0 = direct child, 1 = wrapped in one div, 2 = wrapped in two divs
    depth: fc.nat({ max: 2 }),
  });

  // Generate 1 to 5 binding elements
  const templateArb = fc.array(bindingElementArb, { minLength: 1, maxLength: 5 });

  it('produces one AttrBinding per binding attribute with correct structure', () => {
    fc.assert(
      fc.property(templateArb, (elements) => {
        // Build HTML
        let html = '';
        for (const el of elements) {
          const attrStr = `${el.prefix}${el.attr}="${el.expr}"`;
          const isVoid = el.tag === 'input' || el.tag === 'img';
          const inner = isVoid
            ? `<${el.tag} ${attrStr}>`
            : `<${el.tag} ${attrStr}>content</${el.tag}>`;

          let wrapped = inner;
          for (let d = 0; d < el.depth; d++) {
            wrapped = `<div>${wrapped}</div>`;
          }
          html += wrapped;
        }

        const root = makeRoot(html);
        const { attrBindings } = walkTree(root, new Set(), new Set());

        // One AttrBinding per binding element
        expect(attrBindings).toHaveLength(elements.length);

        for (let i = 0; i < elements.length; i++) {
          const ab = attrBindings[i];
          const el = elements[i];

          // Sequential varName
          expect(ab.varName).toBe(`__attr${i}`);

          // Correct attr name (prefix removed)
          expect(ab.attr).toBe(el.attr);

          // Correct expression
          expect(ab.expression).toBe(el.expr);

          // Correct kind classification
          if (el.attr === 'class') {
            expect(ab.kind).toBe('class');
          } else if (el.attr === 'style') {
            expect(ab.kind).toBe('style');
          } else if (BOOLEAN_ATTRIBUTES.has(el.attr)) {
            expect(ab.kind).toBe('bool');
          } else {
            expect(ab.kind).toBe('attr');
          }

          // Valid DOM path
          expect(Array.isArray(ab.path)).toBe(true);
          for (const segment of ab.path) {
            expect(segment).toMatch(/^childNodes\[\d+\]$/);
          }

          // Path depth should be at least depth + 1 (nesting wrappers + element itself)
          expect(ab.path.length).toBeGreaterThanOrEqual(el.depth + 1);
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 1.5**
 *
 * Property 2: Binding Attribute Removal
 *
 * For any HTML template containing :attr and bind:attr attributes on various
 * elements, the processed template contains zero attributes starting with : or bind:.
 *
 * Feature: attr-bindings, Property 2: Binding Attribute Removal
 */
describe('Feature: attr-bindings, Property 2: Binding Attribute Removal', () => {
  const tags = ['div', 'span', 'p', 'a', 'button'];
  const attrs = ['href', 'class', 'style', 'disabled', 'src', 'title'];
  const prefixArb = fc.constantFrom(':', 'bind:');
  const exprArb = fc.constantFrom('myVar', 'isActive', 'count');

  const elementArb = fc.record({
    tag: fc.constantFrom(...tags),
    prefix: prefixArb,
    attr: fc.constantFrom(...attrs),
    expr: exprArb,
  });

  const templateArb = fc.array(elementArb, { minLength: 1, maxLength: 6 });

  it('processed template contains zero : or bind: attributes', () => {
    fc.assert(
      fc.property(templateArb, (elements) => {
        const html = elements
          .map(({ tag, prefix, attr, expr }) =>
            `<${tag} ${prefix}${attr}="${expr}">content</${tag}>`
          )
          .join('');

        const root = makeRoot(html);
        walkTree(root, new Set(), new Set());

        // Check all elements in the processed DOM
        const allElements = root.querySelectorAll('*');
        for (const el of allElements) {
          for (const a of Array.from(el.attributes)) {
            expect(a.name.startsWith(':')).toBe(false);
            expect(a.name.startsWith('bind:')).toBe(false);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 *
 * Property 3: Binding Kind Classification
 *
 * For any attribute binding, the Tree Walker classifies it as 'class' when the
 * attribute name is class, 'style' when the attribute name is style, 'bool' when
 * the attribute name is in the Boolean_Attributes set, and 'attr' for all other
 * attribute names.
 *
 * Feature: attr-bindings, Property 3: Binding Kind Classification
 */
describe('Feature: attr-bindings, Property 3: Binding Kind Classification', () => {
  const boolAttrs = [...BOOLEAN_ATTRIBUTES];
  const regularAttrs = ['href', 'src', 'title', 'alt', 'id', 'name', 'placeholder', 'data-id', 'role', 'tabindex'];

  // Generator for attr name from each category
  const classAttrArb = fc.constant('class');
  const styleAttrArb = fc.constant('style');
  const boolAttrArb = fc.constantFrom(...boolAttrs);
  const regularAttrArb = fc.constantFrom(...regularAttrs);

  // Generate a binding with a specific attr category
  const bindingArb = fc.oneof(
    classAttrArb.map(a => ({ attr: a, expectedKind: 'class' })),
    styleAttrArb.map(a => ({ attr: a, expectedKind: 'style' })),
    boolAttrArb.map(a => ({ attr: a, expectedKind: 'bool' })),
    regularAttrArb.map(a => ({ attr: a, expectedKind: 'attr' })),
  );

  const bindingsArb = fc.array(bindingArb, { minLength: 1, maxLength: 6 });

  it('classifies each binding kind correctly', () => {
    fc.assert(
      fc.property(bindingsArb, (bindings) => {
        // Build HTML with one element per binding (each on separate elements to avoid duplicate attrs)
        const html = bindings
          .map(({ attr }, i) => `<div id="el${i}" :${attr}="expr${i}">content</div>`)
          .join('');

        const root = makeRoot(html);
        const { attrBindings } = walkTree(root, new Set(), new Set());

        expect(attrBindings).toHaveLength(bindings.length);

        for (let i = 0; i < bindings.length; i++) {
          expect(attrBindings[i].kind).toBe(bindings[i].expectedKind);
          expect(attrBindings[i].attr).toBe(bindings[i].attr);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ── Unit Tests for Edge Cases ───────────────────────────────────────

describe('walkTree — attr-bindings unit tests', () => {
  it('detects multiple bindings on the same element (:href, :class, :disabled)', () => {
    const root = makeRoot('<a :href="url" :class="cls" :disabled="isOff">link</a>');
    const { attrBindings } = walkTree(root, new Set(), new Set());

    expect(attrBindings).toHaveLength(3);
    expect(attrBindings[0].attr).toBe('href');
    expect(attrBindings[0].kind).toBe('attr');
    expect(attrBindings[1].attr).toBe('class');
    expect(attrBindings[1].kind).toBe('class');
    expect(attrBindings[2].attr).toBe('disabled');
    expect(attrBindings[2].kind).toBe('bool');

    // All share the same path
    expect(attrBindings[0].path).toEqual(attrBindings[1].path);
    expect(attrBindings[1].path).toEqual(attrBindings[2].path);
  });

  it('detects deeply nested attribute bindings', () => {
    const root = makeRoot('<div><section><p :title="tip">text</p></section></div>');
    const { attrBindings } = walkTree(root, new Set(), new Set());

    expect(attrBindings).toHaveLength(1);
    expect(attrBindings[0].attr).toBe('title');
    expect(attrBindings[0].kind).toBe('attr');
    // Path: div -> section -> p
    expect(attrBindings[0].path).toEqual(['childNodes[0]', 'childNodes[0]', 'childNodes[0]']);
  });

  it('bind: prefix form produces same result as : prefix', () => {
    const root1 = makeRoot('<div :href="url">a</div>');
    const root2 = makeRoot('<div bind:href="url">a</div>');

    const result1 = walkTree(root1, new Set(), new Set());
    const result2 = walkTree(root2, new Set(), new Set());

    expect(result1.attrBindings).toHaveLength(1);
    expect(result2.attrBindings).toHaveLength(1);
    expect(result1.attrBindings[0].attr).toBe(result2.attrBindings[0].attr);
    expect(result1.attrBindings[0].expression).toBe(result2.attrBindings[0].expression);
    expect(result1.attrBindings[0].kind).toBe(result2.attrBindings[0].kind);
    expect(result1.attrBindings[0].path).toEqual(result2.attrBindings[0].path);
  });

  it('handles attribute bindings alongside {{interpolation}}, @event, and show on the same element', () => {
    const root = makeRoot('<div :title="tip" @click="handler" show="isVisible">{{msg}}</div>');
    const { attrBindings, events, showBindings, bindings } = walkTree(
      root, new Set(['msg']), new Set()
    );

    expect(attrBindings).toHaveLength(1);
    expect(attrBindings[0].attr).toBe('title');
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('click');
    expect(showBindings).toHaveLength(1);
    expect(showBindings[0].expression).toBe('isVisible');
    expect(bindings).toHaveLength(1);
    expect(bindings[0].name).toBe('msg');
  });

  it('handles empty expression value (:href="")', () => {
    const root = makeRoot('<a :href="">link</a>');
    const { attrBindings } = walkTree(root, new Set(), new Set());

    expect(attrBindings).toHaveLength(1);
    expect(attrBindings[0].expression).toBe('');
  });
});
