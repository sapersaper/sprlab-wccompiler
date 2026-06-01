# Technical Design: if-computed-watch-zero-runtime

## Overview

This design migrates `if`/`else-if`/`else` blocks, computed values, and watchers away from `__effect`-based patterns to the static `__invalidate(key)` approach established in Phase 1. It requires Phase 1 (proxy-state-invalidate) as a prerequisite.

After this phase, components that only use simple bindings + if-blocks + computed values + watchers (without each loops, user effects, scoped slots, dynamic components, model bindings, or child prop bindings) can fully prune the `__effect`, `__computed`, and `__untrack` runtime.

## Architecture

### 1. RenderIf Method Generation

If-blocks currently generate an `__effect` inside `connectedCallback` that evaluates conditions and switches branches. The new approach generates a dedicated `__renderIf_N()` instance method called from `__invalidate` when condition signals change.

#### Current Pattern (connectedCallback effect)

```js
// ── if effects ──
this.__disposers.push(__effect(() => {
  let __branch = null;
  if (this._state.status === 'active') { __branch = 0; }
  else if (this._state.status === 'pending') { __branch = 1; }
  else { __branch = 2; }
  if (__branch === this.__if0_active) return;
  if (this.__if0_current) { this.__if0_current.remove(); this.__if0_current = null; }
  if (__branch !== null) {
    const clone = this.__if0_tpl.content.cloneNode(true);
    const node = clone.firstChild;
    this.__if0_anchor.parentNode.insertBefore(node, this.__if0_anchor);
    this.__if0_setup(node);
    this.__if0_current = node;
  }
  this.__if0_active = __branch;
}));
```

#### New Pattern (`__renderIf_0()` method)

```js
__renderIf_0() {
  let __branch = null;
  if (this._state.status === 'active') { __branch = 0; }
  else if (this._state.status === 'pending') { __branch = 1; }
  else { __branch = 2; }
  if (__branch === this.__if0_active) return;
  if (this.__if0_current) { this.__if0_current.remove(); this.__if0_current = null; }
  if (__branch !== null) {
    const clone = this.__if0_tpl.content.cloneNode(true);
    const node = clone.firstChild;
    this.__if0_anchor.parentNode.insertBefore(node, this.__if0_anchor);
    this.__if0_setup(node);
    this.__if0_current = node;
  }
  this.__if0_active = __branch;
}
```

#### What stays in connectedCallback

Template creation, anchor reference, and state initialization remain:
```js
// ── if: template creation, anchor reference, state init ──
this.__if0_t0 = document.createElement('template');
this.__if0_t0.innerHTML = `...branch0 html...`;
// ... more branches
this.__if0_anchor = __root.childNodes[...]];
this.__if0_current = null;
this.__if0_active = undefined;
```

#### What's removed from connectedCallback

The entire `__effect` wrapper for the if-block is removed. Instead, `__invalidate` calls `__renderIf_0()`:

```js
// In __invalidate('status') case:
case 'status':
  this.__renderIf_0();
  // ... other updates ...
  break;

// In __invalidate('*') case:
case '*':
  this.__renderIf_0();
  // ... all other updates ...
  break;
```

### 2. Internal Bindings Within If-Blocks

Bindings inside if-block branches (text, show, attr, class, style) that reference external signals must be updated in `__invalidate` with an existence guard.

#### Current Pattern

Internal bindings are set up once in the branch's setup method (`__if0_setup(node)`) via `__effect`:

```js
// Inside __if0_setup:
this.__disposers.push(__effect(() => {
  // Only runs when branch is active (node exists)
  node.childNodes[0].textContent = this._state.count ?? '';
}));
this.__disposers.push(__effect(() => {
  node.childNodes[1].style.display = (this._state.visible) ? '' : 'none';
}));
```

#### New Pattern

Internal bindings are moved to `__invalidate` with an existence guard:

```js
// In __invalidate case for 'count':
case 'count':
  if (this.__if0_current) {
    this.__if0_current.childNodes[0].textContent = this._state.count ?? '';
  }
  break;

case 'visible':
  if (this.__if0_current) {
    this.__if0_current.childNodes[1].style.display = (this._state.visible) ? '' : 'none';
  }
  break;
```

#### When Condition_Signal matches Internal_Binding signal

When the same signal is both a condition signal AND referenced in an internal binding, the ordering within `__invalidate` is:

```js
case 'count':
  // 1. First: re-evaluate conditions (may switch branches)
  this.__renderIf_0();
  // 2. Then: update internal bindings with existence guard
  if (this.__if0_current) {
    this.__if0_current.childNodes[0].textContent = this._state.count ?? '';
  }
  break;
```

#### Setup method simplification

The branch setup method (`__if0_setup`) no longer needs `__effect` wrappers for simple bindings. It only needs:
- Event listener attachment (AbortController-based)
- Internal `__renderIf_N` / `__renderEach_N` calls for nested features
- No `this.__disposers` usage for simple internal bindings

