import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { walkTree, pathExpr } from './tree-walker.js';

// ── Helper: create a root element from HTML ─────────────────────────

function makeRoot(html) {
  const dom = new JSDOM(`<div id="__root">${html}</div>`);
  return dom.window.document.getElementById('__root');
}

// ── pathExpr ────────────────────────────────────────────────────────

describe('pathExpr', () => {
  it('returns rootVar when parts is empty', () => {
    expect(pathExpr([], '__root')).toBe('__root');
  });

  it('joins parts with dots', () => {
    expect(pathExpr(['childNodes[0]', 'childNodes[1]'], '__root')).toBe(
      '__root.childNodes[0].childNodes[1]'
    );
  });

  it('works with a single part', () => {
    expect(pathExpr(['childNodes[2]'], 'el')).toBe('el.childNodes[2]');
  });
});

// ── Text bindings ───────────────────────────────────────────────────

describe('walkTree — text bindings', () => {
  it('binds sole {{var}} to parent element (no extra span)', () => {
    const root = makeRoot('<div>{{msg}}</div>');
    const propsSet = new Set();
    const computedNames = new Set();
    const rootVarNames = new Set(['msg']);

    const { bindings } = walkTree(root, propsSet, computedNames, rootVarNames);

    expect(bindings).toHaveLength(1);
    expect(bindings[0].name).toBe('msg');
    expect(bindings[0].type).toBe('internal');
    // Path should point to the <div>, not the text node
    expect(bindings[0].path).toEqual(['childNodes[0]']);
    // The text node should be cleared
    expect(root.querySelector('div').textContent).toBe('');
  });

  it('classifies prop bindings correctly', () => {
    const root = makeRoot('<div>{{value}}</div>');
    const { bindings } = walkTree(root, new Set(['value']), new Set(), new Set());

    expect(bindings[0].type).toBe('prop');
  });

  it('classifies computed bindings correctly', () => {
    const root = makeRoot('<div>{{fullLabel}}</div>');
    const { bindings } = walkTree(root, new Set(), new Set(['fullLabel']), new Set());

    expect(bindings[0].type).toBe('computed');
  });

  it('splits mixed text and interpolations into spans', () => {
    const root = makeRoot('<div>hello {{name}} world</div>');
    const { bindings } = walkTree(root, new Set(), new Set(), new Set(['name']));

    expect(bindings).toHaveLength(1);
    expect(bindings[0].name).toBe('name');
    // The div should now contain: text("hello "), <span>, text(" world")
    const div = root.querySelector('div');
    expect(div.childNodes.length).toBe(3);
    expect(div.childNodes[0].nodeType).toBe(3); // text
    expect(div.childNodes[0].textContent).toBe('hello ');
    expect(div.childNodes[1].tagName).toBe('SPAN');
    expect(div.childNodes[2].nodeType).toBe(3); // text
    expect(div.childNodes[2].textContent).toBe(' world');
  });

  it('handles multiple interpolations in one text node', () => {
    const root = makeRoot('<div>{{a}} and {{b}}</div>');
    const { bindings } = walkTree(root, new Set(), new Set(), new Set(['a', 'b']));

    expect(bindings).toHaveLength(2);
    expect(bindings[0].name).toBe('a');
    expect(bindings[1].name).toBe('b');
  });

  it('assigns incremental varNames (__b0, __b1, ...)', () => {
    const root = makeRoot('<div>{{a}}</div><div>{{b}}</div>');
    const { bindings } = walkTree(root, new Set(), new Set(), new Set(['a', 'b']));

    expect(bindings[0].varName).toBe('__b0');
    expect(bindings[1].varName).toBe('__b1');
  });

  it('handles nested elements with bindings', () => {
    const root = makeRoot('<div><p>{{msg}}</p></div>');
    const { bindings } = walkTree(root, new Set(), new Set(), new Set(['msg']));

    expect(bindings).toHaveLength(1);
    expect(bindings[0].name).toBe('msg');
    // Path: childNodes[0] (div) -> childNodes[0] (p)
    expect(bindings[0].path).toEqual(['childNodes[0]', 'childNodes[0]']);
  });
});

// ── Event bindings ──────────────────────────────────────────────────

describe('walkTree — event bindings', () => {
  it('discovers @event attributes and removes them', () => {
    const root = makeRoot('<button @click="handleClick">Click</button>');
    const { events } = walkTree(root, new Set(), new Set(), new Set());

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('click');
    expect(events[0].handler).toBe('handleClick');
    expect(events[0].path).toEqual(['childNodes[0]']);

    // Attribute should be removed
    const btn = root.querySelector('button');
    expect(btn.hasAttribute('@click')).toBe(false);
  });

  it('handles multiple events on different elements', () => {
    const root = makeRoot(
      '<button @click="onClick">A</button><input @input="onInput">'
    );
    const { events } = walkTree(root, new Set(), new Set(), new Set());

    expect(events).toHaveLength(2);
    expect(events[0].event).toBe('click');
    expect(events[0].handler).toBe('onClick');
    expect(events[1].event).toBe('input');
    expect(events[1].handler).toBe('onInput');
  });

  it('assigns incremental varNames (__e0, __e1, ...)', () => {
    const root = makeRoot(
      '<button @click="a">A</button><button @click="b">B</button>'
    );
    const { events } = walkTree(root, new Set(), new Set(), new Set());

    expect(events[0].varName).toBe('__e0');
    expect(events[1].varName).toBe('__e1');
  });
});

// ── Slots ───────────────────────────────────────────────────────────

