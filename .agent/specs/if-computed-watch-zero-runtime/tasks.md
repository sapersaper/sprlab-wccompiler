# Implementation Plan: if-computed-watch-zero-runtime

## Overview

Migration of `if`/`else-if`/`else` blocks, computed values, and watchers from `__effect`-based patterns to the static `__invalidate(key)` approach established in Phase 1. After this phase, components with only simple bindings + if-blocks + computeds + watchers can fully prune the `__effect`, `__computed`, and `__untrack` runtime.

## Prerequisites

Phase 1 (proxy-state-invalidate) must be complete — `this._state` Proxy and `__invalidate(key)` method exist for simple bindings.

## Tasks

- [x] 1. Extend dependency graph and add computed dependency utilities
  - [x] 1.1 Create `extractComputedDeps(body, signalNames, computedNames)` function that scans a computed's raw expression body for known signal/computed names and returns an array of dependency keys
  - [x] 1.2 Create `topologicalSortComputeds(computeds, computedNamesSet)` function that returns computed names in topological order and throws on circular dependencies
  - [x] 1.3 Extend `buildDepGraph` to classify if-blocks: iterate `ifBlocks`, extract condition deps, register `{ type: 'renderIf', ifBlockIndex: N }` entries in depGraph for each condition signal
  - [x] 1.4 Extend `buildDepGraph` to classify if-block internal bindings: scan each branch's bindings/show/attr for signal references, register with `varName` using `this.__ifN_current.pathExpr` pattern
  - [x] 1.5 Extend `buildDepGraph` to classify computed dependencies: for each computed, extract deps from body and register `{ type: 'computed', computedName, computedExpr }` entries
  - [x] 1.6 Extend `buildDepGraph` to classify watcher dependencies: for signal watchers, add entry under the target signal; for getter watchers, extract deps and add entries under each
  - [x] 1.7 Write unit tests in `dep-graph.test.js` for: if-block condition deps, if-block internal bindings, computed deps (single and multi-signal), signal watcher deps, getter watcher deps, computed-to-computed deps, circular computed detection

- [x] 2. Generate `__renderIf_N()` methods
  - [x] 2.1 Create `generateRenderIfMethod(lines, ifBlock, ifBlockIndex, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames, methodNames, modelVarMap)` function that emits the `__renderIf_N()` method body
  - [x] 2.2 Generate branch condition evaluation in order (if → else-if → else) using `transformExpr` for condition expressions
  - [x] 2.3 Generate early return guard: `if (__branch === this.__ifN_active) return;`
  - [x] 2.4 Generate DOM removal of current branch: `if (this.__ifN_current) { this.__ifN_current.remove(); this.__ifN_current = null; }`
  - [x] 2.5 Generate branch insertion: clone template, insert before anchor, assign to `this.__ifN_current`
  - [x] 2.6 Generate event listener attachment for the active branch (only for elements with event handlers)
  - [x] 2.7 Store active branch index: `this.__ifN_active = __branch;`
  - [x] 2.8 Handle no-branch case: when all conditions are false and no else exists, render nothing
  - [x] 2.9 In `generateComponent`, call `generateRenderIfMethod` for each if-block and place methods after the `__invalidate` method

- [x] 3. Generate computed value inline recalculation in `__invalidate`
  - [x] 3.1 Extend `generateUpdateOp` to handle `type: 'computed'` entries: emit `this._state.computedName = computedExpr;`
  - [x] 3.2 In `generateComponent` constructor, after Proxy creation, emit computed initial values in topological order: `this._state.computedName = initialExpr;`
  - [x] 3.3 Ensure computed initial values are also part of the Proxy state object initial values (set to their default/undefined initial state)
  - [x] 3.4 Verify that the Proxy setter cascade works: assigning `this._state.computedA` triggers `__invalidate('computedA')` which triggers downstream computed recalculations

- [x] 4. Generate watcher invocation in `__invalidate`
  - [x] 4.1 Extend `generateUpdateOp` to handle `type: 'watcher'` entries for signal watchers:
    - Emit old-value comparison: `if (this.__prev_target !== undefined && this.__prev_target !== this._state.target)`
    - Emit callback invocation with newVal/oldVal
    - Emit old-value update: `this.__prev_target = this._state.target;`
  - [x] 4.2 Extend `generateUpdateOp` to handle `type: 'watcher'` entries for getter watchers:
    - Emit expression re-evaluation: `const __val = getterExpr;`
    - Emit comparison: `if (this.__prev_watchN !== __val)`
    - Emit callback invocation with newVal/oldVal
    - Emit old-value update: `this.__prev_watchN = __val;`
  - [x] 4.3 In `generateComponent` constructor, initialize watcher old-value tracking to the signal's initial value or expression result
  - [x] 4.4 Ensure watcher callbacks are transformed using `transformMethodBody` to reference `this._state.*`

- [x] 5. Update `__invalidate` method generation
  - [x] 5.1 Modify the switch case generation loop to include computed recalculations, renderIf calls, and watcher invocations from the extended depGraph
  - [x] 5.2 Ensure proper ordering within each case: computed recalculations → renderIf calls → binding updates → watcher invocations
  - [x] 5.3 For if-block internal bindings, generate existence guard: `if (this.__ifN_current) { ... }`
  - [x] 5.4 Update the wildcard `'*'` case:
    - Computed recalculations in topological order (first)
    - `__renderIf_N()` calls for all if-blocks
    - Simple binding updates (deduplicated)
    - If-block internal binding updates (guarded)
    - Watcher old-value initialization (NO callback invocation)
  - [x] 5.5 Remove the `if (!this.__connected) return;` guard concern — replaced with per-type guarding (non-DOM ops always run, DOM ops guarded)