```js
__if0_setup(node) {
  // Event listeners only (no __effect wrappers for bindings)
  node.childNodes[0].addEventListener('click', (e) => { this._increment(); }, { signal: this.__ac.signal });
  // Nested if/each setups if present
  if (node.__if0_nested) { /* ... */ }
}
```

#### Path expressions for internal bindings

The `__invalidate` method needs path expressions to reach DOM nodes inside branch subtrees. These paths are relative to the branch root node:

| Binding position | Path expression | Generated access |
|---|---|---|
| Direct child, index 0 | `['childNodes[0]']` | `this.__if0_current.childNodes[0]` |
| Deeper nesting | `['childNodes[1]', 'childNodes[0]']` | `this.__if0_current.childNodes[1].childNodes[0]` |

### 3. Multiple If-Blocks

Each if-block gets its own `__renderIf_N()` method and its own state variables:

```js
// If-block 0
__renderIf_0() { /* ... */ }
__if0_current, __if0_active, __if0_t0, __if0_t1, __if0_anchor

// If-block 1
__renderIf_1() { /* ... */ }
__if1_current, __if1_active, __if1_t0, __if1_anchor
```

#### Multiple if-blocks depending on same signal

```js
case 'status':
  this.__renderIf_0();  // if-block 0 depends on 'status'
  this.__renderIf_1();  // if-block 1 also depends on 'status'
  break;
```

### 4. Nested If-Blocks

If-blocks nested inside other if-blocks are handled as follows:

- Inner if-blocks get their own `__renderIf_M()` methods (global counter)
- Inner if-block state is scoped per outer branch instance
- When the outer branch is activated, `__renderIf_M()` is called from the setup method
- When the outer branch is destroyed, inner if-block state is implicitly cleaned up (DOM removal)

```js
// Outer if-block
__renderIf_0() {
  // ... branch switching logic ...
  if (__branch === 1) {
    // When branch 1 activates, call setup which may call inner __renderIf_1()
    this.__if0_setup(node, 1);
  }
}

__if0_setup(node, branchIdx) {
  // For each nested if-block in this branch:
  // Set up inner anchor and state on the branch node
  node.__if1_current = null;
  node.__if1_active = undefined;
  // Inner renderIf is called from __invalidate when its condition signals change
}

// Inner if-block (condition depends on signal 'role')
__renderIf_1() {
  // Find which outer branch node contains this inner if-block
  // Use outer state to locate the correct node
}
```

**Design Decision:** For simplicity in Phase 2, nested if-blocks will use per-branch-node state storage (properties on the branch DOM node like `node.__if1_current`) rather than component-level arrays. This avoids the complexity of indexing multiple outer instances.

### 5. Computed Value Inline Recalculation

Computed values are migrated from `__computed()` runtime calls to inline recalculation in `__invalidate`.

#### Current Pattern

```js
// Constructor:
this._c_doubled = __computed(() => this._state.count * 2);

// TransformExpr output for {{doubled()}}:
this._c_doubled() ?? ''
// (Computed-type bindings use __effect)
this.__disposers.push(__effect(() => {
  this.__b0.textContent = this._c_doubled() ?? '';
}));
```

#### New Pattern

```js
// Constructor: no __computed call, computed values stored in _state
// (state entries now include computed keys with initial values)
this._state = new Proxy(
  {
    count: 0,
    doubled: 0,  // computed value stored in _state
    // ...
  },
  { /* set trap */ }
);

// In __invalidate case for 'count':
case 'count':
  // 1. Recalculate dependent computed
  this._state.doubled = this._state.count * 2;
  // 2. Render if-blocks that depend on count
  // 3. Update internal bindings
  // 4. Run watchers
  break;

// In __invalidate case for 'doubled' (triggered by Proxy setter cascade):
case 'doubled':
  // Update bindings that depend on doubled
  this.__b0.textContent = this._state.doubled ?? '';
  break;

// In __invalidate('*') case:
case '*':
  // Computed values recalculated FIRST (topological order)
  this._state.doubled = this._state.count * 2;
  // Then if-blocks, then simple bindings, then watchers
  break;
```

#### Proxy Setter Cascade

When `__invalidate('count')` executes `this._state.doubled = count * 2`, the Proxy setter fires:
1. Sets `target.doubled = newValue`
2. Calls `self.__invalidate('doubled')`
3. `__invalidate('doubled')` updates all bindings that depend on `doubled`

This cascade is the key mechanism that avoids explicit chain tracking in `__invalidate`. Each computed value triggers its own invalidation when assigned.

#### Computed expression transform

Computed bodies are transformed from the raw expression to a `this._state.*` form:

| Source computed body | Transformed for inline recalculation |
|---|---|
| `() => count * 2` | `this._state.count * 2` |
| `() => firstName() + ' ' + lastName()` | `this._state.firstName + ' ' + this._state.lastName` |
| `() => items.filter(i => i.active)` | `this._state.items.filter(i => i.active)` |

The `transformExpr` function is used on the computed body expression (without the `() =>` wrapper) to produce the `this._state.*` read form.

