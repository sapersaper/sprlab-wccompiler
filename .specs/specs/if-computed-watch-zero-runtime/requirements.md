# Requirements Document

## Introduction

Phase 2 of the Zero Runtime Refactor for wcCompiler. This phase migrates `if`/`else-if`/`else` blocks, computed values, and watchers away from `__effect`-based patterns to the static `__invalidate(key)` approach established in Phase 1. It assumes Phase 1 (proxy-state-invalidate) is complete — signals are stored in `this._state` via Proxy, and `__invalidate(key)` already exists with cases for simple bindings (text, show, attr, class, style).

After this phase, components that only use simple bindings + if blocks + computed values + watchers (without each loops, user effects, scoped slots, dynamic components, model bindings, or child prop bindings) can fully prune the `__effect` runtime.

## Glossary

- **Codegen**: The code generation module (`lib/codegen.js`) that transforms parsed component data into a self-contained JavaScript Web Component class.
- **Proxy_State**: The `Proxy`-wrapped object (`this._state`) from Phase 1 containing all signal and computed values as plain properties, where the Proxy setter intercepts writes and calls `this.__invalidate(key)`.
- **Invalidate_Method**: The generated instance method (`this.__invalidate(key)`) containing a `switch` statement that maps each signal key to DOM update operations and computed recalculations.
- **Dependency_Graph**: A compile-time mapping from each signal name to the set of DOM nodes, computed recalculations, and watcher invocations that depend on it.
- **If_Block**: A conditional rendering construct (`if`/`else-if`/`else`) that creates or removes DOM subtrees based on a boolean expression.
- **RenderIf_Method**: A generated instance method (`this.__renderIf_N()`) that evaluates the condition for if-block N, performs branch switching (remove old branch, insert new branch), and sets up internal bindings for the active branch.
- **Branch**: One arm of an If_Block (the `if`, an `else-if`, or the `else` clause), each with its own template HTML and internal bindings.
- **Internal_Binding**: A reactive binding (text, show, attr, class, style) that exists inside an If_Block branch and must only be updated when the branch is active (its DOM node exists).
- **Computed_Value**: A derived value declared with `computed(() => expr)` whose result is cached and recalculated when its dependencies change.
- **Computed_Chain**: A sequence of computed values where one depends on another (e.g., A depends on B depends on C), requiring recalculation in topological order.
- **Topological_Order**: An ordering of computed values such that every computed is defined after all computed values it depends on.
- **Signal_Watcher**: A watcher declared with `watch(signalName, (newVal, oldVal) => {...})` that observes a single signal and fires a callback when the signal changes.
- **Getter_Watcher**: A watcher declared with `watch(() => expr, (newVal, oldVal) => {...})` that observes an expression involving one or more signals and fires a callback when the expression result changes.
- **Watcher_Callback**: The user-provided function invoked when a watched value changes, receiving the new and old values as arguments.
- **Effect_Runtime**: The existing `__effect` function that provides dynamic dependency tracking and automatic re-execution (retained for features not yet migrated).
- **Condition_Signal**: A signal referenced in an If_Block's condition expression that determines which branch is active.
- **Old_Value_Tracking**: Per-watcher storage of the previous value on the component instance, used to provide the `oldVal` argument to Watcher_Callbacks.

## Requirements

### Requirement 1: RenderIf Method Generation

**User Story:** As a compiler maintainer, I want each if-block to be rendered by a dedicated `__renderIf_N()` method called from `__invalidate`, so that conditional rendering no longer requires `__effect` overhead.

#### Acceptance Criteria

1. WHEN a component contains one or more If_Blocks, THE Codegen SHALL generate a `__renderIf_N()` instance method for each If_Block (where N is the zero-based index).
2. THE RenderIf_Method SHALL evaluate the condition expressions for all branches of the If_Block in order (if → else-if → else) and determine the active branch index.
3. WHEN the active branch index differs from the previously active branch, THE RenderIf_Method SHALL remove the current branch DOM node and insert the new branch DOM node before the anchor.
4. WHEN a new branch is activated, THE RenderIf_Method SHALL call the branch setup logic to initialize Internal_Bindings and event listeners for that branch.
5. WHEN no branch condition is true and no else branch exists, THE RenderIf_Method SHALL remove the current branch DOM node and set the active branch to null.
6. THE RenderIf_Method SHALL store the active branch index on the component instance to avoid redundant DOM operations on subsequent calls.

