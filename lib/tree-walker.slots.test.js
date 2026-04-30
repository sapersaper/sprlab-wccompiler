/**
 * Tests for wcCompiler v2 Tree Walker — Scoped Slots (Light DOM).
 *
 * Includes:
 * - Property test for slot replacement completeness (Property 1)
 * - Unit tests for slot processing, slot props, fallback content, edge cases
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { JSDOM } from 'jsdom';
import { walkTree } from './tree-walker.js';

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Create a jsdom root element from an HTML string.
 * @param {string} html
 * @returns {Element}
 */
function makeRoot(html) {
  const dom = new JSDOM(`<div id="__root">${html}</div>`);
  return dom.window.document.getElementById('__root');
}

// ── Arbitraries ─────────────────────────────────────────────────────

/** Generate a valid slot name (lowercase letters, 1-8 chars) */
const slotNameArb = fc.string({ minLength: 1, maxLength: 8 }).filter(s => /^[a-z]+$/.test(s));

/** Generate a wrapper element to nest slots in */
const wrapperTagArb = fc.constantFrom('div', 'section', 'article', 'main', 'span');

/** Generate slot config for Property 1 with known expected results */
const slotConfigArb = fc.record({
  namedSlots: fc.array(slotNameArb, { minLength: 0, maxLength: 4 }),
  hasDefault: fc.boolean(),
  nestingDepth: fc.integer({ min: 0, max: 3 }),
  wrapperTag: wrapperTagArb,
});

// ── Property Tests ──────────────────────────────────────────────────

