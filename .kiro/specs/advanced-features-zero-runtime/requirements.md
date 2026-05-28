# Requirements Document

## Introduction

Phase 4 (final) of the Zero Runtime Refactor for wcCompiler. This phase migrates the remaining `__effect`-based features to the static `__invalidate(key)` approach: model bindings, child component prop bindings, scoped slots, and dynamic components. It also removes the public `effect()` API (breaking change) and eliminates the reactive runtime entirely from generated output.

This phase assumes Phases 1, 2, and 3 are complete — signals are stored in `this._state` via Proxy, `__invalidate(key)` handles simple bindings, if-blocks, computed values, watchers, and each-loops. After this phase, NO component requires `__effect`, `__signal`, `__computed`, or `__untrack` in the generated output. The compiler produces fully static, zero-runtime Web Components using only native browser APIs.

## Glossary

- **Codegen**: The code generation module (`lib/codegen.js`) that transforms parsed component data into a self-contained JavaScript Web Component class.
- **Proxy_State**: The `Proxy`-wrapped object (`this._state`) from Phase 1 containing all signal and computed values as plain properties, where the Proxy setter intercepts writes and calls `this.__invalidate(key)`.
- **Invalidate_Method**: The generated instance method (`this.__invalidate(key)`) containing a `switch` statement that maps each signal key to DOM update operations.
- **Dependency_Graph**: A compile-time mapping from each signal name to the set of DOM operations that depend on it.
- **Model_Binding**: A `model="signalName"` directive that establishes bidirectional synchronization between a signal and a form element's value (text inputs, checkboxes, radios, selects, number inputs).
- **Model_Prop_Binding**: A `model:propName="signalName"` directive that establishes bidirectional synchronization between a parent signal and a child Web Component's attribute, using `wcc:model` events for child-to-parent updates.
- **Child_Prop_Binding**: A `:propName="expr"` binding on a child Web Component element that propagates a parent signal value to the child via `setAttribute`.
- **Scoped_Slot**: A `<slot>` element with bound props that passes data from the component to the slot consumer, using `wcc:slot-update` events and registered slot renderers.
- **Slot_Renderer**: A function registered by the slot consumer (via `registerSlotRenderer`) that receives slot props and re-renders the slot content.
- **Dynamic_Component**: A `<component :is="expr">` element whose tag name is determined by a signal value, requiring creation and destruction of different elements at runtime.
- **RenderDynamic_Method**: A generated instance method (`this.__renderDynamic_N()`) that evaluates the tag expression, destroys the old element if the tag changed, creates the new element, and sets up its prop bindings and event listeners.
- **Batch_Mechanism**: A per-component mechanism where `batch(() => {...})` sets `this.__batching = true`, collects invalidation keys in a Set, and calls `__invalidate` for each collected key once on batch end.
- **Effect_Removal**: The complete removal of the public `effect()` API from the `wcc` module, replaced by `watch()` for reactive side effects.
- **Anchor_Node**: A comment node placed in the DOM as a positional marker for where dynamic component elements are inserted.
- **AbortController_Cleanup**: The use of `AbortController` with `signal` option on event listeners for automatic cleanup when elements are destroyed.
- **Input_Coercion**: The type conversion applied to form element values before writing to state (e.g., `Number()` for number inputs, boolean for checkboxes).

## Requirements

### Requirement 1: Model Binding — Signal to DOM Synchronization

**User Story:** As a compiler maintainer, I want model bindings to update form element values via `__invalidate` instead of `__effect`, so that signal-to-DOM synchronization has zero runtime tracking overhead.

#### Acceptance Criteria

1. WHEN a text input has `model="signalName"`, THE Invalidate_Method SHALL generate `this.__model_N.value = this._state.signalName ?? ''` in the signal's case.
2. WHEN a checkbox has `model="signalName"`, THE Invalidate_Method SHALL generate `this.__model_N.checked = !!this._state.signalName` in the signal's case.
3. WHEN a radio button has `model="signalName"`, THE Invalidate_Method SHALL generate `this.__model_N.checked = (this._state.signalName === radioValue)` in the signal's case, where `radioValue` is the radio element's `value` attribute.
4. WHEN a number input has `model="signalName"`, THE Invalidate_Method SHALL generate `this.__model_N.value = this._state.signalName ?? ''` in the signal's case.
5. WHEN a select element has `model="signalName"`, THE Invalidate_Method SHALL generate `this.__model_N.value = this._state.signalName ?? ''` in the signal's case.
6. THE Codegen SHALL NOT generate `this.__disposers.push(__effect(() => {...}))` for Model_Bindings that are handled by the Invalidate_Method.

