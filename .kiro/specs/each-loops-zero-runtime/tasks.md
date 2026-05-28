# Implementation Plan: each-loops-zero-runtime

## Overview

Migration of `each` loops from `__effect`-based rendering to static `__renderEach_N()` methods called from `__invalidate(key)`. After this phase, components with only simple bindings + if-blocks + computeds + watchers + each loops can fully prune the `__effect`, `__computed`, and `__untrack` runtime.

## Prerequisites

Phases 1 and 2 must be complete — `this._state` Proxy, `__invalidate(key)`, `__renderIf_N()`, computed inline recalculation, and watcher inline invocation all work.

## Tasks

- [ ] 1. Extend dependency graph for each-loops
  - [ ] 1.1 Extend `buildDepGraph` to classify each-block source signals: iterate `forBlocks`, extract deps from source expression, register `{ type: 'renderEach', eachBlockIndex: N }` entries
  - [ ] 1.2 Extend `buildDepGraph` to classify each-block external signals: scan each internal binding for signal references (excluding the source signal and item/index variables), register as in-place update entries under the external signal's key
  - [ ] 1.3 Create `extractEachDeps(bindingName, itemVar, indexVar, signalNames, propNames, modelDefs)` helper that extracts signal deps from a binding expression while filtering out item/index variables
  - [ ] 1.4 Add `extractForDeps` (similar to `extractDeps` but item/index-aware) to prevent false positives for loop-scoped variables
  - [ ] 1.5 Update `DepEntry` typedef with `eachBlockIndex`, `itemVar`, `indexVar`, `path` fields
  - [ ] 1.6 Write unit tests in `dep-graph.test.js` for: each-block source dep classification, each-block external signal classification, item-only bindings (no deps), mixed source+external bindings

- [ ] 2. Generate `__renderEach_N()` methods — non-keyed
  - [ ] 2.1 Create `generateRenderEachMethod(lines, forBlock, eachIndex, signalNames, computedNames, ...)` that emits the `__renderEach_N()` method body
  - [ ] 2.2 Generate source expression evaluation with numeric range handling (`typeof __source === 'number'`)
  - [ ] 2.3 Generate non-keyed destroy-and-recreate: remove all `__for_N_nodes`, iterate source, clone template, insert before anchor
  - [ ] 2.4 Generate static internal bindings: text, show, attr, class, style that reference only item/index (no `__effect`)
  - [ ] 2.5 Generate event handlers with closures capturing `item` and `index` per node
  - [ ] 2.6 Store nodes in `__for_N_nodes` and item data in `__for_N_items`
  - [ ] 2.7 Call `customElements.upgrade(node)` after insertion for child custom elements
  - [ ] 2.8 Handle empty source: remove all nodes, clear arrays

- [ ] 3. Generate `__renderEach_N()` methods — keyed
  - [ ] 3.1 Generate key expression evaluation per item
  - [ ] 3.2 Generate keyed reconciliation: compare new keys against `__for_N_keyMap`
  - [ ] 3.3 For reused keys: recreate node from template (BUG-0012 fix: stale closures), call internal bindings, update item data
  - [ ] 3.4 For new keys: create node from template, call internal bindings
  - [ ] 3.5 Remove old nodes for keys no longer in the source
  - [ ] 3.6 Insert all nodes in correct order before anchor
  - [ ] 3.7 Update `__for_N_nodes`, `__for_N_items`, `__for_N_keyMap`

- [ ] 4. Generate in-place update loops in `__invalidate`
  - [ ] 4.1 Extend `generateUpdateOp` to handle `eachBlockIndex` field: emit `for (let __i = 0; __i < this.__forN_nodes.length; __i++)` loop
  - [ ] 4.2 For each binding type (text, show, attr, bool, class, style), generate the in-place update loop variant
  - [ ] 4.3 Handle expressions that reference item variables: replace `item.x` with `this.__forN_items[__i].x`
  - [ ] 4.4 Handle expressions that reference index: replace `idx` with `__i`
  - [ ] 4.5 Handle expressions that reference only external signals: use `this._state.signalName` directly (no item var replacement needed)
  - [ ] 4.6 Ensure path expressions use `this.__forN_nodes[__i].childNodes[j]` for DOM access