### 6. Computed Dependency Analysis

The codegen must statically analyze which signals each computed expression reads at compile time.

#### Dependency extraction

```js
/**
 * Extract computed dependencies from a computed's raw expression body.
 * @param {string} body - The raw computed expression (e.g., "count * 2", "firstName + ' ' + lastName")
 * @param {string[]} signalNames - All signal names
 * @param {string[]} computedNames - All computed names
 * @returns {string[]} - Array of dependency keys
 */
function extractComputedDeps(body, signalNames, computedNames) {
  const deps = [];
  for (const name of signalNames) {
    const re = new RegExp(`\\b${name}\\b`, 'g');
    if (re.test(body)) deps.push(name);
  }
  for (const name of computedNames) {
    const re = new RegExp(`\\b${name}\\b`, 'g');
    if (re.test(body)) deps.push(name);
  }
  // Exclude references to methods, props, etc.
  return deps;
}
```

#### DepGraph extension for computeds

The `DepEntry` type is extended with a new `'computed'` type:

```js
/**
 * @typedef {Object} DepEntry
 * @property {'text'|'show'|'attr'|'bool'|'class'|'style'|'computed'|'renderIf'|'watcher'} type
 * ...
 * @property {string} [computedExpr] - Inline expression for computed recalculation
 * @property {string} [computedName] - Name of computed value to recalculate
 * @property {number} [ifBlockIndex] - If-block index for renderIf type
 * @property {Object} [watcherInfo] - Watcher metadata for watcher type
 */
```

```js
// Computed entry in depGraph:
depGraph.get('count') = [
  { type: 'computed', computedName: 'doubled', computedExpr: 'this._state.count * 2' },
  // ... other bindings that depend on 'count'
];
```

### 7. Computed Topological Ordering

When a computed depends on another computed, they must be recalculated in topological order.

#### Algorithm

```js
/**
 * Compute topological order of computed values.
 * @param {Object[]} computeds - Array of { name, body, deps } objects
 * @returns {string[]} - Computed names in evaluation order
 * @throws {Error} - If circular dependency is detected
 */
function topologicalSortComputeds(computeds) {
  // Build adjacency: computed A → computed B if A's expression references B
  const graph = new Map();  // name → Set<dependency names>
  for (const c of computeds) {
    graph.set(c.name, new Set(c.deps.filter(d => computedNamesSet.has(d))));
  }
  
  // Kahn's algorithm
  const inDegree = new Map();
  for (const [name, deps] of graph) {
    if (!inDegree.has(name)) inDegree.set(name, 0);
    for (const dep of deps) {
      inDegree.set(name, inDegree.get(name) + 1);
    }
  }
  
  const queue = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) queue.push(name);
  }
  
  const result = [];
  while (queue.length > 0) {
    const name = queue.shift();
    result.push(name);
    // Decrease in-degree of dependents
    for (const [other, deps] of graph) {
      if (deps.has(name)) {
        inDegree.set(other, inDegree.get(other) - 1);
        if (inDegree.get(other) === 0) queue.push(other);
      }
    }
  }
  
  if (result.length !== computeds.length) {
    throw new Error('Circular dependency detected among computed values');
  }
  
  return result;
}
```

#### Initial value computation

In the constructor, computed initial values are set in topological order:

```js
constructor() {
  super();
  const self = this;
  this._state = new Proxy({ count: 0, doubled: 0 }, { /* set trap */ });
  // Computed initial values (topological order)
  this._state.doubled = this._state.count * 2;
}
```

But wait — setting `this._state.doubled` in the constructor fires the Proxy setter, which calls `self.__invalidate('doubled')`. The `__invalidate` method checks `if (!this.__connected) return;` at the top, so this is a no-op during construction.

### 8. Signal Watcher Migration

Signal watchers observe a single signal and fire a callback when it changes.

#### Current Pattern

```js
// Constructor: prev-value tracking
this.__prev_count = undefined;

// connectedCallback effect:
this.__disposers.push(__effect(() => {
  const newVal = this._state.count;
  if (this.__prev_count !== undefined && this.__prev_count !== newVal) {
    const oldVal = this.__prev_count;
    __untrack(() => { console.log('count changed:', newVal); });
  }
  this.__prev_count = newVal;
}));
```

#### New Pattern

```js
// Constructor: prev-value tracking
this.__prev_count = 0;  // initialized to signal's initial value

// In __invalidate('count') case:
case 'count':
  // 1. Computed recalculations
  this._state.doubled = this._state.count * 2;
  // 2. Render if-blocks
  this.__renderIf_0();
  // 3. Update bindings
  this.__b0.textContent = this._state.count ?? '';
  if (this.__if0_current) {
    this.__if0_current.childNodes[0].textContent = this._state.count ?? '';
  }
  // 4. Run watchers
  if (this.__prev_count !== undefined && this.__prev_count !== this._state.count) {
    const oldVal = this.__prev_count;
    (function(newVal, oldVal) { console.log('count changed:', newVal); }).call(this, this._state.count, oldVal);
  }
  this.__prev_count = this._state.count;
  break;
```

