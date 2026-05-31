# Technical Design: proxy-state-invalidate

## Overview

This design replaces the dynamic `__signal` + `__effect` pattern for simple bindings (text, show, attr, class, style) with a compile-time `Proxy`-based state container and a static `__invalidate(key)` method. The Proxy intercepts all signal writes and routes them to a generated switch statement that performs targeted DOM updates — eliminating the runtime dependency tracking overhead for the majority of bindings.

## Architecture

### 1. Proxy State Container Generation

#### Current Pattern (constructor)

```js
constructor() {
  super();
  this._s_label = __signal('Count');   // prop signal
  this._count = __signal(0);           // user signal
  this._m_modelValue = __signal('');   // model signal
}
```

#### New Pattern (constructor)

```js
constructor() {
  super();
  const self = this;
  this._state = new Proxy(
    { label: 'Count', count: 0, modelValue: '' },
    {
      set(target, key, value) {
        if (target[key] === value) return true;
        target[key] = value;
        self.__invalidate(key);
        return true;
      }
    }
  );
}
```

#### How state is collected

In `generateComponent`, the initial state object is built from three sources:

```js
// Build initial state entries
const stateEntries = [];

// 1. Props → key is prop name, value is default
for (const p of propDefs) {
  stateEntries.push(`${p.name}: ${p.default}`);
}

// 2. User signals → key is signal name, value is initial value
for (const s of signals) {
  stateEntries.push(`${s.name}: ${s.value}`);
}

// 3. Model defs → key is model name, value is default
for (const md of modelDefs) {
  stateEntries.push(`${md.name}: ${md.default}`);
}
```

#### Generated Proxy handler

The handler is minimal — it only needs a `set` trap:

```js
{
  set(target, key, value) {
    if (target[key] === value) return true;  // skip if no change
    target[key] = value;
    self.__invalidate(key);
    return true;
  }
}
```

No `get` trap is needed — reads go directly to the target object via `this._state.signalName`.

### 2. Signal Read Transformation

The `transformExpr` function currently rewrites signal reads as function calls. The new pattern rewrites them as property access on `this._state`.

#### Current transformExpr output

| Source expression | Current output |
|---|---|
| `count()` or bare `count` | `this._count()` |
| `props.label` | `this._s_label()` |
| `modelValue()` | `this._m_modelValue()` |
| `doubled()` (computed) | `this._c_doubled()` — **unchanged** |

#### New transformExpr output

| Source expression | New output |
|---|---|
| `count()` or bare `count` | `this._state.count` |
| `props.label` | `this._state.label` |
| `modelValue()` | `this._state.modelValue` |
| `doubled()` (computed) | `this._c_doubled()` — **unchanged** |

#### Regex changes in `transformExpr`