### Requirement 2: Model Binding — DOM to Signal Synchronization

**User Story:** As a compiler maintainer, I want model bindings to update the signal via the Proxy setter when the user interacts with the form element, so that DOM-to-signal synchronization triggers the invalidation path.

#### Acceptance Criteria

1. WHEN a text input with `model="signalName"` receives an `input` event, THE event listener SHALL write `this._state.signalName = e.target.value` to trigger invalidation through the Proxy setter.
2. WHEN a checkbox with `model="signalName"` receives a `change` event, THE event listener SHALL write `this._state.signalName = e.target.checked` to trigger invalidation.
3. WHEN a radio button with `model="signalName"` receives a `change` event, THE event listener SHALL write `this._state.signalName = e.target.value` to trigger invalidation.
4. WHEN a number input with `model="signalName"` receives an `input` event, THE event listener SHALL write `this._state.signalName = Number(e.target.value)` to apply Input_Coercion.
5. WHEN a select element with `model="signalName"` receives a `change` event, THE event listener SHALL write `this._state.signalName = e.target.value` to trigger invalidation.
6. THE Codegen SHALL attach model event listeners in `connectedCallback` using AbortController_Cleanup for automatic removal on disconnect.

### Requirement 3: Model Prop Binding — Parent to Child Synchronization

**User Story:** As a compiler maintainer, I want `model:propName` bindings to propagate parent signal values to child component attributes via `__invalidate`, so that parent-to-child model synchronization has zero effect overhead.

#### Acceptance Criteria

1. WHEN a child component has `model:propName="signalName"`, THE Invalidate_Method SHALL generate `this.__child_N.setAttribute('prop-name', this._state.signalName)` in the signal's case.
2. THE Codegen SHALL convert camelCase prop names to kebab-case attribute names when generating `setAttribute` calls.
3. WHEN the signal value is null or undefined, THE Invalidate_Method SHALL call `this.__child_N.removeAttribute('prop-name')` instead of `setAttribute`.
4. THE Codegen SHALL NOT generate `this.__disposers.push(__effect(() => {...}))` for Model_Prop_Bindings that are handled by the Invalidate_Method.

### Requirement 4: Model Prop Binding — Child to Parent Synchronization

**User Story:** As a compiler maintainer, I want `model:propName` bindings to listen for `wcc:model` events from the child and update the parent signal, so that child-to-parent model synchronization triggers the invalidation path.

#### Acceptance Criteria

1. WHEN a child component with `model:propName="signalName"` dispatches a `wcc:model` event, THE event listener SHALL write `this._state.signalName = e.detail.value` to trigger invalidation through the Proxy setter.
2. THE Codegen SHALL attach the `wcc:model` event listener on the child element in `connectedCallback` using AbortController_Cleanup.
3. WHEN the `wcc:model` event detail contains a `prop` field matching the bound prop name, THE event listener SHALL update the corresponding parent signal.
4. WHEN multiple `model:propName` bindings exist on the same child, THE Codegen SHALL generate a single `wcc:model` listener that dispatches to the correct signal based on `e.detail.prop`.

### Requirement 5: Child Component Prop Binding

**User Story:** As a compiler maintainer, I want child component prop bindings (`:propName="expr"`) to be updated via `__invalidate` instead of `__effect`, so that parent-to-child attribute propagation has zero effect overhead.

#### Acceptance Criteria

1. WHEN a child component has `:propName="expr"` and the expression depends on signal S, THE Invalidate_Method SHALL generate `this.__child_N.setAttribute('prop-name', expr)` in signal S's case.
2. WHEN multiple prop bindings on the same child depend on the same signal, THE Invalidate_Method SHALL group all `setAttribute` calls for that child in the same signal case.
3. WHEN a prop binding expression evaluates to null, undefined, or false, THE Invalidate_Method SHALL call `this.__child_N.removeAttribute('prop-name')`.
4. WHEN a prop binding expression evaluates to true (boolean attribute), THE Invalidate_Method SHALL call `this.__child_N.setAttribute('prop-name', '')`.
5. THE Codegen SHALL NOT generate `this.__disposers.push(__effect(() => {...}))` for Child_Prop_Bindings that are handled by the Invalidate_Method.
6. WHEN a prop binding expression depends on multiple signals, THE Invalidate_Method SHALL include the `setAttribute` call in each dependent signal's case.

### Requirement 6: Scoped Slot Invalidation

**User Story:** As a compiler maintainer, I want scoped slot prop updates to be triggered via `__invalidate` instead of `__effect`, so that slot re-rendering has zero effect overhead.