- [ ] 5. Generate nested each-loop methods
  - [ ] 5.1 Generate separate `__renderEach_M()` methods for inner loops
  - [ ] 5.2 Scope inner loop state (`__for_M_nodes`, `__for_M_items`) per outer item (on the outer item's root DOM node)
  - [ ] 5.3 Call inner `__renderEach_M()` from outer `__renderEach_N()` during item setup
  - [ ] 5.4 Generate nested in-place update loops for external signals: iterate all nesting levels
  - [ ] 5.5 Handle cleanup of nested loops when outer items are removed

- [ ] 6. Update `__invalidate` method generation
  - [ ] 6.1 Add `renderEach` case entries in `__invalidate` switch (source signal → `__renderEach_N()`)
  - [ ] 6.2 Add in-place update loops for external signal cases
  - [ ] 6.3 Update wildcard `'*'` case to call `__renderEach_N()` for each each-block
  - [ ] 6.4 Ensure ordering: computeds → renderIf → renderEach → bindings → watchers

- [ ] 7. Update connectedCallback
  - [ ] 7.1 Remove `__effect` wrappers for each loops (keep template creation, anchor reference, state init)
  - [ ] 7.2 Add `this.__for_N_items = []` initialization alongside existing `this.__for_N_nodes = []`

- [ ] 8. Update `generateItemSetup` and `generateNestedItemSetup`
  - [ ] 8.1 Remove `__effect` wrappers for simple internal bindings (text, show, attr, class, style) — use static assignments
  - [ ] 8.2 Keep event listeners as direct `addEventListener` calls (no `__effect`)
  - [ ] 8.3 Keep `__effect` wrappers for bindings that reference computeds or methods

- [ ] 9. Update runtime flag computation
  - [ ] 9.1 Update `needsEffect` to exclude `forBlocks`:
    ```js
    const needsEffect = effects.length > 0
      || hasEffectBindings
      || modelBindings.length > 0
      || modelPropBindings.length > 0
      || childComponents.length > 0
      || dynamicComponents.length > 0
      || slots.some(s => s.slotProps.length > 0);
    ```
  - [ ] 9.2 Verify that a component with only simple bindings + each loops generates zero runtime

- [ ] 10. Update existing tests
  - [ ] 10.1 Update `codegen.each.test.js` to expect `__renderEach_0()` instead of `__effect` for each loops
  - [ ] 10.2 Update `codegen.test.js` each-loop related assertions
  - [ ] 10.3 Update `compiler.if.test.js` and `compiler.sfc.test.js` if they use each loops
  - [ ] 10.4 Update any snapshot tests affected by the output changes

- [ ] 11. Add new tests
  - [ ] 11.1 Create `codegen.each-no-effect.test.js` with tests for:
    - Non-keyed each generates `__renderEach_0()` method
    - Keyed each generates `__renderEach_0()` with key reconciliation
    - Numeric range source works
    - External signal in-place updates (text, show, attr)
    - Item variable interpolation in internal bindings
    - Event handler closures capture item/index
    - Wildcard case calls `__renderEach_0()`
    - Source signal change in `__invalidate` calls `__renderEach_0()`
    - Multiple each-blocks each get their own `__renderEach_N()`
  - [ ] 11.2 Add integration test: compile a component with each + if + computed + watch

- [ ] 12. Run full test suite and fix regressions
  - [ ] 12.1 Run `npm test` and identify all failing tests
  - [ ] 12.2 Update all test expectations to match the new output patterns
  - [ ] 12.3 Verify that the E2E tests in `e2e/` still pass
  - [ ] 12.4 Verify that the example components in `example/` compile and run correctly

## Task Dependency Graph

```json
{
  "waves": [
    [1],
    [2, 3],
    [4, 5],
    [6, 7, 8, 9],
    [10, 11],
    [12]
  ]
}
```

## Notes

- Task 1 is foundational — all other tasks depend on the extended dependency graph
- Tasks 2 and 3 can be done in parallel (non-keyed and keyed reconciliation)
- Tasks 4 and 5 depend on 2/3 (need the array/node structures that `__renderEach_N()` sets up)
- Tasks 6, 7, 8, 9 depend on 2-5 and integrate the new patterns
- Tasks 10, 11 update existing tests and add new ones
- Task 12 validates all changes together
- Multi-level nested each loops can be deferred to a follow-up if complexity is high
