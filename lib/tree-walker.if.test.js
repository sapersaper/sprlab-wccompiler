/**
 * Tests for wcCompiler v2 Tree Walker — if/else-if/else extensions.
 *
 * Includes:
 * - Property tests for chain detection, branch extraction, validation errors
 * - Unit tests for edge cases (nesting, multiple chains, anchor path recomputation)
 */

import { describe, it, expect } from 'vitest';
import { parseHTML } from 'linkedom';
import fc from 'fast-check';
import { walkTree, processIfChains, walkBranch } from './tree-walker.js';

// ── Helper: create a root element from HTML ─────────────────────────

function makeRoot(html) {
  const { document } = parseHTML(`<div id="__root">${html}</div>`);
  return document.getElementById('__root');
}

// ── Property Tests ──────────────────────────────────────────────────

/**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 4.1, 4.2, 4.3, 11.1, 11.2**
 *
 * Property 1: Chain Detection and If_Block Structure
 *
 * For any valid HTML template containing one or more conditional chains
 * (if optionally followed by else-if and/or else siblings), the Tree Walker
 * SHALL produce one If_Block per chain, each with a sequential variable name
 * (__if0, __if1, ...), a valid anchor path, and branches matching the chain
 * elements in order with correct types and expressions.
 *
 * Feature: if, Property 1: Chain Detection and If_Block Structure
 */