### Requirement 2: If-Block Invalidation Integration

**User Story:** As a compiler maintainer, I want `__invalidate` to call `__renderIf_N()` when a condition signal changes, so that if-blocks react to state changes through the static invalidation path.

#### Acceptance Criteria

1. WHEN a Condition_Signal for If_Block N changes, THE Invalidate_Method SHALL include a call to `this.__renderIf_N()` in that signal's case.
2. WHEN multiple If_Blocks depend on the same signal, THE Invalidate_Method SHALL call each corresponding `__renderIf_N()` in that signal's case.
3. WHEN an If_Block condition references multiple signals, THE Invalidate_Method SHALL include the `__renderIf_N()` call in each referenced signal's case.
4. THE Codegen SHALL NOT generate `this.__disposers.push(__effect(() => {...}))` for If_Blocks that are handled by the RenderIf_Method.

### Requirement 3: Internal Bindings Within If-Blocks

**User Story:** As a compiler maintainer, I want bindings inside if-block branches to be updated via `__invalidate` with existence guards, so that internal content stays reactive without `__effect`.

#### Acceptance Criteria

1. WHEN an Internal_Binding inside branch B of If_Block N depends on signal S, THE Invalidate_Method SHALL include an update operation for that binding in signal S's case, guarded by a check that the branch node exists.
2. THE existence guard SHALL verify that `this.__if_N_node` is not null before executing the Internal_Binding update.
3. WHEN a branch is activated, THE RenderIf_Method SHALL set initial values for all Internal_Bindings in that branch from the current state.
4. WHEN the Condition_Signal and an Internal_Binding signal are the same signal, THE Invalidate_Method SHALL first call `__renderIf_N()` (to potentially switch branches), then update Internal_Bindings if the branch node exists.
5. THE Codegen SHALL store DOM references for Internal_Bindings relative to the branch root node using path expressions.

### Requirement 4: Computed Value Static Recalculation

**User Story:** As a compiler maintainer, I want computed values to be recalculated inline within `__invalidate` when their dependencies change, so that computed values no longer require the `__computed` runtime function.

#### Acceptance Criteria

1. WHEN a signal that a Computed_Value depends on changes, THE Invalidate_Method SHALL recalculate the computed value and assign the result to `this._state.computedName`.
2. THE Proxy setter for the computed value's key SHALL trigger `this.__invalidate(computedName)`, which in turn updates any bindings that depend on the computed value.
3. THE Codegen SHALL statically analyze computed dependencies at build time by inspecting which `this._state.*` properties the computed expression reads.
4. THE Codegen SHALL store computed values as regular keys in `this._state` alongside signal values.
5. THE Codegen SHALL NOT generate `__computed()` function calls for computed values that are handled by the Invalidate_Method.
6. WHEN a computed expression reads from `this._state`, THE Codegen SHALL use the raw expression (not a function wrapper) for inline recalculation in the Invalidate_Method.

### Requirement 5: Computed Dependency Chain Resolution

**User Story:** As a compiler maintainer, I want computed values that depend on other computed values to recalculate in the correct order, so that cascading dependencies produce correct results.

#### Acceptance Criteria

1. THE Codegen SHALL analyze the Computed_Chain and determine the Topological_Order of all computed values at compile time.
2. WHEN signal S changes and computed B depends on S, and computed A depends on B, THE Invalidate_Method SHALL recalculate B before A by relying on the Proxy setter cascade (assigning B triggers `__invalidate('B')` which recalculates A).
3. IF a circular dependency is detected among computed values, THEN THE Codegen SHALL emit a compile-time error indicating the cycle.
4. THE Codegen SHALL generate computed initial values in Topological_Order during the initial state setup so that each computed can read its dependencies' values.

### Requirement 6: Signal Watcher Migration

**User Story:** As a compiler maintainer, I want signal watchers to fire directly from the Proxy setter instead of using `__effect` + `__untrack`, so that watchers have zero runtime tracking overhead.

#### Acceptance Criteria