#### Acceptance Criteria

1. WHEN a scoped slot's prop expression depends on signal S, THE Invalidate_Method SHALL recompute the slot props object in signal S's case.
2. WHEN slot props are recomputed, THE Invalidate_Method SHALL store the updated props in `this.__slotProps[slotName]`.
3. WHEN slot props are recomputed, THE Invalidate_Method SHALL dispatch a `wcc:slot-update` CustomEvent with the updated props as detail.
4. WHEN a Slot_Renderer is registered for the slot, THE Invalidate_Method SHALL call the renderer function with the updated props after dispatching the event.
5. WHEN no Slot_Renderer is registered and the slot uses template token replacement, THE Invalidate_Method SHALL perform the token replacement on the slot's DOM content.
6. THE Codegen SHALL NOT generate `this.__disposers.push(__effect(() => {...}))` for Scoped_Slots that are handled by the Invalidate_Method.

### Requirement 7: Dynamic Component Rendering

**User Story:** As a compiler maintainer, I want dynamic components to be rendered by a dedicated `__renderDynamic_N()` method called from `__invalidate`, so that dynamic element creation and destruction no longer requires `__effect`.

#### Acceptance Criteria

1. WHEN a component contains one or more Dynamic_Components, THE Codegen SHALL generate a `__renderDynamic_N()` instance method for each (where N is the zero-based index).
2. THE RenderDynamic_Method SHALL evaluate the tag expression to obtain the current element tag name.
3. WHEN the tag value differs from the previously rendered tag, THE RenderDynamic_Method SHALL remove the existing element from the DOM and create a new element with the new tag name, inserting it before the Anchor_Node.
4. WHEN a new element is created, THE RenderDynamic_Method SHALL set up all prop bindings and event listeners on the new element.
5. WHEN the tag value is null, undefined, or empty string, THE RenderDynamic_Method SHALL remove the existing element and render nothing.
6. THE RenderDynamic_Method SHALL store the current tag value on the component instance to detect tag changes on subsequent calls.
7. THE Codegen SHALL NOT generate `this.__disposers.push(__effect(() => {...}))` for Dynamic_Components that are handled by the RenderDynamic_Method.

### Requirement 8: Dynamic Component Invalidation Integration

**User Story:** As a compiler maintainer, I want `__invalidate` to call `__renderDynamic_N()` when the tag signal changes and to update prop bindings when prop signals change, so that dynamic components react through the static invalidation path.

#### Acceptance Criteria

1. WHEN the signal that determines the tag name for Dynamic_Component N changes, THE Invalidate_Method SHALL include a call to `this.__renderDynamic_N()` in that signal's case.
2. WHEN a prop binding on a Dynamic_Component depends on signal S (and S is not the tag signal), THE Invalidate_Method SHALL generate a guarded `setAttribute` call in signal S's case that checks whether the dynamic element currently exists.
3. THE existence guard for dynamic component prop updates SHALL verify that `this.__dynamic_N_el` is not null before executing `setAttribute`.
4. WHEN the tag signal and a prop signal are the same signal, THE Invalidate_Method SHALL first call `__renderDynamic_N()` (which sets up initial props), then skip the individual prop update for that signal.

### Requirement 9: Dynamic Component Event Listener Management

**User Story:** As a compiler maintainer, I want event listeners on dynamic components to be attached when the element is created and cleaned up when it is destroyed, so that there are no memory leaks or stale handlers.

#### Acceptance Criteria

1. WHEN a new dynamic component element is created, THE RenderDynamic_Method SHALL attach all event listeners defined on the dynamic component template element.
2. WHEN a dynamic component element is destroyed (tag changes or becomes null), THE event listeners SHALL be cleaned up via AbortController_Cleanup (aborting the controller associated with the destroyed element).
3. THE Codegen SHALL generate a per-element AbortController for each dynamic component instance, created when the element is created and aborted when the element is destroyed.
4. WHEN an event handler on a dynamic component writes to a signal, THE Proxy_State SHALL trigger `__invalidate` normally.

### Requirement 10: Effect API Removal

**User Story:** As a compiler maintainer, I want the public `effect()` API to be removed from the `wcc` module, so that users migrate to `watch()` and the reactive runtime can be fully eliminated.

#### Acceptance Criteria

1. THE Codegen SHALL emit a compile-time error when a component source contains `import { effect } from 'wcc'` or uses the `effect()` function.
2. THE compile-time error message SHALL indicate that `effect()` is removed and suggest using `watch()` as a replacement.
3. THE Codegen SHALL NOT generate `__effect` function definitions in any component output after this phase.
4. THE Codegen SHALL NOT include `__currentEffect`, `__batchDepth`, or `__pendingEffects` globals in any component output after this phase.
5. WHEN a component uses `watch()`, THE Codegen SHALL handle it via the Invalidate_Method as defined in Phase 2 (no `__effect` needed).