#### DepGraph extension for watchers

```js
// Watcher entry in depGraph for 'count':
depGraph.get('count') = [
  { type: 'watcher', watcherIndex: 0, kind: 'signal', target: 'count',
    prevName: '__prev_count', callbackExpr: 'console.log(\'count changed:\', newVal)' },
  // ... other entries
];
```

#### Old_Value_Tracking initialization

In the constructor, prev values are initialized to the signal's initial value (for signal watchers) or to the expression result (for getter watchers):

```js
constructor() {
  // ...
  this.__prev_count = 0;  // signal watcher: init to signal's initial value
  this.__prev_watch0 = this._state.firstName + ' ' + this._state.lastName;  // getter watcher: init to expression result
}
```

### 9. Getter Watcher Migration

Getter watchers observe an expression involving one or more signals.

#### Current Pattern

```js
// Constructor:
this.__prev_watch0 = undefined;

// connectedCallback effect:
this.__disposers.push(__effect(() => {
  const newVal = this._state.firstName + ' ' + this._state.lastName;
  if (this.__prev_watch0 !== undefined && this.__prev_watch0 !== newVal) {
    const oldVal = this.__prev_watch0;
    __untrack(() => { console.log('fullName:', newVal); });
  }
  this.__prev_watch0 = newVal;
}));
```

#### New Pattern

```js
// Constructor: prev-value tracking
this.__prev_watch0 = this._state.firstName + ' ' + this._state.lastName;

// The watcher callback is registered in the depGraph for EACH signal the expression reads
// In __invalidate('firstName') case:
case 'firstName':
  // ... computed recalculations, renderIf calls, binding updates ...
  // Getter watcher
  if (this.__prev_watch0 !== undefined) {
    const newVal = this._state.firstName + ' ' + this._state.lastName;
    if (this.__prev_watch0 !== newVal) {
      const oldVal = this.__prev_watch0;
      { console.log('fullName:', newVal); }
      this.__prev_watch0 = newVal;
    }
  }
  break;

// Same watcher also fires from 'lastName' case:
case 'lastName':
  // ... other updates ...
  if (this.__prev_watch0 !== undefined) {
    const newVal = this._state.firstName + ' ' + this._state.lastName;
    if (this.__prev_watch0 !== newVal) {
      const oldVal = this.__prev_watch0;
      { console.log('fullName:', newVal); }
      this.__prev_watch0 = newVal;
    }
  }
  break;
```

**Important:** The same getter watcher fires from multiple signal cases. This is correct — any dependency change triggers re-evaluation. The old-value comparison prevents redundant callback invocations.

#### Watcher callback code generation

The watcher callback body is transformed using `transformMethodBody` to produce imperative code referencing `this._state`:

```js
// Watcher callback source:
(newVal, oldVal) => { console.log('count:', newVal); }

// After transformMethodBody:
{ console.log('count:', newVal); }
```

The callback is wrapped in an IIFE or a plain block that is generated inline:

```js
// Signal watcher inline:
if (this.__prev_count !== undefined && this.__prev_count !== this._state.count) {
  const newVal = this._state.count;
  const oldVal = this.__prev_count;
  console.log('count:', newVal);
}
this.__prev_count = this._state.count;
```

### 10. Watcher Execution Order

Within a single `__invalidate` case, watchers fire AFTER all DOM updates:

```js
case 'count':
  // 1. Computed recalculations (may cascade to more __invalidate calls)
  this._state.doubled = this._state.count * 2;
  
  // 2. If-block re-evaluations
  this.__renderIf_0();
  
  // 3. Simple binding updates
  this.__b0.textContent = this._state.count ?? '';
  if (this.__if0_current) { /* internal binding updates */ }
  
  // 4. Watcher callbacks (after DOM is stable)
  if (this.__prev_count !== undefined && this.__prev_count !== this._state.count) {
    const oldVal = this.__prev_count;
    (function(newVal, oldVal) { console.log('count:', newVal); }).call(this, this._state.count, oldVal);
  }
  this.__prev_count = this._state.count;
  
  break;
```

When a watcher callback writes to a signal, it triggers the Proxy setter → `__invalidate(key)`. Since the Proxy setter is synchronous, the new invalidation is processed immediately after the current case completes. No re-entrancy protection is needed beyond JavaScript's normal synchronous execution model.

### 11. Initial Render (`__invalidate('*')`)

The wildcard case handles initial rendering. It must:
1. Initialize computed values in topological order
2. Call `__renderIf_N()` for all if-blocks
3. Update all simple bindings
4. Initialize old-value tracking without invoking watcher callbacks

#### Wildcard case generation