1. WHEN a Signal_Watcher observes signal S, THE Invalidate_Method SHALL invoke the Watcher_Callback in signal S's case after all DOM updates for that signal are complete.
2. THE Invalidate_Method SHALL pass the new value (`this._state.S`) and the old value (from Old_Value_Tracking) to the Watcher_Callback.
3. THE Codegen SHALL generate Old_Value_Tracking storage (`this.__prev_S`) initialized to the signal's initial value in the constructor.
4. THE Invalidate_Method SHALL update the Old_Value_Tracking storage after invoking the Watcher_Callback.
5. THE Codegen SHALL NOT generate `this.__disposers.push(__effect(() => {...}))` for Signal_Watchers that are handled by the Invalidate_Method.
6. WHEN the new value equals the old value, THE Invalidate_Method SHALL NOT invoke the Watcher_Callback (the Proxy setter already guards against same-value assignments, but this provides defense-in-depth for computed-triggered watchers).

### Requirement 7: Getter Watcher Migration

**User Story:** As a compiler maintainer, I want getter watchers to be invoked from `__invalidate` for each signal the getter expression reads, so that expression-based watchers work without `__effect`.

#### Acceptance Criteria

1. THE Codegen SHALL statically analyze which signals a Getter_Watcher expression reads at compile time.
2. WHEN any signal that the getter expression reads changes, THE Invalidate_Method SHALL re-evaluate the getter expression and compare the result to the stored old value.
3. WHEN the re-evaluated getter result differs from the old value, THE Invalidate_Method SHALL invoke the Watcher_Callback with the new and old values.
4. THE Codegen SHALL generate Old_Value_Tracking storage (`this.__prev_watchN`) initialized to the getter expression's initial value.
5. THE Invalidate_Method SHALL update the Old_Value_Tracking storage after comparison regardless of whether the callback was invoked.
6. THE Codegen SHALL NOT generate `this.__disposers.push(__effect(() => {...}))` for Getter_Watchers that are handled by the Invalidate_Method.

### Requirement 8: Watcher Execution Order

**User Story:** As a compiler maintainer, I want watchers to fire after DOM updates within the same invalidation cycle, so that watcher callbacks can safely read the updated DOM.

#### Acceptance Criteria

1. WITHIN a single `__invalidate(key)` case, THE Invalidate_Method SHALL execute all DOM update operations before invoking any Watcher_Callbacks for that key.
2. WHEN a Watcher_Callback writes to a signal (triggering a new invalidation), THE Proxy_State SHALL process the new invalidation after the current watcher completes (no re-entrancy within the same case).
3. WHEN multiple watchers observe the same signal, THE Invalidate_Method SHALL invoke them in declaration order (the order they appear in the source file).

### Requirement 9: Initial Render Integration

**User Story:** As a compiler maintainer, I want the wildcard `__invalidate('*')` call to also render if-blocks and initialize computed values, so that the initial render path remains unified.

#### Acceptance Criteria

1. WHEN `__invalidate('*')` is called, THE Invalidate_Method SHALL call each `__renderIf_N()` method to render the initial branch state.
2. WHEN `__invalidate('*')` is called, THE Invalidate_Method SHALL calculate all computed values in Topological_Order and store them in `this._state`.
3. WHEN `__invalidate('*')` is called, THE Invalidate_Method SHALL initialize Old_Value_Tracking for all watchers with the current signal/expression values without invoking Watcher_Callbacks.
4. THE initial render SHALL produce the same DOM output as the previous `__effect`-based approach for if-blocks, computed-dependent bindings, and watched values.

### Requirement 10: Runtime Pruning Extension

**User Story:** As a compiler maintainer, I want the runtime to exclude `__effect`, `__computed`, and `__untrack` when a component only uses features covered by Phase 1 and Phase 2, so that the generated output is minimal.

#### Acceptance Criteria

1. WHEN a component has no each loops, no user effects, no scoped slots, no dynamic components, no model bindings, and no child prop bindings, THE Codegen SHALL NOT include `__effect` in the inlined runtime.
2. WHEN a component's computed values are fully handled by the Invalidate_Method, THE Codegen SHALL NOT include `__computed` in the inlined runtime.
3. WHEN a component's watchers are fully handled by the Invalidate_Method, THE Codegen SHALL NOT include `__untrack` in the inlined runtime.
4. WHEN a component requires none of `__effect`, `__computed`, or `__untrack`, THE Codegen SHALL NOT include the runtime globals (`__currentEffect`, `__batchDepth`, `__pendingEffects`).
5. WHEN a component still uses features requiring `__effect` (each loops, user effects, scoped slots, dynamic components, model bindings, child prop bindings), THE Codegen SHALL include the necessary runtime functions alongside the Invalidate_Method.

