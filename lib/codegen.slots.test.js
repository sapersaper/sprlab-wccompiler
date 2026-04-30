/**
 * Tests for wcCompiler v2 Code Generator — Scoped Slots (Light DOM).
 *
 * Includes:
 * - Property test for Light DOM Always (Property 2)
 * - Property test for CSS Scoping Always (Property 3)
 * - Property test for Slot Resolution Code Generation (Property 4)
 * - Unit tests for codegen edge cases
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateComponent } from './codegen.js';

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Build a minimal ParseResult for testing.
 * @param {object} overrides
 * @returns {object}
 */
function makeParseResult(overrides = {}) {
  return {
    tagName: 'wcc-test',
    className: 'WccTest',
    template: '<div>Hello</div>',
    style: '',
    signals: [],
    computeds: [],
    effects: [],
    methods: [],
    bindings: [],
    events: [],
    processedTemplate: '<div>Hello</div>',
    propDefs: [],
    propsObjectName: null,
    emits: [],
    emitsObjectName: null,
    ifBlocks: [],
    showBindings: [],
    forBlocks: [],
    onMountHooks: [],
    onDestroyHooks: [],
    modelBindings: [],
    attrBindings: [],
    slots: [],
    refs: [],
    refBindings: [],
    ...overrides,
  };
}

// ── Arbitraries ─────────────────────────────────────────────────────

/** Generate a valid tag/class pair */
const tagClassPairArb = fc.constantFrom(
  { tagName: 'wcc-card', className: 'WccCard' },
  { tagName: 'wcc-layout', className: 'WccLayout' },
  { tagName: 'wcc-panel', className: 'WccPanel' },
  { tagName: 'wcc-modal', className: 'WccModal' },
  { tagName: 'wcc-tabs', className: 'WccTabs' },
);

/** Generate optional CSS styles */
const styleArb = fc.option(
  fc.constantFrom(
    '.container { display: flex; }',
    'p { color: red; }',
    '.card { border: 1px solid; padding: 8px; }',
  ),
  { nil: '' }
);

/** Generate optional signal definitions */
const signalsArb = fc.constantFrom(
  [],
  [{ name: 'count', value: '0' }],
  [{ name: 'title', value: "'Hello'" }],
);

/** Generate optional binding definitions */
const bindingsArb = fc.constantFrom(
  [],
  [{ varName: '__b0', name: 'count', type: 'signal', path: ['childNodes[0]'] }],
);

/** Generate a template with slot placeholders (already processed by tree-walker) */
const slotTemplateArb = fc.constantFrom(
  '<div><span data-slot="default">Fallback</span></div>',
  '<div><span data-slot="header">Header</span><span data-slot="default">Body</span><span data-slot="footer">Footer</span></div>',
  '<section><span data-slot="content">Default</span></section>',
);

/** Generate a template without slots */
const noSlotTemplateArb = fc.constantFrom(
  '<div>Hello</div>',
  '<p>Text</p>',
  '<div><span>Content</span></div>',
  '<button>Click me</button>',
);

// ── Property Tests ──────────────────────────────────────────────────

