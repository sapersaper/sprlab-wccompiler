# Technical Design: advanced-features-zero-runtime

## Overview

Phase 4 (final) migrates all remaining `__effect`-based features to the static `__invalidate(key)` approach: model bindings, child component prop bindings, scoped slots, and dynamic components. It also removes the public `effect()` API, refactors batch to be per-component, and eliminates the reactive runtime entirely.

After this phase, NO component requires `__effect`, `__signal`, `__computed`, or `__untrack` in the generated output. The compiler produces fully static, zero-runtime Web Components using only native browser APIs (`Proxy`, `HTMLElement`, `AbortController`).

## Architecture

### 1. Model Binding — Signal to DOM Synchronization

Model bindings (signal→DOM) currently use `__effect` wrappers. These are moved to `__invalidate` cases.

#### Current Pattern (connectedCallback)

```js
this.__disposers.push(__effect(() => {
  this.__model_username_0.value = this._state.username ?? '';
}));
```

#### New Pattern (`__invalidate` case)

```js
case 'username':
  this.__model_username_0.value = this._state.username ?? '';
  break;
```

#### DepGraph Registration

In `buildDepGraph`, model bindings are registered under the signal key:

```js
for (const mb of modelBindings) {
  if (mb.prop === 'checked' && mb.radioValue !== null) {
    addDep(mb.signal, {
      type: 'modelRadio',
      varName: mb.varName,
      radioValue: mb.radioValue,
    });
  } else if (mb.prop === 'checked') {
    addDep(mb.signal, {
      type: 'modelCheckbox',
      varName: mb.varName,
    });
  } else {
    addDep(mb.signal, {
      type: 'modelValue',
      varName: mb.varName,
    });
  }
}
```

#### Extended `generateUpdateOp`

```js
case 'modelValue':
  lines.push(`${indent}this.${entry.varName}.value = this._state.${entry.signal} ?? '';`);
  break;
case 'modelCheckbox':
  lines.push(`${indent}this.${entry.varName}.checked = !!this._state.${entry.signal};`);
  break;
case 'modelRadio':
  lines.push(`${indent}this.${entry.varName}.checked = (this._state.${entry.signal} === '${entry.radioValue}');`);
  break;
```

#### Model event listeners (DOM → signal) stay unchanged

These already use `addEventListener` with `this.__ac.signal` and write directly to `this._state`. No change needed — they're already `__effect`-free.

### 2. Model Prop Binding — Parent to Child Synchronization

Model prop bindings (`model:propName="signalName"`) currently use `__effect` for parent→child sync, and `addEventListener` for child→parent sync.

#### Current Pattern

```js
// Parent → child (__effect)
this.__disposers.push(__effect(() => {
  this.__child.setAttribute('model-value', this._state.modelValue ?? '');
}));

// Child → parent (event listener — already __effect-free)
this.__child.addEventListener('wcc:model', (e) => {
  if (e.detail.prop === 'modelValue') {
    this._state.modelValue = e.detail.value;
  }
}, { signal: this.__ac.signal });
```

#### New Pattern (`__invalidate` case)

```js
case 'modelValue':
  this.__child.setAttribute('model-value', this._state.modelValue ?? '');
  break;
```

#### DepGraph Registration

```js
for (const mpb of modelPropBindings) {
  addDep(mpb.signal, {
    type: 'modelProp',
    varName: mpb.varName,
    attr: camelToKebab(mpb.propName),
  });
}
```

The child→parent `wcc:model` listener remains in `connectedCallback` unchanged.

### 3. Child Component Prop Binding

Child component prop bindings (`:propName="expr"`) currently use `__effect` wrappers.

#### Current Pattern

```js
this.__disposers.push(__effect(() => {
  this.__child.setAttribute('title', this._state.title ?? '');
}));
```

#### New Pattern (`__invalidate` case)

```js
case 'title':
  this.__child.setAttribute('title', this._state.title ?? '');
  break;
```

#### DepGraph Registration

For child prop bindings, the signal deps are extracted from the expression:

```js
for (const cc of childComponents) {
  for (const pb of cc.propBindings) {
    if (pb.type === 'signal' || pb.type === 'prop' || pb.type === 'computed') {
      addDep(pb.expr, {
        type: 'childProp',
        varName: cc.varName,
        attr: pb.attr,
        expr: transformExpr(pb.expr, ...),
      });
    } else if (pb.type === 'constant') {
      addDep(pb.expr, {
        type: 'childProp',
        varName: cc.varName,
        attr: pb.attr,
        expr: `this._const_${pb.expr}`,
      });
    }
  }
}
```

