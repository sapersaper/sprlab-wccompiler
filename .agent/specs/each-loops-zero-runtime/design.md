# Technical Design: each-loops-zero-runtime

## Overview

This design migrates `each` loops away from `__effect`-based rendering to the static `__invalidate(key)` approach established in Phase 1 and extended in Phase 2. Each loops are the most complex migration target: they require dynamic DOM creation/destruction, keyed/non-keyed reconciliation, per-item bindings capturing loop variables, and external-signal in-place updates.

The core strategy: generate a `__renderEach_N()` instance method for each loop that handles reconciliation (keyed or non-keyed) and initial internal bindings. Source signal changes trigger `__renderEach_N()` from `__invalidate`. External signal changes trigger in-place update loops in `__invalidate` that iterate existing nodes without recreating them.

## Architecture

### 1. Current Pattern (`__effect`-based)

The existing each-loop implementation generates a single `__effect` inside `connectedCallback`:

```js
this.__disposers.push(__effect(() => {
  const __source = this._state.items;
  const __iter = (__source || []);

  // Non-keyed: destroy and recreate all nodes
  for (const n of this.__for0_nodes) n.remove();
  this.__for0_nodes = [];
  __iter.forEach((item, idx) => {
    const clone = this.__for0_tpl.content.cloneNode(true);
    const node = clone.firstChild;
    // Setup bindings (inline __effect per binding per node)
    __effect(() => { node.childNodes[0].textContent = item; });
    __effect(() => { node.childNodes[1].textContent = this._state.externalValue; });
    node.addEventListener('click', (e) => { this._remove(item.id); });
    this.__for0_anchor.parentNode.insertBefore(node, this.__for0_anchor);
    this.__for0_nodes.push(node);
  });
}));
```

**Problems:**
- Each binding in each item creates an `__effect` → O(items × bindings) runtime overhead
- All items are destroyed and recreated on any change to the source signal
- External signal changes trigger full list re-render (unnecessary DOM churn)
- The BUG-0012 workaround (destroy-and-recreate for keyed loops) reveals the closure-stale-issue inherent in `__effect`-based per-item bindings

### 2. New Pattern: `__renderEach_N()` Method

Each each-block is rendered by a dedicated `__renderEach_N()` instance method called from `__invalidate` when the source signal changes.

#### Generated Method Structure

```js
__renderEach_0() {
  // Evaluate source expression
  const __source = this._state.items;
  const __iter = typeof __source === 'number'
    ? Array.from({ length: __source }, (_, i) => i + 1)
    : (__source || []);

  // Non-keyed: destroy and recreate
  for (const n of this.__for0_nodes) n.remove();
  this.__for0_nodes = [];
  this.__for0_items = [];

  __iter.forEach((item, idx) => {
    const clone = this.__for0_tpl.content.cloneNode(true);
    const node = clone.firstChild;

    // === Static internal bindings (no __effect) ===

    // Text binding referencing item variable
    node.childNodes[0].textContent = item ?? '';

    // Text binding referencing external signal (initial value)
    node.childNodes[1].textContent = this._state.externalValue ?? '';

    // Event handler with closure capturing item and index
    node.childNodes[2].addEventListener('click', () => this._remove(item.id));

    // Insert into DOM
    this.__for0_anchor.parentNode.insertBefore(node, this.__for0_anchor);

    // Store node reference and item data for in-place updates
    this.__for0_nodes.push(node);
    this.__for0_items.push(item);
  });
}
```

#### Key Differences from Current `__effect`-based code

| Aspect | Current (`__effect`) | New (`__renderEach`) |
|---|---|---|
| Rendering trigger | `__effect` re-run on signal change | `__invalidate` → `__renderEach_N()` |
| Internal bindings | Per-node `__effect` wrappers (N effects) | Static assignments (zero runtime) |
| External signals | Trigger full list re-render via `__effect` | In-place update loops in `__invalidate` |
| Item data capture | Not captured (lost on each re-render) | Stored in `__for_N_items` for in-place ops |
| Method location | Inline in `connectedCallback` | Dedicated instance method on class |

### 3. Source → DepGraph Registration