```js
case '*':
  // ── Computed recalculations (topological order) ──
  this._state.doubled = this._state.count * 2;
  this._state.total = this._state.doubled + 1;
  
  // ── If-blocks (render initial branches) ──
  this.__renderIf_0();
  this.__renderIf_1();
  
  // ── Simple bindings (deduplicated) ──
  this.__b0.textContent = this._state.count ?? '';
  this.__b1.textContent = this._state.firstName ?? '';
  this.__ab0.disabled = !!(this._state.count > 5);
  
  // ── If-block internal bindings (active branches only) ──
  if (this.__if0_current) {
    this.__if0_current.childNodes[0].textContent = this._state.count ?? '';
  }
  
  // ── Watcher old-value initialization (NO callback invocation) ──
  this.__prev_count = this._state.count;
  this.__prev_watch0 = this._state.firstName + ' ' + this._state.lastName;
  
  break;
```

### 12. Runtime Pruning

The `needsEffect` flag is updated to exclude features migrated in Phase 2:

```js
// Phase 2: if-blocks, computeds, and watchers no longer require __effect
const needsEffect = effects.length > 0
  || forBlocks.length > 0       // not yet migrated (Phase 3)
  || childComponents.length > 0  // not yet migrated (Phase 4)
  || dynamicComponents.length > 0// not yet migrated (Phase 4)
  || slots.some(s => s.slotProps.length > 0)  // not yet migrated (Phase 4)
  || modelBindings.length > 0    // not yet migrated (Phase 4)
  || modelPropBindings.length > 0// not yet migrated (Phase 4)
  || hasEffectBindings;          // bindings that still reference computeds/methods

// Computeds are handled inline
const needsComputed = false;  // computeds use inline recalculation

// Watchers are handled inline
const needsUntrack = false;    // watchers use direct comparison in __invalidate
```

#### Runtime size impact

| Feature mix | Before Phase 2 | After Phase 2 |
|---|---|---|
| Simple bindings only | 0 lines | 0 lines |
| + if-blocks | ~25 lines (globals + `__effect`) | 0 lines |
| + computeds | ~35 lines (+ `__computed`) | 0 lines |
| + watchers | ~40 lines (+ `__untrack`) | 0 lines |
| + each loops | ~25 lines | ~25 lines (still needed) |

### 13. Dependency Graph Extension

The `buildDepGraph` function is extended to classify if-block, computed, and watcher dependencies:

```js
function buildDepGraph(parseResult, transformContext) {
  const { depGraph, effectBindings } = existingBuildDepGraph(parseResult, transformContext);
  
  // ── Process if-blocks ──
  for (let idx = 0; idx < ifBlocks.length; idx++) {
    const ifBlock = ifBlocks[idx];
    for (const branch of ifBlock.branches) {
      if (!branch.expression) continue; // else branch (no condition)
      // Extract condition signal dependencies
      const deps = extractDeps(branch.expression, signalNames, propNames, modelDefs);
      for (const dep of deps) {
        addDep(dep, { type: 'renderIf', ifBlockIndex: idx });
      }
      // Process internal bindings within this branch
      for (const b of branch.bindings) {
        if (b.type === 'computed' || refsComputedOrMethod(b.expression, computedNames, methodNames)) {
          continue; // keep in effectBindings for now
        }
        const internalDeps = extractDeps(b.expression, signalNames, propNames, modelDefs);
        for (const dep of internalDeps) {
          addDep(dep, { type: 'text', varName: `this.__if${idx}_current.${pathToExpr(b.path)}`, expr: b.expr });
        }
      }
    }
  }
  
  // ── Process computeds ──
  for (const c of computeds) {
    const deps = extractComputedDeps(c.body, signalNames, computedNames);
    for (const dep of deps) {
      addDep(dep, { type: 'computed', computedName: c.name, computedExpr: transformExpr(c.body, ...) });
    }
  }
  
  // ── Process watchers ──
  for (let idx = 0; idx < watchers.length; idx++) {
    const w = watchers[idx];
    if (w.kind === 'signal') {
      addDep(w.target, { type: 'watcher', watcherIndex: idx, kind: 'signal',
        target: w.target, prevName: `__prev_${w.target}`,
        callbackExpr: transformedBody });
    } else {
      // Getter watcher
      const deps = extractDeps(w.target, signalNames, propNames, modelDefs);
      for (const dep of deps) {
        addDep(dep, { type: 'watcher', watcherIndex: idx, kind: 'getter',
          getterExpr: transformExpr(w.target, ...), prevName: `__prev_watch${idx}`,
          callbackExpr: transformedBody });
      }
    }
  }
  
  return { depGraph, effectBindings };
}
```

### 14. Generated Output Examples

#### Source component

```ts
import { defineComponent, signal, computed, watch } from 'wcc'

export default defineComponent({
  tag: 'wcc-dashboard',
})

const status = signal('active')
const count = signal(0)
const visible = signal(true)

const doubled = computed(() => count() * 2)

watch(count, (newVal, oldVal) => {
  console.log('count:', newVal)
})

watch(() => doubled() > 10, (isHigh) => {
  console.log('doubled is high:', isHigh)
})

function increment() {
  count.set(count() + 1)
}
```