When multiple prop bindings on the same child depend on the same signal, they group naturally in the same `__invalidate` case.

#### Existence Guards in `__invalidate`

```js
case 'title':
  if (this.__child) {
    const __v = this._state.title;
    if (__v || __v === '') {
      this.__child.setAttribute('title', __v);
    } else {
      this.__child.removeAttribute('title');
    }
  }
  break;
```

### 4. Scoped Slot Invalidation

Scoped slots currently use `__effect` for prop computation and event dispatch.

#### Current Pattern

```js
__effect(() => {
  const __props = { item: this._state.currentItem };
  this.__slotProps['default'] = __props;
  this.dispatchEvent(new CustomEvent('wcc:slot-update', {
    detail: { slot: 'default', props: __props },
    bubbles: false,
  }));
  if (this.__slotRenderers && this.__slotRenderers['default']) {
    this.__slotRenderers['default'](__props);
  } else if (this.__slotTpl_default) {
    let __html = this.__slotTpl_default;
    for (const [k, v] of Object.entries(__props)) {
      __html = __html.replace(new RegExp('(?:\\{\\{|\\{%)\\s*' + k + '(\\(\\))?\\s*(?:\\}\\}|%\\})', 'g'), v ?? '');
    }
    this.__slot_default.innerHTML = __html;
  }
});
```

#### New Pattern (`__invalidate` case)

```js
case 'currentItem':
  { const __props = { item: this._state.currentItem };
    this.__slotProps['default'] = __props;
    this.dispatchEvent(new CustomEvent('wcc:slot-update', {
      detail: { slot: 'default', props: __props },
      bubbles: false,
    }));
    if (this.__slotRenderers && this.__slotRenderers['default']) {
      this.__slotRenderers['default'](__props);
    } else if (this.__slotTpl_default) {
      let __html = this.__slotTpl_default;
      for (const [k, v] of Object.entries(__props)) {
        __html = __html.replace(new RegExp('(?:\\{\\{|\\{%)\\s*' + k + '(\\(\\))?\\s*(?:\\}\\}|%\\})', 'g'), v ?? '');
      }
      this.__slot_default.innerHTML = __html;
    } }
  break;
```

#### DepGraph Registration

```js
for (const s of slots) {
  if (s.name && s.slotProps.length > 0) {
    for (const sp of s.slotProps) {
      const deps = extractDeps(sp.source, signalNames, propNames, modelDefs);
      for (const dep of deps) {
        addDep(dep, {
          type: 'scopedSlot',
          slotName: s.name,
          varName: s.varName,
          slotPropsExpr: `{ ${s.slotProps.map(sp2 => {
            return `${sp2.prop}: ${slotPropRef(sp2.source, signalNames, computedNames, propNames)}`;
          }).join(', ')} }`,
        });
      }
    }
  }
}
```

### 5. Dynamic Component Rendering

Dynamic components are migrated from `__effect` to a dedicated `__renderDynamic_N()` method, following the same pattern as `__renderIf_N()` and `__renderEach_N()`.

#### Current Pattern

```js
this.__disposers.push(__effect(() => {
  const __tag = this._state.currentView;
  if (__tag === this.__dyn0_tag) return;
  if (this.__dyn0_current) {
    this.__dyn0_propDisposers.forEach(d => d());
    this.__dyn0_propDisposers = [];
    this.__dyn0_current.remove();
    this.__dyn0_current = null;
  }
  if (__tag) {
    const el = document.createElement(__tag);
    // Prop effects
    this.__dyn0_propDisposers.push(__effect(() => {
      el.setAttribute('title', this._state.title);
    }));
    // Event listeners
    el.addEventListener('custom-event', (e) => this._logEvent(e));
    this.__dyn0_anchor.parentNode.insertBefore(el, this.__dyn0_anchor);
    customElements.upgrade(el);
    this.__dyn0_current = el;
  }
  this.__dyn0_tag = __tag;
}));
```

#### New Pattern (`__renderDynamic_N()` method)

```js
__renderDynamic_0() {
  const __tag = this._state.currentView;
  if (__tag === this.__dyn0_tag) return;
  if (this.__dyn0_current) {
    this.__dyn0_current.remove();
    this.__dyn0_current = null;
  }
  if (__tag) {
    const el = document.createElement(__tag);
    // Set initial prop values directly (no __effect)
    el.setAttribute('title', this._state.title ?? '');
    // Event listeners
    el.addEventListener('custom-event', (e) => this._logEvent(e));
    this.__dyn0_anchor.parentNode.insertBefore(el, this.__dyn0_anchor);
    customElements.upgrade(el);
    this.__dyn0_current = el;
  }
  this.__dyn0_tag = __tag;
}
```