- [x] 6. Update connectedCallback
  - [x] 6.1 Remove `__effect` wrappers for if-blocks (keep template creation, anchor reference, and state initialization)
  - [x] 6.2 Remove `__effect` wrappers for computed-dependent bindings (they are now in `__invalidate` cases)
  - [x] 6.3 Remove `__effect` wrappers for watchers
  - [x] 6.4 Simplify if-block setup methods (`__ifN_setup`): remove `__effect` wrappers for internal bindings, keep only event listener attachment
  - [x] 6.5 Ensure `this.__invalidate('*')` is still called at the end of connectedCallback

- [x] 7. Update runtime flag computation
  - [x] 7.1 Set `needsComputed = false` (computeds are now handled inline in `__invalidate`)
  - [x] 7.2 Set `needsUntrack = false` (watchers use direct comparison in `__invalidate`)
  - [x] 7.3 Update `needsEffect` to exclude if-blocks, computeds, and watchers:
    - Keep `needsEffect = true` for: each loops, user effects, scoped slots, dynamic components, model bindings, model prop bindings, child prop bindings
    - Remove if-blocks, watchers from the `needsEffect` condition
  - [x] 7.4 Verify that a component with only simple bindings + if-blocks + computeds + watchers generates zero runtime (no `__effect`, no `__computed`, no `__untrack`, no globals)
  - [x] 7.5 Verify that a component mixing migrated features with each loops still generates `__effect` correctly

- [x] 8. Update branch setup methods
  - [x] 8.1 For each if-block branch, remove `this.__disposers.push(__effect(...))` for simple internal bindings (text, show, attr, class, style)
  - [x] 8.2 Keep event listener attachment in setup methods using `this.__ac.signal` (AbortController)
  - [x] 8.3 Keep nested feature setup (inner if-blocks, each loops, dynamic components) that still need `__effect` in the branch
  - [x] 8.4 Update the setup method call from `__renderIf_N()` — pass the active branch node

- [x] 9. Update existing tests
  - [x] 9.1 Update `compiler.if.test.js` to expect `__renderIf_0()` method instead of `__effect` for if-blocks
  - [x] 9.2 Update `codegen.if.test.js` to expect the new pattern (no `__effect` in connectedCallback for if-blocks)
  - [x] 9.3 Update `codegen.test.js` computed tests to expect inline recalculation instead of `__computed()`
  - [x] 9.4 Update `watch-prop.test.js` to expect watcher invocation inside `__invalidate` instead of `__effect` + `__untrack`
  - [x] 9.5 Update any snapshot tests affected by the output changes

- [x] 10. Add new tests
  - [x] 10.1 If-block tests covered by existing `compiler.if.test.js` and `codegen.if.test.js` (updated for Phase 2 patterns)
  - [x] 10.2 Create `codegen.computed-no-effect.test.js` with tests for:
    - Computed value recalculated inline in signal's `__invalidate` case
    - Computed initial value in constructor (topological order)
    - Computed-to-computed dependency chain works via Proxy cascade
    - Computed-dependent binding in `__invalidate` case
  - [x] 10.3 Create `codegen.watch-no-effect.test.js` with tests for:
    - Signal watcher fires in `__invalidate` case
    - Getter watcher fires in dependent signals' cases
    - Old-value tracking initialization in constructor
    - Watcher fires after DOM updates within same case
    - `'*'` case initializes old values without firing callbacks
    - Multiple watchers on same signal fire in declaration order
  - [ ] 10.4 Add integration tests: compile a component with if + computed + watch and verify the full output
  - [ ] 10.5 Add E2E browser tests for if-block switching, computed reactivity, and watcher callback behavior

- [x] 11. Run full test suite and fix regressions
  - [x] 11.1 Run `npm test` and identify all failing tests
  - [x] 11.2 Update all test expectations to match the new output patterns
  - [x] 11.3 Verify that the E2E tests in `e2e/` — 188 passing, 4 pre-existing `effect()`/`batch()` failures (Phase 4 scope)
  - [x] 11.4 Verify that the example components in `example/` compile and run correctly

## Bugs Fixed

| Bug | Descripción | Fix |
|---|---|---|
| Double `_state` | Computed `bareRe` matcheaba `this._state.X` y duplicaba el prefijo | `(?<!\.)` lookbehind en `transformExpr` y `transformForExpr` |
| Method bindings | `{{getCount()}}` no se clasificaba a `effectBindings` porque `b.name` se stripeaba de `()` | `b.type === 'method'` → directo a `effectBindings` |
| Batch globals | `needsBatch` no incluía `runtimeGlobals` (`__pendingEffects`, `__batchDepth`) | Agregado `needsBatch` a condiciones de `buildInlineRuntime` y shared imports |
| `__connected` guard | `__invalidate` retornaba temprano antes de `connectedCallback`, silenciando watchers | Reemplazado con guardia selectiva por tipo (non-DOM ops sin guardia) |

## Task Dependency Graph

```json
{
  "waves": [
    [1],
    [2, 3, 4],
    [5, 6, 7, 8],
    [9, 10],
    [11]
  ]
}
```

## Notes

- Tasks 10.4 and 10.5 (integration + E2E tests for if+computed+watch) are pending — can be added in a follow-up
- 3 tests in `codegen.defineModel-event-names.test.js` are intentionally skipped (camelCase events kept for Angular compatibility)