```html
<div>
  <p>Count: {{count()}}</p>
  <p>Doubled: {{doubled()}}</p>

  <div if="status === 'active'">
    <span>Active: {{count()}}</span>
    <button @click="increment">+</button>
  </div>
  <div else-if="status === 'pending'">
    <span>Loading...</span>
  </div>
  <div else>
    <span show="visible">Inactive</span>
  </div>
</div>
```

#### Generated Output (after Phase 2)

```js
const __t_WccDashboard = document.createElement('template');
__t_WccDashboard.innerHTML = `<div>
  <p>Count: <span></span></p>
  <p>Doubled: <span></span></p>
  <!--if0-->
</div>`;

const __t_WccDashboard_if0_b0 = document.createElement('template');
__t_WccDashboard_if0_b0.innerHTML = `<div>
    <span></span>
    <button>+</button>
  </div>`;

const __t_WccDashboard_if0_b1 = document.createElement('template');
__t_WccDashboard_if0_b1.innerHTML = `<div>
    <span>Loading...</span>
  </div>`;

const __t_WccDashboard_if0_b2 = document.createElement('template');
__t_WccDashboard_if0_b2.innerHTML = `<div>
    <span></span>
  </div>`;

class WccDashboard extends HTMLElement {
  static __meta = { tag: 'wcc-dashboard', props: [], events: [], models: [], slots: [] };

  constructor() {
    super();
    const self = this;
    this._state = new Proxy(
      { status: 'active', count: 0, visible: true, doubled: 0 },
      {
        set(target, key, value) {
          if (target[key] === value) return true;
          target[key] = value;
          self.__invalidate(key);
          return true;
        }
      }
    );
    // Computed initial values (topological order)
    this._state.doubled = this._state.count * 2;
    // Watcher old-value tracking
    this.__prev_count = this._state.count;
    this.__prev_watch0 = this._state.doubled > 10;
  }

  connectedCallback() {
    if (this.__connected) return;
    this.__connected = true;
    const __root = __t_WccDashboard.content.cloneNode(true);
    this.__b0 = __root.childNodes[0].childNodes[1].childNodes[1];
    this.__b1 = __root.childNodes[0].childNodes[3].childNodes[1];
    this.__if0_anchor = __root.childNodes[0].childNodes[5];
    // If-block templates
    this.__if0_t0 = __t_WccDashboard_if0_b0;
    this.__if0_t1 = __t_WccDashboard_if0_b1;
    this.__if0_t2 = __t_WccDashboard_if0_b2;
    this.__if0_current = null;
    this.__if0_active = undefined;
    this.innerHTML = '';
    this.appendChild(__root);
    this.__ac = new AbortController();
    this.__invalidate('*');
  }

  disconnectedCallback() {
    this.__connected = false;
    this.__ac.abort();
  }

  _increment() {
    this._state.count = this._state.count + 1;
  }

  __renderIf_0() {
    let __branch = null;
    if (this._state.status === 'active') { __branch = 0; }
    else if (this._state.status === 'pending') { __branch = 1; }
    else { __branch = 2; }
    if (__branch === this.__if0_active) return;
    if (this.__if0_current) { this.__if0_current.remove(); this.__if0_current = null; }
    if (__branch !== null) {
      const clone = this['__if0_t' + __branch].content.cloneNode(true);
      const node = clone.firstChild;
      this.__if0_anchor.parentNode.insertBefore(node, this.__if0_anchor);
      // Setup event listeners for this branch
      if (__branch === 0) {
        node.childNodes[1].addEventListener('click', (e) => { this._increment(); }, { signal: this.__ac.signal });
      }
      this.__if0_current = node;
    }
    this.__if0_active = __branch;
  }

  __invalidate(key) {
    if (!this.__connected) return;
    switch(key) {
      case 'count':
        // Computed recalculations
        this._state.doubled = this._state.count * 2;
        // If-block re-evaluation
        this.__renderIf_0();
        // Simple bindings
        this.__b0.textContent = this._state.count ?? '';
        // Internal bindings (guarded)
        if (this.__if0_current && this.__if0_active === 0) {
          this.__if0_current.childNodes[0].textContent = this._state.count ?? '';
        }
        // Watchers
        if (this.__prev_count !== undefined && this.__prev_count !== this._state.count) {
          const oldVal = this.__prev_count;
          console.log('count:', this._state.count);
        }
        this.__prev_count = this._state.count;
        break;

      case 'doubled':
        // Bindings depending on doubled
        this.__b1.textContent = this._state.doubled ?? '';
        // Watchers (getter watcher on doubled)
        if (this.__prev_watch0 !== undefined) {
          const newVal = this._state.doubled > 10;
          if (this.__prev_watch0 !== newVal) {
            console.log('doubled is high:', newVal);
          }
          this.__prev_watch0 = newVal;
        }
        break;

      case 'status':
        this.__renderIf_0();
        break;

      case 'visible':
        if (this.__if0_current && this.__if0_active === 2) {
          this.__if0_current.childNodes[0].style.display = (this._state.visible) ? '' : 'none';
        }
        break;

      case '*':
        // Computed recalculations (topological order)
        this._state.doubled = this._state.count * 2;
        // If-blocks
        this.__renderIf_0();
        // Simple bindings
        this.__b0.textContent = this._state.count ?? '';
        this.__b1.textContent = this._state.doubled ?? '';
        // Internal bindings
        if (this.__if0_current && this.__if0_active === 0) {
          this.__if0_current.childNodes[0].textContent = this._state.count ?? '';
        }
        if (this.__if0_current && this.__if0_active === 2) {
          this.__if0_current.childNodes[0].style.display = (this._state.visible) ? '' : 'none';
        }
        // Watcher old-value initialization
        this.__prev_count = this._state.count;
        this.__prev_watch0 = this._state.doubled > 10;
        break;
    }
  }
}

if (!customElements.get('wcc-dashboard')) customElements.define('wcc-dashboard', WccDashboard);
export default WccDashboard;
```