### Requirement 11: Full Runtime Elimination

**User Story:** As a compiler maintainer, I want the generated component output to contain zero reactive runtime code, so that the output uses only native browser APIs and generated static methods.

#### Acceptance Criteria

1. THE Codegen SHALL NOT include `__signal`, `__effect`, `__computed`, or `__untrack` function definitions in any generated component output.
2. THE generated component output SHALL use only: `Proxy` (native), `HTMLElement`/`customElements` (native), `AbortController` (native), and generated instance methods (`__invalidate`, `__renderIf_N`, `__renderEach_N`, `__renderDynamic_N`).
3. THE Codegen SHALL NOT include the reactive runtime globals (`__currentEffect`, `__batchDepth`, `__pendingEffects`) in any generated output.
4. WHEN a component uses computed values, THE Codegen SHALL handle them via inline recalculation in the Invalidate_Method (as defined in Phase 2) without `__computed`.
5. WHEN a component uses watchers, THE Codegen SHALL handle them via direct invocation in the Invalidate_Method (as defined in Phase 2) without `__effect` or `__untrack`.

### Requirement 12: Batch Mechanism Refactoring

**User Story:** As a compiler maintainer, I want `batch()` to become a per-component mechanism that collects invalidation keys and deduplicates them, so that batch semantics work without shared reactive globals.

#### Acceptance Criteria

1. WHEN `batch(() => {...})` is called on a component, THE Batch_Mechanism SHALL set `this.__batching = true` on the component instance.
2. WHILE `this.__batching` is true, THE Proxy_State setter SHALL collect changed keys in `this.__batchKeys` (a Set) instead of calling `__invalidate` immediately.
3. WHEN the batch callback completes, THE Batch_Mechanism SHALL set `this.__batching = false` and call `this.__invalidate(key)` for each key in `this.__batchKeys`.
4. THE Batch_Mechanism SHALL clear `this.__batchKeys` after processing all collected keys.
5. WHEN the same key is written multiple times within a batch, THE Batch_Mechanism SHALL call `__invalidate` for that key only once (deduplication via Set).
6. THE Codegen SHALL generate the batch mechanism as an instance method on the component class without relying on shared globals.

### Requirement 13: Model Binding Inside If-Blocks

**User Story:** As a compiler maintainer, I want model bindings inside if-block branches to work correctly with existence guards, so that model synchronization only occurs when the branch is active.

#### Acceptance Criteria

1. WHEN a Model_Binding exists inside an If_Block branch, THE Invalidate_Method SHALL guard the signal-to-DOM update with a check that the branch node exists.
2. WHEN a branch containing a Model_Binding is activated, THE RenderIf_Method SHALL set the initial form element value from the current signal state.
3. WHEN a branch containing a Model_Binding is activated, THE RenderIf_Method SHALL attach the model event listener for DOM-to-signal synchronization.
4. WHEN a branch containing a Model_Binding is deactivated, THE model event listener SHALL be cleaned up via DOM node removal (implicit cleanup).

### Requirement 14: Model Binding Inside Each-Blocks

**User Story:** As a compiler maintainer, I want model bindings inside each-block items to work correctly with per-item state, so that each list item has independent bidirectional binding.

#### Acceptance Criteria

1. WHEN a Model_Binding inside an Each_Block references the Item_Variable, THE RenderEach_Method SHALL set the initial form element value from the item data during node creation.
2. WHEN a Model_Binding inside an Each_Block references an External_Signal, THE Invalidate_Method SHALL generate an In_Place_Update loop that updates form element values for all existing nodes.
3. WHEN a form element inside an Each_Block receives user input, THE event listener SHALL write to the appropriate signal or modify the source array to trigger reconciliation.
4. THE Codegen SHALL generate model event listeners as closures capturing the item index for correct per-item updates.

### Requirement 15: Child Prop Bindings Inside Each-Blocks

**User Story:** As a compiler maintainer, I want child component prop bindings inside each-block items to propagate item data to child components without effects, so that nested components in lists receive correct props.

#### Acceptance Criteria