#### Dynamic Prop Invalidation

Prop bindings on dynamic components that depend on external signals are registered in the depGraph with an existence guard:

```js
for (const dyn of dynamicComponents) {
  for (const prop of dyn.props) {
    const deps = extractDeps(prop.expression, signalNames, propNames, modelDefs);
    for (const dep of deps) {
      if (dep !== extractDeps(dyn.isExpression, signalNames, propNames, modelDefs)) {
        // External signal (not the tag signal) → guarded update
        addDep(dep, {
          type: 'childProp',
          varName: `this.__dyn${idx}_current`,
          attr: prop.attr,
          expr: transformExpr(prop.expression, ...),
          dynGuard: true,
        });
      }
    }
  }
}
```

Generated in `__invalidate`:
```js
case 'title':
  if (this.__dyn0_current) {
    this.__dyn0_current.setAttribute('title', this._state.title ?? '');
  }
  break;
```

#### Tag Signal → `__renderDynamic_N()` Call

```js
case 'currentView':
  this.__renderDynamic_0();
  break;
```

#### DepGraph Registration for RenderDynamic

```js
for (let idx = 0; idx < dynamicComponents.length; idx++) {
  const dyn = dynamicComponents[idx];
  const deps = extractDeps(dyn.isExpression, signalNames, propNames, modelDefs);
  for (const dep of deps) {
    addDep(dep, { type: 'renderDynamic', dynIndex: idx });
  }
}
```

### 6. Effect API Removal

When the parser detects `import { effect } from 'wcc'` or a call to `effect(...)`, the codegen emits a compile-time error.

#### Parser Detection

The parser already extracts `effects` from the import list and function calls. For Phase 4, when `effects.length > 0`:

```js
if (effects.length > 0) {
  throw new Error(
    'effect() has been removed. Use watch() for reactive side effects ' +
    '(see docs: https://wcc.dev/docs/migration-v1#effect-removed)'
  );
}
```

### 7. Full Runtime Elimination

After migrating all features, `needsEffect` becomes:

```js
const needsEffect = false;  // Always false — no component needs __effect
const needsComputed = false; // Already false since Phase 2
const needsUntrack = false;  // Already false since Phase 2
const needsBatch = false;    // Batch is refactored to per-component
```

This means:
- NO `import { __effect }` in any component
- NO `__disposers` array initialization
- NO `__disposers.forEach(d => d())` in disconnectedCallback
- NO `__currentEffect`, `__batchDepth`, `__pendingEffects` globals
- Zero reactive runtime code in ALL generated components

**Exception:** Runtime globals may still be needed if the Proxy `get` trap is generated. But wait — if `needsEffect` is always false, the `get` trap is never generated! The Proxy only needs the `set` trap:

```js
this._state = new Proxy(
  { ... },
  {
    set(target, key, value) {
      if (target[key] === value) return true;
      target[key] = value;
      self.__invalidate(key);
      return true;
    }
  }
);
```

No `get` trap needed because no subscribers exist (no `__effect`, no `__currentEffect`).

### 8. Batch Mechanism Refactoring

The current `batch()` relies on `__batchDepth` and `__pendingEffects` (shared globals). In Phase 4, batch becomes a per-component mechanism.

#### Current Pattern (runtime global)

```js
function __batch(fn) {
  __batchDepth++;
  try { fn(); } finally {
    __batchDepth--;
    if (__batchDepth === 0) {
      for (const fn of __pendingEffects) fn();
      __pendingEffects.clear();
    }
  }
}
```

#### New Pattern (per-component inline)

```js
// In connectedCallback:
this.__batching = false;
this.__batchKeys = new Set();

// In the Proxy set trap:
set(target, key, value) {
  if (target[key] === value) return true;
  target[key] = value;
  if (self.__batching) {
    self.__batchKeys.add(key);
  } else {
    self.__invalidate(key);
  }
  return true;
}

// In User method body, batch( → this.__batch( :
this.__batch(() => {
  this._state.count = 5;
  this._state.name = 'foo';
});
```

**Note:** `batch()` in user code is transformed to `this.__batch()` by `transformMethodBody`.

#### Generated `__batch` Method

