# Implementation Plan: proxy-state-invalidate

## Overview

Implementation of the Proxy-based state container and static `__invalidate(key)` method to replace `__signal` + `__effect` for simple bindings (text, show, attr, class, style). This eliminates runtime dependency tracking overhead for the majority of bindings while maintaining backward compatibility for complex features.

## Tasks

- [x] 1. Create `extractDeps` and `buildDepGraph` utility functions
  - [ ] 1.1 Create the `extractDeps(rawExpr, signalNames, propNames, modelDefs)` function in `lib/codegen.js` that scans a raw expression for known signal/prop/model names using regex and returns a `Set` of dependency keys
  - [ ] 1.2 Create the `refsComputedOrMethod(rawExpr, computedNames, methodNames)` helper that returns `true` if an expression references any computed value or method call
  - [ ] 1.3 Create the `buildDepGraph(parseResult, transformContext)` function that iterates over `bindings`, `showBindings`, and `attrBindings`, classifies each as eligible for `__invalidate` or remaining in `__effect`, and returns `{ depGraph, effectBindings }`
  - [ ] 1.4 Handle text bindings: skip `computed` type, skip constant function bindings, skip expressions referencing computeds/methods, extract deps and build `DepEntry` with `type: 'text'`
  - [ ] 1.5 Handle show bindings: skip expressions referencing computeds/methods, extract deps and build `DepEntry` with `type: 'show'`
  - [ ] 1.6 Handle attr bindings: skip expressions referencing computeds/methods, extract deps, determine `subKind` (object/array/string) for class/style, and build `DepEntry` with appropriate type
  - [ ] 1.7 Write unit tests in `test/dep-graph.test.js` covering single-signal text binding, multi-signal expression, show binding, attr/bool/class/style bindings, and computed-referencing expressions that should be excluded

- [x] 2. Modify `transformExpr` for signal reads
  - [ ] 2.1 In `transformExpr`, change the signal read regex replacement from `this._${name}()` to `this._state.${name}` for both `callRe` (matching `name()`) and `bareRe` (matching bare `name`)
  - [ ] 2.2 Change prop read output from `this._s_${propName}()` to `this._state.${propName}`
  - [ ] 2.3 Change model read output from `this._m_${propNameVal}()` to `this._state.${propNameVal}`
  - [ ] 2.4 Ensure computed reads (`this._c_doubled()`) remain unchanged — verify the computed regex path is not affected
  - [ ] 2.5 Update existing `transformExpr` unit tests to expect the new `this._state.x` output pattern