```js
// BEFORE: Signal reads
// const callRe = new RegExp(`\\b${name}\\(\\)`, 'g');
// result = result.replace(callRe, `this._${name}()`);
// const bareRe = new RegExp(`\\b(${name})\\b(?!\\.set\\()(?!\\()`, 'g');
// result = result.replace(bareRe, `this._${name}()`);

// AFTER: Signal reads → property access
const callRe = new RegExp(`\\b${name}\\(\\)`, 'g');
result = result.replace(callRe, `this._state.${name}`);
const bareRe = new RegExp(`\\b(${name})\\b(?!\\.set\\()(?!\\()`, 'g');
result = result.replace(bareRe, `this._state.${name}`);
```

```js
// BEFORE: Prop reads
// return `this._s_${propName}()`;

// AFTER: Prop reads → property access
return `this._state.${propName}`;
```

```js
// BEFORE: Model reads
// const callRe = new RegExp(`\\b${varName}\\(\\)`, 'g');
// result = result.replace(callRe, `this._m_${propNameVal}()`);

// AFTER: Model reads → property access
const callRe = new RegExp(`\\b${varName}\\(\\)`, 'g');
result = result.replace(callRe, `this._state.${propNameVal}`);
```

### 3. Signal Write Transformation

The `transformMethodBody` function currently rewrites `x.set(value)` to `this._x(value)`. The new pattern rewrites to property assignment.

#### Current transformMethodBody output

| Source expression | Current output |
|---|---|
| `count.set(5)` | `this._count(5)` |
| `modelValue.set('hi')` | `this._modelSet_modelValue('hi')` |

#### New transformMethodBody output

| Source expression | New output |
|---|---|
| `count.set(5)` | `this._state.count = 5` |
| `modelValue.set('hi')` | `this._modelSet_modelValue('hi')` — **unchanged** (model writes still emit events) |

#### Regex changes in `transformMethodBody`

```js
// BEFORE: Signal writes
// const setRe = new RegExp(`\\b${name}\\.set\\(`, 'g');
// result = result.replace(setRe, `this._${name}(`);

// AFTER: Signal writes → property assignment
// This requires a more complex transform since we need to capture the value argument
const setRe = new RegExp(`\\b${name}\\.set\\(([^)]+)\\)`, 'g');
result = result.replace(setRe, `this._state.${name} = $1`);
```

**Note:** Model writes (`varName.set(...)`) remain unchanged — they still call `this._modelSet_propName(...)` because model writes must emit `wcc:model` events.

#### attributeChangedCallback changes

```js
// BEFORE:
if (name === 'label') this._s_label(newVal ?? 'Count');

// AFTER:
if (name === 'label') this._state.label = newVal ?? 'Count';
```

```js
// BEFORE (model):
if (name === 'model-value' || name === 'modelValue') this._m_modelValue(newVal ?? '');

// AFTER (model):
if (name === 'model-value' || name === 'modelValue') this._state.modelValue = newVal ?? '';
```

### 4. Dependency Graph Data Structure

The dependency graph maps each signal/prop/model key to the set of DOM update operations that depend on it.

#### Data structure

```js
/**
 * @typedef {Object} DepEntry
 * @property {'text'|'show'|'attr'|'bool'|'class'|'style'} type
 * @property {string} varName - DOM node variable (e.g., '__b0', '__sb0', '__ab0')
 * @property {string} expr - Transformed expression to evaluate
 * @property {string} [attr] - Attribute name (for attr/bool bindings)
 * @property {string} [staticValue] - Static prefix (for class/style)
 * @property {'object'|'array'|'string'} [subKind] - For class/style bindings
 */

/** @type {Map<string, DepEntry[]>} */
const depGraph = new Map();
// key: signal name (e.g., 'count', 'label', 'modelValue')
// value: array of DepEntry objects
```

#### How it's built

The graph is populated by scanning the existing `bindings`, `showBindings`, and `attrBindings` arrays. For each binding, we extract signal names from the raw expression and register the binding under each signal key.

```js
// Example: binding { name: 'count', type: 'signal', varName: '__b0' }
// → depGraph.get('count') = [{ type: 'text', varName: '__b0', expr: 'this._state.count' }]

// Example: binding { name: 'firstName() + " " + lastName()', type: 'expression', varName: '__b1' }
// → depGraph.get('firstName') = [{ type: 'text', varName: '__b1', expr: '...' }]
// → depGraph.get('lastName') = [{ type: 'text', varName: '__b1', expr: '...' }]
```

#### Signal extraction from expressions

To determine which signals an expression depends on, we scan the raw (untransformed) expression for known signal/prop/model names:

```js
function extractDeps(rawExpr, signalNames, propNames, modelDefs) {
  const deps = new Set();
  for (const name of signalNames) {
    // Match name() or bare name (same patterns transformExpr uses)
    const re = new RegExp(`\\b${name}\\b`, 'g');
    if (re.test(rawExpr)) deps.add(name);
  }
  for (const name of propNames) {
    const re = new RegExp(`\\b${name}\\b`, 'g');
    if (re.test(rawExpr)) deps.add(name);
  }
  for (const md of modelDefs) {
    const re = new RegExp(`\\b${md.varName}\\b`, 'g');
    if (re.test(rawExpr)) deps.add(md.name);
  }
  return deps;
}
```

#### Filtering: which bindings go into the dep graph

A binding is eligible for `__invalidate` (i.e., NOT kept in `__effect`) when:

1. Its expression references **only** signals, props, or model values (no computeds, no method calls)
2. It is of type: text, show, attr, bool, class, or style
3. It is NOT inside an `if` block or `each` loop (those remain in `__effect`)

Bindings that reference computeds or methods remain in `__effect` because:
- Computeds use `__computed()` which requires the reactive tracking system
- Methods may internally read signals in ways we can't statically trace

### 5. `__invalidate(key)` Method Generation

The `__invalidate` method is generated as an instance method on the component class, containing a `switch(key)` statement.

#### Algorithm for building the switch

```js
function generateInvalidateMethod(depGraph, lines) {
  lines.push('  __invalidate(key) {');
  lines.push('    switch(key) {');
  
  for (const [signalKey, entries] of depGraph) {
    lines.push(`      case '${signalKey}':`);
    for (const entry of entries) {
      generateUpdateOp(entry, lines);
    }
    lines.push('        break;');
  }
  
  // Wildcard: run ALL update operations (initial render)
  lines.push("      case '*':");
  for (const [, entries] of depGraph) {
    for (const entry of entries) {
      generateUpdateOp(entry, lines);
    }
  }
  lines.push('        break;');
  
  lines.push('    }');
  lines.push('  }');
}
```

#### Generated code patterns for each binding type

**Text binding case:**
```js
case 'count':
  this.__b0.textContent = this._state.count ?? '';
  break;
```

**Text binding with expression:**
```js
case 'firstName':
  this.__b1.textContent = (this._state.firstName + ' ' + this._state.lastName) ?? '';
  break;
case 'lastName':
  this.__b1.textContent = (this._state.firstName + ' ' + this._state.lastName) ?? '';
  break;
```

**Show binding case:**
```js
case 'visible':
  this.__sb0.style.display = (this._state.visible) ? '' : 'none';
  break;
```

**Attr binding case (kind: 'attr'):**
```js
case 'href':
  { const __v = this._state.href;
    if (__v || __v === '') { this.__ab0.setAttribute('href', __v); }
    else { this.__ab0.removeAttribute('href'); } }
  break;
```

**Attr binding case (kind: 'bool'):**
```js
case 'isDisabled':
  this.__ab1.disabled = !!(this._state.isDisabled);
  break;
```

**Class binding (object expression):**
```js
case 'isActive':
  { const __obj = { active: this._state.isActive, highlight: this._state.isHighlight };
    for (const [__k, __val] of Object.entries(__obj)) {
      __val ? this.__ab2.classList.add(__k) : this.__ab2.classList.remove(__k);
    } }
  break;
```

**Class binding (array expression):**
```js
case 'dynamicClass':
  this.__ab3.className = 'static-class ' + ([this._state.dynamicClass]).join(' ');
  break;
```

**Class binding (string expression):**
```js
case 'theme':
  this.__ab4.className = 'base ' + this._state.theme;
  break;
```

**Style binding (object expression):**
```js
case 'color':
  { const __obj = { color: this._state.color, fontSize: this._state.fontSize };
    for (const [__k, __val] of Object.entries(__obj)) {
      this.__ab5.style[__k] = __val;
    } }
  break;
```

**Style binding (string expression):**
```js
case 'cssText':
  this.__ab6.style.cssText = 'margin: 0; ' + this._state.cssText;
  break;
```

#### Multi-signal bindings

When a binding depends on multiple signals, the same update code appears in each signal's case. This is intentional — any signal change must re-evaluate the full expression.

```js
// Expression: firstName + ' ' + lastName
case 'firstName':
  this.__b0.textContent = (this._state.firstName + ' ' + this._state.lastName) ?? '';
  break;
case 'lastName':
  this.__b0.textContent = (this._state.firstName + ' ' + this._state.lastName) ?? '';
  break;
```

To avoid code duplication in the generated output, we can deduplicate by reference:

```js
// Internal: track which update strings we've already generated
const updateCode = `this.__b0.textContent = (this._state.firstName + ' ' + this._state.lastName) ?? '';`;
// Both cases emit the same string — no helper function needed, just repeated inline code
```

#### The wildcard `'*'` case

The `'*'` case executes ALL update operations once. To avoid duplicates (a multi-signal binding would appear multiple times), we deduplicate:

```js
case '*': {
  // Deduplicated: each unique update operation runs exactly once
  this.__b0.textContent = this._state.count ?? '';
  this.__b1.textContent = (this._state.firstName + ' ' + this._state.lastName) ?? '';
  this.__sb0.style.display = (this._state.visible) ? '' : 'none';
  // ... all other bindings
  break;
}
```

### 6. Initial Render

#### Current pattern (end of connectedCallback)

```js
// Each binding creates its own __effect that runs immediately
this.__disposers.push(__effect(() => {
  this.__b0.textContent = this._count() ?? '';
}));
this.__disposers.push(__effect(() => {
  this.__sb0.style.display = (this._visible()) ? '' : 'none';
}));
```

#### New pattern (end of connectedCallback)

```js
// Simple bindings: single invalidate call renders everything
this.__invalidate('*');

// Complex features still use __effect (if/each/computed/watch/model/slots/dynamic)
this.__disposers.push(__effect(() => { /* if block logic */ }));
this.__disposers.push(__effect(() => { /* each loop logic */ }));
```

#### Generated connectedCallback structure

```js
connectedCallback() {
  if (this.__connected) return;
  this.__connected = true;

  // DOM setup (template clone, node references) — unchanged
  const __root = __t_MyComponent.content.cloneNode(true);
  this.__b0 = __root.childNodes[0].childNodes[0];
  // ...

  // Slot resolution — unchanged
  // ...

  // AbortController + disposers for complex features
  this.__ac = new AbortController();
  this.__disposers = [];

  // Event listeners — unchanged
  this.__b2.addEventListener('click', (e) => { this._increment(); }, { signal: this.__ac.signal });

  // Complex features that still need __effect
  this.__disposers.push(__effect(() => { /* if block */ }));
  this.__disposers.push(__effect(() => { /* each loop */ }));
  this.__disposers.push(__effect(() => { /* watcher */ }));

  // Initial render of all simple bindings
  this.__invalidate('*');

  // onMount hooks — unchanged
}
```

### 7. Runtime Pruning

#### Changes to `buildInlineRuntime` in `reactive-runtime.js`

Add a new flag `needsSignal` to control whether `__signal` is included:

```js
/**
 * @param {{
 *   needsSignal?: boolean,
 *   needsComputed: boolean,
 *   needsEffect: boolean,
 *   needsBatch: boolean,
 *   needsUntrack: boolean
 * }} usage
 */
export function buildInlineRuntime(usage) {
  let code = '';
  
  // Only include globals if effect or computed is needed
  if (usage.needsEffect || usage.needsComputed) {
    code += runtimeGlobals;
  }
  
  // Only include __signal if explicitly needed (complex features reading signals via __effect)
  if (usage.needsSignal) {
    code += runtimeSignal;
  }
  
  if (usage.needsComputed) code += runtimeComputed;
  if (usage.needsEffect) code += runtimeEffect;
  if (usage.needsBatch) code += runtimeBatch;
  if (usage.needsUntrack) code += runtimeUntrack;
  return code;
}
```

#### Determining `needsSignal` in codegen

```js
// needsSignal is FALSE in the new model — signals are stored as plain properties in Proxy
// It's only true if we still have __signal() calls somewhere (should be never in Phase 1)
const needsSignal = false;

// needsEffect remains true when complex features exist
const needsEffect = effects.length > 0 || ifBlocks.length > 0 || forBlocks.length > 0 ||
  watchers.length > 0 || childComponents.length > 0 || dynamicComponents.length > 0 ||
  slots.some(s => s.slotProps.length > 0) || modelBindings.length > 0 ||
  modelPropBindings.length > 0 ||
  // Bindings/show/attr that reference computeds still need __effect
  hasComputedDependentBindings;
```

#### Size impact

For a simple component with only signals + text/show/attr bindings:
- **Before:** ~40 lines of runtime (`__signal` + `__effect` + globals)
- **After:** 0 lines of runtime (no `__signal`, no `__effect`, no globals)

For a component with computeds or complex features:
- **Before:** ~40 lines
- **After:** ~25 lines (no `__signal`, but keeps `__effect` + `__computed` + globals)

### 8. Backward Compatibility Layer

#### How `__effect` callbacks read from `this._state`

Complex features that still use `__effect` (if/each/watchers/user effects) will read signal values from `this._state` instead of calling `this._signalName()`:

```js
// BEFORE (if block condition):
this.__disposers.push(__effect(() => {
  if (this._isLoggedIn()) { /* show branch */ }
}));

// AFTER:
this.__disposers.push(__effect(() => {
  if (this._state.isLoggedIn) { /* show branch */ }
}));
```

**Important:** Since `this._state.isLoggedIn` is a plain property read (no function call), `__effect` will NOT automatically track it. This means complex features that depend on signals need a different subscription mechanism.

#### Solution: Proxy `get` trap for effect tracking

For components that have complex features requiring `__effect`, we add a `get` trap to the Proxy that participates in the reactive tracking system:

```js
this._state = new Proxy(
  { count: 0, isLoggedIn: false },
  {
    get(target, key) {
      // If inside an __effect, register this signal as a dependency
      if (__currentEffect && typeof key === 'string') {
        if (!target.__subs) target.__subs = {};
        if (!target.__subs[key]) target.__subs[key] = new Set();
        target.__subs[key].add(__currentEffect);
      }
      return target[key];
    },
    set(target, key, value) {
      if (key === '__subs') { target[key] = value; return true; }
      if (target[key] === value) return true;
      target[key] = value;
      // Notify __effect subscribers (for complex features)
      if (target.__subs && target.__subs[key]) {
        if (__batchDepth > 0) {
          for (const fn of target.__subs[key]) __pendingEffects.add(fn);
        } else {
          for (const fn of [...target.__subs[key]]) fn();
        }
      }
      // Also run static invalidation
      self.__invalidate(key);
      return true;
    }
  }
);
```

**When the `get` trap is needed:** Only when the component has complex features (`needsEffect === true`). For simple components, the Proxy only needs the `set` trap.

#### How computed values read from Proxy state

```js
// BEFORE:
this._c_doubled = __computed(() => this._count() * 2);

// AFTER:
this._c_doubled = __computed(() => this._state.count * 2);
```

This works because `__computed` sets `__currentEffect` before calling its function, so the Proxy `get` trap registers the dependency.

#### How watchers read from Proxy state

```js
// BEFORE:
this.__disposers.push(__effect(() => {
  const newVal = this._count();
  if (this.__prev_count !== undefined && this.__prev_count !== newVal) { ... }
  this.__prev_count = newVal;
}));

// AFTER:
this.__disposers.push(__effect(() => {
  const newVal = this._state.count;
  if (this.__prev_count !== undefined && this.__prev_count !== newVal) { ... }
  this.__prev_count = newVal;
}));
```

#### What stays unchanged

- **if/each block logic:** Still uses `__effect`, just reads from `this._state.x` instead of `this._x()`
- **Model bindings (signal → DOM):** Still uses `__effect` (reads `this._state.modelName`)
- **Model event listeners (DOM → signal):** Writes via `this._modelSet_propName(val)` — unchanged
- **Scoped slots:** Still uses `__effect` for prop propagation
- **Dynamic components:** Still uses `__effect` for tag resolution
- **Child component prop bindings:** Still uses `__effect` for attribute propagation
- **User effects:** Still uses `__effect`, reads from `this._state`
- **Event handlers:** Read/write via `this._state` — no `__effect` involved (they're imperative)

## Generated Output Examples

### Source component

```ts
import { defineComponent, defineProps, signal } from 'wcc'

export default defineComponent({
  tag: 'wcc-example',
  template: './wcc-example.html',
  styles: './wcc-example.css',
})

const props = defineProps<{ label: string }>({ label: 'Hello' })
const count = signal(0)
const visible = signal(true)

function increment() {
  count.set(count() + 1)
}
```

```html
<div>
  <span>{{label}}</span>
  <span>{{count}}</span>
  <span show="visible">Visible!</span>
  <button :disabled="count > 5" @click="increment">+</button>
</div>
```

### BEFORE (current output)

```js
let __currentEffect = null;
let __batchDepth = 0;
const __pendingEffects = new Set();
let __runningEffect = null;

function __signal(initial) {
  let _value = initial;
  const _subs = new Set();
  return (...args) => {
    if (args.length === 0) {
      if (__currentEffect) _subs.add(__currentEffect);
      return _value;
    }
    const old = _value;
    _value = args[0];
    if (old !== _value) {
      if (__runningEffect) _subs.delete(__runningEffect);
      if (__batchDepth > 0) {
        for (const fn of _subs) __pendingEffects.add(fn);
      } else {
        for (const fn of [..._subs]) fn();
      }
    }
  };
}

function __effect(fn) {
  let _cleanup = null;
  let _active = true;
  let _running = false;
  const run = () => { /* ... */ };
  run();
  return () => { _active = false; /* ... */ };
}

const __t_WccExample = document.createElement('template');
__t_WccExample.innerHTML = `<div><span></span> <span></span> <span>Visible!</span> <button>+</button></div>`;

class WccExample extends HTMLElement {
  static get observedAttributes() { return ['label']; }

  constructor() {
    super();
    this._s_label = __signal('Hello');
    this._count = __signal(0);
    this._visible = __signal(true);
  }

  connectedCallback() {
    if (this.__connected) return;
    this.__connected = true;

    const __root = __t_WccExample.content.cloneNode(true);
    this.__b0 = __root.childNodes[0].childNodes[0];
    this.__b1 = __root.childNodes[0].childNodes[1];
    this.__sb0 = __root.childNodes[0].childNodes[2];
    this.__ab0 = __root.childNodes[0].childNodes[3];
    this.appendChild(__root);

    this.__ac = new AbortController();
    this.__disposers = [];

    this.__disposers.push(__effect(() => {
      this.__b0.textContent = this._s_label() ?? '';
    }));
    this.__disposers.push(__effect(() => {
      this.__b1.textContent = this._count() ?? '';
    }));
    this.__disposers.push(__effect(() => {
      this.__sb0.style.display = (this._visible()) ? '' : 'none';
    }));
    this.__disposers.push(__effect(() => {
      this.__ab0.disabled = !!(this._count() > 5);
    }));

    this.__ab0.addEventListener('click', (e) => { this._increment(); }, { signal: this.__ac.signal });
  }

  disconnectedCallback() {
    this.__connected = false;
    this.__ac.abort();
    this.__disposers.forEach(d => d());
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'label') this._s_label(newVal ?? 'Hello');
  }

  get label() { return this._s_label(); }
  set label(val) { this._s_label(val); this.setAttribute('label', String(val)); }

  _increment() {
    this._count(this._count() + 1);
  }
}

customElements.define('wcc-example', WccExample);
export default WccExample;
```

### AFTER (new output)

```js
// No runtime globals, no __signal, no __effect needed!

const __t_WccExample = document.createElement('template');
__t_WccExample.innerHTML = `<div><span></span> <span></span> <span>Visible!</span> <button>+</button></div>`;

class WccExample extends HTMLElement {
  static get observedAttributes() { return ['label']; }

  constructor() {
    super();
    const self = this;
    this._state = new Proxy(
      { label: 'Hello', count: 0, visible: true },
      {
        set(target, key, value) {
          if (target[key] === value) return true;
          target[key] = value;
          self.__invalidate(key);
          return true;
        }
      }
    );
  }

  connectedCallback() {
    if (this.__connected) return;
    this.__connected = true;

    const __root = __t_WccExample.content.cloneNode(true);
    this.__b0 = __root.childNodes[0].childNodes[0];
    this.__b1 = __root.childNodes[0].childNodes[1];
    this.__sb0 = __root.childNodes[0].childNodes[2];
    this.__ab0 = __root.childNodes[0].childNodes[3];
    this.appendChild(__root);

    this.__ac = new AbortController();

    this.__ab0.addEventListener('click', (e) => { this._increment(); }, { signal: this.__ac.signal });

    // Initial render
    this.__invalidate('*');
  }

  disconnectedCallback() {
    this.__connected = false;
    this.__ac.abort();
  }

  __invalidate(key) {
    switch(key) {
      case 'label':
        this.__b0.textContent = this._state.label ?? '';
        break;
      case 'count':
        this.__b1.textContent = this._state.count ?? '';
        this.__ab0.disabled = !!(this._state.count > 5);
        break;
      case 'visible':
        this.__sb0.style.display = (this._state.visible) ? '' : 'none';
        break;
      case '*':
        this.__b0.textContent = this._state.label ?? '';
        this.__b1.textContent = this._state.count ?? '';
        this.__ab0.disabled = !!(this._state.count > 5);
        this.__sb0.style.display = (this._state.visible) ? '' : 'none';
        break;
    }
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'label') this._state.label = newVal ?? 'Hello';
  }

  get label() { return this._state.label; }
  set label(val) { this._state.label = val; this.setAttribute('label', String(val)); }

  _increment() {
    this._state.count = this._state.count + 1;
  }
}

customElements.define('wcc-example', WccExample);
export default WccExample;
```

## Dependency Graph Building Algorithm

```js
/**
 * Build the compile-time dependency graph from parsed bindings.
 * Returns a Map<string, DepEntry[]> mapping signal keys to their dependent update operations.
 *
 * @param {Object} parseResult - The full parse result
 * @param {Object} transformContext - { signalNames, computedNames, propNames, modelDefs, ... }
 * @returns {{ depGraph: Map<string, DepEntry[]>, effectBindings: Object[] }}
 */
function buildDepGraph(parseResult, transformContext) {
  const { bindings, showBindings, attrBindings } = parseResult;
  const { signalNames, computedNames, propDefs, modelDefs, modelVarMap,
          propsObjectName, emitsObjectName, constantNames, methodNames } = transformContext;
  
  const propNames = new Set(propDefs.map(p => p.name));
  const depGraph = new Map();        // signal key → DepEntry[]
  const effectBindings = {           // bindings that stay in __effect
    text: [], show: [], attr: []
  };

  // Helper: add entry to dep graph under a key
  function addDep(key, entry) {
    if (!depGraph.has(key)) depGraph.set(key, []);
    depGraph.get(key).push(entry);
  }

  // Helper: check if expression references any computed or method (disqualifying)
  function refsComputedOrMethod(rawExpr) {
    for (const name of computedNames) {
      if (new RegExp(`\\b${name}\\b`).test(rawExpr)) return true;
    }
    // Method calls: name( where name is a known method
    for (const name of methodNames) {
      if (new RegExp(`\\b${name}\\s*\\(`).test(rawExpr)) return true;
    }
    return false;
  }

  // ── Process text bindings ──
  for (const b of bindings) {
    // Computed bindings always stay in __effect
    if (b.type === 'computed') {
      effectBindings.text.push(b);
      continue;
    }
    // Constant function bindings stay in __effect
    if (b.type === 'constant') {
      const constDef = parseResult.constantVars.find(c => c.name === b.name);
      if (constDef && /^\s*(\(|function\b)/.test(constDef.value)) {
        effectBindings.text.push(b);
        continue;
      }
    }

    // Determine raw expression to scan for deps
    let rawExpr;
    if (b.type === 'signal') rawExpr = b.name;
    else if (b.type === 'prop') rawExpr = b.name;
    else rawExpr = b.name; // expression type

    // Check for computed/method references
    if (refsComputedOrMethod(rawExpr)) {
      effectBindings.text.push(b);
      continue;
    }

    // Extract signal dependencies
    const deps = extractDeps(rawExpr, signalNames, propNames, modelDefs);
    if (deps.size === 0) {
      // Static constant — set once, no invalidation needed
      continue;
    }

    // Transform the expression for the generated code
    const expr = transformExpr(rawExpr, signalNames, computedNames,
      propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);

    const entry = { type: 'text', varName: b.varName, expr };
    for (const dep of deps) {
      addDep(dep, entry);
    }
  }

  // ── Process show bindings ──
  for (const sb of showBindings) {
    if (refsComputedOrMethod(sb.expression)) {
      effectBindings.show.push(sb);
      continue;
    }
    const deps = extractDeps(sb.expression, signalNames, propNames, modelDefs);
    if (deps.size === 0) continue;

    const expr = transformExpr(sb.expression, signalNames, computedNames,
      propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);

    const entry = { type: 'show', varName: sb.varName, expr };
    for (const dep of deps) {
      addDep(dep, entry);
    }
  }

  // ── Process attr bindings ──
  for (const ab of attrBindings) {
    if (refsComputedOrMethod(ab.expression)) {
      effectBindings.attr.push(ab);
      continue;
    }
    const deps = extractDeps(ab.expression, signalNames, propNames, modelDefs);
    if (deps.size === 0) continue;

    const expr = transformExpr(ab.expression, signalNames, computedNames,
      propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap);

    const entry = {
      type: ab.kind,  // 'attr', 'bool', 'class', 'style'
      varName: ab.varName,
      expr,
      attr: ab.attr,
      staticValue: ab.staticValue || null,
      subKind: ab.expression.trimStart().startsWith('{') ? 'object'
             : ab.expression.trimStart().startsWith('[') ? 'array'
             : 'string'
    };
    for (const dep of deps) {
      addDep(dep, entry);
    }
  }

  return { depGraph, effectBindings };
}
```

## Files Modified

### `lib/codegen.js`

| Section | Change |
|---|---|
| `generateComponent` — constructor | Replace `__signal()` calls with `this._state = new Proxy({...}, handler)` |
| `generateComponent` — constructor | Conditionally include `get` trap when `needsEffect` is true |
| `generateComponent` — connectedCallback | Remove `__effect` wrappers for simple bindings; add `this.__invalidate('*')` |
| `generateComponent` — connectedCallback | Remove `this.__disposers = []` when no complex features exist |
| `generateComponent` — disconnectedCallback | Remove `this.__disposers.forEach(d => d())` when no complex features exist |
| `generateComponent` — new method | Generate `__invalidate(key)` method with switch statement |
| `generateComponent` — attributeChangedCallback | Change `this._s_propName(val)` → `this._state.propName = val` |
| `generateComponent` — attributeChangedCallback | Change `this._m_modelName(val)` → `this._state.modelName = val` |
| `generateComponent` — public getters | Change `this._s_propName()` → `this._state.propName` |
| `generateComponent` — public setters | Change `this._s_propName(val)` → `this._state.propName = val` |
| `generateComponent` — runtime selection | Set `needsSignal = false`; conditionally include globals |
| `transformExpr` | Signal reads: `this._name()` → `this._state.name` |
| `transformExpr` | Prop reads: `this._s_name()` → `this._state.name` |
| `transformExpr` | Model reads: `this._m_name()` → `this._state.name` |
| `transformMethodBody` | Signal writes: `this._name(val)` → `this._state.name = val` |
| `transformMethodBody` | Signal reads: `this._name()` → `this._state.name` |
| New function: `buildDepGraph` | Analyze bindings and build compile-time dependency map |
| New function: `extractDeps` | Extract signal names from raw expressions |
| New function: `generateInvalidateMethod` | Emit the `__invalidate(key)` switch statement |

### `lib/reactive-runtime.js`

| Section | Change |
|---|---|
| `buildInlineRuntime` | Add `needsSignal` parameter (default: `true` for backward compat) |
| `buildInlineRuntime` | Conditionally include `runtimeGlobals` only when `needsEffect` or `needsComputed` |
| `buildInlineRuntime` | Conditionally include `runtimeSignal` only when `needsSignal` is true |

### `test/` (new/modified test files)

| File | Purpose |
|---|---|
| `test/codegen-proxy-state.test.js` | Unit tests for Proxy state generation |
| `test/codegen-invalidate.test.js` | Unit tests for `__invalidate` method generation |
| `test/dep-graph.test.js` | Unit tests for dependency graph building |
| Existing codegen tests | Update expected output patterns |

## Components and Interfaces

### Modified Components

| Component | Interface | Role |
|---|---|---|
| `generateComponent()` | `(parseResult, options) → string` | Main codegen entry point — generates the full component class |
| `transformExpr()` | `(expr, signalNames, ...) → string` | Transforms template expressions to reference `this._state` |
| `transformMethodBody()` | `(body, signalNames, ...) → string` | Transforms method bodies for signal reads/writes |
| `buildInlineRuntime()` | `(usage) → string` | Generates the inline runtime code (conditionally pruned) |

### New Components

| Component | Interface | Role |
|---|---|---|
| `extractDeps()` | `(rawExpr, signalNames, propNames, modelDefs) → Set<string>` | Extracts signal dependency names from a raw expression |
| `buildDepGraph()` | `(parseResult, transformContext) → { depGraph, effectBindings }` | Builds the compile-time dependency map from parsed bindings |
| `generateInvalidateMethod()` | `(depGraph, lines) → void` | Emits the `__invalidate(key)` switch statement into the output lines array |

### External Interfaces (unchanged)

| Interface | Description |
|---|---|
| `Proxy` (native) | Browser-native state container — replaces `__signal` |
| `HTMLElement` / `customElements` | Standard Web Component APIs |
| `AbortController` | Event listener cleanup on disconnect |

## Data Models

### DepEntry (Dependency Graph Entry)

```ts
interface DepEntry {
  type: 'text' | 'show' | 'attr' | 'bool' | 'class' | 'style';
  varName: string;       // DOM node reference (e.g., '__b0', '__sb0', '__ab0')
  expr: string;          // Transformed expression (e.g., 'this._state.count')
  attr?: string;         // Attribute name (for attr/bool bindings)
  staticValue?: string;  // Static prefix (for class/style with existing static values)
  subKind?: 'object' | 'array' | 'string';  // Sub-type for class/style bindings
}
```

### Dependency Graph

```ts
type DepGraph = Map<string, DepEntry[]>;
// Key: signal/prop/model name (e.g., 'count', 'label')
// Value: array of DepEntry objects that depend on this key
```

### Proxy State Object (generated)

```ts
// Runtime shape of this._state (per component instance)
interface ProxyState {
  [signalName: string]: any;    // User signals
  [propName: string]: any;      // Props
  [modelName: string]: any;     // Model definitions
  __subs?: Record<string, Set<Function>>;  // Effect subscribers (only when get trap is active)
}
```

## Correctness Properties

### Property 1: Output Equivalence
For any component with only simple bindings (text, show, attr, class, style), the DOM output after `__invalidate('*')` MUST be identical to the DOM output after all `__effect` callbacks have run in the current model.

### Property 2: Idempotency
Calling `__invalidate(key)` multiple times with the same state MUST produce the same DOM state (no cumulative side effects).

### Property 3: Change Detection
The Proxy setter MUST NOT call `__invalidate` when the new value equals the old value (`===` comparison).

### Property 4: Dependency Completeness
Every signal that a binding depends on MUST have that binding registered in its `__invalidate` case. Missing a dependency means the DOM won't update.

### Property 5: No Stale Reads
All expressions in `__invalidate` cases read from `this._state` (current values), never from captured closures.

## Error Handling

| Scenario | Handling |
|---|---|
| `__invalidate` called before `connectedCallback` (DOM refs are null) | Each case should guard with `if (this.__varName)` — but in practice `__invalidate` is only called from the Proxy setter which fires after constructor, and DOM refs are set in `connectedCallback`. The wildcard `'*'` is called at end of `connectedCallback` so refs are guaranteed to exist. |
| Proxy setter throws | The `set` trap always returns `true`. If `__invalidate` throws, it propagates to the caller (the code that wrote to `this._state`). This matches current behavior where signal writes can throw if an effect errors. |
| Circular invalidation | Not possible in Phase 1 — simple bindings don't write to state. Computed chains (Phase 2) will need cycle detection. |

## Testing Strategy

| Test Type | Coverage |
|---|---|
| Unit: `extractDeps` | Verify correct signal extraction from various expression patterns |
| Unit: `buildDepGraph` | Verify correct classification of bindings (invalidate vs effect) |
| Unit: `generateInvalidateMethod` | Verify generated switch cases for all binding types |
| Integration: full compile | Compile sample `.wcc` components and verify output matches expected patterns |
| Regression: existing tests | All existing codegen tests updated to expect new `this._state` patterns |
| E2E: browser | Compile a component, load in browser, verify reactivity works (signal write → DOM update) |
