# Implementation Plan: advanced-features-zero-runtime

## Overview

Phase 4 (final) migrates all remaining `__effect`-based features to `__invalidate`: model bindings, child prop bindings, scoped slots, dynamic components. Also removes `effect()`, refactors batch to per-component, and eliminates the reactive runtime entirely.

## Prerequisites

Phases 1, 2, and 3 must be complete — `this._state` Proxy, `__invalidate(key)`, `__renderIf_N()`, computed inline, watcher inline, `__renderEach_N()` all work.

## Tasks

- [ ] 1. Migrate model bindings (signal→DOM) to `__invalidate`
  - [ ] 1.1 Extend `buildDepGraph` to classify model bindings: for each `modelBinding`, register `{ type: 'modelValue'|'modelCheckbox'|'modelRadio', varName, signal }` under the signal key
  - [ ] 1.2 Extend `generateUpdateOp` to handle `modelValue`, `modelCheckbox`, `modelRadio` types
  - [ ] 1.3 Remove `__effect` wrappers from model bindings in connectedCallback (keep event listeners)
  - [ ] 1.4 Add model binding updates to `__invalidate('*')` wildcard case
  - [ ] 1.5 Verify model bindings inside if-blocks (guarded) and each-blocks (per-item) still work
  - [ ] 1.6 Update model-related tests

- [ ] 2. Migrate model prop bindings (`model:propName`) to `__invalidate`
  - [ ] 2.1 Extend `buildDepGraph` to classify model prop bindings: register `{ type: 'modelProp', varName, attr }` under the signal key
  - [ ] 2.2 Extend `generateUpdateOp` to handle `modelProp` type: emit `setAttribute` call
  - [ ] 2.3 Remove `__effect` wrapper for model prop bindings in connectedCallback
  - [ ] 2.4 Keep `wcc:model` event listener in connectedCallback (child→parent sync)
  - [ ] 2.5 Support null/undefined handling: `removeAttribute` when value is null
  - [ ] 2.6 Update model prop binding tests

- [ ] 3. Migrate child component prop bindings to `__invalidate`
  - [ ] 3.1 Extend `buildDepGraph` to classify child prop bindings: for each `propBinding`, extract deps and register `{ type: 'childProp', varName, attr, expr }` under each signal key
  - [ ] 3.2 Extend `generateUpdateOp` to handle `childProp` type with existence guard for dynamic components
  - [ ] 3.3 Remove `__effect` wrappers from child prop bindings in connectedCallback
  - [ ] 3.4 Handle null/false/true values: `removeAttribute` vs `setAttribute(..., '')`
  - [ ] 3.5 Update child prop binding tests

- [ ] 4. Migrate scoped slots to `__invalidate`
  - [ ] 4.1 Extend `buildDepGraph` to classify scoped slot deps: for each slot prop, extract signal deps and register `{ type: 'scopedSlot', varName, slotName, slotPropsExpr }`
  - [ ] 4.2 Extend `generateUpdateOp` to handle `scopedSlot` type:
    - Emit slotProps object creation
    - Emit `this.__slotProps[slotName] = __props`
    - Emit `wcc:slot-update` CustomEvent dispatch
    - Emit renderer call or template token replacement
  - [ ] 4.3 Remove `__effect` wrapper from scoped slots in connectedCallback
  - [ ] 4.4 Update scoped slot tests

- [ ] 5. Migrate dynamic components to `__renderDynamic_N()`
  - [ ] 5.1 Create `generateRenderDynamicMethod(lines, dyn, dynIndex, signalNames, computedNames, ...)` that emits `__renderDynamic_N()` method:
    - Evaluate tag expression
    - Early return if tag unchanged
    - Remove old element
    - Create new element with `document.createElement(__tag)`
    - Set initial prop values (static assignments, no `__effect`)
    - Attach event listeners
    - Insert before anchor, `customElements.upgrade(el)`
  - [ ] 5.2 Extend `buildDepGraph` to register `{ type: 'renderDynamic', dynIndex }` under tag signal deps
  - [ ] 5.3 For dynamic component prop bindings, register external signal entries with `dynGuard: true` (existence guard)
  - [ ] 5.4 Remove `__effect` wrappers from dynamic components in connectedCallback
  - [ ] 5.5 Add `__renderDynamic_N()` calls to `__invalidate('*')` wildcard case
  - [ ] 5.6 Add dynamic component cleanup in disconnectedCallback (per-element AbortControllers)
  - [ ] 5.7 Update dynamic component tests

