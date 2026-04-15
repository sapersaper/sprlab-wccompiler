import { describe, it, expect } from 'vitest';
import { generateComponent } from './codegen.js';

// ── Helper: build a minimal ParseResult ─────────────────────────────

function makePR(overrides = {}) {
  return {
    tagName: 'my-comp',
    className: 'MyComp',
    template: '<div>{{msg}}</div>',
    script: '',
    style: '',
    props: [],
    reactiveVars: [],
    computeds: [],
    watchers: [],
    methods: [],
    bindings: [],
    events: [],
    slots: [],
    processedTemplate: '<div></div>',
    ...overrides,
  };
}

// ── 6.1: Structure — class, define, observedAttributes, attributeChangedCallback ──

describe('codegen — component structure (6.1)', () => {
  it('generates a class extending HTMLElement with PascalCase name', () => {
    const out = generateComponent(makePR());
    expect(out).toContain('class MyComp extends HTMLElement');
  });

  it('generates customElements.define with the tag name', () => {
    const out = generateComponent(makePR());
    expect(out).toContain("customElements.define('my-comp', MyComp)");
  });

  it('generates observedAttributes with props list', () => {
    const out = generateComponent(makePR({ props: ['value', 'label'] }));
    expect(out).toContain("return ['value', 'label']");
  });

  it('generates attributeChangedCallback that updates signals', () => {
    const out = generateComponent(makePR({ props: ['value'] }));
    expect(out).toContain("if (name === 'value') this._s_value(newValue)");
  });

  it('inlines the reactive runtime at the top (no imports)', () => {
    const out = generateComponent(makePR());
    expect(out).not.toMatch(/^import\s/m);
    expect(out).toContain('function __signal(');
    expect(out).toContain('function __computed(');
    expect(out).toContain('function __effect(');
  });

  it('has zero import statements', () => {
    const out = generateComponent(makePR({
      props: ['x'],
      reactiveVars: [{ name: 'y', value: "'hi'" }],
      computeds: [{ name: 'z', body: "x + y" }],
      bindings: [{ varName: '__b0', name: 'x', type: 'prop', path: ['childNodes[0]'] }],
    }));
    const importLines = out.split('\n').filter(l => /^\s*import\s/.test(l));
    expect(importLines).toHaveLength(0);
  });
});

// ── 6.2: Reactivity — signals, computeds, effects, getters/setters ──

describe('codegen — reactivity (6.2)', () => {
  it('creates a signal per prop initialized to null', () => {
    const out = generateComponent(makePR({ props: ['value', 'label'] }));
    expect(out).toContain('this._s_value = __signal(null)');
    expect(out).toContain('this._s_label = __signal(null)');
  });

  it('creates a signal per reactive var with literal value', () => {
    const out = generateComponent(makePR({
      reactiveVars: [
        { name: 'count', value: '0' },
        { name: 'msg', value: "'hello'" },
      ],
    }));
    expect(out).toContain("this._count = __signal(0)");
    expect(out).toContain("this._msg = __signal('hello')");
  });

  it('creates a computed with transformed references', () => {
    const out = generateComponent(makePR({
      props: ['value'],
      reactiveVars: [{ name: 'prefix', value: "'hi'" }],
      computeds: [{ name: 'full', body: "prefix + ' ' + value" }],
    }));
    expect(out).toContain("this._c_full = __computed(() => this._prefix() + ' ' + this._s_value())");
  });

  it('generates effect in connectedCallback that updates textContent', () => {
    const out = generateComponent(makePR({
      props: ['value'],
      bindings: [
        { varName: '__b0', name: 'value', type: 'prop', path: ['childNodes[0]'] },
      ],
    }));
    expect(out).toContain('__effect(() => {');
    expect(out).toContain("this.__b0.textContent = this._s_value() ?? ''");
  });

  it('generates effect for internal var bindings', () => {
    const out = generateComponent(makePR({
      reactiveVars: [{ name: 'msg', value: "'hi'" }],
      bindings: [
        { varName: '__b0', name: 'msg', type: 'internal', path: ['childNodes[0]'] },
      ],
    }));
    expect(out).toContain("this.__b0.textContent = this._msg() ?? ''");
  });

  it('generates effect for computed bindings', () => {
    const out = generateComponent(makePR({
      computeds: [{ name: 'full', body: "'x'" }],
      bindings: [
        { varName: '__b0', name: 'full', type: 'computed', path: ['childNodes[0]'] },
      ],
    }));
    expect(out).toContain("this.__b0.textContent = this._c_full() ?? ''");
  });

  it('generates public getters and setters per prop', () => {
    const out = generateComponent(makePR({ props: ['value'] }));
    expect(out).toContain('get value() { return this._s_value(); }');
    expect(out).toContain('set value(val) { this._s_value(val); }');
  });
});