### Requirement 11: Backward Compatibility for Remaining Effect-Based Features

**User Story:** As a compiler maintainer, I want features not covered by this phase to continue working with `__effect` while coexisting with the new invalidation-based if-blocks, computed values, and watchers.

#### Acceptance Criteria

1. WHILE a component uses each loops, THE Codegen SHALL continue generating `__effect`-based rendering for those loops.
2. WHILE a component uses user-defined effects, THE Codegen SHALL continue generating `__effect` calls for those effects.
3. WHILE a component uses scoped slots, THE Codegen SHALL continue generating `__effect`-based slot rendering.
4. WHILE a component uses dynamic components, THE Codegen SHALL continue generating `__effect`-based dynamic component logic.
5. WHILE a component uses child component prop bindings, THE Codegen SHALL continue generating `__effect`-based attribute propagation.
6. WHILE a component uses model bindings, THE Codegen SHALL continue generating `__effect`-based model synchronization.
7. WHEN a component mixes invalidation-based features (if, computed, watch) with effect-based features (each, user effects), THE Codegen SHALL generate both the Invalidate_Method and the `__effect` runtime without conflict.

### Requirement 12: Computed Dependency Analysis

**User Story:** As a compiler maintainer, I want the codegen to statically determine which signals each computed value depends on, so that recalculation is triggered from the correct `__invalidate` cases.

#### Acceptance Criteria

1. WHEN a computed expression contains a direct reference to `this._state.signalName`, THE Codegen SHALL register that computed under the signal's key in the Dependency_Graph.
2. WHEN a computed expression references multiple signals, THE Codegen SHALL register the computed recalculation under each signal's key.
3. WHEN a computed expression references another computed value via `this._state.computedName`, THE Codegen SHALL NOT register a direct dependency on the upstream computed's source signals (the cascade is handled by the Proxy setter triggering `__invalidate` for the intermediate computed).
4. WHEN a computed expression calls a method that internally reads signals, THE Codegen SHALL NOT attempt to trace through the method (such computed values remain in `__effect` for this phase).
5. THE dependency analysis SHALL operate on the parsed expressions available at compile time without executing any code.

### Requirement 13: If-Block Event Listener Management

**User Story:** As a compiler maintainer, I want event listeners inside if-block branches to be properly attached when a branch activates and cleaned up when it deactivates, so that there are no memory leaks or stale handlers.

#### Acceptance Criteria

1. WHEN a branch is activated, THE RenderIf_Method SHALL attach all event listeners defined in that branch's template to the newly created DOM nodes.
2. WHEN a branch is deactivated (its DOM node is removed), THE event listeners SHALL be implicitly cleaned up by DOM node removal (no explicit removeEventListener needed since the node is discarded).
3. THE Codegen SHALL generate event handler expressions for if-block branches using the same transformation logic as top-level event handlers.
4. WHEN an event handler inside a branch writes to a signal, THE Proxy_State SHALL trigger `__invalidate` normally, which may cause the if-block to switch branches.

### Requirement 14: Nested If-Blocks and Computed Interactions

**User Story:** As a compiler maintainer, I want if-blocks whose conditions depend on computed values to re-evaluate when the computed value changes, so that derived conditions work correctly in the invalidation model.

#### Acceptance Criteria

1. WHEN an If_Block condition references a Computed_Value, THE Invalidate_Method SHALL include a call to `__renderIf_N()` in the computed value's case (triggered after the computed is recalculated).
2. WHEN a computed value changes and an Internal_Binding also depends on that computed value, THE Invalidate_Method SHALL update the Internal_Binding in the computed value's case with the appropriate existence guard.
3. THE ordering within a single `__invalidate` case SHALL be: computed recalculations first, then `__renderIf_N()` calls, then Internal_Binding updates, then Watcher_Callbacks.