describe('Feature: slots, Property 2: Light DOM Always', () => {
  it('generates light DOM pattern regardless of slot presence', () => {
    fc.assert(
      fc.property(
        tagClassPairArb,
        fc.boolean(), // hasSlots
        styleArb,
        signalsArb,
        ({ tagName, className }, hasSlots, style, signals) => {
          const template = hasSlots
            ? '<div><span data-slot="default">Fallback</span></div>'
            : '<div>Hello</div>';
          const slots = hasSlots
            ? [{ varName: '__s0', name: '', path: ['childNodes[0]', 'childNodes[0]'], defaultContent: 'Fallback', slotProps: [] }]
            : [];

          const pr = makeParseResult({
            tagName,
            className,
            template,
            style,
            processedTemplate: template,
            signals,
            slots,
          });

          const output = generateComponent(pr);

          // Always light DOM
          expect(output).toContain("this.innerHTML = ''");
          expect(output).toContain('this.appendChild(__root)');

          // Never Shadow DOM
          expect(output).not.toContain('attachShadow');
          expect(output).not.toContain('this.shadowRoot');
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: slots, Property 3: CSS Scoping Always', () => {
  it('always injects scoped CSS into document.head when styles are provided', () => {
    fc.assert(
      fc.property(
        tagClassPairArb,
        fc.boolean(), // hasSlots
        fc.boolean(), // hasStyle
        ({ tagName, className }, hasSlots, hasStyle) => {
          const style = hasStyle ? '.card { display: flex; }' : '';
          const template = hasSlots
            ? '<div><span data-slot="default">Fallback</span></div>'
            : '<div>Hello</div>';
          const slots = hasSlots
            ? [{ varName: '__s0', name: '', path: ['childNodes[0]', 'childNodes[0]'], defaultContent: 'Fallback', slotProps: [] }]
            : [];

          const pr = makeParseResult({
            tagName,
            className,
            template,
            style,
            processedTemplate: template,
            slots,
          });

          const output = generateComponent(pr);

          if (hasStyle) {
            // Scoped CSS in document.head (always)
            expect(output).toContain('document.head.appendChild');
            expect(output).toContain(`${tagName} .card`);
          } else {
            // No style element
            expect(output).not.toContain('document.head.appendChild');
          }

          // Never shadow root style injection
          expect(output).not.toContain('this.shadowRoot.appendChild(__style)');
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: slots, Property 4: Slot Resolution Code Generation', () => {
  it('generates __slotMap construction and slot injection code when slots are present', () => {
    fc.assert(
      fc.property(
        tagClassPairArb,
        styleArb,
        ({ tagName, className }, style) => {
          const slots = [
            { varName: '__s0', name: 'header', path: ['childNodes[0]', 'childNodes[0]'], defaultContent: 'Header', slotProps: [] },
            { varName: '__s1', name: '', path: ['childNodes[0]', 'childNodes[1]'], defaultContent: 'Body', slotProps: [] },
          ];

          const pr = makeParseResult({
            tagName,
            className,
            style,
            processedTemplate: '<div><span data-slot="header">Header</span><span data-slot="default">Body</span></div>',
            slots,
          });

          const output = generateComponent(pr);

          // Slot map construction
          expect(output).toContain('const __slotMap = {}');
          expect(output).toContain('const __defaultSlotNodes = []');
          expect(output).toContain("child.nodeName === 'TEMPLATE'");
          expect(output).toContain("attr.name.startsWith('#')");

          // Named slot injection
          expect(output).toContain("__slotMap['header']");
          expect(output).toContain('this.__s0.innerHTML');

          // Default slot injection
          expect(output).toContain('__defaultSlotNodes.length');
          expect(output).toContain('this.__s1.textContent');
          expect(output).toContain('this.__s1.appendChild');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Unit Tests ──────────────────────────────────────────────────────

describe('codegen slots — unit tests', () => {
  it('no slots — no slot resolution code generated', () => {
    const pr = makeParseResult({
      processedTemplate: '<div>Hello</div>',
      slots: [],
    });

    const output = generateComponent(pr);

    expect(output).not.toContain('__slotMap');
    expect(output).not.toContain('__defaultSlotNodes');
    expect(output).toContain("this.innerHTML = ''");
    expect(output).toContain('this.appendChild(__root)');
  });

  it('named slot — generates injection code', () => {
    const pr = makeParseResult({
      processedTemplate: '<div><span data-slot="header">Default</span></div>',
      slots: [{ varName: '__s0', name: 'header', path: ['childNodes[0]', 'childNodes[0]'], defaultContent: 'Default', slotProps: [] }],
    });

    const output = generateComponent(pr);

    expect(output).toContain('const __slotMap = {}');
    expect(output).toContain("if (__slotMap['header']) { this.__s0.innerHTML = __slotMap['header'].content; }");
  });

  it('default slot — generates default node injection code', () => {
    const pr = makeParseResult({
      processedTemplate: '<div><span data-slot="default">Fallback</span></div>',
      slots: [{ varName: '__s0', name: '', path: ['childNodes[0]', 'childNodes[0]'], defaultContent: 'Fallback', slotProps: [] }],
    });

    const output = generateComponent(pr);

    expect(output).toContain('const __defaultSlotNodes = []');
    expect(output).toContain("if (__defaultSlotNodes.length) { this.__s0.textContent = ''; __defaultSlotNodes.forEach(n => this.__s0.appendChild(n.cloneNode(true))); }");
  });

  it('scoped slot — generates template storage and reactive effect', () => {
    const pr = makeParseResult({
      signals: [{ name: 'currentItem', value: "'test'" }],
      processedTemplate: '<div><span data-slot="data"></span></div>',
      slots: [{
        varName: '__s0',
        name: 'data',
        path: ['childNodes[0]', 'childNodes[0]'],
        defaultContent: '',
        slotProps: [{ prop: 'item', source: 'currentItem' }],
      }],
    });

    const output = generateComponent(pr);

    // Template storage in constructor
    expect(output).toContain("if (__slotMap['data']) { this.__slotTpl_data = __slotMap['data'].content; }");

    // Reactive effect in connectedCallback
    expect(output).toContain('if (this.__slotTpl_data)');
    expect(output).toContain('__effect(() => {');
    expect(output).toContain('item: this._currentItem()');
    expect(output).toContain('this.__s0.innerHTML = __html');
  });

  it('scoped slot with multiple props — generates all prop references', () => {
    const pr = makeParseResult({
      signals: [
        { name: 'currentItem', value: "'test'" },
        { name: 'currentIndex', value: '0' },
      ],
      processedTemplate: '<div><span data-slot="row"></span></div>',
      slots: [{
        varName: '__s0',
        name: 'row',
        path: ['childNodes[0]', 'childNodes[0]'],
        defaultContent: '',
        slotProps: [
          { prop: 'item', source: 'currentItem' },
          { prop: 'index', source: 'currentIndex' },
        ],
      }],
    });

    const output = generateComponent(pr);

    expect(output).toContain('item: this._currentItem()');
    expect(output).toContain('index: this._currentIndex()');
  });

  it('scoped slot with computed source — uses _c_ prefix', () => {
    const pr = makeParseResult({
      computeds: [{ name: 'fullName', body: "'John Doe'" }],
      processedTemplate: '<div><span data-slot="info"></span></div>',
      slots: [{
        varName: '__s0',
        name: 'info',
        path: ['childNodes[0]', 'childNodes[0]'],
        defaultContent: '',
        slotProps: [{ prop: 'name', source: 'fullName' }],
      }],
    });

    const output = generateComponent(pr);

    expect(output).toContain('name: this._c_fullName()');
  });

  it('scoped slot with prop source — uses _s_ prefix', () => {
    const pr = makeParseResult({
      propDefs: [{ name: 'title', default: "'Default'", attrName: 'title' }],
      processedTemplate: '<div><span data-slot="header"></span></div>',
      slots: [{
        varName: '__s0',
        name: 'header',
        path: ['childNodes[0]', 'childNodes[0]'],
        defaultContent: '',
        slotProps: [{ prop: 'heading', source: 'title' }],
      }],
    });

    const output = generateComponent(pr);

    expect(output).toContain('heading: this._s_title()');
  });

  it('mixed slots — named, default, and scoped all together', () => {
    const pr = makeParseResult({
      signals: [{ name: 'current', value: "'item'" }],
      processedTemplate: '<div><span data-slot="header">H</span><span data-slot="default">B</span><span data-slot="data"></span></div>',
      slots: [
        { varName: '__s0', name: 'header', path: ['childNodes[0]', 'childNodes[0]'], defaultContent: 'H', slotProps: [] },
        { varName: '__s1', name: '', path: ['childNodes[0]', 'childNodes[1]'], defaultContent: 'B', slotProps: [] },
        { varName: '__s2', name: 'data', path: ['childNodes[0]', 'childNodes[2]'], defaultContent: '', slotProps: [{ prop: 'item', source: 'current' }] },
      ],
    });

    const output = generateComponent(pr);

    // Named slot injection
    expect(output).toContain("__slotMap['header']");
    expect(output).toContain('this.__s0.innerHTML');

    // Default slot injection
    expect(output).toContain('__defaultSlotNodes.length');
    expect(output).toContain('this.__s1');

    // Scoped slot template storage + effect
    expect(output).toContain("this.__slotTpl_data = __slotMap['data'].content");
    expect(output).toContain('if (this.__slotTpl_data)');
    expect(output).toContain('item: this._current()');
  });

  it('slots with styles — CSS is scoped and in document.head (not shadow root)', () => {
    const pr = makeParseResult({
      style: '.card { display: flex; }',
      processedTemplate: '<div class="card"><span data-slot="default">Body</span></div>',
      slots: [{ varName: '__s0', name: '', path: ['childNodes[0]', 'childNodes[0]'], defaultContent: 'Body', slotProps: [] }],
    });

    const output = generateComponent(pr);

    // Scoped CSS in document.head
    expect(output).toContain('document.head.appendChild');
    expect(output).toContain('wcc-test .card');

    // No shadow DOM
    expect(output).not.toContain('attachShadow');
    expect(output).not.toContain('this.shadowRoot');
  });

  it('bindings work alongside slots', () => {
    const pr = makeParseResult({
      signals: [{ name: 'count', value: '0' }],
      bindings: [{ varName: '__b0', name: 'count', type: 'signal', path: ['childNodes[0]', 'childNodes[0]'] }],
      processedTemplate: '<div><p></p><span data-slot="default">Body</span></div>',
      slots: [{ varName: '__s0', name: '', path: ['childNodes[0]', 'childNodes[1]'], defaultContent: 'Body', slotProps: [] }],
    });

    const output = generateComponent(pr);

    // Binding ref
    expect(output).toContain('this.__b0 = __root.childNodes[0].childNodes[0]');
    // Slot ref
    expect(output).toContain('this.__s0 = __root.childNodes[0].childNodes[1]');
    // Binding effect
    expect(output).toContain('this.__b0.textContent = this._count()');
    // Slot injection
    expect(output).toContain('__defaultSlotNodes');
  });

  it('DOM ref assignments for slots appear in constructor', () => {
    const pr = makeParseResult({
      processedTemplate: '<div><span data-slot="header">H</span></div>',
      slots: [{ varName: '__s0', name: 'header', path: ['childNodes[0]', 'childNodes[0]'], defaultContent: 'H', slotProps: [] }],
    });

    const output = generateComponent(pr);

    expect(output).toContain('this.__s0 = __root.childNodes[0].childNodes[0]');
  });
});