- [x] 3. Modify `transformMethodBody` for signal writes
  - [ ] 3.1 Change the signal write regex in `transformMethodBody` from `this._${name}(val)` to `this._state.${name} = val` by capturing the argument with `([^)]+)` and replacing with `this._state.${name} = $1`
  - [ ] 3.2 Ensure signal reads within method bodies also use `this._state.${name}` (the read regex should already be updated from Task 2's pattern)
  - [ ] 3.3 Verify that model writes (`varName.set(...)`) remain unchanged — they must still call `this._modelSet_propName(...)` for event emission
  - [ ] 3.4 Update existing `transformMethodBody` unit tests to expect `this._state.x = val` for signal writes and `this._state.x` for signal reads

- [x] 4. Generate Proxy state container in constructor
  - [ ] 4.1 In `generateComponent`, replace the `__signal()` constructor calls with a single `this._state = new Proxy({...}, handler)` block that collects initial values from props, user signals, and model definitions
  - [ ] 4.2 Generate the `set` trap that checks `target[key] === value` for equality, assigns the value, and calls `self.__invalidate(key)`
  - [ ] 4.3 Conditionally generate the `get` trap (for `__currentEffect` tracking) only when `needsEffect` is true (component has complex features)
  - [ ] 4.4 When the `get` trap is included, generate the subscription tracking logic (`target.__subs`) and modify the `set` trap to notify effect subscribers before calling `self.__invalidate(key)`
  - [ ] 4.5 Remove all `this._s_propName = __signal(...)`, `this._signalName = __signal(...)`, and `this._m_modelName = __signal(...)` lines from constructor output
  - [ ] 4.6 Write unit tests verifying constructor output for a simple component (set-only Proxy) and a complex component (get+set Proxy with effect tracking)

- [x] 5. Generate `__invalidate(key)` method
  - [ ] 5.1 Create `generateInvalidateMethod(depGraph, lines)` function that emits the `__invalidate(key) { switch(key) { ... } }` method
  - [ ] 5.2 For each signal key in the dep graph, generate a `case 'key':` block with the appropriate DOM update operations based on `DepEntry.type` (text, show, attr, bool, class, style)
  - [ ] 5.3 Generate the wildcard `case '*':` block that executes all unique update operations (deduplicated) for initial render
  - [ ] 5.4 Handle multi-signal bindings by emitting the same update code in each dependent signal's case
  - [ ] 5.5 Handle class binding sub-kinds: object (classList.add/remove loop), array (className join), string (className assignment), preserving static class prefixes
  - [ ] 5.6 Handle style binding sub-kinds: object (style[key] = value loop), string (style.cssText assignment), preserving static style prefixes
  - [ ] 5.7 Write unit tests in `test/codegen-invalidate.test.js` verifying generated switch cases for text, show, attr, bool, class (all sub-kinds), style (all sub-kinds), multi-signal, and wildcard

- [x] 6. Modify connectedCallback
  - [ ] 6.1 Remove `this.__disposers.push(__effect(() => {...}))` wrappers for bindings that are now handled by `__invalidate` (those in the dep graph)
  - [ ] 6.2 Add `this.__invalidate('*')` call at the end of connectedCallback after DOM setup and event listeners
  - [ ] 6.3 Keep `this.__disposers.push(__effect(...))` for bindings classified in `effectBindings` (computed-dependent, method-referencing) and for complex features (if/each/watchers/user effects/model/child props/dynamic components/scoped slots)
  - [ ] 6.4 Remove `this.__disposers = []` initialization when no complex features exist (no effect bindings remain)
  - [ ] 6.5 In `disconnectedCallback`, remove `this.__disposers.forEach(d => d())` when no disposers are needed

- [x] 7. Modify attributeChangedCallback and public getters/setters
  - [ ] 7.1 In `attributeChangedCallback`, change prop updates from `this._s_${propName}(newVal ?? default)` to `this._state.${propName} = newVal ?? default`
  - [ ] 7.2 In `attributeChangedCallback`, change model updates from `this._m_${modelName}(newVal ?? default)` to `this._state.${modelName} = newVal ?? default`
  - [ ] 7.3 In public getters for props, change `return this._s_${propName}()` to `return this._state.${propName}`
  - [ ] 7.4 In public setters for props, change `this._s_${propName}(val)` to `this._state.${propName} = val`
  - [ ] 7.5 Verify that `this.setAttribute(...)` calls in setters remain unchanged
  - [ ] 7.6 Update related unit tests to expect the new `this._state` patterns in attributeChangedCallback and getter/setter output

- [x] 8. Add Proxy `get` trap for backward compatibility
  - [ ] 8.1 Detect when a component has complex features requiring `__effect` by checking for if blocks, each loops, watchers, user effects, computed-dependent bindings, child component props, model bindings, dynamic components, or scoped slots
  - [ ] 8.2 When complex features are detected, generate the Proxy with both `get` and `set` traps — the `get` trap registers `__currentEffect` as a subscriber in `target.__subs[key]`
  - [ ] 8.3 In the `set` trap for complex components, add subscriber notification logic: iterate `target.__subs[key]` and either add to `__pendingEffects` (if batching) or invoke directly
  - [ ] 8.4 Ensure the `set` trap skips the `__subs` key itself to avoid infinite recursion
  - [ ] 8.5 When no complex features exist, generate the simpler Proxy with only the `set` trap (no `get` trap, no subscriber logic)
  - [ ] 8.6 Write unit tests verifying that a component with an `if` block generates the full get+set Proxy, while a simple component generates set-only Proxy

- [x] 9. Modify `buildInlineRuntime` for runtime pruning
  - [ ] 9.1 Add `needsSignal` parameter to `buildInlineRuntime` in `lib/reactive-runtime.js` (default `false`)
  - [ ] 9.2 Conditionally include `runtimeGlobals` (`__currentEffect`, `__batchDepth`, `__pendingEffects`) only when `needsEffect || needsComputed` is true
  - [ ] 9.3 Conditionally include `runtimeSignal` only when `needsSignal` is true (should be `false` for all Phase 1 components)
  - [ ] 9.4 In `generateComponent`, set `needsSignal = false` and compute `needsEffect` based on presence of complex features or computed-dependent bindings
  - [ ] 9.5 Verify that a simple component (no complex features) generates zero runtime code (no globals, no `__signal`, no `__effect`)
  - [ ] 9.6 Verify that a component with computeds generates `__computed` + globals but no `__signal`

- [x] 10. Update existing tests and add new tests
  - [ ] 10.1 Create `test/codegen-proxy-state.test.js` with end-to-end tests: compile a simple component and verify the full output matches the new Proxy + `__invalidate` pattern (no `__signal`, no `__effect` wrappers)
  - [ ] 10.2 Create a test case for a component with multi-signal text binding (`{{firstName + ' ' + lastName}}`) and verify both signals appear in the dep graph and switch cases
  - [ ] 10.3 Create a test case for a component with complex features (if block + signals) and verify: Proxy has get+set traps, `__effect` is kept for the if block, simple bindings use `__invalidate`, runtime includes `__effect` but not `__signal`
  - [ ] 10.4 Update existing codegen snapshot/assertion tests in `test/` to expect `this._state.x` instead of `this._x()` for reads and `this._state.x = val` instead of `this._x(val)` for writes
  - [ ] 10.5 Add a test verifying `attributeChangedCallback` generates `this._state.propName = newVal ?? default`
  - [ ] 10.6 Add a test verifying `disconnectedCallback` omits `this.__disposers.forEach(d => d())` when no complex features exist
  - [ ] 10.7 Run the full test suite (`npm test`) and fix any regressions caused by the new output patterns

## Task Dependency Graph

```json
{
  "waves": [
    [1, 2, 3],
    [4, 7, 8],
    [5, 6],
    [9],
    [10]
  ]
}
```

## Notes

- Tasks 1, 2, 3 can be worked on in parallel as they are independent foundational changes
- Task 4 depends on Tasks 2 and 3 (needs the new read/write patterns)
- Task 5 depends on Task 1 (needs the dep graph to generate switch cases)
- Task 8 overlaps with Task 4 but focuses specifically on the `get` trap logic for complex components
- Task 10 should be done last as it validates all previous changes together