```js
__batch(fn) {
  this.__batching = true;
  try { fn(); } finally {
    this.__batching = false;
    for (const key of this.__batchKeys) {
      this.__invalidate(key);
    }
    this.__batchKeys.clear();
  }
}
```

This replaces the shared global `__batch()` function. No runtime imports needed.

### 9. Cleanup and Disconnection

After Phase 4, `disconnectedCallback` no longer needs to dispose effects:

```js
disconnectedCallback() {
  this.__connected = false;
  this.__ac.abort();
  // No __disposers to clean up
}
```

The `AbortController` (via `this.__ac.signal`) handles all event listener cleanup automatically.

### 10. Generated Output Example

#### Source component

```ts
import { defineComponent, signal, computed, watch, batch } from 'wcc'

export default defineComponent({ tag: 'wcc-full-demo' })

const count = signal(0)
const doubled = computed(() => count() * 2)
const items = signal([1, 2, 3])

watch(count, (newVal) => { console.log('count:', newVal) })

function increment() {
  batch(() => {
    count.set(count() + 1)
  })
}
```

```html
<div>
  <p>{{count()}}</p>
  <p>{{doubled()}}</p>
  <input model="count" />
  <ul>
    <li each="n in items()" :key="n">{{n}}</li>
  </ul>
</div>
```

#### Generated Output (after Phase 4)

```js
const __t = document.createElement('template');
__t.innerHTML = `<div>
  <p><span></span></p>
  <p><span></span></p>
  <input>
  <ul>
    <!--for0-->
  </ul>
</div>`;

// No runtime imports — zero reactive runtime

class WccFullDemo extends HTMLElement {
  static __meta = { tag: 'wcc-full-demo', props: [], events: [], models: [], slots: [] };

  constructor() {
    super();
    const self = this;
    this._state = new Proxy(
      { count: 0, doubled: 0, items: [1, 2, 3] },
      {
        set(target, key, value) {
          if (target[key] === value) return true;
          target[key] = value;
          self.__invalidate(key);
          return true;
        }
      }
    );
    // Computed initial values
    this._state.doubled = this._state.count * 2;
    // Watcher old-value tracking
    this.__prev_count = this._state.count;
    // Batch state
    this.__batching = false;
    this.__batchKeys = new Set();
  }

  connectedCallback() {
    if (this.__connected) return;
    this.__connected = true;
    const __root = __t.content.cloneNode(true);
    this.__b0 = __root.childNodes[0].childNodes[1].childNodes[1];
    this.__b1 = __root.childNodes[0].childNodes[3].childNodes[1];
    this.__model_count_0 = __root.childNodes[0].childNodes[5];
    this.__for0_anchor = __root.childNodes[0].childNodes[7];
    // ... template/anchor init ...
    this.innerHTML = '';
    this.appendChild(__root);
    this.__ac = new AbortController();

    // Event listeners
    this.__model_count_0.addEventListener('input', (e) => {
      this._state.count = e.target.value;
    }, { signal: this.__ac.signal });

    this.__invalidate('*');
  }

  disconnectedCallback() {
    this.__connected = false;
    this.__ac.abort();
  }

  _increment() {
    this.__batch(() => {
      this._state.count = this._state.count + 1;
    });
  }

  __batch(fn) {
    this.__batching = true;
    try { fn(); } finally {
      this.__batching = false;
      for (const key of this.__batchKeys) {
        this.__invalidate(key);
      }
      this.__batchKeys.clear();
    }
  }

  __renderEach_0() { /* ... */ }
  __renderIf_0() { /* ... */ }

  __invalidate(key) {
    switch(key) {
      case 'count':
        this._state.doubled = this._state.count * 2;
        this.__b0.textContent = this._state.count ?? '';
        this.__model_count_0.value = this._state.count ?? '';
        if (this.__prev_count !== this._state.count) {
          console.log('count:', this._state.count);
        }
        this.__prev_count = this._state.count;
        break;
      case 'doubled':
        this.__b1.textContent = this._state.doubled ?? '';
        break;
      case 'items':
        this.__renderEach_0();
        break;
      case '*':
        this._state.doubled = this._state.count * 2;
        this.__renderEach_0();
        this.__b0.textContent = this._state.count ?? '';
        this.__b1.textContent = this._state.doubled ?? '';
        this.__model_count_0.value = this._state.count ?? '';
        this.__prev_count = this._state.count;
        break;
    }
  }
}

customElements.define('wcc-full-demo', WccFullDemo);
export default WccFullDemo;
```

