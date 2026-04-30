import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import fc from 'fast-check';
import { walkTree } from './tree-walker.js';

// ── Helper: create a root element from HTML ─────────────────────────

function makeRoot(html) {
  const dom = new JSDOM(`<div id="__root">${html}</div>`);
  return dom.window.document.getElementById('__root');
}

// ── Text bindings ───────────────────────────────────────────────────

describe('walkTree — text bindings', () => {
  it('binds sole {{var}} to parent element (no extra span)', () => {
    const root = makeRoot('<div>{{msg}}</div>');
    const { bindings } = walkTree(root, new Set(), new Set());

    expect(bindings).toHaveLength(1);
    expect(bindings[0].name).toBe('msg');
    expect(bindings[0].type).toBe('method');
    // Path should point to the <div>, not the text node
    expect(bindings[0].path).toEqual(['childNodes[0]']);
    // The parent's text content should be cleared
    expect(root.querySelector('div').textContent).toBe('');
  });

  it('classifies signal bindings correctly', () => {
    const root = makeRoot('<div>{{value}}</div>');
    const { bindings } = walkTree(root, new Set(['value']), new Set());

    expect(bindings[0].type).toBe('signal');
  });

  it('classifies computed bindings correctly', () => {
    const root = makeRoot('<div>{{fullLabel}}</div>');
    const { bindings } = walkTree(root, new Set(), new Set(['fullLabel']));

    expect(bindings[0].type).toBe('computed');
  });

  it('splits mixed text and interpolations into spans', () => {
    const root = makeRoot('<div>hello {{name}} world</div>');
    const { bindings } = walkTree(root, new Set(['name']), new Set());

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
    const { bindings } = walkTree(root, new Set(['a', 'b']), new Set());

    expect(bindings).toHaveLength(2);
    expect(bindings[0].name).toBe('a');
    expect(bindings[1].name).toBe('b');
  });

  it('assigns incremental varNames (__b0, __b1, ...)', () => {
    const root = makeRoot('<div>{{a}}</div><div>{{b}}</div>');
    const { bindings } = walkTree(root, new Set(['a', 'b']), new Set());

    expect(bindings[0].varName).toBe('__b0');
    expect(bindings[1].varName).toBe('__b1');
  });

  it('handles nested elements with bindings', () => {
    const root = makeRoot('<div><p>{{msg}}</p></div>');
    const { bindings } = walkTree(root, new Set(['msg']), new Set());

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
    const { events } = walkTree(root, new Set(), new Set());

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
    const { events } = walkTree(root, new Set(), new Set());

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
    const { events } = walkTree(root, new Set(), new Set());

    expect(events[0].varName).toBe('__e0');
    expect(events[1].varName).toBe('__e1');
  });

  it('handles multiple events on the same element', () => {
    const root = makeRoot('<button @click="onClick" @mouseenter="onHover">A</button>');
    const { events } = walkTree(root, new Set(), new Set());

    expect(events).toHaveLength(2);
    expect(events[0].event).toBe('click');
    expect(events[1].event).toBe('mouseenter');
  });
});

// ── Combined bindings and events ────────────────────────────────────

describe('walkTree — combined bindings and events', () => {
  it('discovers both bindings and events in the same template', () => {
    const root = makeRoot('<div>{{count}}</div><button @click="increment">+</button>');
    const { bindings, events } = walkTree(root, new Set(['count']), new Set());

    expect(bindings).toHaveLength(1);
    expect(bindings[0].name).toBe('count');
    expect(bindings[0].type).toBe('signal');

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('click');
    expect(events[0].handler).toBe('increment');
  });

  it('handles event and binding on the same element', () => {
    const root = makeRoot('<div @click="handleClick">{{msg}}</div>');
    const { bindings, events } = walkTree(root, new Set(), new Set());

    expect(bindings).toHaveLength(1);
    expect(bindings[0].name).toBe('msg');

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('click');
  });
});

// ── Task 3.4: Undeclared binding warning ────────────────────────────