When an each-block's source expression references a signal, that signal is registered in the depGraph as a `renderEach` type entry. When that signal changes, `__invalidate` calls `__renderEach_N()`.

```js
// In extended buildDepGraph():
for (let idx = 0; idx < forBlocks.length; idx++) {
  const forBlock = forBlocks[idx];
  const deps = extractDeps(forBlock.source, signalNames, propNames, modelDefs);
  for (const dep of deps) {
    addDep(dep, { type: 'renderEach', eachBlockIndex: idx });
  }
}
```

Generated `__invalidate` case:
```js
case 'items':
  this.__renderEach_0();
  break;
```

### 4. External Signal In-Place Updates

External signals (signals referenced inside loop items that are NOT the source signal) trigger in-place update loops instead of full reconciliation.

#### Dependency Analysis

When building the depGraph, each binding inside a forBlock is analyzed:

```js
for (let idx = 0; idx < forBlocks.length; idx++) {
  const forBlock = forBlocks[idx];
  for (const b of forBlock.bindings) {
    // Extract signal deps from the binding expression
    const exprDeps = extractForDeps(b.name, forBlock.itemVar, forBlock.indexVar,
                                    signalNames, propNames, modelDefs);
    for (const dep of exprDeps) {
      if (dep === forBlock.source) continue; // source signal handled by renderEach
      // External signal: register in-place update entry
      addDep(dep, {
        type: 'text',
        eachBlockIndex: idx,
        varName: b.varName,
        expr: transformForExpr(b.name, forBlock.itemVar, forBlock.indexVar,
                              propNames, signalNamesSet, computedNamesSet, methodNames),
        itemVar: forBlock.itemVar,
        indexVar: forBlock.indexVar,
      });
    }
  }
}
```

#### Generated In-Place Update Loop

For a text binding `{{externalValue}}` inside each-block items where `externalValue` is an external signal:

```js
case 'externalValue':
  // In-place update for each-block 0
  for (let __i = 0; __i < this.__for0_nodes.length; __i++) {
    this.__for0_nodes[__i].childNodes[1].textContent = this._state.externalValue ?? '';
  }
  break;
```

For a text binding `{{item.name + ' - ' + externalValue}}` that references both item data and an external signal:

```js
case 'externalValue':
  for (let __i = 0; __i < this.__for0_nodes.length; __i++) {
    this.__for0_nodes[__i].childNodes[1].textContent =
      (this.__for0_items[__i].name + ' - ' + this._state.externalValue) ?? '';
  }
  break;
```

For a show binding referencing an external signal:
```js
case 'showExternal':
  for (let __i = 0; __i < this.__for0_nodes.length; __i++) {
    this.__for0_nodes[__i].childNodes[3].style.display =
      (this._state.showExternal) ? '' : 'none';
  }
  break;
```

For an attr binding:
```js
case 'hrefValue':
  for (let __i = 0; __i < this.__for0_nodes.length; __i++) {
    const __v = this._state.hrefValue;
    if (__v || __v === '') {
      this.__for0_nodes[__i].childNodes[4].setAttribute('href', __v);
    } else {
      this.__for0_nodes[__i].childNodes[4].removeAttribute('href');
    }
  }
  break;
```

#### Path Expression Resolution

Each binding inside forBlock items has a `path` that describes how to reach the DOM node relative to the item root. The in-place update uses `this.__for_N_nodes[__i].` + path to reference the specific node:

```js
// Path: ['childNodes[0]'] → this.__for0_nodes[__i].childNodes[0]
// Path: ['childNodes[1]', 'childNodes[0]'] → this.__for0_nodes[__i].childNodes[1].childNodes[0]
```

### 5. Keyed Reconciliation

The `__renderEach_N()` method implements keyed reconciliation when the `:key` expression is present.

#### Data Structures

```js
// Per each-block, on the component instance:
this.__for0_nodes = [];     // HTMLElement[] — current DOM nodes in order
this.__for0_items = [];     // any[] — captured item values per node
this.__for0_keyMap = null;  // Map<key, {node, itemData}> | null — for keyed loops only
```

#### Keyed RenderEach Method