**Zero runtime.** No `__effect`, `__signal`, `__computed`, `__untrack`, or reactive globals.

### 11. DepEntry Type Extension

```ts
interface DepEntry {
  type: 'text' | 'show' | 'attr' | 'bool' | 'class' | 'style'
      | 'computed' | 'renderIf' | 'renderEach' | 'watcher'
      | 'modelValue' | 'modelCheckbox' | 'modelRadio'
      | 'modelProp' | 'childProp'
      | 'scopedSlot'
      | 'renderDynamic';
  // Existing fields...
  varName?: string;
  expr?: string;

  // Phase 4 specific
  radioValue?: string;      // For modelRadio
  slotName?: string;         // For scoped slots
  slotPropsExpr?: string;    // Pre-computed slot props expression
  dynIndex?: number;         // Dynamic component index
  dynGuard?: boolean;        // Whether to guard with __dynN_current check
}
```

### 12. What Stays Unchanged

After Phase 4, EVERYTHING is migrated. There are no remaining `__effect`-based features. The only runtime helper kept is the cross-runtime import path (`__wcc-signals.js`) for legacy components.

## Files Modified

### `lib/codegen.js`

| Section | Change |
|---|---|
| `buildDepGraph` | Add model, childProp, scopedSlot, renderDynamic, modelProp entries |
| `generateUpdateOp` | Add cases for modelValue, modelCheckbox, modelRadio, modelProp, childProp, scopedSlot, renderDynamic |
| `generateComponent` — connectedCallback | Remove `__effect` wrappers for model, childProp, scopedSlot, dynamic |
| `generateComponent` — connectedCallback | Keep event listeners (model, wcc:model) with AbortController |
| `generateComponent` — new methods | Generate `__renderDynamic_N()` for each dynamic component |
| `generateComponent` — new methods | Generate `__batch()` method when usesBatch is true |
| `generateComponent` — constructor | Initialize `this.__batching = false; this.__batchKeys = new Set()` |
| `generateComponent` — Proxy set trap | Add batch key collection (`if (self.__batching) self.__batchKeys.add(key)`) |
| `generateComponent` — `__invalidate` | Add cases for newly migrated types (models, childProps, slots, dynamic) |
| `generateComponent` — `__invalidate('*')` | Add initial values for model bindings, renderDynamic calls |
| `generateComponent` — runtime flags | `needsEffect = false`, `needsBatch = false` |
| `generateComponent` — `disconnectedCallback` | Remove `__disposers.forEach(d => d())` |
| `transformMethodBody` | Transform `batch(...)` → `this.__batch(...)` (already done) |
| `transformExpr` | Validate that `effect` is not referenced |
| `buildInlineRuntime` | Remove `__batch` generation (replaced by per-component method) |

### `lib/reactive-runtime.js`

| Section | Change |
|---|---|
| `buildInlineRuntime` | `needsBatch` → not needed (batch is now per-component) |

## Correctness Properties

### Property 1: No `__effect` in Any Component
For ANY component after Phase 4, the generated output MUST NOT contain `__effect`, `__disposers`, `__currentEffect`, `__batchDepth`, or `__pendingEffects`.

### Property 2: Proxy Setter Always Functions
The Proxy `set` guard checks `self.__batching` first. When batching, keys are collected. When not, `__invalidate` is called. This is always correct regardless of whether `batch()` is used.

### Property 3: Batch Deduplication
If the same key is written multiple times in a batch, it appears in `__batchKeys` once (Set semantics). `__invalidate` runs once per key after batch completes.

### Property 4: Dynamic Component Cleanup
When a dynamic component's tag changes, the old element is removed from DOM before the new one is created. Event listeners on the old element are implicitly cleaned up by DOM removal.

### Property 5: Model Binding Safety
Model bindings inside if-blocks are guarded by `if (this.__ifN_current)`. Model bindings inside each-blocks are per-item, set during `__renderEach_N()`.

### Property 6: Watcher Execution
Watchers continue to fire from `__invalidate` as implemented in Phase 2. No change needed.

## Testing Strategy

| Test Type | Coverage |
|---|---|
| Unit: `buildDepGraph` | Model, childProp, scopedSlot, renderDynamic classification |
| Unit: `generateUpdateOp` | new types (modelValue, modelCheckbox, etc.) |
| Unit: `generateComponent` | No `__effect` in any component |
| Integration: full compile | All feature combinations, zero runtime output |
| E2E: browser | All existing example components work without errors |
| Regression: existing tests | All tests updated for no-`__effect` output |