// ── 6.3: Watchers with prev tracking ──

describe('codegen — watchers (6.3)', () => {
  it('initializes __prev_{target} as undefined', () => {
    const out = generateComponent(makePR({
      props: ['value'],
      watchers: [{ target: 'value', newParam: 'newVal', oldParam: 'oldVal', body: "console.log(oldVal, newVal)" }],
    }));
    expect(out).toContain('this.__prev_value = undefined');
  });

  it('generates effect that reads current value and guards on prev', () => {
    const out = generateComponent(makePR({
      props: ['value'],
      watchers: [{ target: 'value', newParam: 'newVal', oldParam: 'oldVal', body: "console.log(oldVal, newVal)" }],
    }));
    expect(out).toContain('const newVal = this._s_value()');
    expect(out).toContain('if (this.__prev_value !== undefined)');
    expect(out).toContain('const oldVal = this.__prev_value');
    expect(out).toContain('this.__prev_value = newVal');
  });

  it('transforms variable references in watcher body to signal calls', () => {
    const out = generateComponent(makePR({
      props: ['value'],
      reactiveVars: [{ name: 'count', value: '0' }],
      watchers: [{ target: 'value', newParam: 'n', oldParam: 'o', body: "console.log(count)" }],
    }));
    expect(out).toContain('console.log(this._count())');
  });
});

// ── 6.4: Events and emit ──