```js
__renderEach_0() {
  const __source = this._state.items;
  const __iter = (__source || []);
  const __oldMap = this.__for0_keyMap || new Map();
  const __newMap = new Map();
  const __newNodes = [];
  const __newItems = [];

  __iter.forEach((item, idx) => {
    const __key = item.id; // key expression
    if (__oldMap.has(__key)) {
      // Reuse existing node — recreate to avoid stale closures
      const oldNode = __oldMap.get(__key).node;
      oldNode.remove();
      const clone = this.__for0_tpl.content.cloneNode(true);
      const node = clone.firstChild;
      // Internal bindings for the reused node
      node.childNodes[0].textContent = item.name ?? '';
      node.childNodes[2].addEventListener('click', () => this._remove(item.id));
      __newMap.set(__key, node);
      __newNodes.push(node);
      __newItems.push(item);
      __oldMap.delete(__key);
    } else {
      // Create new node
      const clone = this.__for0_tpl.content.cloneNode(true);
      const node = clone.firstChild;
      node.childNodes[0].textContent = item.name ?? '';
      node.childNodes[2].addEventListener('click', () => this._remove(item.id));
      __newMap.set(__key, node);
      __newNodes.push(node);
      __newItems.push(item);
    }
  });

  // Remove nodes with keys no longer in the source
  for (const { node } of __oldMap.values()) node.remove();

  // Insert all nodes in order before the anchor
  for (const n of __newNodes) {
    this.__for0_anchor.parentNode.insertBefore(n, this.__for0_anchor);
    customElements.upgrade(n);
  }

  this.__for0_nodes = __newNodes;
  this.__for0_items = __newItems;
  this.__for0_keyMap = __newMap;
}
```

**Important:** The BUG-0012 workaround (destroy-and-recreate for reused nodes) is preserved because each node's bindings are set up at creation time with closures capturing the current item/index. Re-using the old node would require updating closures, which is impossible — closures are immutable. Destroy-and-recreate is the correct approach.

### 6. Non-Keyed Reconciliation

Simpler than keyed: destroy all existing nodes, recreate from scratch.

```js
__renderEach_0() {
  const __source = this._state.items;
  const __iter = (__source || []);

  for (const n of this.__for0_nodes) n.remove();
  this.__for0_nodes = [];
  this.__for0_items = [];

  __iter.forEach((item, idx) => {
    const clone = this.__for0_tpl.content.cloneNode(true);
    const node = clone.firstChild;
    // Internal bindings
    node.childNodes[0].textContent = item ?? '';
    node.childNodes[1].addEventListener('click', () => this._handleClick(item));
    this.__for0_anchor.parentNode.insertBefore(node, this.__for0_anchor);
    customElements.upgrade(node);
    this.__for0_nodes.push(node);
    this.__for0_items.push(item);
  });
}
```

### 7. Numeric Range

When the source evaluates to a number, items are generated from 1 to N:

```js
const __source = 5; // literal or signal value
const __iter = typeof __source === 'number'
  ? Array.from({ length: __source }, (_, i) => i + 1)
  : (__source || []);
```

### 8. Event Handlers Inside Loop Items

Event handlers that reference the Item_Variable or Index_Variable must capture these values in closures. Each event handler is generated per-item during `__renderEach_N`:

```js
// Template: @click="() => removeItem(item.id)"
node.childNodes[2].addEventListener('click', () => this._removeItem(item.id));
```

For inline event handlers:
```js
// Template: @click="select(item)"
node.childNodes[2].addEventListener('click', (e) => this._select(item));
```

The `generateForEventHandler` function is used to generate the handler expression with the item and index variables scoped to the specific item.

### 9. Nested Each Loops

When an each-block's template contains another each-block, the inner loop is handled as follows:

1. The inner loop gets its own `__renderEach_M()` method
2. Inner loop state (`__for_M_nodes`, `__for_M_items`) is stored per outer item
3. The outer `__renderEach_N()` calls the inner `__renderEach_M()` during item setup

#### Per-Outer-Item State Scoping

Instead of global arrays, nested each state is stored as properties on the outer item's root DOM node:

```js
// During outer each rendering:
__iter.forEach((item, idx) => {
  const clone = this.__for0_tpl.content.cloneNode(true);
  const node = clone.firstChild;

  // Inner each state on the outer item node
  node.__inner0_nodes = [];
  node.__inner0_items = [];

  // Setup inner loop (set anchor, call nested renderEach)
  const innerAnchor = node.childNodes[3]; // anchor comment
  const __innerSource = item.children;    // source from item
  (__innerSource || []).forEach((childItem) => {
    const childClone = this.__for1_tpl.content.cloneNode(true);
    const childNode = childClone.firstChild;
    childNode.textContent = childItem.name ?? '';
    innerAnchor.parentNode.insertBefore(childNode, innerAnchor);
    node.__inner0_nodes.push(childNode);
    node.__inner0_items.push(childItem);
  });

  this.__for0_nodes.push(node);
});
```

#### External Signal In Nested Loops

When an external signal is referenced inside a nested each, the in-place update loop must iterate through all nesting levels:

```js
case 'externalSignal':
  for (let __i0 = 0; __i0 < this.__for0_nodes.length; __i0++) {
    const __outerNode = this.__for0_nodes[__i0];
    for (let __i1 = 0; __i1 < (__outerNode.__inner0_nodes || []).length; __i1++) {
      __outerNode.__inner0_nodes[__i1].childNodes[0].textContent =
        this._state.externalSignal ?? '';
    }
  }
  break;
```

### 10. DepGraph Extension for Each-Loops

The `buildDepGraph` function is extended to:

1. **Source signals**: Register `renderEach` entries for each each-block under the source signal keys
2. **External signals**: For each internal binding that references an external signal, register the binding under that signal's key with the `eachBlockIndex` property
3. **Item-only bindings**: Bindings that reference only `item`/`index` (no signals) are not registered in the depGraph (no invalidation needed — they're set during `__renderEach_N`)

#### Extended DepEntry Type

```ts
interface DepEntry {
  type: 'text' | 'show' | 'attr' | 'bool' | 'class' | 'style'
      | 'computed' | 'renderIf' | 'renderEach' | 'watcher';
  // Existing fields...
  varName?: string;      // DOM node variable name
  expr?: string;         // Transformed expression
  
  // Each-block-specific
  eachBlockIndex?: number;  // Which each-block this entry belongs to
  itemVar?: string;         // Item variable name for expression reconstruction
  indexVar?: string;        // Index variable name
  path?: string[];          // Path from item root node to the binding node
}
```

#### Extended `generateUpdateOp`

```js
case 'text':
  if (entry.eachBlockIndex !== undefined) {
    // In-place update for each-block items
    const itemRef = entry.itemVar ? `this.__for${entry.eachBlockIndex}_items[__i]` : '';
    lines.push(`${indent}for (let __i = 0; __i < this.__for${entry.eachBlockIndex}_nodes.length; __i++) {`);
    // Replace item variable references with __forX_items[__i]
    const exprWithItems = replaceItemVars(entry.expr, entry.itemVar, entry.indexVar, entry.eachBlockIndex);
    lines.push(`${indent}  this.__for${entry.eachBlockIndex}_nodes[__i].textContent = ${wrapTernaryExpr(exprWithItems)} ?? '';`);
    lines.push(`${indent}}`);
  } else {
    // Regular top-level binding
    lines.push(`${indent}this.${entry.varName}.textContent = ${wrapTernaryExpr(entry.expr)} ?? '';`);
  }
  break;
```

### 11. Wildcard Case (`__invalidate('*')`)

The wildcard case is updated to call `__renderEach_N()` for each each-block:

```js
case '*':
  // Computed recalculations (topological order)
  this._state.doubled = this._state.count * 2;
  // If-blocks
  this.__renderIf_0();
  // Each-blocks
  this.__renderEach_0();
  this.__renderEach_1();
  // Simple bindings (deduplicated)
  // ...
  break;
```

### 12. What Stays in `connectedCallback`

The template creation, anchor reference, and state initialization remain:

```js
// ── each: template creation, anchor reference, state init ──
this.__for0_tpl = document.createElement('template');
this.__for0_tpl.innerHTML = `...loop template html...`;
this.__for0_anchor = __root.childNodes[...];
this.__for0_nodes = [];
this.__for0_items = [];
```

The `__effect` wrapper is removed.

### 13. What Stays Unchanged

The following continue using `__effect` in Phase 3:

- **User effects** (`effect()`): Still `__effect`-based — removed in Phase 4
- **Scoped slots**: Still `__effect`-based — migrated in Phase 4
- **Dynamic components**: Still `__effect`-based — migrated in Phase 4
- **Model bindings** (signal → DOM): Still `__effect`-based — migrated in Phase 4
- **Model prop bindings**: Still `__effect`-based — migrated in Phase 4
- **Child component prop bindings**: Still `__effect`-based — migrated in Phase 4

### 14. Generated Output Example

#### Source component

```ts
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-todo-list' })

const items = signal([
  { id: 1, name: 'Buy milk' },
  { id: 2, name: 'Walk dog' },
])
const filterText = signal('')

function removeItem(id) {
  items.set(items().filter(i => i.id !== id))
}
```

```html
<div>
  <input model="filterText" placeholder="Filter..." />
  <ul>
    <li each="item in items()" :key="item.id">
      <span>{{item.name}}</span>
      <span>{{filterText()}}</span>
      <button @click="() => removeItem(item.id)">✕</button>
    </li>
  </ul>
</div>
```

#### Generated Output (after Phase 3)

```js
const __t_WccTodoList = document.createElement('template');
__t_WccTodoList.innerHTML = `<div>
  <input>
  <ul>
    <!--for0-->
  </ul>
</div>`;

const __t_WccTodoList_for0_tpl = document.createElement('template');
__t_WccTodoList_for0_tpl.innerHTML = `<li>
    <span></span>
    <span></span>
    <button>✕</button>
  </li>`;

class WccTodoList extends HTMLElement {
  static __meta = { tag: 'wcc-todo-list', props: [], events: [], models: [], slots: [] };

  constructor() {
    super();
    const self = this;
    this._state = new Proxy(
      { items: [], filterText: '' },
      { set(target, key, value) {
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
    const __root = __t_WccTodoList.content.cloneNode(true);
    this.__model_filterText_0 = __root.childNodes[0].childNodes[1];
    this.__for0_anchor = __root.childNodes[0].childNodes[3];
    this.__for0_tpl = __t_WccTodoList_for0_tpl;
    this.__for0_nodes = [];
    this.__for0_items = [];
    this.innerHTML = '';
    this.appendChild(__root);
    this.__ac = new AbortController();

    // Model event listener (DOM → signal)
    if (this.__model_filterText_0) this.__model_filterText_0.addEventListener(
      'input', (e) => { this._state.filterText = e.target.value; },
      { signal: this.__ac.signal }
    );

    this.__invalidate('*');
  }

  disconnectedCallback() {
    this.__connected = false;
    this.__ac.abort();
  }

  _removeItem(id) {
    // items.set(items().filter(...)) → this._state.items = this._state.items.filter(...)
    this._state.items = this._state.items.filter(i => i.id !== id);
  }

  __renderEach_0() {
    const __source = this._state.items;
    const __iter = (__source || []);

    for (const n of this.__for0_nodes) n.remove();
    this.__for0_nodes = [];
    this.__for0_items = [];

    __iter.forEach((item, idx) => {
      const clone = this.__for0_tpl.content.cloneNode(true);
      const node = clone.firstChild;

      // Text binding: {{item.name}}
      node.childNodes[0].textContent = item.name ?? '';

      // Text binding: {{filterText()}} — external signal, initial value
      node.childNodes[1].textContent = this._state.filterText ?? '';

      // Event handler: @click="() => removeItem(item.id)"
      node.childNodes[2].addEventListener('click', () => this._removeItem(item.id));

      this.__for0_anchor.parentNode.insertBefore(node, this.__for0_anchor);
      customElements.upgrade(node);
      this.__for0_nodes.push(node);
      this.__for0_items.push(item);
    });
  }

  __invalidate(key) {
    if (!this.__connected) return;
    switch(key) {
      case 'items':
        this.__renderEach_0();
        break;
      case 'filterText':
        // In-place update for each-block items
        for (let __i = 0; __i < this.__for0_nodes.length; __i++) {
          this.__for0_nodes[__i].childNodes[1].textContent = this._state.filterText ?? '';
        }
        break;
      case '*':
        this.__renderEach_0();
        this.__text__ = ...; // simple bindings
        break;
    }
  }
}

if (!customElements.get('wcc-todo-list')) customElements.define('wcc-todo-list', WccTodoList);
export default WccTodoList;
```

**Zero runtime.** No `__effect`, no `__signal`, no `__computed`, no `__untrack`.

### 15. Runtime Pruning

After Phase 3, `needsEffect` is further reduced:

```js
const needsEffect = effects.length > 0   // user effects (Phase 4)
  || childComponents.length > 0           // child prop bindings (Phase 4)
  || dynamicComponents.length > 0         // dynamic components (Phase 4)
  || slots.some(s => s.slotProps.length > 0) // scoped slots (Phase 4)
  || modelBindings.length > 0             // model bindings (Phase 4)
  || modelPropBindings.length > 0         // model prop bindings (Phase 4)
  || hasEffectBindings;                   // bindings still referencing methods/etc
```

Components using only simple bindings + if-blocks + computeds + watchers + each loops generate **zero runtime**.

## Files Modified

### `lib/codegen.js`

| Section | Change |
|---|---|
| `buildDepGraph` | Add source and external signal dependency classification for each-blocks |
| `generateUpdateOp` | Add in-place update loop generation for each-block external signals |
| `generateComponent` — connectedCallback | Remove `__effect` for each loops, keep template/anchor init |
| `generateComponent` — new methods | Generate `__renderEach_N()` for each each-block |
| `generateComponent` — `__invalidate` | Add `renderEach` case entries and in-place update loops |
| `generateComponent` — `__invalidate('*')` | Add `__renderEach_N()` calls |
| `generateComponent` — runtime flags | Update `needsEffect` to exclude each loops |
| `generateItemSetup` | Remove `__effect` wrappers for internal bindings (use static assignments) |
| `generateNestedItemSetup` | Same for nested loops |

### New test files

| File | Purpose |
|---|---|
| `lib/codegen.each-no-effect.test.js` | Tests for each-loop migration: `__renderEach_N()`, keyed/non-keyed, external signals, in-place updates |

## Correctness Properties

### Property 1: Output Equivalence
For any component with each loops (no user effects/slots/dynamic), the DOM output after `__invalidate('*')` MUST be identical to the DOM output after all `__effect` callbacks in the pre-Phase-3 model.

### Property 2: No Stale Closures
All event handler closures inside `__renderEach_N()` capture the current `item` and `idx` values at node creation time. This is guaranteed by the let-in-forEach behavior (each iteration creates a new scope).

### Property 3: In-Place Correctness
An external signal in-place update loop ONLY updates existing nodes — it never creates or destroys nodes. Node arrays remain unchanged during in-place updates.

### Property 4: Source Change = Full Reconciliation
When the source signal changes, `__renderEach_N()` destroys and recreates all nodes (non-keyed) or reconciles the key map (keyed). Old nodes are fully removed from DOM.

### Property 5: Empty Source Cleanup
When the source becomes empty, `__renderEach_N()` removes all nodes and clears both `__for_N_nodes` and `__for_N_items`.

### Property 6: Numeric Range Behavior
- Literal number source: fixed at compile time, never changes
- Signal number source: each signal change triggers full reconciliation (like array source)

## Testing Strategy

| Test Type | Coverage |
|---|---|
| Unit: dep-graph | Source vs external signal classification for each-loops |
| Unit: `__renderEach_N` generation | Non-keyed, keyed, numeric range, nested |
| Unit: in-place update loops | Text, show, attr, class, style with external signals |
| Integration: full compile | Each loop variations → verify correct JS output |
| E2E: browser | Each loop rendering, add/remove items, external signal updates |
| Regression: existing tests | All existing each-loop tests updated for new patterns |
