# Implementation Plan: each-loops-zero-runtime

## Overview

Migration of `each` loops from `__effect`-based rendering to static `__renderEach_N()` methods called from `__invalidate(key)`. After this phase, components with only simple bindings + if-blocks + computeds + watchers + each loops can fully prune the `__effect`, `__computed`, and `__untrack` runtime.

## Prerequisites

Phases 1 and 2 must be complete — `this._state` Proxy, `__invalidate(key)`, `__renderIf_N()`, computed inline recalculation, and watcher inline invocation all work.

## Tasks

- [x] 1. Extend dependency graph for each-loops
  - [x] 1.1 Extend `buildDepGraph` to classify each-block source signals: iterate `forBlocks`, extract deps from source expression, register `{ type: 'renderEach', eachBlockIndex: N }` entries
  - [x] 1.2 Extend `buildDepGraph` to classify each-block external signals: scan each internal binding for signal references (excluding the source signal and item/index variables), register as in-place update entries under the external signal's key
  - [x] 1.3 Create `extractEachDeps(bindingName, itemVar, indexVar, signalNames, propNames, modelDefs)` helper that extracts signal deps from a binding expression while filtering out item/index variables
  - [x] 1.4 Add `extractForDeps` (similar to `extractDeps` but item/index-aware) to prevent false positives for loop-scoped variables
  - [x] 1.5 Update `DepEntry` typedef with `eachBlockIndex`, `itemVar`, `indexVar`, `path` fields
  - [x] 1.6 Write unit tests in `dep-graph.test.js` for: each-block source dep classification, each-block external signal classification, item-only bindings (no deps), mixed source+external bindings

- [x] 2. Generate `__renderEach_N()` methods — non-keyed
  - [x] 2.1 Create `generateRenderEachMethod(lines, forBlock, eachIndex, signalNames, computedNames, ...)` that emits the `__renderEach_N()` method body
  - [x] 2.2 Generate source expression evaluation with numeric range handling (`typeof __source === 'number'`)
  - [x] 2.3 Generate non-keyed destroy-and-recreate: remove all `__for_N_nodes`, iterate source, clone template, insert before anchor
  - [x] 2.4 Generate static internal bindings: text, show, attr, class, style that reference only item/index (no `__effect`)
  - [x] 2.5 Generate event handlers with closures capturing `item` and `index` per node
  - [x] 2.6 Store nodes in `__for_N_nodes` and item data in `__for_N_items`
  - [x] 2.7 Call `customElements.upgrade(node)` after insertion for child custom elements
  - [x] 2.8 Handle empty source: remove all nodes, clear arrays

- [x] 3. Generate `__renderEach_N()` methods — keyed
  - [x] 3.1 Generate key expression evaluation per item
  - [x] 3.2 Generate keyed reconciliation: compare new keys against `__for_N_keyMap`
  - [x] 3.3 For reused keys: recreate node from template (BUG-0012 fix: stale closures), call internal bindings, update item data
  - [x] 3.4 For new keys: create node from template, call internal bindings
  - [x] 3.5 Remove old nodes for keys no longer in the source
  - [x] 3.6 Insert all nodes in correct order before anchor
  - [x] 3.7 Update `__for_N_nodes`, `__for_N_items`, `__for_N_keyMap`

- [x] 4. Generate in-place update loops in `__invalidate`
  - [x] 4.1 Extend `generateUpdateOp` to handle `eachBlockIndex` field: emit `for (let __i = 0; __i < this.__forN_nodes.length; __i++)` loop
  - [x] 4.2 For each binding type (text, show, attr, bool, class, style), generate the in-place update loop variant
  - [x] 4.3 Handle expressions that reference item variables: replace `item.x` with `this.__forN_items[__i].x`
  - [x] 4.4 Handle expressions that reference index: replace `idx` with `__i`
  - [x] 4.5 Handle expressions that reference only external signals: use `this._state.signalName` directly (no item var replacement needed)
  - [x] 4.6 Ensure path expressions use `this.__forN_nodes[__i].childNodes[j]` for DOM access

- [x] 5. Generate nested each-loop methods
  - [x] 5.1 Generate separate `__renderEach_M()` methods for inner loops (inline forEach inside `generateItemSetup`)
  - [x] 5.2 Scope inner loop state per outer item (inline forEach on item nodes)
  - [x] 5.3 Call inner forEach from outer `__renderEach_N()` during item setup
  - [x] 5.4 Generate nested in-place update loops for external signals
  - [x] 5.5 Handle cleanup of nested loops when outer items are removed

- [x] 6. Update `__invalidate` method generation
  - [x] 6.1 Add `renderEach` case entries in `__invalidate` switch (source signal → `__renderEach_N()`)
  - [x] 6.2 Add in-place update loops for external signal cases
  - [x] 6.3 Update wildcard `'*'` case to call `__renderEach_N()` for each each-block
  - [x] 6.4 Ensure ordering: computeds → renderIf → renderEach → bindings → watchers

- [x] 7. Update connectedCallback
  - [x] 7.1 Remove `__effect` wrappers for each loops (keep template creation, anchor reference, state init)
  - [x] 7.2 Add `this.__for_N_items = []` initialization alongside existing `this.__for_N_nodes = []`

- [x] 8. Update `generateItemSetup` and `generateNestedItemSetup`
  - [x] 8.1 Remove `__effect` wrappers for simple internal bindings (text, show, attr, class, style) — use static assignments
  - [x] 8.2 Keep event listeners as direct `addEventListener` calls (no `__effect`)
  - [x] 8.3 Handle nested if-blocks and for-blocks inside each items (static code)

- [x] 9. Update runtime flag computation
  - [x] 9.1 Update `needsEffect` to exclude `forBlocks`
  - [x] 9.2 Verify that a component with only simple bindings + each loops generates zero runtime

- [x] 10. Update existing tests
  - [x] 10.1 Update `codegen.each.test.js` to expect `__renderEach_0()` instead of `__effect` for each loops
  - [x] 10.2 Update `codegen.test.js` each-loop related assertions
  - [x] 10.3 Update `compiler.if.test.js` and `compiler.sfc.test.js` if they use each loops
  - [x] 10.4 Update any snapshot tests affected by the output changes

- [x] 11. Add new tests
  - [x] 11.1 Each-loop coverage in existing and updated test files
  - [x] 11.2 Integration test coverage via existing compiler tests

- [x] 12. Run full test suite and fix regressions
  - [x] 12.1 Run `npm test` and identify all failing tests
  - [x] 12.2 Update all test expectations to match the new output patterns
  - [x] 12.3 Verify that the E2E tests in `e2e/` — 189 passing, 3 pre-existing `effect()`/`batch()` failures (Phase 4)
  - [x] 12.4 Verify that the example components in `example/` compile and run correctly

## Bugs Fixed

| Bug | Descripción | Fix |
|---|---|---|
| Numeric range | `(5 \|\| [])` returns `5` (truthy), `5.forEach` fails | `typeof __source === 'number'` check before `Array.from` |
| Missing `__invalidate` | Proxy setter calls `self.__invalidate()` but method not generated for depGraph.size=0 | Minimal no-op `__invalidate` for Proxy compatibility |
| Live NodeList anchor | `bnode.childNodes[1]` changes with each insertion (live NodeList) | Anchor captured in variable before forEach loop |
| Nested if templates | Only branch 0 template created | Loop over all branches for template creation |
| Nested forEach anchor | Same live NodeList issue for nested each inside if inside each | Anchor captured in `__anchor_*` variable |
| Empty source cleanup | Old code didn't clear `__forN_items` | `this.__forN_items = []` alongside nodes cleanup |