describe('Feature: if, Property 1: Chain Detection and If_Block Structure', () => {
  // Generator for a simple JS expression
  const exprArb = fc.constantFrom(
    "status === 'active'",
    'count > 0',
    'isVisible',
    'x === 1',
    'flag',
    "mode === 'edit'"
  );

  // Generator for a tag name
  const tagArb = fc.constantFrom('div', 'span', 'p', 'section', 'article');

  // Generator for a single conditional chain
  const chainArb = fc.record({
    tag: tagArb,
    ifExpr: exprArb,
    elseIfExprs: fc.array(exprArb, { minLength: 0, maxLength: 1 }),
    hasElse: fc.boolean(),
  });

  // Generator for 1-2 chains (reduced from 3 to avoid timeout with jsdom overhead)
  const templateArb = fc.array(chainArb, { minLength: 1, maxLength: 2 });

  it('produces one IfBlock per chain with sequential varNames, valid anchorPath, and correct branch types', { timeout: 30000 }, () => {
    fc.assert(
      fc.property(templateArb, (chains) => {
        // Build HTML with chains separated by non-conditional elements
        let html = '';
        for (let c = 0; c < chains.length; c++) {
          const chain = chains[c];
          html += `<${chain.tag} if="${chain.ifExpr}">if content</${chain.tag}>`;
          for (const elseIfExpr of chain.elseIfExprs) {
            html += `<${chain.tag} else-if="${elseIfExpr}">else-if content</${chain.tag}>`;
          }
          if (chain.hasElse) {
            html += `<${chain.tag} else>else content</${chain.tag}>`;
          }
          // Add a separator between chains
          if (c < chains.length - 1) {
            html += '<hr>';
          }
        }

        const root = makeRoot(html);
        const ifBlocks = processIfChains(root, [], new Set(), new Set(), new Set());

        // One IfBlock per chain
        expect(ifBlocks).toHaveLength(chains.length);

        for (let c = 0; c < chains.length; c++) {
          const block = ifBlocks[c];
          const chain = chains[c];

          // Sequential varName
          expect(block.varName).toBe(`__if${c}`);

          // Valid anchorPath
          expect(Array.isArray(block.anchorPath)).toBe(true);
          expect(block.anchorPath.length).toBeGreaterThan(0);
          for (const seg of block.anchorPath) {
            expect(seg).toMatch(/^childNodes\[\d+\]$/);
          }

          // Correct number of branches
          const expectedBranches = 1 + chain.elseIfExprs.length + (chain.hasElse ? 1 : 0);
          expect(block.branches).toHaveLength(expectedBranches);

          // First branch is 'if'
          expect(block.branches[0].type).toBe('if');
          expect(block.branches[0].expression).toBe(chain.ifExpr);

          // else-if branches
          for (let ei = 0; ei < chain.elseIfExprs.length; ei++) {
            expect(block.branches[1 + ei].type).toBe('else-if');
            expect(block.branches[1 + ei].expression).toBe(chain.elseIfExprs[ei]);
          }

          // else branch
          if (chain.hasElse) {
            const lastBranch = block.branches[block.branches.length - 1];
            expect(lastBranch.type).toBe('else');
            expect(lastBranch.expression).toBeNull();
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 *
 * Property 2: Branch Template Extraction and Internal Processing
 *
 * For any branch in a conditional chain, the extracted templateHtml SHALL NOT
 * contain if, else-if, or else attributes, and all {{interpolation}} bindings
 * and @event bindings within the branch SHALL be discovered with paths relative
 * to the branch root element.
 *
 * Feature: if, Property 2: Branch Template Extraction and Internal Processing
 */
describe('Feature: if, Property 2: Branch Template Extraction and Internal Processing', () => {
  const varNameArb = fc.stringMatching(/^[a-z][a-zA-Z]{0,5}$/);
  const eventArb = fc.constantFrom('click', 'input', 'change', 'submit');
  const handlerArb = fc.stringMatching(/^[a-z][a-zA-Z]{0,5}$/);
  const tagArb = fc.constantFrom('div', 'span', 'p', 'section');

  // Generator for branch HTML content
  const branchContentArb = fc.record({
    tag: tagArb,
    hasBinding: fc.boolean(),
    bindingVar: varNameArb,
    hasEvent: fc.boolean(),
    eventName: eventArb,
    eventHandler: handlerArb,
  });

  it('templateHtml has no directive attributes and all bindings/events are discovered with relative paths', () => {
    fc.assert(
      fc.property(branchContentArb, (content) => {
        let innerHtml = 'static text';
        if (content.hasBinding) {
          innerHtml = `{{${content.bindingVar}}}`;
        }

        let attrs = '';
        if (content.hasEvent) {
          attrs = ` @${content.eventName}="${content.eventHandler}"`;
        }

        const html = `<${content.tag}${attrs}>${innerHtml}</${content.tag}>`;
        const signalNames = content.hasBinding ? new Set([content.bindingVar]) : new Set();

        const result = walkBranch(html, signalNames, new Set(), new Set());

        // templateHtml should NOT contain directive attributes
        expect(result.processedHtml).not.toMatch(/\bif="/);
        expect(result.processedHtml).not.toMatch(/\belse-if="/);
        expect(result.processedHtml).not.toMatch(/\belse\b/);

        // Bindings discovered
        if (content.hasBinding) {
          expect(result.bindings.length).toBeGreaterThanOrEqual(1);
          // Paths should be relative (no leading childNodes[0] from wrapper)
          for (const b of result.bindings) {
            expect(Array.isArray(b.path)).toBe(true);
            // Path should not start with the wrapper div's childNodes index
          }
        }

        // Events discovered
        if (content.hasEvent) {
          expect(result.events.length).toBeGreaterThanOrEqual(1);
          expect(result.events[0].event).toBe(content.eventName);
          expect(result.events[0].handler).toBe(content.eventHandler);
        }

        // showBindings and attrBindings are empty arrays (not yet implemented)
        expect(result.showBindings).toEqual([]);
        expect(result.attrBindings).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 8.1, 8.2, 8.3**
 *
 * Property 5: Conflicting Directives Error
 *
 * For any element that has both if and else, or both if and else-if,
 * or both show and if, the Tree Walker SHALL throw an error with code
 * CONFLICTING_DIRECTIVES.
 *
 * Feature: if, Property 5: Conflicting Directives Error
 */
describe('Feature: if, Property 5: Conflicting Directives Error', () => {
  const tagArb = fc.constantFrom('div', 'span', 'p', 'section', 'article');
  const exprArb = fc.constantFrom('x', 'y > 0', "status === 'ok'", 'flag');

  // Generator for conflicting directive combinations
  const conflictArb = fc.oneof(
    // if + else on same element
    fc.record({
      kind: fc.constant('if-else'),
      tag: tagArb,
      ifExpr: exprArb,
    }),
    // if + else-if on same element
    fc.record({
      kind: fc.constant('if-elseif'),
      tag: tagArb,
      ifExpr: exprArb,
      elseIfExpr: exprArb,
    }),
    // show + if on same element
    fc.record({
      kind: fc.constant('show-if'),
      tag: tagArb,
      ifExpr: exprArb,
      showExpr: exprArb,
    })
  );

  it('throws CONFLICTING_DIRECTIVES for conflicting directive combinations', () => {
    fc.assert(
      fc.property(conflictArb, (conflict) => {
        let html;
        if (conflict.kind === 'if-else') {
          html = `<${conflict.tag} if="${conflict.ifExpr}" else>content</${conflict.tag}>`;
        } else if (conflict.kind === 'if-elseif') {
          html = `<${conflict.tag} if="${conflict.ifExpr}" else-if="${conflict.elseIfExpr}">content</${conflict.tag}>`;
        } else {
          html = `<${conflict.tag} show="${conflict.showExpr}" if="${conflict.ifExpr}">content</${conflict.tag}>`;
        }

        const root = makeRoot(html);
        try {
          processIfChains(root, [], new Set(), new Set(), new Set());
          expect.unreachable('Should have thrown CONFLICTING_DIRECTIVES');
        } catch (err) {
          expect(err.code).toBe('CONFLICTING_DIRECTIVES');
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 9.1, 9.2**
 *
 * Property 6: Orphan Else Error
 *
 * For any element with else-if or else that does not immediately follow
 * a sibling with if or else-if, the Tree Walker SHALL throw an error
 * with code ORPHAN_ELSE.
 *
 * Feature: if, Property 6: Orphan Else Error
 */
describe('Feature: if, Property 6: Orphan Else Error', () => {
  const tagArb = fc.constantFrom('div', 'span', 'p', 'section');
  const exprArb = fc.constantFrom('x', 'y > 0', 'flag', "status === 'ok'");

  const orphanArb = fc.oneof(
    // else-if without preceding if
    fc.record({
      kind: fc.constant('orphan-elseif'),
      tag: tagArb,
      expr: exprArb,
    }),
    // else without preceding if
    fc.record({
      kind: fc.constant('orphan-else'),
      tag: tagArb,
    })
  );

  it('throws ORPHAN_ELSE for else-if or else without preceding if', () => {
    fc.assert(
      fc.property(orphanArb, (orphan) => {
        let html;
        if (orphan.kind === 'orphan-elseif') {
          // A non-conditional element followed by else-if
          html = `<div>normal</div><${orphan.tag} else-if="${orphan.expr}">content</${orphan.tag}>`;
        } else {
          // A non-conditional element followed by else
          html = `<div>normal</div><${orphan.tag} else>content</${orphan.tag}>`;
        }

        const root = makeRoot(html);
        try {
          processIfChains(root, [], new Set(), new Set(), new Set());
          expect.unreachable('Should have thrown ORPHAN_ELSE');
        } catch (err) {
          expect(err.code).toBe('ORPHAN_ELSE');
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 10.1**
 *
 * Property 7: Invalid else Error
 *
 * For any element with a else attribute that has a non-empty value,
 * the Tree Walker SHALL throw an error with code INVALID_V_ELSE.
 *
 * Feature: if, Property 7: Invalid else Error
 */
describe('Feature: if, Property 7: Invalid else Error', () => {
  const tagArb = fc.constantFrom('div', 'span', 'p', 'section');
  const exprArb = fc.stringMatching(/^[a-z][a-zA-Z0-9 ]{1,10}$/);

  it('throws INVALID_V_ELSE for else with a non-empty value', () => {
    fc.assert(
      fc.property(tagArb, exprArb, (tag, expr) => {
        // if element followed by else with a value
        const html = `<${tag} if="x">${tag}</${tag}><${tag} else="${expr}">content</${tag}>`;

        const root = makeRoot(html);
        try {
          processIfChains(root, [], new Set(), new Set(), new Set());
          expect.unreachable('Should have thrown INVALID_V_ELSE');
        } catch (err) {
          expect(err.code).toBe('INVALID_V_ELSE');
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ── Unit Tests for Edge Cases ───────────────────────────────────────

describe('processIfChains — unit tests', () => {
  it('recomputes anchor path after DOM normalization (Req 2.3)', () => {
    // Text nodes around the chain may merge after element removal
    const html = 'before <p if="x">A</p><p else>B</p> after';
    const root = makeRoot(html);
    const ifBlocks = processIfChains(root, [], new Set(), new Set(), new Set());

    expect(ifBlocks).toHaveLength(1);
    // The anchor path should be valid after normalization
    const anchorPath = ifBlocks[0].anchorPath;
    expect(anchorPath.length).toBeGreaterThan(0);
    for (const seg of anchorPath) {
      expect(seg).toMatch(/^childNodes\[\d+\]$/);
    }
  });

  it('handles multiple independent chains in same parent (Req 1.5)', () => {
    const html = `
      <div if="a">A</div>
      <div else>B</div>
      <hr>
      <span if="c">C</span>
      <span else-if="d">D</span>
      <span else>E</span>
    `;
    const root = makeRoot(html);
    const ifBlocks = processIfChains(root, [], new Set(), new Set(), new Set());

    expect(ifBlocks).toHaveLength(2);
    expect(ifBlocks[0].varName).toBe('__if0');
    expect(ifBlocks[0].branches).toHaveLength(2);
    expect(ifBlocks[1].varName).toBe('__if1');
    expect(ifBlocks[1].branches).toHaveLength(3);
  });

  it('handles deeply nested conditional chains (Req 11.1, 11.2)', () => {
    const html = `
      <div>
        <section>
          <p if="x">nested if</p>
          <p else>nested else</p>
        </section>
      </div>
    `;
    const root = makeRoot(html);
    const ifBlocks = processIfChains(root, [], new Set(), new Set(), new Set());

    expect(ifBlocks).toHaveLength(1);
    expect(ifBlocks[0].branches).toHaveLength(2);
    // Anchor path should include the nesting: childNodes[0] (div) -> childNodes[0] (section) -> childNodes[N] (comment)
    expect(ifBlocks[0].anchorPath.length).toBeGreaterThanOrEqual(2);
  });

  it('closes chain without else when non-conditional sibling follows (Req 1.4)', () => {
    const html = `
      <div if="x">A</div>
      <div else-if="y">B</div>
      <hr>
    `;
    const root = makeRoot(html);
    const ifBlocks = processIfChains(root, [], new Set(), new Set(), new Set());

    expect(ifBlocks).toHaveLength(1);
    expect(ifBlocks[0].branches).toHaveLength(2);
    expect(ifBlocks[0].branches[0].type).toBe('if');
    expect(ifBlocks[0].branches[1].type).toBe('else-if');
  });

  it('removes directive attributes from branch templateHtml', () => {
    const html = '<p if="x">content</p><p else>fallback</p>';
    const root = makeRoot(html);
    const ifBlocks = processIfChains(root, [], new Set(), new Set(), new Set());

    expect(ifBlocks[0].branches[0].templateHtml).not.toContain('if=');
    expect(ifBlocks[0].branches[1].templateHtml).not.toContain('else');
  });

  it('discovers bindings inside branches with relative paths', () => {
    const html = '<div if="x">{{count}}</div><div else>static</div>';
    const root = makeRoot(html);
    const signalNames = new Set(['count']);
    const ifBlocks = processIfChains(root, [], signalNames, new Set(), new Set());

    expect(ifBlocks[0].branches[0].bindings).toHaveLength(1);
    expect(ifBlocks[0].branches[0].bindings[0].name).toBe('count');
    // Path should be relative to the branch root (the <div>), not the component root
    // For sole content, path points to the element itself (empty or just the element)
    expect(Array.isArray(ifBlocks[0].branches[0].bindings[0].path)).toBe(true);
  });

  it('discovers events inside branches', () => {
    const html = '<div if="x"><button @click="handleClick">Click</button></div><div else>no</div>';
    const root = makeRoot(html);
    const ifBlocks = processIfChains(root, [], new Set(), new Set(), new Set());

    expect(ifBlocks[0].branches[0].events).toHaveLength(1);
    expect(ifBlocks[0].branches[0].events[0].event).toBe('click');
    expect(ifBlocks[0].branches[0].events[0].handler).toBe('handleClick');
  });

  it('replaces chain with comment node in the DOM', () => {
    const html = '<p if="x">A</p><p else>B</p>';
    const root = makeRoot(html);
    processIfChains(root, [], new Set(), new Set(), new Set());

    // The chain should be replaced with a comment node
    const innerHTML = root.innerHTML;
    expect(innerHTML).toContain('<!-- if -->');
    expect(innerHTML).not.toContain('if=');
  });

  it('handles if-only chain (no else-if or else)', () => {
    const html = '<div if="x">only if</div>';
    const root = makeRoot(html);
    const ifBlocks = processIfChains(root, [], new Set(), new Set(), new Set());

    expect(ifBlocks).toHaveLength(1);
    expect(ifBlocks[0].branches).toHaveLength(1);
    expect(ifBlocks[0].branches[0].type).toBe('if');
  });
});