describe('walkTree — slots', () => {
  it('discovers default slot and replaces with span', () => {
    const root = makeRoot('<slot>Default content</slot>');
    const { slots } = walkTree(root, new Set(), new Set(), new Set());

    expect(slots).toHaveLength(1);
    expect(slots[0].name).toBe('');
    expect(slots[0].defaultContent).toBe('Default content');
    expect(slots[0].slotProps).toEqual([]);

    // Should be replaced with <span data-slot="default">
    const span = root.querySelector('span[data-slot="default"]');
    expect(span).not.toBeNull();
    expect(span.innerHTML).toBe('Default content');
  });

  it('discovers named slot and replaces with span', () => {
    const root = makeRoot('<slot name="title">Default title</slot>');
    const { slots } = walkTree(root, new Set(), new Set(), new Set());

    expect(slots).toHaveLength(1);
    expect(slots[0].name).toBe('title');
    expect(slots[0].defaultContent).toBe('Default title');

    const span = root.querySelector('span[data-slot="title"]');
    expect(span).not.toBeNull();
  });

  it('discovers slot with slotProps', () => {
    const root = makeRoot(
      '<slot name="info" :count="value" :label="prefix">Default info</slot>'
    );
    const { slots } = walkTree(
      root,
      new Set(['value']),
      new Set(),
      new Set(['prefix'])
    );

    expect(slots).toHaveLength(1);
    expect(slots[0].name).toBe('info');
    expect(slots[0].slotProps).toEqual([
      { prop: 'count', source: 'value' },
      { prop: 'label', source: 'prefix' },
    ]);
  });

  it('assigns incremental varNames (__s0, __s1, ...)', () => {
    const root = makeRoot(
      '<slot name="a">A</slot><slot name="b">B</slot>'
    );
    const { slots } = walkTree(root, new Set(), new Set(), new Set());

    expect(slots[0].varName).toBe('__s0');
    expect(slots[1].varName).toBe('__s1');
  });

  it('handles empty default slot', () => {
    const root = makeRoot('<slot></slot>');
    const { slots } = walkTree(root, new Set(), new Set(), new Set());

    expect(slots).toHaveLength(1);
    expect(slots[0].name).toBe('');
    expect(slots[0].defaultContent).toBe('');
  });
});

// ── Integration: spr-hi.html template ───────────────────────────────

describe('walkTree — spr-hi.html template integration', () => {
  const templateHTML = `
  <div class="counter">{{value}}</div>
  <div class="info">segundo: {{prefix}} {{value2}}</div>
  <div>{{internalValue}}</div>
  <div>computed: {{fullLabel}}</div>
  <div class="slot-area">
    <slot name="title">Default title</slot>
  </div>
  <div class="slot-area">
    <slot name="info" :count="value" :label="prefix">Default info</slot>
  </div>
  <slot>Default content</slot>
  <button @click="handleClick">Click me</button>
  <button @click="handleInternal">cambiar adentro</button>`;

  const propsSet = new Set(['value', 'value2']);
  const computedNames = new Set(['fullLabel']);
  const rootVarNames = new Set(['prefix', 'internalValue']);

  it('discovers all bindings', () => {
    const root = makeRoot(templateHTML);
    const { bindings } = walkTree(root, propsSet, computedNames, rootVarNames);

    const names = bindings.map((b) => b.name);
    expect(names).toContain('value');
    expect(names).toContain('prefix');
    expect(names).toContain('value2');
    expect(names).toContain('internalValue');
    expect(names).toContain('fullLabel');
  });

  it('classifies binding types correctly', () => {
    const root = makeRoot(templateHTML);
    const { bindings } = walkTree(root, propsSet, computedNames, rootVarNames);

    const byName = Object.fromEntries(bindings.map((b) => [b.name, b.type]));
    expect(byName.value).toBe('prop');
    expect(byName.value2).toBe('prop');
    expect(byName.prefix).toBe('internal');
    expect(byName.internalValue).toBe('internal');
    expect(byName.fullLabel).toBe('computed');
  });

  it('discovers all events', () => {
    const root = makeRoot(templateHTML);
    const { events } = walkTree(root, propsSet, computedNames, rootVarNames);

    expect(events).toHaveLength(2);
    expect(events[0].event).toBe('click');
    expect(events[0].handler).toBe('handleClick');
    expect(events[1].event).toBe('click');
    expect(events[1].handler).toBe('handleInternal');
  });

  it('discovers all slots', () => {
    const root = makeRoot(templateHTML);
    const { slots } = walkTree(root, propsSet, computedNames, rootVarNames);

    expect(slots).toHaveLength(3);

    const named = slots.find((s) => s.name === 'title');
    expect(named).toBeDefined();
    expect(named.defaultContent).toBe('Default title');

    const scoped = slots.find((s) => s.name === 'info');
    expect(scoped).toBeDefined();
    expect(scoped.slotProps).toEqual([
      { prop: 'count', source: 'value' },
      { prop: 'label', source: 'prefix' },
    ]);

    const defaultSlot = slots.find((s) => s.name === '');
    expect(defaultSlot).toBeDefined();
    expect(defaultSlot.defaultContent).toBe('Default content');
  });

  it('replaces all slots with span placeholders', () => {
    const root = makeRoot(templateHTML);
    walkTree(root, propsSet, computedNames, rootVarNames);

    // No <slot> elements should remain
    expect(root.querySelectorAll('slot').length).toBe(0);

    // Should have span placeholders
    expect(root.querySelector('span[data-slot="title"]')).not.toBeNull();
    expect(root.querySelector('span[data-slot="info"]')).not.toBeNull();
    expect(root.querySelector('span[data-slot="default"]')).not.toBeNull();
  });

  it('removes @event attributes from processed template', () => {
    const root = makeRoot(templateHTML);
    walkTree(root, propsSet, computedNames, rootVarNames);

    const buttons = root.querySelectorAll('button');
    for (const btn of buttons) {
      expect(btn.hasAttribute('@click')).toBe(false);
    }
  });
});
