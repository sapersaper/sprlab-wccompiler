/**
 * Tests for wcCompiler v2 Tree Walker — show directive extensions.
 *
 * Includes:
 * - Property tests for show attribute detection (Property 1),
 *   attribute removal (Property 2), and conflicting directives (Property 5)
 * - Unit tests for edge cases
 */

import { describe, it, expect } from 'vitest';
import { parseHTML } from 'linkedom';
import fc from 'fast-check';
import { walkTree, processIfChains } from './tree-walker.js';

// ── Helper: create a root element from HTML ─────────────────────────

function makeRoot(html) {
  const { document } = parseHTML(`<div id="__root">${html}</div>`);
  return document.getElementById('__root');
}

// ── Property Tests ──────────────────────────────────────────────────

/**
 * **Validates: Requirements 1.1, 1.2, 1.4, 1.5, 2.1, 2.2, 2.3, 7.1**
 *
 * Property 1: Show Attribute Detection and ShowBinding Structure
 *
 * For any valid HTML template containing one or more elements with `show`
 * attributes at various nesting depths, the Tree Walker SHALL produce one
 * ShowBinding per `show` element, each with a sequential variable name
 * (__show0, __show1, ...), the correct expression string, and a valid DOM
 * path from the template root to the target element.
 *
 * Feature: show-directive, Property 1: Show Attribute Detection and ShowBinding Structure
 */