describe('codegen — events and emit (6.4)', () => {
  it('generates addEventListener in connectedCallback', () => {
    const out = generateComponent(makePR({
      events: [
        { varName: '__e0', event: 'click', handler: 'handleClick', path: ['childNodes[0]'] },
      ],
      methods: [{ name: 'handleClick', params: '', body: "console.log('clicked')" }],
    }));
    expect(out).toContain("this.__e0.addEventListener('click', this._handleClick.bind(this))");
  });

  it('generates _emit method with CustomEvent', () => {
    const out = generateComponent(makePR({
      events: [
        { varName: '__e0', event: 'click', handler: 'handleClick', path: ['childNodes[0]'] },
      ],
      methods: [{ name: 'handleClick', params: '', body: "emit('on-click', 'data')" }],
    }));
    expect(out).toContain('_emit(name, detail)');
    expect(out).toContain('new CustomEvent(name, { detail, bubbles: true, composed: true })');
  });

  it('transforms emit() to this._emit() in method bodies', () => {
    const out = generateComponent(makePR({
      methods: [{ name: 'handleClick', params: '', body: "emit('on-click', 'data')" }],
    }));
    expect(out).toContain("this._emit('on-click', 'data')");
    // Should NOT contain bare emit(
    expect(out).not.toMatch(/[^._]emit\(/);
  });

  it('converts function declarations to class methods prefixed with _', () => {
    const out = generateComponent(makePR({
      methods: [{ name: 'handleClick', params: 'e', body: "console.log(e)" }],
    }));
    expect(out).toContain('_handleClick(e)');
  });
});

// ── 6.5: Slots ──

describe('codegen — slots (6.5)', () => {
  it('generates slot resolution code reading childNodes', () => {
    const out = generateComponent(makePR({
      slots: [
        { varName: '__s0', name: 'title', path: ['childNodes[0]'], defaultContent: 'Default', slotProps: [] },
      ],
    }));
    expect(out).toContain('const __slotMap = {}');
    expect(out).toContain('const __defaultSlotNodes = []');
    expect(out).toContain('Array.from(this.childNodes)');
  });

  it('injects content for named slots via <template #name>', () => {
    const out = generateComponent(makePR({
      slots: [
        { varName: '__s0', name: 'title', path: ['childNodes[0]'], defaultContent: 'Default', slotProps: [] },
      ],
    }));
    expect(out).toContain("if (__slotMap['title']) { this.__s0.innerHTML = __slotMap['title'].content; }");
  });

  it('replaces content for default slot', () => {
    const out = generateComponent(makePR({
      slots: [
        { varName: '__s0', name: '', path: ['childNodes[0]'], defaultContent: 'Default', slotProps: [] },
      ],
    }));
    expect(out).toContain("if (__defaultSlotNodes.length) { this.__s0.textContent = ''");
    expect(out).toContain('__defaultSlotNodes.forEach');
  });

  it('generates reactive effects for slots with slotProps', () => {
    const out = generateComponent(makePR({
      props: ['value'],
      reactiveVars: [{ name: 'prefix', value: "'hi'" }],
      slots: [
        {
          varName: '__s0',
          name: 'info',
          path: ['childNodes[0]'],
          defaultContent: 'Default',
          slotProps: [
            { prop: 'count', source: 'value' },
            { prop: 'label', source: 'prefix' },
          ],
        },
      ],
    }));
    expect(out).toContain("this.__slotTpl_info");
    expect(out).toContain('__effect(() => {');
    expect(out).toContain('count: this._s_value()');
    expect(out).toContain('label: this._prefix()');
    expect(out).toContain('this.__s0.innerHTML = __html');
  });

  it('does not generate slot resolution code when no slots', () => {
    const out = generateComponent(makePR({ slots: [] }));
    expect(out).not.toContain('__slotMap');
    expect(out).not.toContain('__defaultSlotNodes');
  });
});

// ── 6.6: CSS injection ──

describe('codegen — CSS injection (6.6)', () => {
  it('creates <style> element with scoped CSS when style exists', () => {
    const out = generateComponent(makePR({
      style: '.counter { color: red; }',
    }));
    expect(out).toContain("const __css_MyComp = document.createElement('style')");
    expect(out).toContain('my-comp .counter');
    expect(out).toContain('document.head.appendChild(__css_MyComp)');
  });

  it('omits CSS injection when no style block', () => {
    const out = generateComponent(makePR({ style: '' }));
    expect(out).not.toContain('__css_');
    expect(out).not.toContain("document.createElement('style')");
  });
});

// ── Integration: spr-hi.html-like ParseResult ──

describe('codegen — spr-hi integration', () => {
  const pr = makePR({
    tagName: 'spr-hi',
    className: 'SprHi',
    props: ['value', 'value2'],
    reactiveVars: [
      { name: 'prefix', value: "'el prefix'" },
      { name: 'internalValue', value: "'hola desde adentro'" },
    ],
    computeds: [
      { name: 'fullLabel', body: "prefix + ' - ' + value + '/' + value2" },
    ],
    watchers: [
      { target: 'value', newParam: 'newVal', oldParam: 'oldVal', body: "console.log('value cambió:', oldVal, '->', newVal)" },
    ],
    methods: [
      { name: 'handleClick', params: '', body: "emit('on-click', internalValue)" },
      { name: 'handleInternal', params: '', body: "const internalValue = 'chau'" },
    ],
    bindings: [
      { varName: '__b0', name: 'value', type: 'prop', path: ['childNodes[1]'] },
      { varName: '__b1', name: 'prefix', type: 'internal', path: ['childNodes[3]', 'childNodes[1]'] },
      { varName: '__b2', name: 'value2', type: 'prop', path: ['childNodes[3]', 'childNodes[3]'] },
      { varName: '__b3', name: 'internalValue', type: 'internal', path: ['childNodes[5]'] },
      { varName: '__b4', name: 'fullLabel', type: 'computed', path: ['childNodes[7]', 'childNodes[1]'] },
    ],
    events: [
      { varName: '__e0', event: 'click', handler: 'handleClick', path: ['childNodes[15]'] },
      { varName: '__e1', event: 'click', handler: 'handleInternal', path: ['childNodes[17]'] },
    ],
    slots: [
      { varName: '__s0', name: 'title', path: ['childNodes[9]', 'childNodes[1]'], defaultContent: 'Default title', slotProps: [] },
      { varName: '__s1', name: 'info', path: ['childNodes[11]', 'childNodes[1]'], defaultContent: 'Default info', slotProps: [{ prop: 'count', source: 'value' }, { prop: 'label', source: 'prefix' }] },
      { varName: '__s2', name: '', path: ['childNodes[13]'], defaultContent: 'Default content', slotProps: [] },
    ],
    style: `.counter { color: red; }`,
    processedTemplate: `
  <div class="counter"></div>
  <div class="info">segundo: <span></span> <span></span></div>
  <div></div>
  <div>computed: <span></span></div>
  <div class="slot-area"><span data-slot="title">Default title</span></div>
  <div class="slot-area"><span data-slot="info">Default info</span></div>
  <span data-slot="default">Default content</span>
  <button>Click me</button>
  <button>cambiar adentro</button>`,
  });

  it('produces output with zero imports', () => {
    const out = generateComponent(pr);
    const importLines = out.split('\n').filter(l => /^\s*import\s/.test(l));
    expect(importLines).toHaveLength(0);
  });

  it('contains class SprHi extends HTMLElement', () => {
    const out = generateComponent(pr);
    expect(out).toContain('class SprHi extends HTMLElement');
  });

  it('contains customElements.define', () => {
    const out = generateComponent(pr);
    expect(out).toContain("customElements.define('spr-hi', SprHi)");
  });

  it('contains all signal inits', () => {
    const out = generateComponent(pr);
    expect(out).toContain('this._s_value = __signal(null)');
    expect(out).toContain('this._s_value2 = __signal(null)');
    expect(out).toContain("this._prefix = __signal('el prefix')");
    expect(out).toContain("this._internalValue = __signal('hola desde adentro')");
  });

  it('contains computed with transformed refs', () => {
    const out = generateComponent(pr);
    expect(out).toContain("this._c_fullLabel = __computed(() => this._prefix() + ' - ' + this._s_value() + '/' + this._s_value2())");
  });

  it('contains watcher effect with prev tracking', () => {
    const out = generateComponent(pr);
    expect(out).toContain('this.__prev_value = undefined');
    expect(out).toContain('const newVal = this._s_value()');
    expect(out).toContain('if (this.__prev_value !== undefined)');
  });

  it('contains event listeners', () => {
    const out = generateComponent(pr);
    expect(out).toContain("this.__e0.addEventListener('click', this._handleClick.bind(this))");
    expect(out).toContain("this.__e1.addEventListener('click', this._handleInternal.bind(this))");
  });

  it('contains _emit method', () => {
    const out = generateComponent(pr);
    expect(out).toContain('_emit(name, detail)');
    expect(out).toContain('new CustomEvent(name, { detail, bubbles: true, composed: true })');
  });

  it('transforms emit() to this._emit() in handleClick', () => {
    const out = generateComponent(pr);
    expect(out).toContain("this._emit('on-click'");
  });

  it('contains slot resolution code', () => {
    const out = generateComponent(pr);
    expect(out).toContain('const __slotMap = {}');
    expect(out).toContain("if (__slotMap['title'])");
    expect(out).toContain("this.__slotTpl_info");
    expect(out).toContain('__defaultSlotNodes');
  });

  it('contains scoped CSS injection', () => {
    const out = generateComponent(pr);
    expect(out).toContain('spr-hi .counter');
    expect(out).toContain("document.head.appendChild(__css_SprHi)");
  });

  it('contains inline reactive runtime', () => {
    const out = generateComponent(pr);
    expect(out).toContain('let __currentEffect = null');
    expect(out).toContain('function __signal(');
    expect(out).toContain('function __computed(');
    expect(out).toContain('function __effect(');
  });
});