**Zero runtime needed.** The generated output uses only native browser APIs: `Proxy`, `HTMLElement`, `AbortController`, `CustomEvent`, `template`, `cloneNode`.

### 15. What Stays Unchanged

The following features continue using `__effect` during Phase 2:

- **Each loops** (`each="item in items"`): Still `__effect`-based — migrated in Phase 3
- **User effects** (`effect(() => {...})`): Still `__effect`-based — removed in Phase 4
- **Scoped slots**: Still `__effect`-based — migrated in Phase 4
- **Dynamic components**: Still `__effect`-based — migrated in Phase 4
- **Model bindings** (signal → DOM): Still `__effect`-based — migrated in Phase 4
- **Model prop bindings** (`model:propName`): Still `__effect`-based — migrated in Phase 4
- **Child component prop bindings**: Still `__effect`-based — migrated in Phase 4

When mixed with Phase 2 features, the component generates both `__invalidate` and `__effect` (with the runtime) without conflict.

### 16. If-Block Event Listener Management

Event listeners inside if-block branches are attached in the `__renderIf_N()` method when a branch is activated:

```js
__renderIf_0() {
  // ... branch switching ...
  if (__branch !== null) {
    const clone = this['__if0_t' + __branch].content.cloneNode(true);
    const node = clone.firstChild;
    this.__if0_anchor.parentNode.insertBefore(node, this.__if0_anchor);
    // Attach event listeners for the active branch
    if (__branch === 0) {
      node.childNodes[1].addEventListener('click', (e) => { this._increment(); }, { signal: this.__ac.signal });
    }
    // For else branch with show binding, no event listeners
    this.__if0_current = node;
  }
  // ...
}
```