describe('Feature: slots, Property 1: Slot Replacement Completeness', () => {
  it('replaces each <slot> with <span data-slot> and returns correct SlotBindings', () => {
    fc.assert(
      fc.property(slotConfigArb, ({ namedSlots, hasDefault, nestingDepth, wrapperTag }) => {
        // Build template from config
        const slotElements = [];
        for (const name of namedSlots) {
          slotElements.push(`<slot name="${name}">Fallback for ${name}</slot>`);
        }
        if (hasDefault) {
          slotElements.push('<slot>Default fallback</slot>');
        }

        let html = slotElements.join('');
        for (let i = 0; i < nestingDepth; i++) {
          html = `<${wrapperTag}>${html}</${wrapperTag}>`;
        }

        const rootEl = makeRoot(html);
        const { slots } = walkTree(rootEl, new Set(), new Set());

        const totalSlots = namedSlots.length + (hasDefault ? 1 : 0);

        // Correct number of SlotBindings returned
        expect(slots.length).toBe(totalSlots);

        // No <slot> elements remain in the DOM
        expect(rootEl.querySelectorAll('slot').length).toBe(0);

        // All <slot> elements replaced with <span data-slot="...">
        const placeholders = rootEl.querySelectorAll('span[data-slot]');
        expect(placeholders.length).toBe(totalSlots);

        // Named slots have correct data-slot values
        for (const name of namedSlots) {
          const found = rootEl.querySelector(`span[data-slot="${name}"]`);
          expect(found).not.toBeNull();
          // Fallback content preserved
          expect(found.textContent).toBe(`Fallback for ${name}`);
        }

        // Default slot has data-slot="default"
        if (hasDefault) {
          const defaultSpan = rootEl.querySelector('span[data-slot="default"]');
          expect(defaultSpan).not.toBeNull();
          expect(defaultSpan.textContent).toBe('Default fallback');
        }

        // Each SlotBinding has correct name
        const uniqueNames = [...new Set(namedSlots)];
        for (const name of uniqueNames) {
          const binding = slots.find(s => s.name === name);
          expect(binding).toBeDefined();
          expect(binding.defaultContent).toBe(`Fallback for ${name}`);
        }

        if (hasDefault) {
          const defaultBinding = slots.find(s => s.name === '');
          expect(defaultBinding).toBeDefined();
          expect(defaultBinding.defaultContent).toBe('Default fallback');
        }

        // Each SlotBinding has a unique varName
        const varNames = slots.map(s => s.varName);
        expect(new Set(varNames).size).toBe(varNames.length);

        // Each SlotBinding has a non-empty path
        for (const s of slots) {
          expect(s.path.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ── Unit Tests ──────────────────────────────────────────────────────

describe('walkTree slots — unit tests', () => {
  it('returns empty slots array for template with no slots', () => {
    const rootEl = makeRoot('<div><p>Hello</p></div>');
    const { slots } = walkTree(rootEl, new Set(), new Set());
    expect(slots).toEqual([]);
  });

  it('replaces named slot with span and records SlotBinding', () => {
    const rootEl = makeRoot('<div><slot name="header">Default Header</slot></div>');
    const { slots } = walkTree(rootEl, new Set(), new Set());

    expect(slots.length).toBe(1);
    expect(slots[0].name).toBe('header');
    expect(slots[0].defaultContent).toBe('Default Header');
    expect(slots[0].slotProps).toEqual([]);
    expect(slots[0].varName).toBe('__s0');

    // <slot> replaced with <span data-slot="header">
    expect(rootEl.querySelectorAll('slot').length).toBe(0);
    const span = rootEl.querySelector('span[data-slot="header"]');
    expect(span).not.toBeNull();
    expect(span.textContent).toBe('Default Header');
  });

  it('replaces default slot with span data-slot="default"', () => {
    const rootEl = makeRoot('<div><slot>Default Body</slot></div>');
    const { slots } = walkTree(rootEl, new Set(), new Set());

    expect(slots.length).toBe(1);
    expect(slots[0].name).toBe('');
    expect(slots[0].defaultContent).toBe('Default Body');

    const span = rootEl.querySelector('span[data-slot="default"]');
    expect(span).not.toBeNull();
    expect(span.textContent).toBe('Default Body');
  });

  it('collects :prop="expr" attributes as slotProps', () => {
    const rootEl = makeRoot('<div><slot name="data" :item="currentItem" :index="currentIndex"></slot></div>');
    const { slots } = walkTree(rootEl, new Set(), new Set());

    expect(slots.length).toBe(1);
    expect(slots[0].name).toBe('data');
    expect(slots[0].slotProps).toEqual([
      { prop: 'item', source: 'currentItem' },
      { prop: 'index', source: 'currentIndex' },
    ]);
  });

  it('handles multiple slots (named + default + scoped)', () => {
    const html = `<div>
      <slot name="header">Header</slot>
      <slot>Body</slot>
      <slot name="data" :item="current"></slot>
    </div>`;
    const rootEl = makeRoot(html);
    const { slots } = walkTree(rootEl, new Set(), new Set());

    expect(slots.length).toBe(3);
    expect(slots[0].name).toBe('header');
    expect(slots[0].slotProps).toEqual([]);
    expect(slots[1].name).toBe('');
    expect(slots[1].slotProps).toEqual([]);
    expect(slots[2].name).toBe('data');
    expect(slots[2].slotProps).toEqual([{ prop: 'item', source: 'current' }]);

    // All replaced
    expect(rootEl.querySelectorAll('slot').length).toBe(0);
    expect(rootEl.querySelectorAll('span[data-slot]').length).toBe(3);
  });

  it('detects slots inside deeply nested elements', () => {
    const rootEl = makeRoot('<div><section><article><div><slot name="deep">Deep</slot></div></article></section></div>');
    const { slots } = walkTree(rootEl, new Set(), new Set());

    expect(slots.length).toBe(1);
    expect(slots[0].name).toBe('deep');
    expect(slots[0].defaultContent).toBe('Deep');
    expect(rootEl.querySelector('span[data-slot="deep"]')).not.toBeNull();
  });

  it('preserves empty fallback content', () => {
    const rootEl = makeRoot('<div><slot name="empty"></slot></div>');
    const { slots } = walkTree(rootEl, new Set(), new Set());

    expect(slots[0].defaultContent).toBe('');
    const span = rootEl.querySelector('span[data-slot="empty"]');
    expect(span.innerHTML).toBe('');
  });

  it('works alongside interpolation, events, and other directives', () => {
    const html = `<div>
      <p>{{title}}</p>
      <button @click="handleClick">Click</button>
      <slot name="content">Default</slot>
      <div show="visible">
        <slot>Body</slot>
      </div>
    </div>`;
    const rootEl = makeRoot(html);
    const { bindings, events, showBindings, slots } = walkTree(rootEl, new Set(['title', 'visible']), new Set());

    // Slots processed
    expect(slots.length).toBe(2);
    expect(slots[0].name).toBe('content');
    expect(slots[1].name).toBe('');

    // Other directives also processed
    expect(bindings.length).toBe(1);
    expect(events.length).toBe(1);
    expect(showBindings.length).toBe(1);

    // No <slot> elements remain
    expect(rootEl.querySelectorAll('slot').length).toBe(0);
  });

  it('slot with only :prop attrs and no name attribute is a default scoped slot', () => {
    const rootEl = makeRoot('<div><slot :data="items"></slot></div>');
    const { slots } = walkTree(rootEl, new Set(), new Set());

    expect(slots.length).toBe(1);
    expect(slots[0].name).toBe('');
    expect(slots[0].slotProps).toEqual([{ prop: 'data', source: 'items' }]);
  });
});