describe('Feature: show-directive, Property 1: Show Attribute Detection and ShowBinding Structure', () => {
  const tags = ['div', 'span', 'p', 'section', 'article'];
  const expressions = ['isVisible', 'count > 0', 'flag', 'active && ready', 'items.length'];

  // Generator for a show element at a given nesting depth
  const showElementArb = fc.record({
    tag: fc.constantFrom(...tags),
    expression: fc.constantFrom(...expressions),
  });

  // Generator for flat templates: multiple show elements as siblings
  const flatTemplateArb = fc.array(showElementArb, { minLength: 1, maxLength: 5 });

  // Generator for nested templates: show elements at various depths
  const nestedDepthArb = fc.nat({ max: 3 }); // 0-3 levels of nesting

  const nestedShowArb = fc.record({
    wrapperTags: fc.array(fc.constantFrom(...tags), { minLength: 0, maxLength: 3 }),
    showTag: fc.constantFrom(...tags),
    expression: fc.constantFrom(...expressions),
  });

  const templateArb = fc.array(nestedShowArb, { minLength: 1, maxLength: 4 });

  it('discovers every show attribute with correct expression, sequential varNames, and valid paths', () => {
    fc.assert(
      fc.property(templateArb, (elements) => {
        // Build HTML with nested show elements
        let html = '';
        const expectedExpressions = [];

        for (const el of elements) {
          let inner = `<${el.showTag} show="${el.expression}">content</${el.showTag}>`;
          // Wrap in nesting layers
          for (let i = el.wrapperTags.length - 1; i >= 0; i--) {
            inner = `<${el.wrapperTags[i]}>${inner}</${el.wrapperTags[i]}>`;
          }
          html += inner;
          expectedExpressions.push(el.expression);
        }

        const root = makeRoot(html);
        const { showBindings } = walkTree(root, new Set(), new Set());

        // One ShowBinding per show element
        expect(showBindings).toHaveLength(expectedExpressions.length);

        // Sequential varNames
        for (let i = 0; i < showBindings.length; i++) {
          expect(showBindings[i].varName).toBe(`__show${i}`);
        }

        // Correct expressions
        for (let i = 0; i < showBindings.length; i++) {
          expect(showBindings[i].expression).toBe(expectedExpressions[i]);
        }

        // Valid DOM paths (array of childNodes[n] segments)
        for (const sb of showBindings) {
          expect(Array.isArray(sb.path)).toBe(true);
          expect(sb.path.length).toBeGreaterThan(0);
          for (const segment of sb.path) {
            expect(segment).toMatch(/^childNodes\[\d+\]$/);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 1.3**
 *
 * Property 2: Show Attribute Removal
 *
 * For any HTML template containing elements with `show` attributes, the
 * processed template returned by the Tree Walker SHALL NOT contain any
 * `show` attributes.
 *
 * Feature: show-directive, Property 2: Show Attribute Removal
 */
describe('Feature: show-directive, Property 2: Show Attribute Removal', () => {
  const tags = ['div', 'span', 'p', 'section', 'h1', 'h2', 'article'];
  const expressions = ['isVisible', 'count > 0', 'flag', 'active', 'x && y'];

  const showElementArb = fc.record({
    tag: fc.constantFrom(...tags),
    expression: fc.constantFrom(...expressions),
    hasContent: fc.boolean(),
  });

  const templateArb = fc.array(showElementArb, { minLength: 1, maxLength: 6 });

  it('removes all show attributes from the processed template', () => {
    fc.assert(
      fc.property(templateArb, (elements) => {
        let html = '';
        for (const el of elements) {
          const content = el.hasContent ? 'some content' : '';
          html += `<${el.tag} show="${el.expression}">${content}</${el.tag}>`;
        }

        const root = makeRoot(html);
        walkTree(root, new Set(), new Set());

        // The processed DOM must contain zero show attributes
        const allElements = root.querySelectorAll('*');
        for (const el of allElements) {
          expect(el.hasAttribute('show')).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 6.1**
 *
 * Property 5: Conflicting Directives Error
 *
 * For any element that has both `show` and `if` attributes, the Tree Walker
 * SHALL throw an error with code `CONFLICTING_DIRECTIVES`.
 *
 * Feature: show-directive, Property 5: Conflicting Directives Error
 */
describe('Feature: show-directive, Property 5: Conflicting Directives Error', () => {
  const tags = ['div', 'span', 'p', 'section', 'article'];
  const showExprs = ['isVisible', 'count > 0', 'flag'];
  const ifExprs = ['active', 'status', 'ready'];

  const conflictArb = fc.record({
    tag: fc.constantFrom(...tags),
    showExpr: fc.constantFrom(...showExprs),
    ifExpr: fc.constantFrom(...ifExprs),
  });

  it('throws CONFLICTING_DIRECTIVES when show and if are on the same element', () => {
    fc.assert(
      fc.property(conflictArb, ({ tag, showExpr, ifExpr }) => {
        const html = `<${tag} show="${showExpr}" if="${ifExpr}">content</${tag}>`;
        const root = makeRoot(html);

        try {
          processIfChains(root, [], new Set(), new Set(), new Set());
          // Should not reach here
          expect.unreachable('Expected CONFLICTING_DIRECTIVES error');
        } catch (err) {
          expect(err.code).toBe('CONFLICTING_DIRECTIVES');
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ── Unit Tests for Edge Cases ───────────────────────────────────────

describe('walkTree — show directive unit tests', () => {
  it('detects multiple show directives in same parent element', () => {
    const root = makeRoot(
      '<div show="isVisible">A</div><span show="isActive">B</span><p show="hasItems">C</p>'
    );
    const { showBindings } = walkTree(root, new Set(), new Set());

    expect(showBindings).toHaveLength(3);
    expect(showBindings[0].varName).toBe('__show0');
    expect(showBindings[0].expression).toBe('isVisible');
    expect(showBindings[1].varName).toBe('__show1');
    expect(showBindings[1].expression).toBe('isActive');
    expect(showBindings[2].varName).toBe('__show2');
    expect(showBindings[2].expression).toBe('hasItems');
  });

  it('detects deeply nested show elements', () => {
    const root = makeRoot(
      '<div><section><article><p show="deep">Nested</p></article></section></div>'
    );
    const { showBindings } = walkTree(root, new Set(), new Set());

    expect(showBindings).toHaveLength(1);
    expect(showBindings[0].expression).toBe('deep');
    expect(showBindings[0].path).toEqual([
      'childNodes[0]', 'childNodes[0]', 'childNodes[0]', 'childNodes[0]',
    ]);
  });

  it('handles show with complex expressions', () => {
    const root = makeRoot('<div show="count > 0 && isActive">content</div>');
    const { showBindings } = walkTree(root, new Set(), new Set());

    expect(showBindings).toHaveLength(1);
    expect(showBindings[0].expression).toBe('count > 0 && isActive');
  });

  it('handles show alongside {{interpolation}} and @event on the same element', () => {
    const root = makeRoot(
      '<div show="isVisible" @click="handleClick">{{msg}}</div>'
    );
    const { showBindings, bindings, events } = walkTree(
      root, new Set(['msg']), new Set()
    );

    expect(showBindings).toHaveLength(1);
    expect(showBindings[0].expression).toBe('isVisible');

    expect(bindings).toHaveLength(1);
    expect(bindings[0].name).toBe('msg');

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('click');
  });

  it('removes show attribute from processed template', () => {
    const root = makeRoot('<div show="isVisible">content</div>');
    walkTree(root, new Set(), new Set());

    const div = root.querySelector('div');
    expect(div.hasAttribute('show')).toBe(false);
  });

  it('preserves other attributes when removing show', () => {
    const root = makeRoot('<div class="box" show="isVisible" id="main">content</div>');
    walkTree(root, new Set(), new Set());

    const div = root.querySelector('div');
    expect(div.hasAttribute('show')).toBe(false);
    expect(div.getAttribute('class')).toBe('box');
    expect(div.getAttribute('id')).toBe('main');
  });
});