describe('walkTree — undeclared binding type', () => {
  it('assigns type "method" when {{unknownVar}} is not in signalNames or computedNames', () => {
    const root = makeRoot('<div>{{unknownVar}}</div>');
    const { bindings } = walkTree(root, new Set(['count']), new Set(['doubled']));

    expect(bindings).toHaveLength(1);
    expect(bindings[0].name).toBe('unknownVar');
    expect(bindings[0].type).toBe('method');
  });

  it('assigns type "method" for multiple undeclared bindings', () => {
    const root = makeRoot('<div>{{foo}}</div><div>{{bar}}</div>');
    const { bindings } = walkTree(root, new Set(), new Set());

    expect(bindings).toHaveLength(2);
    expect(bindings[0].type).toBe('method');
    expect(bindings[1].type).toBe('method');
  });

  it('correctly classifies mixed declared and undeclared bindings', () => {
    const root = makeRoot('<div>{{count}}</div><div>{{unknown}}</div><div>{{doubled}}</div>');
    const { bindings } = walkTree(root, new Set(['count']), new Set(['doubled']));

    expect(bindings).toHaveLength(3);
    expect(bindings[0].type).toBe('signal');
    expect(bindings[1].type).toBe('method');
    expect(bindings[2].type).toBe('computed');
  });
});


// ── Property Tests ──────────────────────────────────────────────────

/**
 * **Validates: Requirements 2.1, 2.3, 2.4**
 *
 * Property 2: Interpolation Discovery Completeness
 *
 * For any HTML template containing {{variableName}} expressions at various
 * positions (sole content, mixed with text, multiple per text node),
 * the Tree Walker SHALL discover every interpolation and record a valid
 * DOM path, the correct variable name, and the correct binding type.
 *
 * Feature: core, Property 2: Interpolation Discovery Completeness
 */