When a branch is deactivated, `node.remove()` removes the DOM subtree, which implicitly cleans up all event listeners (the browser's GC handles this — no explicit `removeEventListener` needed). The `AbortController` signal is shared via `this.__ac`, so when the component disconnects, all listeners from all branches are cleaned up.

## Files Modified

### `lib/codegen.js`

| Section | Change |
|---|---|
| `buildDepGraph` | Extend to classify if-blocks, computed, and watcher dependencies |
| `generateComponent` — constructor | Add computed initial values (topological order) to Proxy state |
| `generateComponent` — constructor | Initialize watcher old-value tracking from initial signal values |
| `generateComponent` — connectedCallback | Remove `__effect` for if-blocks, keep template/anchor init |
| `generateComponent` — connectedCallback | Remove `__effect` for computed-dependent bindings (now in `__invalidate`) |
| `generateComponent` — connectedCallback | Remove `__effect` for watchers |
| `generateComponent` — new method | Generate `__renderIf_N()` methods for each if-block |
| `generateComponent` — `__invalidate` | Add computed recalculations, `renderIf` calls, internal bindings, watcher invocations |
| `generateComponent` — `__invalidate` | Update wildcard case with computed init, if-block init, watcher old-value init |
| `generateComponent` — branch setup | Remove `__effect` wrappers from setup methods (just event listeners now) |
| `generateComponent` — runtime flags | Set `needsComputed = false`, `needsUntrack = false`; update `needsEffect` |
| `extractComputedDeps` (new) | Analyze computed dependencies at compile time |
| `topologicalSortComputeds` (new) | Order computed values by dependency for initial render |
| `generateRenderIfMethod` (new) | Emit `__renderIf_N()` method code |

### `lib/reactive-runtime.js`

| Section | Change |
|---|---|
| `buildInlineRuntime` | No changes needed (Phase 2 just flags fewer things as needed) |

### Test files (new/modified)

| File | Purpose |
|---|---|
| `lib/codegen.if-no-effect.test.js` | Verify if-blocks generate `__renderIf_N()` instead of `__effect` |
| `lib/codegen.computed-no-effect.test.js` | Verify computed values use inline recalculation instead of `__computed()` |
| `lib/codegen.watch-no-effect.test.js` | Verify watchers use inline invocation instead of `__effect` + `__untrack` |
| `lib/dep-graph.test.js` | Add tests for if-block, computed, and watcher dependency classification |
| Existing codegen tests | Update expected output patterns |

## Data Models

### Extended DepEntry

```ts
interface DepEntry {
  type: 'text' | 'show' | 'attr' | 'bool' | 'class' | 'style'
      | 'computed' | 'renderIf' | 'watcher';
  varName?: string;         // DOM node reference (for bindings)
  expr?: string;            // Transformed expression
  attr?: string;
  staticValue?: string;
  subKind?: 'object' | 'array' | 'string';
  
  // Computed-specific
  computedName?: string;    // Name of computed value
  computedExpr?: string;    // Inline expression for recalculation
  
  // If-block-specific
  ifBlockIndex?: number;    // Which if-block to re-render
  
  // Watcher-specific
  watcherIndex?: number;    // Which watcher to invoke
  watcherKind?: 'signal' | 'getter';
  target?: string;          // Watched signal name or getter expression
  prevName?: string;        // Old-value tracking variable name
  getterExpr?: string;      // Getter expression for comparison
  callbackExpr?: string;    // Transformed callback body
}
```

### ComputedConfig

```ts
interface ComputedConfig {
  name: string;        // Computed value name
  body: string;        // Raw expression body (without () => wrapper)
  deps: string[];      // Statically extracted dependency signal names
  compDeps: string[];  // Computed-to-computed dependency names
}
```

### WatcherConfig

```ts
interface WatcherConfig {
  kind: 'signal' | 'getter';
  target: string;         // Signal name (for signal) or expression (for getter)
  deps: string[];         // Statically extracted dependency signal names
  prevName: string;       // Instance property name for old-value tracking
  body: string;           // Transformed callback body (writes to this._state)
}
```

## Correctness Properties

### Property 1: Output Equivalence
For any component with if-blocks, computed values, and watchers (no each/user effects/slots/dynamic), the DOM output after `__invalidate('*')` MUST be identical to the DOM output after all `__effect` callbacks have run in the pre-Phase-2 model.

### Property 2: Reactive Correctness
When signal S changes, ALL of the following MUST occur (in order):
1. All computed values that depend on S are recalculated (cascade via Proxy)
2. If-blocks whose conditions reference S or a computed depending on S are re-rendered
3. All DOM bindings that depend on S (or on a computed depending on S) are updated
4. All watchers that observe S are invoked with correct newVal/oldVal

### Property 3: No Redundant DOM Operations
`__renderIf_N()` returns early if the branch index hasn't changed (`__branch === this.__if0_active`).

### Property 4: No Stale Closures
All `__renderIf_N()` methods read from `this._state` (current values), never from captured closure variables.

### Property 5: Branch Cleanup
When an if-block branch is deactivated, the DOM node is removed, which implicitly cleans up all event listeners. No explicit `removeEventListener` calls are needed.

### Property 6: Watcher Correctness
- Signal watchers: Only fire when the observed signal's value actually changes
- Getter watchers: Only fire when the expression result actually changes
- Old values are updated AFTER callback invocation (so callbacks can compare)
- Watchers in the `'*'` case initialize old-value tracking WITHOUT firing callbacks

### Property 7: Computed Chain Consistency
When computed A depends on computed B depends on signal S:
1. `S` changes → `__invalidate('S')` recalculates `B` → Proxy setter → `__invalidate('B')` recalculates `A` → Proxy setter → `__invalidate('A')`
2. This cascade is synchronous, so by the time `__invalidate('S')` returns, all downstream computeds are up to date

### Property 8: No Re-entrancy Issues
When a watcher callback writes to a signal, the Proxy setter calls `__invalidate` synchronously. Since JavaScript is single-threaded, this is safe — the nested `__invalidate` completes before the outer `__invalidate` case continues.

## Error Handling

| Scenario | Handling |
|---|---|
| Circular computed dependency | Compile-time error during `topologicalSortComputeds` |
| Method call inside computed expression | Computed stays in `__effect` (backward compat) |
| `__renderIf_N` called before connectedCallback | Guard `__if0_current = null` → DOM operations check `if (this.__if0_current)` |
| Watcher fires before initial render | Watchers only fire from `__invalidate` signals; `__invalidate('*')` fires AFTER connectedCallback completes |
| Branch node removed externally | `__if0_current` becomes a detached node; next `__renderIf_N()` overwrites it on branch switch |

## Testing Strategy

| Test Type | Coverage |
|---|---|
| Unit: `extractComputedDeps` | Verify correct signal extraction from computed expressions |
| Unit: `topologicalSortComputeds` | Verify correct ordering and circular detection |
| Unit: `buildDepGraph` (extended) | Verify if-block, computed, and watcher deps classified correctly |
| Unit: `__renderIf_N` generation | Verify generated method for single, multi-branch, and nested if-blocks |
| Integration: full compile | Compile sample `.wcc` components with if/computed/watch and verify output |
| E2E: browser | Compile a component, load in browser, verify if-blocks switch, computed values update, watchers fire |
| Regression: existing tests | All existing tests updated to expect new patterns |
