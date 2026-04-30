/**
 * Tests for tree walker ref detection.
 *
 * Includes:
 * - Property test for ref detection and removal (Property 2)
 * - Property test for duplicate ref error (Property 4)
 * - Unit tests for tree walker edge cases
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { JSDOM } from 'jsdom';
import { detectRefs } from './tree-walker.js';

// ── Helpers ─────────────────────────────────────────────────────────

function makeRoot(html) {
  const dom = new JSDOM(`<div id="__root">${html}</div>`);
  return dom.window.document.getElementById('__root');
}

/** Generate a unique ref name */
const refNameArb = fc.stringMatching(/^[a-z][a-z]{1,7}$/);

/** Generate an HTML element tag name */
const tagArb = fc.constantFrom('div', 'span', 'p', 'section', 'canvas', 'input', 'button', 'h1');

// ── Property Test: Tree Walker ref Detection and Removal (Property 2) ──

describe('Feature: template-refs, Property 2: Tree Walker ref Detection and Removal', () => {
  /**
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   */
  it('detects all ref attributes, records correct refName and valid DOM path, and removes ref attributes', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(tagArb, refNameArb),
          { minLength: 1, maxLength: 5 }
        ),
        (elements) => {
          // Deduplicate ref names
          const seen = new Set();
          const unique = elements.filter(([, refName]) => {
            if (seen.has(refName)) return false;
            seen.add(refName);
            return true;
          });
          if (unique.length === 0) return;

          // Build HTML with ref attributes at various nesting depths
          let html = '';
          for (let i = 0; i < unique.length; i++) {
            const [tag, refName] = unique[i];
            // Alternate between flat and nested elements
            if (i % 2 === 0) {
              html += `<${tag} ref="${refName}"></${tag}>`;
            } else {
              html += `<div><${tag} ref="${refName}"></${tag}></div>`;
            }
          }

          const rootEl = makeRoot(html);
          const result = detectRefs(rootEl);

          // Correct number of RefBindings
          expect(result).toHaveLength(unique.length);

          // Each has correct refName
          const resultNames = result.map(r => r.refName);
          for (const [, refName] of unique) {
            expect(resultNames).toContain(refName);
          }

          // Each has a valid DOM path (non-empty array of childNodes[n] segments)
          for (const rb of result) {
            expect(rb.path.length).toBeGreaterThan(0);
            for (const seg of rb.path) {
              expect(seg).toMatch(/^childNodes\[\d+\]$/);
            }
          }

          // Processed template contains zero ref attributes
          expect(rootEl.querySelectorAll('[ref]')).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property Test: Duplicate Ref Error (Property 4) ─────────────────

describe('Feature: template-refs, Property 4: Duplicate Ref Error', () => {
  /**
   * **Validates: Requirements 6.1**
   */
  it('throws DUPLICATE_REF when two or more elements share the same ref name', () => {
    fc.assert(
      fc.property(
        refNameArb,
        fc.tuple(tagArb, tagArb),
        (refName, [tag1, tag2]) => {
          const html = `<${tag1} ref="${refName}"></${tag1}><${tag2} ref="${refName}"></${tag2}>`;
          const rootEl = makeRoot(html);

          expect(() => detectRefs(rootEl)).toThrow();
          try {
            detectRefs(makeRoot(html));
          } catch (e) {
            expect(e.code).toBe('DUPLICATE_REF');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Unit Tests: Tree Walker Edge Cases ──────────────────────────────

describe('detectRefs — unit tests', () => {
  it('detects ref on deeply nested element (3+ levels deep)', () => {
    const html = '<div><section><p><span ref="deep"></span></p></section></div>';
    const rootEl = makeRoot(html);
    const result = detectRefs(rootEl);

    expect(result).toHaveLength(1);
    expect(result[0].refName).toBe('deep');
    expect(result[0].path.length).toBeGreaterThanOrEqual(4); // div > section > p > span
  });

  it('detects ref alongside {{interpolation}} and @event bindings on same element', () => {
    const html = '<button ref="btn" @click="handler">{{label}}</button>';
    const rootEl = makeRoot(html);
    const result = detectRefs(rootEl);

    expect(result).toHaveLength(1);
    expect(result[0].refName).toBe('btn');
    // ref attribute removed, but @click and text content remain
    const btn = rootEl.querySelector('button');
    expect(btn.hasAttribute('ref')).toBe(false);
    // @click is still there (detectRefs doesn't touch it)
    expect(btn.hasAttribute('@click')).toBe(true);
  });

  it('detects ref alongside if, show, :attr directives on same element', () => {
    const html = '<div ref="myDiv" show="visible" :class="cls">content</div>';
    const rootEl = makeRoot(html);
    const result = detectRefs(rootEl);

    expect(result).toHaveLength(1);
    expect(result[0].refName).toBe('myDiv');
    const div = rootEl.querySelector('div');
    expect(div.hasAttribute('ref')).toBe(false);
    // Other directives remain
    expect(div.hasAttribute('show')).toBe(true);
  });

  it('returns correct path for a single ref', () => {
    const html = '<canvas ref="canvas"></canvas>';
    const rootEl = makeRoot(html);
    const result = detectRefs(rootEl);

    expect(result).toHaveLength(1);
    expect(result[0].refName).toBe('canvas');
    expect(result[0].path).toEqual(['childNodes[0]']);
  });

  it('removes ref attribute from processed template', () => {
    const html = '<input ref="input" /><div ref="container"></div>';
    const rootEl = makeRoot(html);
    detectRefs(rootEl);

    expect(rootEl.querySelectorAll('[ref]')).toHaveLength(0);
    expect(rootEl.innerHTML).not.toContain('ref=');
  });
});