describe('walkTree — property: Interpolation Discovery Completeness', () => {
  // Generator for valid variable names (simple identifiers)
  const varNameArb = fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,7}$/);

  // Generator for plain text (no mustaches)
  const plainTextArb = fc.stringMatching(/^[a-zA-Z ]{1,10}$/);

  // Generator for a sole-content binding: <tag>{{varName}}</tag>
  const soleBindingArb = fc.record({
    kind: fc.constant('sole'),
    tag: fc.constantFrom('div', 'span', 'p', 'h1', 'li'),
    varName: varNameArb,
  });

  // Generator for a mixed-content binding: <tag>text {{varName}} text</tag>
  const mixedBindingArb = fc.record({
    kind: fc.constant('mixed'),
    tag: fc.constantFrom('div', 'span', 'p', 'h1', 'li'),
    varName: varNameArb,
    prefix: plainTextArb,
    suffix: plainTextArb,
  });

  // Generator for multiple interpolations in one text node: <tag>{{a}} and {{b}}</tag>
  const multiBindingArb = fc.record({
    kind: fc.constant('multi'),
    tag: fc.constantFrom('div', 'span', 'p', 'h1', 'li'),
    varNames: fc.array(varNameArb, { minLength: 2, maxLength: 4 }),
  });

  // Generate a template element (one of the three kinds)
  const templateElementArb = fc.oneof(soleBindingArb, mixedBindingArb, multiBindingArb);

  // Generate 1 to 6 template elements
  const templateArb = fc.array(templateElementArb, { minLength: 1, maxLength: 6 });

  it('discovers every {{varName}} with correct name, valid path, and correct type', () => {
    fc.assert(
      fc.property(templateArb, (elements) => {
        // Collect all expected variable names
        const expectedVarNames = [];
        const signalNames = new Set();
        const computedNames = new Set();

        // Build HTML and expected var names
        let html = '';
        for (const el of elements) {
          if (el.kind === 'sole') {
            html += `<${el.tag}>{{${el.varName}}}</${el.tag}>`;
            expectedVarNames.push(el.varName);
            // Randomly assign as signal
            signalNames.add(el.varName);
          } else if (el.kind === 'mixed') {
            html += `<${el.tag}>${el.prefix}{{${el.varName}}}${el.suffix}</${el.tag}>`;
            expectedVarNames.push(el.varName);
            // Randomly assign as computed
            computedNames.add(el.varName);
          } else if (el.kind === 'multi') {
            const content = el.varNames.map((v) => `{{${v}}}`).join(' and ');
            html += `<${el.tag}>${content}</${el.tag}>`;
            for (const v of el.varNames) {
              expectedVarNames.push(v);
            }
          }
        }

        const root = makeRoot(html);
        const { bindings } = walkTree(root, signalNames, computedNames);

        // Every expected variable name must be discovered
        const discoveredNames = bindings.map((b) => b.name);
        expect(discoveredNames).toHaveLength(expectedVarNames.length);
        for (let i = 0; i < expectedVarNames.length; i++) {
          expect(discoveredNames[i]).toBe(expectedVarNames[i]);
        }

        // Each binding has a valid path (array of childNodes[n] segments)
        for (const binding of bindings) {
          expect(Array.isArray(binding.path)).toBe(true);
          for (const segment of binding.path) {
            expect(segment).toMatch(/^childNodes\[\d+\]$/);
          }
        }

        // Each binding has correct type classification
        for (const binding of bindings) {
          if (signalNames.has(binding.name)) {
            expect(binding.type).toBe('signal');
          } else if (computedNames.has(binding.name)) {
            expect(binding.type).toBe('computed');
          } else {
            expect(binding.type).toBe('method');
          }
        }

        // Sequential varNames
        for (let i = 0; i < bindings.length; i++) {
          expect(bindings[i].varName).toBe(`__b${i}`);
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 2.2, 2.5**
 *
 * Property 3: Event Discovery and Cleanup
 *
 * For any HTML template containing @event="handler" attributes on various
 * elements, the Tree Walker SHALL discover every event binding with the
 * correct event name and handler, AND the processed template SHALL contain
 * zero @event attributes.
 *
 * Feature: core, Property 3: Event Discovery and Cleanup
 */
describe('walkTree — property: Event Discovery and Cleanup', () => {
  const eventNames = ['click', 'input', 'change', 'submit', 'focus', 'blur', 'keydown', 'mouseenter'];
  const tags = ['div', 'button', 'span', 'input', 'form', 'a', 'p'];

  // Generator for a valid handler name
  const handlerArb = fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,9}$/);

  // Generator for a single element with an @event attribute
  const eventElementArb = fc.record({
    tag: fc.constantFrom(...tags),
    event: fc.constantFrom(...eventNames),
    handler: handlerArb,
  });

  // Generate 1 to 8 elements with events
  const templateArb = fc.array(eventElementArb, { minLength: 1, maxLength: 8 });

  it('discovers every @event with correct name and handler, and removes all @event attributes', () => {
    fc.assert(
      fc.property(templateArb, (elements) => {
        // Build HTML template
        const html = elements
          .map(({ tag, event, handler }) => {
            // input and form are void/special — handle closing
            if (tag === 'input') {
              return `<input @${event}="${handler}">`;
            }
            return `<${tag} @${event}="${handler}">content</${tag}>`;
          })
          .join('');

        const root = makeRoot(html);
        const { events } = walkTree(root, new Set(), new Set());

        // Every event must be discovered
        expect(events).toHaveLength(elements.length);
        for (let i = 0; i < elements.length; i++) {
          expect(events[i].event).toBe(elements[i].event);
          expect(events[i].handler).toBe(elements[i].handler);
        }

        // Sequential varNames
        for (let i = 0; i < events.length; i++) {
          expect(events[i].varName).toBe(`__e${i}`);
        }

        // Each event has a valid path
        for (const event of events) {
          expect(Array.isArray(event.path)).toBe(true);
          for (const segment of event.path) {
            expect(segment).toMatch(/^childNodes\[\d+\]$/);
          }
        }

        // The processed DOM must contain zero @event attributes
        const allElements = root.querySelectorAll('*');
        for (const el of allElements) {
          for (const attr of Array.from(el.attributes)) {
            expect(attr.name.startsWith('@')).toBe(false);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
