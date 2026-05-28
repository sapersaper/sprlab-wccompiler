/**
 * Tests for wcCompiler v2 Code Generator — if/else-if/else extensions.
 *
 * Includes:
 * - Property tests for constructor/effect structure and setup method
 * - Unit tests for edge cases (early return, no-branch, branch removal, clone/insert)
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

/** Generate a valid JS identifier */
const arbIdentifier = fc
  .stringMatching(/^[a-z][a-z]{1,6}$/)
  .filter(s => !['if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else', 'enum', 'eval', 'null', 'this', 'true', 'void', 'with'].includes(s));

/** Generate a simple expression referencing a signal */
const arbExpr = fc.constantFrom(
  "status === 'active'",
  'count > 0',
  'isVisible',
  'flag',
  "mode === 'edit'"
);

/** Generate a binding */
const arbBinding = fc.record({
  varName: fc.nat({ max: 20 }).map(n => `__b${n}`),
  name: arbIdentifier,
  type: fc.constantFrom('signal', 'computed', 'method'),
  path: fc.array(fc.nat({ max: 3 }).map(n => `childNodes[${n}]`), { minLength: 0, maxLength: 2 }),
});

/** Generate an event binding */
const arbEvent = fc.record({
  varName: fc.nat({ max: 20 }).map(n => `__e${n}`),
  event: fc.constantFrom('click', 'input', 'change'),
  handler: arbIdentifier,
  path: fc.array(fc.nat({ max: 3 }).map(n => `childNodes[${n}]`), { minLength: 0, maxLength: 2 }),
});

/** Generate an IfBranch */
const arbIfBranch = fc.record({
  type: fc.constantFrom('if', 'else-if', 'else'),
  expression: arbExpr.map(e => e),
  templateHtml: fc.constant('<p>branch content</p>'),
  bindings: fc.array(arbBinding, { minLength: 0, maxLength: 2 }),
  events: fc.array(arbEvent, { minLength: 0, maxLength: 1 }),
  showBindings: fc.constant([]),
  attrBindings: fc.constant([]),
});

/** Generate a valid IfBlock with proper branch ordering */
const arbIfBlock = fc.record({
  elseIfCount: fc.nat({ max: 2 }),
  hasElse: fc.boolean(),
  ifBranch: arbIfBranch.map(b => ({ ...b, type: 'if' })),
  elseIfBranches: fc.array(arbIfBranch.map(b => ({ ...b, type: 'else-if' })), { minLength: 0, maxLength: 2 }),
  elseBranch: arbIfBranch.map(b => ({ ...b, type: 'else', expression: null })),
}).map(({ hasElse, ifBranch, elseIfBranches, elseBranch }) => {
  const branches = [ifBranch, ...elseIfBranches];
  if (hasElse) branches.push(elseBranch);
  return {
    varName: '__if0',
    anchorPath: ['childNodes[0]'],
    branches,
  };
});

/** Generate a ParseResult with ifBlocks */
const arbParseResultWithIf = fc.record({
  tagName: arbTagName,
  signals: fc.array(fc.record({
    name: arbIdentifier,
    value: fc.constantFrom('0', "'hello'", 'true'),
  }), { minLength: 0, maxLength: 2 }),
  ifBlock: arbIfBlock,
}).map(r => {
  const usedNames = new Set();
  const signals = r.signals.filter(s => {
    if (usedNames.has(s.name)) return false;
    usedNames.add(s.name);
    return true;
  });

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
    processedTemplate: '<!-- if -->',
    ifBlocks: [r.ifBlock],
  };
});

// ── Property Tests ──────────────────────────────────────────────────

/**
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 12.1, 12.2, 12.3**
 *
 * Property 3: Codegen Constructor and Effect Structure
 *
 * For any ParseResult containing IfBlocks, the generated JavaScript SHALL contain:
 * a document.createElement('template') and innerHTML assignment for each branch
 * in the constructor, an anchor reference assignment, _current = null and
 * _active = undefined initialization, and an __effect in connectedCallback that
 * evaluates branch conditions using transformExpr.
 *
 * Feature: if, Property 3: Codegen Constructor and Effect Structure
 */