1. WHEN a child component inside an Each_Block has `:propName="itemExpr"` referencing the Item_Variable, THE RenderEach_Method SHALL call `child.setAttribute('prop-name', itemValue)` during node creation.
2. WHEN a child component inside an Each_Block has `:propName="expr"` referencing an External_Signal, THE Invalidate_Method SHALL generate an In_Place_Update loop that calls `setAttribute` on each child for all existing nodes.
3. WHEN the source signal changes and the Each_Block is reconciled, THE RenderEach_Method SHALL set all prop bindings on newly created or reused child elements.
4. THE Codegen SHALL store child element references in the Node_Array alongside other DOM references for each item.

### Requirement 16: Scoped Slots Inside Each-Blocks

**User Story:** As a compiler maintainer, I want scoped slots inside each-block items to pass per-item data to slot consumers, so that slot rendering works correctly within lists.

#### Acceptance Criteria

1. WHEN a Scoped_Slot inside an Each_Block has props referencing the Item_Variable, THE RenderEach_Method SHALL compute and store slot props per item during node creation.
2. WHEN an External_Signal referenced by a slot prop expression changes, THE Invalidate_Method SHALL generate an In_Place_Update loop that recomputes slot props and invokes renderers for each existing item.
3. WHEN the source signal changes and items are reconciled, THE RenderEach_Method SHALL dispatch `wcc:slot-update` events for newly created items.
4. THE Codegen SHALL scope slot prop storage per item (e.g., per-node data structure) rather than globally on the component.

### Requirement 17: Dynamic Components Inside If-Blocks

**User Story:** As a compiler maintainer, I want dynamic components inside if-block branches to be created when the branch activates and destroyed when it deactivates, so that dynamic component lifecycle is tied to branch visibility.

#### Acceptance Criteria

1. WHEN a branch containing a Dynamic_Component is activated, THE RenderIf_Method SHALL call the corresponding `__renderDynamic_N()` to create the element.
2. WHEN a branch containing a Dynamic_Component is deactivated, THE RenderIf_Method SHALL destroy the dynamic element and abort its AbortController.
3. WHEN the tag signal changes while the branch is active, THE Invalidate_Method SHALL call `__renderDynamic_N()` guarded by a branch existence check.
4. WHEN the tag signal changes while the branch is inactive, THE Invalidate_Method SHALL skip the `__renderDynamic_N()` call (no-op due to existence guard).

### Requirement 18: Initial Render Integration

**User Story:** As a compiler maintainer, I want the wildcard `__invalidate('*')` call to render model bindings, child prop bindings, scoped slots, and dynamic components, so that the initial render path remains unified.

#### Acceptance Criteria

1. WHEN `__invalidate('*')` is called, THE Invalidate_Method SHALL set initial values for all Model_Bindings (signal-to-DOM direction).
2. WHEN `__invalidate('*')` is called, THE Invalidate_Method SHALL call `setAttribute` for all Child_Prop_Bindings with their initial expression values.
3. WHEN `__invalidate('*')` is called, THE Invalidate_Method SHALL compute and store initial Scoped_Slot props and invoke registered renderers.
4. WHEN `__invalidate('*')` is called, THE Invalidate_Method SHALL call each `__renderDynamic_N()` method to create the initial dynamic elements.
5. THE initial render SHALL produce the same DOM output as the previous `__effect`-based approach for all features migrated in this phase.

### Requirement 19: Cleanup and Disconnection

**User Story:** As a compiler maintainer, I want all event listeners and dynamic elements to be properly cleaned up when a component disconnects, so that there are no memory leaks.

#### Acceptance Criteria

1. WHEN `disconnectedCallback` is called, THE component SHALL abort its main AbortController to remove all event listeners registered with that controller's signal.
2. WHEN `disconnectedCallback` is called, THE component SHALL abort any per-dynamic-component AbortControllers to clean up dynamic element listeners.
3. THE Codegen SHALL NOT generate `this.__disposers.forEach(d => d())` cleanup patterns (the disposer array is eliminated along with `__effect`).
4. WHEN a component reconnects after disconnection, THE `connectedCallback` SHALL create a new AbortController and re-attach all event listeners.

### Requirement 20: Migration Error Reporting

**User Story:** As a compiler maintainer, I want the compiler to emit clear error messages when deprecated patterns are detected, so that users can migrate their code to the new API.

#### Acceptance Criteria

1. WHEN the parser detects `import { effect } from 'wcc'`, THE Codegen SHALL emit an error: "effect() has been removed. Use watch() for reactive side effects."
2. WHEN the parser detects a call to `effect(...)` in the component script, THE Codegen SHALL emit an error referencing the line number and suggesting the `watch()` equivalent.
3. THE error messages SHALL be emitted at compile time (not runtime) so that users discover issues during the build step.
4. IF the parser detects `effect` imported but not used, THEN THE Codegen SHALL emit a warning rather than an error.