- [ ] 6. Remove `effect()` API
  - [ ] 6.1 Add compile-time error in `compile()` or `generateComponent()` when `effects.length > 0`
  - [ ] 6.2 Error message: "effect() has been removed. Use watch() for reactive side effects."
  - [ ] 6.3 Update imports/exports in `lib/wcc.js` to remove `effect` from the public API
  - [ ] 6.4 Update any tests that use `effect()` — migrate to `watch()` or remove

- [ ] 7. Refactor batch mechanism
  - [ ] 7.1 Add `this.__batching = false` and `this.__batchKeys = new Set()` to constructor init
  - [ ] 7.2 Update Proxy set trap to collect keys when `self.__batching` is true:
    ```js
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
    ```
  - [ ] 7.3 Generate `__batch(fn)` instance method if `usesBatch` is true:
    ```js
    __batch(fn) {
      this.__batching = true;
      try { fn(); } finally {
        this.__batching = false;
        for (const key of this.__batchKeys) this.__invalidate(key);
        this.__batchKeys.clear();
      }
    }
    ```
  - [ ] 7.4 Ensure `batch(...)` → `this.__batch(...)` transform in `transformMethodBody`
  - [ ] 7.5 Remove `__batch` from runtime imports (both inline and shared)
  - [ ] 7.6 Remove `__batchDepth` and `__pendingEffects` from globals (no longer needed)
  - [ ] 7.7 Update batch tests

- [ ] 8. Full runtime elimination
  - [ ] 8.1 Set `needsEffect = false` (all features migrated)
  - [ ] 8.2 Proxy: remove `get` trap entirely (no `__currentEffect`, no subscribers)
  - [ ] 8.3 Remove `this.__disposers = []` initialization
  - [ ] 8.4 Remove `this.__disposers.forEach(d => d())` from disconnectedCallback
  - [ ] 8.5 Remove `runtimeGlobals` inclusion when `needsBatch` was the only reason
  - [ ] 8.6 Verify NO component generates `__effect`, `__signal`, `__computed`, `__untrack`, or runtime globals
  - [ ] 8.7 Update `buildInlineRuntime` to handle new needsBatch=false

- [ ] 9. Update existing tests
  - [ ] 9.1 Update all tests to expect NO `__effect` or `__disposers` in any component
  - [ ] 9.2 Update tests for model bindings (output in `__invalidate`, not connectedCallback)
  - [ ] 9.3 Update tests for dynamic components (expect `__renderDynamic_N()`)
  - [ ] 9.4 Update tests for scoped slots (output in `__invalidate`)
  - [ ] 9.5 Update batch tests (per-component `__batch()`)

- [ ] 10. Run final test suite and fix regressions
  - [ ] 10.1 Run `npm test` and identify all failing tests
  - [ ] 10.2 Fix all regressions systematically
  - [ ] 10.3 Verify E2E tests pass (should fix all 3 pre-existing `effect()`/`batch()` failures)
  - [ ] 10.4 Verify example components compile and run correctly
  - [ ] 10.5 Verify zero runtime output for all components

## Task Dependency Graph

```json
{
  "waves": [
    [1, 2, 3],
    [4, 5],
    [6, 7],
    [8],
    [9, 10]
  ]
}
```

## Notes

- Tasks 1, 2, 3 can be worked on in parallel (model bindings, model prop bindings, child props)
- Tasks 4, 5 depend on 1-3 (share the same `generateUpdateOp` extension pattern)
- Task 6 (effect removal) can be done at any time — it's a hard error, no migration needed
- Task 7 (batch refactoring) depends on removing the proxy get trap (task 8)
- Task 8 (runtime elimination) must be done AFTER all features are migrated
- Tasks 9, 10 should be done last as they validate all changes
- This phase resolves the 3 remaining E2E failures (effect/batch tests will pass after tasks 6, 7, 8)