describe('Feature: if, Property 3: Codegen Constructor and Effect Structure', () => {
  it('generates template elements, anchor ref, state init, and effect for each IfBlock', () => {
    fc.assert(
      fc.property(arbParseResultWithIf, (ir) => {
        const output = generateComponent(ir);
        const ifBlock = ir.ifBlocks[0];
        const vn = ifBlock.varName;

        // Template per branch
        for (let i = 0; i < ifBlock.branches.length; i++) {
          expect(output).toContain(`this.${vn}_t${i} = document.createElement('template')`);
          expect(output).toContain(`this.${vn}_t${i}.innerHTML`);
        }

        // Anchor reference
        expect(output).toContain(`this.${vn}_anchor = `);

        // State init
        expect(output).toContain(`this.${vn}_current = null`);
        expect(output).toContain(`this.${vn}_active = undefined`);

        // __renderIf_N method (Phase 2: if-blocks moved from __effect to __invalidate)
        expect(output).toContain('__renderIf_0() {');
        expect(output).toContain('let __branch = null');

        // Branch conditions
        for (const branch of ifBlock.branches) {
          if (branch.type === 'if') {
            expect(output).toContain(`if (`);
          } else if (branch.type === 'else-if') {
            expect(output).toContain(`else if (`);
          } else {
            expect(output).toContain(`else { __branch =`);
          }
        }

        // Early return optimization
        expect(output).toContain(`__branch === this.${vn}_active) return`);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**
 *
 * Property 4: Codegen Setup Method
 *
 * For any IfBlock where at least one branch contains bindings or events,
 * the Code Generator SHALL produce a setup method that, for each such branch,
 * generates __effect calls for text bindings and addEventListener calls for
 * event bindings, keyed on the branch index.
 *
 * Feature: if, Property 4: Codegen Setup Method
 */
describe('Feature: if, Property 4: Codegen Setup Method', () => {
  // Generate IfBlock where at least one branch has bindings
  const arbIfBlockWithBindings = arbIfBlock.map(block => {
    // Ensure at least one branch has a binding
    if (block.branches[0].bindings.length === 0 && block.branches[0].events.length === 0) {
      block.branches[0].bindings = [{
        varName: '__b0',
        name: 'count',
        type: 'signal',
        path: ['childNodes[0]'],
      }];
    }
    return block;
  });

  const arbParseResultWithSetup = fc.record({
    tagName: arbTagName,
    ifBlock: arbIfBlockWithBindings,
  }).map(r => ({
    tagName: r.tagName,
    className: toClassName(r.tagName),
    template: '<div>test</div>',
    style: '',
    signals: [{ name: 'count', value: '0' }],
    computeds: [],
    effects: [],
    methods: [],
    bindings: [],
    events: [],
    processedTemplate: '<!-- if -->',
    ifBlocks: [r.ifBlock],
  }));

  it('Phase 2: setup method only generated when branches have events (simple bindings via __invalidate)', () => {
    fc.assert(
      fc.property(arbParseResultWithSetup, (ir) => {
        const output = generateComponent(ir);
        const ifBlock = ir.ifBlocks[0];
        const vn = ifBlock.varName;
        const hasEvents = ifBlock.branches.some(b => b.events.length > 0);

        if (hasEvents) {
          // Setup method should exist for event bindings
          expect(output).toContain(`${vn}_setup(node, branch)`);
          expect(output).toContain(`this.${vn}_setup(node, __branch)`);
        } else {
          // No setup method when only simple bindings (no events/model/for/dynamic)
          expect(output).not.toContain(`${vn}_setup(`);
        }

        // For branches with events, check addEventListener in setup
        for (let i = 0; i < ifBlock.branches.length; i++) {
          const branch = ifBlock.branches[i];
          if (branch.events.length > 0) {
            expect(output).toContain(`branch === ${i}`);
            for (const e of branch.events) {
              expect(output).toContain(`addEventListener('${e.event}'`);
            }
          }
          // Simple text bindings (signal) are now in __invalidate, not setup
          if (branch.bindings.length > 0) {
            // Phase 2: Internal bindings are handled in __invalidate with ifPathExpr,
            // not as standalone varName references in setup methods.
            // Verify the if-block is registered as a renderIf in the depGraph instead.
            expect(output).toContain('__renderIf_0');
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ── Unit Tests for Edge Cases ───────────────────────────────────────

describe('codegen if — unit tests', () => {
  /** Helper to create a minimal ParseResult with ifBlocks */
  function makeIR(ifBlocks) {
    return {
      tagName: 'wcc-test',
      className: 'WccTest',
      template: '<div>test</div>',
      style: '',
      signals: [{ name: 'status', value: "'idle'" }],
      computeds: [],
      effects: [],
      methods: [],
      bindings: [],
      events: [],
      processedTemplate: '<!-- if -->',
      ifBlocks,
    };
  }

  it('generates early return optimization when branch index unchanged (Req 6.6)', () => {
    const ir = makeIR([{
      varName: '__if0',
      anchorPath: ['childNodes[0]'],
      branches: [
        { type: 'if', expression: "status === 'active'", templateHtml: '<p>Active</p>', bindings: [], events: [], showBindings: [], attrBindings: [] },
        { type: 'else', expression: null, templateHtml: '<p>Inactive</p>', bindings: [], events: [], showBindings: [], attrBindings: [] },
      ],
    }]);

    const output = generateComponent(ir);
    expect(output).toContain('if (__branch === this.__if0_active) return');
  });

  it('renders nothing when no condition matches and no else (Req 6.5)', () => {
    const ir = makeIR([{
      varName: '__if0',
      anchorPath: ['childNodes[0]'],
      branches: [
        { type: 'if', expression: "status === 'active'", templateHtml: '<p>Active</p>', bindings: [], events: [], showBindings: [], attrBindings: [] },
      ],
    }]);

    const output = generateComponent(ir);
    // When no condition matches, __branch stays null
    // The code should handle __branch !== null check
    expect(output).toContain('if (__branch !== null)');
    // And remove current if exists
    expect(output).toContain('this.__if0_current.remove()');
  });

  it('generates branch removal logic (Req 6.3)', () => {
    const ir = makeIR([{
      varName: '__if0',
      anchorPath: ['childNodes[0]'],
      branches: [
        { type: 'if', expression: 'status', templateHtml: '<p>A</p>', bindings: [], events: [], showBindings: [], attrBindings: [] },
        { type: 'else', expression: null, templateHtml: '<p>B</p>', bindings: [], events: [], showBindings: [], attrBindings: [] },
      ],
    }]);

    const output = generateComponent(ir);
    expect(output).toContain('this.__if0_current.remove()');
    expect(output).toContain('this.__if0_current = null');
  });

  it('generates clone/insert before anchor logic (Req 6.4)', () => {
    const ir = makeIR([{
      varName: '__if0',
      anchorPath: ['childNodes[0]'],
      branches: [
        { type: 'if', expression: 'status', templateHtml: '<p>A</p>', bindings: [], events: [], showBindings: [], attrBindings: [] },
      ],
    }]);

    const output = generateComponent(ir);
    expect(output).toContain('tpl.content.cloneNode(true)');
    expect(output).toContain('clone.firstChild');
    expect(output).toContain('this.__if0_anchor.parentNode.insertBefore(node, this.__if0_anchor)');
    expect(output).toContain('this.__if0_current = node');
  });

  it('does NOT generate setup method when no branch has bindings (Req 7.1)', () => {
    const ir = makeIR([{
      varName: '__if0',
      anchorPath: ['childNodes[0]'],
      branches: [
        { type: 'if', expression: 'status', templateHtml: '<p>A</p>', bindings: [], events: [], showBindings: [], attrBindings: [] },
        { type: 'else', expression: null, templateHtml: '<p>B</p>', bindings: [], events: [], showBindings: [], attrBindings: [] },
      ],
    }]);

    const output = generateComponent(ir);
    expect(output).not.toContain('__if0_setup');
  });

  it('does NOT generate setup method for branches with only simple bindings (Phase 2: __invalidate handles them)', () => {
    const ir = makeIR([{
      varName: '__if0',
      anchorPath: ['childNodes[0]'],
      branches: [
        {
          type: 'if',
          expression: 'status',
          templateHtml: '<p><span></span></p>',
          bindings: [{ varName: '__b0', name: 'status', type: 'signal', path: ['childNodes[0]'] }],
          events: [],
          showBindings: [],
          attrBindings: [],
        },
        { type: 'else', expression: null, templateHtml: '<p>B</p>', bindings: [], events: [], showBindings: [], attrBindings: [] },
      ],
    }]);

    const output = generateComponent(ir);
    // Phase 2: no setup method for simple bindings (only events/model/for/dynamic trigger setup)
    expect(output).not.toContain('__if0_setup(');
    // Text binding handled via __invalidate with existence guard and ifPathExpr
    expect(output).toContain('__renderIf_0');
    expect(output).toContain('this._state.status');
  });

  it('generates setup method with addEventListener for event bindings', () => {
    const ir = makeIR([{
      varName: '__if0',
      anchorPath: ['childNodes[0]'],
      branches: [
        {
          type: 'if',
          expression: 'status',
          templateHtml: '<button>Click</button>',
          bindings: [],
          events: [{ varName: '__e0', event: 'click', handler: 'handleClick', path: [] }],
          showBindings: [],
          attrBindings: [],
        },
      ],
    }]);

    // Add the method so codegen doesn't break
    ir.methods = [{ name: 'handleClick', params: '', body: 'console.log("clicked")' }];

    const output = generateComponent(ir);
    expect(output).toContain('__if0_setup(node, branch)');
    expect(output).toContain("addEventListener('click'");
    expect(output).toContain('_handleClick.bind(this)');
  });

  it('transforms signal names in if expressions via transformExpr (Req 12.1)', () => {
    const ir = makeIR([{
      varName: '__if0',
      anchorPath: ['childNodes[0]'],
      branches: [
        { type: 'if', expression: "status === 'active'", templateHtml: '<p>A</p>', bindings: [], events: [], showBindings: [], attrBindings: [] },
      ],
    }]);

    const output = generateComponent(ir);
    // 'status' should be transformed to 'this._state.status'
    expect(output).toContain("this._state.status === 'active'");
  });
});
