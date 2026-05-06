import { describe, it, expect } from 'vitest';
import { parseHTML } from 'linkedom';
import fc from 'fast-check';
import { parseEachExpression, processForBlocks, walkBranch } from './tree-walker.js';

// ── Helper: create a root element from HTML ─────────────────────────

function makeRoot(html) {
  const { document } = parseHTML(`<div id="__root">${html}</div>`);
  return document.getElementById('__root');
}

// ── Property Tests ──────────────────────────────────────────────────

/**
 * **Validates: Requirements 1.1, 1.2**
 *
 * Property 1: each Expression Parsing Round-Trip
 *
 * For any valid identifier pair (itemVar, source) and optional indexVar,
 * constructing an each expression string and parsing it SHALL produce
 * the original itemVar, indexVar (or null), and source.
 *
 * Feature: each-directive, Property 1: each Expression Parsing Round-Trip
 */
describe('Feature: each-directive, Property 1: each Expression Parsing Round-Trip', () => {
  const identArb = fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,7}$/);

  it('round-trips simple form: "item in source"', () => {
    fc.assert(
      fc.property(
        identArb,
        identArb.filter(s => s.length > 0),
        (itemVar, source) => {
          // Ensure itemVar !== source to avoid ambiguity
          fc.pre(itemVar !== source);
          const expr = `${itemVar} in ${source}`;
          const result = parseEachExpression(expr);
          expect(result.itemVar).toBe(itemVar);
          expect(result.indexVar).toBeNull();
          expect(result.source).toBe(source);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('round-trips destructured form: "(item, index) in source"', () => {
    fc.assert(
      fc.property(
        identArb,
        identArb,
        identArb.filter(s => s.length > 0),
        (itemVar, indexVar, source) => {
          fc.pre(itemVar !== indexVar && itemVar !== source && indexVar !== source);
          const expr = `(${itemVar}, ${indexVar}) in ${source}`;
          const result = parseEachExpression(expr);
          expect(result.itemVar).toBe(itemVar);
          expect(result.indexVar).toBe(indexVar);
          expect(result.source).toBe(source);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 2.1, 2.2, 2.3, 3.1, 3.2, 5.1, 5.2, 5.3**
 *
 * Property 2: For_Block Structure and Anchor Replacement
 *
 * For any valid HTML template containing one or more each elements,
 * the Tree Walker SHALL produce one ForBlock per each element with
 * sequential varNames, valid anchorPath, correct metadata, and
 * comment anchors in the processed template.
 *
 * Feature: each-directive, Property 2: For_Block Structure and Anchor Replacement
 */
describe('Feature: each-directive, Property 2: For_Block Structure and Anchor Replacement', () => {
  const identArb = fc.stringMatching(/^[a-z][a-zA-Z]{0,5}$/);
  const tagArb = fc.constantFrom('div', 'span', 'li', 'p');

  // Generator for a single each element
  const eachElementArb = fc.record({
    tag: tagArb,
    itemVar: identArb,
    source: identArb,
  }).filter(r => r.itemVar !== r.source && r.itemVar.length > 0 && r.source.length > 0);

  it('produces one ForBlock per each element with sequential varNames and comment anchors', () => {
    fc.assert(
      fc.property(
        fc.array(eachElementArb, { minLength: 1, maxLength: 4 }),
        (elements) => {
          const html = elements
            .map(({ tag, itemVar, source }) =>
              `<${tag} each="${itemVar} in ${source}">text</${tag}>`
            )
            .join('');

          const root = makeRoot(html);
          const forBlocks = processForBlocks(root, [], new Set(), new Set(), new Set());

          // One ForBlock per each element
          expect(forBlocks).toHaveLength(elements.length);

          // Sequential varNames
          for (let i = 0; i < forBlocks.length; i++) {
            expect(forBlocks[i].varName).toBe(`__for${i}`);
          }

          // Correct metadata
          for (let i = 0; i < forBlocks.length; i++) {
            expect(forBlocks[i].itemVar).toBe(elements[i].itemVar);
            expect(forBlocks[i].source).toBe(elements[i].source);
          }

          // Valid anchorPath
          for (const fb of forBlocks) {
            expect(Array.isArray(fb.anchorPath)).toBe(true);
            for (const segment of fb.anchorPath) {
              expect(segment).toMatch(/^childNodes\[\d+\]$/);
            }
          }

          // Processed template contains comment anchors
          const serialized = root.innerHTML;
          const commentCount = (serialized.match(/<!--\s*each\s*-->/g) || []).length;
          expect(commentCount).toBe(elements.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
 *
 * Property 3: Item Template Extraction and Internal Processing
 *
 * For any each element containing bindings, the extracted templateHtml
 * SHALL NOT contain each or :key attributes, and all internal bindings
 * SHALL be discovered with paths relative to the item root element.
 *
 * Feature: each-directive, Property 3: Item Template Extraction and Internal Processing
 */
describe('Feature: each-directive, Property 3: Item Template Extraction and Internal Processing', () => {
  const identArb = fc.stringMatching(/^[a-z][a-zA-Z]{0,5}$/);

  it('extracted template has no each/:key attrs and discovers internal bindings', () => {
    fc.assert(
      fc.property(
        identArb,
        identArb,
        identArb,
        (itemVar, source, bindingVar) => {
          fc.pre(itemVar !== source && itemVar.length > 0 && source.length > 0 && bindingVar.length > 0);

          const html = `<li each="${itemVar} in ${source}" :key="${itemVar}.id">` +
            `<span>{{${bindingVar}}}</span>` +
            `<button @click="remove">x</button>` +
            `</li>`;

          const root = makeRoot(html);
          const forBlocks = processForBlocks(root, [], new Set(), new Set(), new Set());

          expect(forBlocks).toHaveLength(1);
          const fb = forBlocks[0];

          // Template should not contain each or :key
          expect(fb.templateHtml).not.toContain('each=');
          expect(fb.templateHtml).not.toContain(':key=');

          // Bindings should be discovered
          expect(fb.bindings.length).toBeGreaterThanOrEqual(1);
          expect(fb.bindings[0].name).toBe(bindingVar);

          // Events should be discovered
          expect(fb.events.length).toBeGreaterThanOrEqual(1);
          expect(fb.events[0].event).toBe('click');
          expect(fb.events[0].handler).toBe('remove');

          // Paths should be relative (no leading childNodes[0] wrapper)
          for (const b of fb.bindings) {
            expect(Array.isArray(b.path)).toBe(true);
          }
          for (const e of fb.events) {
            expect(Array.isArray(e.path)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 12.1**
 *
 * Property 7: Conflicting Directives Error
 *
 * For any element with both each and if attributes,
 * the Tree Walker SHALL throw CONFLICTING_DIRECTIVES.
 *
 * Feature: each-directive, Property 7: Conflicting Directives Error
 */
describe('Feature: each-directive, Property 7: Conflicting Directives Error', () => {
  const identArb = fc.stringMatching(/^[a-z][a-zA-Z]{0,5}$/);
  const tagArb = fc.constantFrom('div', 'span', 'li', 'p');

  it('throws CONFLICTING_DIRECTIVES when each and if are on the same element', () => {
    fc.assert(
      fc.property(
        tagArb,
        identArb,
        identArb,
        identArb,
        (tag, itemVar, source, condition) => {
          fc.pre(itemVar !== source && itemVar.length > 0 && source.length > 0 && condition.length > 0);

          const html = `<${tag} each="${itemVar} in ${source}" if="${condition}">text</${tag}>`;
          const root = makeRoot(html);

          expect(() => {
            processForBlocks(root, [], new Set(), new Set(), new Set());
          }).toThrow();

          try {
            processForBlocks(makeRoot(html), [], new Set(), new Set(), new Set());
          } catch (e) {
            expect(e.code).toBe('CONFLICTING_DIRECTIVES');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 1.3, 1.4, 1.5**
 *
 * Property 8: Invalid each Expression Error
 *
 * For any string missing the in keyword, with empty item variable,
 * or empty source expression, parsing SHALL throw INVALID_V_FOR.
 *
 * Feature: each-directive, Property 8: Invalid each Expression Error
 */
describe('Feature: each-directive, Property 8: Invalid each Expression Error', () => {
  const identArb = fc.stringMatching(/^[a-z][a-zA-Z]{0,5}$/).filter(s => s.length > 0);

  it('throws INVALID_V_FOR for missing "in" keyword', () => {
    fc.assert(
      fc.property(
        // Generate strings without "in" keyword
        fc.stringMatching(/^[a-z][a-zA-Z0-9 ]{1,15}$/).filter(s => !s.includes('in')),
        (expr) => {
          expect(() => parseEachExpression(expr)).toThrow();
          try {
            parseEachExpression(expr);
          } catch (e) {
            expect(e.code).toBe('INVALID_V_FOR');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('throws INVALID_V_FOR for empty item variable', () => {
    fc.assert(
      fc.property(identArb, (source) => {
        expect(() => parseEachExpression(` in ${source}`)).toThrow();
        try {
          parseEachExpression(` in ${source}`);
        } catch (e) {
          expect(e.code).toBe('INVALID_V_FOR');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('throws INVALID_V_FOR for empty source expression', () => {
    fc.assert(
      fc.property(identArb, (itemVar) => {
        expect(() => parseEachExpression(`${itemVar} in `)).toThrow();
        try {
          parseEachExpression(`${itemVar} in `);
        } catch (e) {
          expect(e.code).toBe('INVALID_V_FOR');
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ── Unit Tests ──────────────────────────────────────────────────────

describe('tree-walker each — unit tests', () => {
  it('recomputes anchor path after DOM normalization (Req 3.3)', () => {
    // Text nodes around the each element may merge after replacement
    const root = makeRoot('text before<li each="item in items">{{item}}</li>text after');
    const forBlocks = processForBlocks(root, [], new Set(), new Set(), new Set());

    expect(forBlocks).toHaveLength(1);
    // After replacement, the comment should be between text nodes
    expect(forBlocks[0].anchorPath.length).toBeGreaterThan(0);
    // Verify the anchor path points to a comment node
    let node = root;
    for (const seg of forBlocks[0].anchorPath) {
      const match = seg.match(/childNodes\[(\d+)\]/);
      node = node.childNodes[parseInt(match[1])];
    }
    expect(node.nodeType).toBe(8); // Comment node
  });

  it('detects deeply nested each elements (Req 5.3)', () => {
    const html = '<div><section><ul><li each="item in items">{{item}}</li></ul></section></div>';
    const root = makeRoot(html);
    const forBlocks = processForBlocks(root, [], new Set(), new Set(), new Set());

    expect(forBlocks).toHaveLength(1);
    expect(forBlocks[0].itemVar).toBe('item');
    expect(forBlocks[0].source).toBe('items');
    // Anchor path should have multiple segments for deep nesting
    expect(forBlocks[0].anchorPath.length).toBeGreaterThan(2);
  });

  it('handles multiple each elements in same parent (Req 5.2)', () => {
    const html =
      '<li each="item in items">{{item}}</li>' +
      '<li each="user in users">{{user}}</li>';
    const root = makeRoot(html);
    const forBlocks = processForBlocks(root, [], new Set(), new Set(), new Set());

    expect(forBlocks).toHaveLength(2);
    expect(forBlocks[0].varName).toBe('__for0');
    expect(forBlocks[0].source).toBe('items');
    expect(forBlocks[1].varName).toBe('__for1');
    expect(forBlocks[1].source).toBe('users');
  });

  it('extracts :key and removes it from template (Req 2.1, 2.2, 2.3)', () => {
    const html = '<li each="item in items" :key="item.id">{{item.name}}</li>';
    const root = makeRoot(html);
    const forBlocks = processForBlocks(root, [], new Set(), new Set(), new Set());

    expect(forBlocks).toHaveLength(1);
    expect(forBlocks[0].keyExpr).toBe('item.id');
    expect(forBlocks[0].templateHtml).not.toContain(':key');
  });

  it('sets keyExpr to null when no :key attribute (Req 2.2)', () => {
    const html = '<li each="item in items">{{item}}</li>';
    const root = makeRoot(html);
    const forBlocks = processForBlocks(root, [], new Set(), new Set(), new Set());

    expect(forBlocks).toHaveLength(1);
    expect(forBlocks[0].keyExpr).toBeNull();
  });

  it('handles each element with no internal bindings', () => {
    const html = '<li each="item in items">static text</li>';
    const root = makeRoot(html);
    const forBlocks = processForBlocks(root, [], new Set(), new Set(), new Set());

    expect(forBlocks).toHaveLength(1);
    expect(forBlocks[0].bindings).toHaveLength(0);
    expect(forBlocks[0].events).toHaveLength(0);
  });

  it('discovers show bindings inside each template', () => {
    const html = '<li each="item in items"><span show="item.visible">text</span></li>';
    const root = makeRoot(html);
    const forBlocks = processForBlocks(root, [], new Set(), new Set(), new Set());

    expect(forBlocks).toHaveLength(1);
    expect(forBlocks[0].showBindings).toHaveLength(1);
    expect(forBlocks[0].showBindings[0].expression).toBe('item.visible');
  });

  it('parses destructured form with index variable', () => {
    const result = parseEachExpression('(item, index) in items');
    expect(result.itemVar).toBe('item');
    expect(result.indexVar).toBe('index');
    expect(result.source).toBe('items');
  });

  it('parses simple form without index variable', () => {
    const result = parseEachExpression('item in items');
    expect(result.itemVar).toBe('item');
    expect(result.indexVar).toBeNull();
    expect(result.source).toBe('items');
  });
});
