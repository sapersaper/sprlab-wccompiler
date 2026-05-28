# Requirements Document

## Introduction

Phase 3 of the Zero Runtime Refactor for wcCompiler. This phase migrates `each` loops away from `__effect`-based rendering to the static `__invalidate(key)` approach established in Phase 1 and extended in Phase 2. It assumes Phase 1 (proxy-state-invalidate) and Phase 2 (if-computed-watch-zero-runtime) are complete — signals are stored in `this._state` via Proxy, `__invalidate(key)` already handles simple bindings, if-blocks, computed values, and watchers.

Each loops are the most complex migration target because they involve:
- Dynamic DOM creation/destruction based on a source array or numeric range
- Keyed and non-keyed reconciliation strategies
- Internal bindings that reference both loop-scoped variables (item, index) and external signals
- The critical distinction between "source signal changed" (reconcile the list) vs "external signal changed" (update existing nodes in-place)
- Nested loops where inner sources depend on outer items

After this phase, components that only use simple bindings + if-blocks + computed values + watchers + each loops (without user effects, scoped slots, dynamic components, model bindings, or child prop bindings) can fully prune the `__effect` runtime.

## Glossary

- **Codegen**: The code generation module (`lib/codegen.js`) that transforms parsed component data into a self-contained JavaScript Web Component class.
- **Proxy_State**: The `Proxy`-wrapped object (`this._state`) from Phase 1 containing all signal and computed values as plain properties, where the Proxy setter intercepts writes and calls `this.__invalidate(key)`.
- **Invalidate_Method**: The generated instance method (`this.__invalidate(key)`) containing a `switch` statement that maps each signal key to DOM update operations, computed recalculations, renderIf calls, renderEach calls, and watcher invocations.
- **Dependency_Graph**: A compile-time mapping from each signal name to the set of DOM operations, renderEach calls, and in-place update loops that depend on it.
- **Each_Block**: A list rendering construct (`each="item in source"` or `each="(item, index) in source"`) that creates DOM nodes for each element in the source collection.
- **RenderEach_Method**: A generated instance method (`this.__renderEach_N()`) that evaluates the source expression, performs reconciliation (keyed or non-keyed), and sets up internal bindings for each item node.
- **Source_Signal**: The signal or computed value whose change triggers full list reconciliation via `__renderEach_N()`.
- **Source_Expression**: The expression on the right side of `in` in the each directive (e.g., `items()`, `filteredList()`, `5`).
- **Item_Variable**: The loop-scoped variable representing the current element (e.g., `item` in `each="item in items()"`).
- **Index_Variable**: The optional loop-scoped variable representing the current zero-based index (e.g., `index` in `each="(item, index) in items()"`).
- **External_Signal**: A signal referenced inside a loop item's bindings that is NOT the Source_Signal and NOT the Item_Variable or Index_Variable. Changing an External_Signal updates existing nodes in-place without reconciling the list.
- **Node_Array**: A component instance array (`this.__for_N_nodes`) storing references to the DOM nodes currently rendered by Each_Block N.
- **Item_Data_Array**: A component instance array (`this.__for_N_items`) storing the captured item values for each rendered node, used by External_Signal in-place updates to reconstruct full expressions.
- **Keyed_Reconciliation**: A reconciliation strategy using `:key="expr"` that maps keys to existing nodes, reorders/reuses nodes when items move, and only creates/destroys nodes for added/removed items.
- **Non_Keyed_Reconciliation**: A reconciliation strategy without `:key` that destroys all existing nodes and recreates them from scratch when the source changes.
- **Key_Map**: A `Map<keyValue, {node, itemData}>` stored on the component instance for keyed Each_Blocks, enabling O(1) lookup of existing nodes by key.
- **In_Place_Update**: An update operation that iterates over existing Node_Array entries and updates bindings without recreating DOM nodes, triggered when an External_Signal changes.
- **Anchor_Node**: A comment node placed in the DOM as a positional marker for where Each_Block nodes are inserted (before the anchor).
- **Numeric_Range**: A source expression that is a literal number (e.g., `each="n in 5"`), producing items 1 through N.
- **Nested_Each**: An Each_Block whose template contains another Each_Block, where the inner source may depend on the outer Item_Variable.
- **Internal_Binding**: A reactive binding (text, show, attr, class, style, event) inside an Each_Block item template that may reference the Item_Variable, Index_Variable, or External_Signals.
- **Effect_Runtime**: The existing `__effect` function that provides dynamic dependency tracking and automatic re-execution (retained for features not yet migrated).

## Requirements

### Requirement 1: RenderEach Method Generation

**User Story:** As a compiler maintainer, I want each `each` block to be rendered by a dedicated `__renderEach_N()` method called from `__invalidate`, so that list rendering no longer requires `__effect` overhead.

#### Acceptance Criteria

1. WHEN a component contains one or more Each_Blocks, THE Codegen SHALL generate a `__renderEach_N()` instance method for each Each_Block (where N is the zero-based index).
2. THE RenderEach_Method SHALL evaluate the Source_Expression to obtain the current list of items.
3. WHEN the Source_Expression evaluates to an array, THE RenderEach_Method SHALL iterate over the array elements.
4. WHEN the Source_Expression evaluates to a number, THE RenderEach_Method SHALL generate items from 1 to that number (Numeric_Range).
5. THE RenderEach_Method SHALL store rendered DOM nodes in the Node_Array (`this.__for_N_nodes`).
6. THE RenderEach_Method SHALL store captured item values in the Item_Data_Array (`this.__for_N_items`).
7. THE Codegen SHALL NOT generate `this.__disposers.push(__effect(() => {...}))` for Each_Blocks that are handled by the RenderEach_Method.

### Requirement 2: Each-Block Invalidation Integration

**User Story:** As a compiler maintainer, I want `__invalidate` to call `__renderEach_N()` when the source signal changes, so that each-blocks react to source changes through the static invalidation path.

#### Acceptance Criteria

1. WHEN a Source_Signal for Each_Block N changes, THE Invalidate_Method SHALL include a call to `this.__renderEach_N()` in that signal's case.
2. WHEN multiple Each_Blocks depend on the same Source_Signal, THE Invalidate_Method SHALL call each corresponding `__renderEach_N()` in that signal's case.
3. WHEN a Source_Expression references a computed value, THE Invalidate_Method SHALL include the `__renderEach_N()` call in the computed value's case (triggered after the computed is recalculated).
4. THE Codegen SHALL distinguish between Source_Signal changes (which trigger `__renderEach_N()`) and External_Signal changes (which trigger In_Place_Updates).

### Requirement 3: Non-Keyed Reconciliation

**User Story:** As a compiler maintainer, I want each-blocks without `:key` to use a destroy-and-recreate strategy, so that non-keyed lists render correctly without effect overhead.

#### Acceptance Criteria

1. WHEN an Each_Block has no `:key` attribute and `__renderEach_N()` is called, THE RenderEach_Method SHALL remove all existing nodes in the Node_Array from the DOM.
2. THE RenderEach_Method SHALL create a new DOM node for each item in the evaluated source, inserting each before the Anchor_Node.
3. THE RenderEach_Method SHALL set up Internal_Bindings for each new node using the current item value and index.
4. THE RenderEach_Method SHALL update the Node_Array and Item_Data_Array to reflect the new set of rendered nodes.
5. WHEN the source evaluates to an empty array or zero, THE RenderEach_Method SHALL remove all existing nodes and set the Node_Array to empty.

### Requirement 4: Keyed Reconciliation

**User Story:** As a compiler maintainer, I want each-blocks with `:key` to reuse and reorder existing nodes, so that keyed lists minimize DOM operations and preserve element state.

#### Acceptance Criteria

1. WHEN an Each_Block has a `:key` attribute and `__renderEach_N()` is called, THE RenderEach_Method SHALL evaluate the key expression for each item in the new source.
2. THE RenderEach_Method SHALL compare new keys against the Key_Map to identify reusable nodes.
3. WHEN a key exists in the Key_Map, THE RenderEach_Method SHALL reuse the existing DOM node and update its Internal_Bindings with the new item value and index.
4. WHEN a key does not exist in the Key_Map, THE RenderEach_Method SHALL create a new DOM node with the item's bindings.
5. WHEN a key from the previous render is absent in the new source, THE RenderEach_Method SHALL remove that node from the DOM and delete it from the Key_Map.
6. THE RenderEach_Method SHALL reorder existing nodes in the DOM to match the new source order by inserting them before the Anchor_Node in sequence.
7. THE RenderEach_Method SHALL update the Node_Array, Item_Data_Array, and Key_Map to reflect the final state after reconciliation.

### Requirement 5: External Signal In-Place Updates

**User Story:** As a compiler maintainer, I want changes to external signals to update existing loop item nodes in-place without reconciling the list, so that non-source signal changes are efficient and do not destroy/recreate DOM.

#### Acceptance Criteria

1. WHEN an External_Signal changes, THE Invalidate_Method SHALL NOT call `__renderEach_N()` for Each_Blocks that do not depend on that signal as their source.
2. WHEN an Internal_Binding inside Each_Block N references External_Signal S, THE Invalidate_Method SHALL generate an in-place update loop in signal S's case that iterates over `this.__for_N_nodes`.
3. THE In_Place_Update loop SHALL use the stored Item_Data_Array values to reconstruct the full binding expression for each node (combining the external signal's current value with the captured item data).
4. THE In_Place_Update loop SHALL update only the specific DOM property affected by the binding (textContent, style.display, setAttribute, className, style properties).
5. WHEN an Internal_Binding references both an External_Signal and the Item_Variable, THE Codegen SHALL generate the expression using `this._state.externalSignal` for the external part and `this.__for_N_items[i]` for the item part.
6. WHEN an Internal_Binding references both an External_Signal and the Index_Variable, THE Codegen SHALL use the loop index `i` for the index part.

### Requirement 6: Item Data Capture

**User Story:** As a compiler maintainer, I want item values to be captured alongside node references during rendering, so that external signal updates can reconstruct full expressions without re-evaluating the source.

#### Acceptance Criteria

1. WHEN `__renderEach_N()` creates or updates a node for item at index I, THE RenderEach_Method SHALL store the item value at `this.__for_N_items[I]`.
2. WHEN using Keyed_Reconciliation and a node is reused with a new item value, THE RenderEach_Method SHALL update the corresponding entry in the Item_Data_Array.
3. THE Item_Data_Array SHALL always have the same length as the Node_Array after `__renderEach_N()` completes.
4. WHEN the source is a Numeric_Range, THE Item_Data_Array SHALL store the numeric value (1-based) for each position.

### Requirement 7: Internal Bindings Within Loop Items

**User Story:** As a compiler maintainer, I want all binding types inside loop items to work without `__effect`, so that text, show, attr, class, style, and event bindings inside each-blocks are fully static.

#### Acceptance Criteria

1. WHEN an Internal_Binding is a text interpolation referencing the Item_Variable, THE RenderEach_Method SHALL set `node.textContent` (or the appropriate text node) using the item value during creation.
2. WHEN an Internal_Binding is a text interpolation referencing an External_Signal, THE Codegen SHALL generate both the initial render logic (inside `__renderEach_N()`) and the In_Place_Update logic (in the External_Signal's invalidate case).
3. WHEN an Internal_Binding is a show directive, THE RenderEach_Method SHALL set `style.display` during creation, and THE Invalidate_Method SHALL generate an In_Place_Update loop if the show expression references an External_Signal.
4. WHEN an Internal_Binding is an attribute binding, THE RenderEach_Method SHALL set the attribute during creation, and THE Invalidate_Method SHALL generate an In_Place_Update loop if the expression references an External_Signal.
5. WHEN an Internal_Binding is a class binding, THE RenderEach_Method SHALL set the class during creation, and THE Invalidate_Method SHALL generate an In_Place_Update loop if the expression references an External_Signal.
6. WHEN an Internal_Binding is a style binding, THE RenderEach_Method SHALL set the style during creation, and THE Invalidate_Method SHALL generate an In_Place_Update loop if the expression references an External_Signal.
7. WHEN an Internal_Binding is an event handler referencing the Item_Variable or Index_Variable, THE RenderEach_Method SHALL attach the event listener with a closure capturing the current item and index values.

### Requirement 8: Event Handlers Inside Loop Items

**User Story:** As a compiler maintainer, I want event handlers inside each-block items to correctly reference the item and index for their specific node, so that click handlers and other events work correctly per-item.

#### Acceptance Criteria

1. WHEN an event handler inside an Each_Block references the Item_Variable, THE RenderEach_Method SHALL generate the handler as a closure that captures the item value for that specific node.
2. WHEN an event handler inside an Each_Block references the Index_Variable, THE RenderEach_Method SHALL generate the handler as a closure that captures the index value for that specific node.
3. WHEN an event handler writes to a signal that is the Source_Signal, THE Proxy_State SHALL trigger `__invalidate` which calls `__renderEach_N()` to reconcile the list.
4. WHEN an event handler writes to an External_Signal, THE Proxy_State SHALL trigger `__invalidate` which performs In_Place_Updates on existing nodes.

### Requirement 9: Nested Each Loops

**User Story:** As a compiler maintainer, I want nested each-blocks to work correctly where the inner source depends on the outer item variable, so that multi-level lists render and update properly.

#### Acceptance Criteria

1. WHEN an Each_Block template contains a Nested_Each, THE Codegen SHALL generate a separate `__renderEach_M()` method for the inner loop (with a distinct index M).
2. WHEN the inner Each_Block's Source_Expression depends on the outer Item_Variable, THE RenderEach_Method for the outer loop SHALL invoke the inner `__renderEach_M()` as part of setting up each outer item node.
3. THE inner Each_Block SHALL maintain its own Node_Array and Item_Data_Array scoped per outer item (e.g., `this.__for_N_M_nodes[outerIndex]` or equivalent scoping strategy).
4. WHEN the outer Source_Signal changes, THE outer `__renderEach_N()` SHALL destroy inner loop nodes as part of removing outer nodes, and recreate inner loops for new outer items.
5. WHEN an External_Signal is referenced inside a Nested_Each's Internal_Bindings, THE Invalidate_Method SHALL generate In_Place_Update loops that iterate through all nesting levels.

### Requirement 10: Numeric Range Source

**User Story:** As a compiler maintainer, I want `each="n in 5"` (numeric range) to work without effects, so that fixed-count and signal-driven numeric ranges render statically.

#### Acceptance Criteria

1. WHEN the Source_Expression is a numeric literal, THE RenderEach_Method SHALL generate items with values 1 through N (where N is the literal value).
2. WHEN the Source_Expression is a signal that evaluates to a number, THE RenderEach_Method SHALL generate items with values 1 through the signal's current value.
3. WHEN the numeric source signal changes, THE Invalidate_Method SHALL call `__renderEach_N()` to reconcile the list to the new count.
4. THE Item_Variable for a Numeric_Range SHALL hold the 1-based numeric value for each iteration.

### Requirement 11: Initial Render Integration

**User Story:** As a compiler maintainer, I want the wildcard `__invalidate('*')` call to also render each-blocks, so that the initial render path remains unified.

#### Acceptance Criteria

1. WHEN `__invalidate('*')` is called, THE Invalidate_Method SHALL call each `__renderEach_N()` method to render the initial list state.
2. THE initial render SHALL produce the same DOM output as the previous `__effect`-based approach for all Each_Block configurations (keyed, non-keyed, numeric range, nested).
3. WHEN `__invalidate('*')` is called, THE Invalidate_Method SHALL call `__renderEach_N()` methods after computed recalculations and `__renderIf_N()` calls (so that computed sources are available).

### Requirement 12: If-Blocks Inside Each Items

**User Story:** As a compiler maintainer, I want if-blocks nested inside each-block items to work correctly, so that conditional rendering within list items functions without effects.

#### Acceptance Criteria

1. WHEN an Each_Block item template contains an If_Block, THE RenderEach_Method SHALL set up the if-block's anchor and initial branch as part of item node creation.
2. WHEN the If_Block condition inside a loop item depends on an External_Signal, THE Invalidate_Method SHALL generate an In_Place_Update loop that re-evaluates the condition for each existing item node.
3. WHEN the If_Block condition depends only on the Item_Variable, THE RenderEach_Method SHALL evaluate the condition during item creation and THE condition SHALL only be re-evaluated when `__renderEach_N()` is called (source change).
4. THE Codegen SHALL scope if-block state (active branch index, branch node reference) per loop item rather than globally on the component.

### Requirement 13: Runtime Pruning Extension

**User Story:** As a compiler maintainer, I want the runtime to exclude `__effect` when a component only uses features covered by Phases 1, 2, and 3, so that the generated output is minimal.

#### Acceptance Criteria

1. WHEN a component has no user effects, no scoped slots, no dynamic components, no model bindings, and no child prop bindings, THE Codegen SHALL NOT include `__effect` in the inlined runtime.
2. WHEN a component uses each-blocks but no features requiring `__effect`, THE Codegen SHALL generate the component with only the Proxy_State and Invalidate_Method (no reactive runtime).
3. WHEN a component still uses features requiring `__effect` (user effects, scoped slots, dynamic components, model bindings, child prop bindings), THE Codegen SHALL include the necessary runtime functions alongside the Invalidate_Method and RenderEach methods.
4. THE Codegen SHALL NOT include `__signal`, `__computed`, or `__untrack` in the inlined runtime when all signals, computed values, and watchers are handled by the Invalidate_Method.

### Requirement 14: Backward Compatibility for Remaining Effect-Based Features

**User Story:** As a compiler maintainer, I want features not covered by Phases 1–3 to continue working with `__effect` while coexisting with the new invalidation-based each-blocks.

#### Acceptance Criteria

1. WHILE a component uses user-defined effects, THE Codegen SHALL continue generating `__effect` calls for those effects.
2. WHILE a component uses scoped slots, THE Codegen SHALL continue generating `__effect`-based slot rendering.
3. WHILE a component uses dynamic components, THE Codegen SHALL continue generating `__effect`-based dynamic component logic.
4. WHILE a component uses child component prop bindings, THE Codegen SHALL continue generating `__effect`-based attribute propagation.
5. WHILE a component uses model bindings, THE Codegen SHALL continue generating `__effect`-based model synchronization.
6. WHEN a component mixes invalidation-based features (simple bindings, if-blocks, computed, watchers, each-blocks) with effect-based features (user effects, scoped slots, dynamic components, model bindings, child prop bindings), THE Codegen SHALL generate both the Invalidate_Method and the `__effect` runtime without conflict.

### Requirement 15: Dependency Analysis for Each-Block Bindings

**User Story:** As a compiler maintainer, I want the codegen to statically distinguish source signals from external signals in each-block bindings, so that the correct update path (reconcile vs in-place) is generated for each signal.

#### Acceptance Criteria

1. THE Codegen SHALL classify each signal referenced inside an Each_Block as either a Source_Signal (triggers `__renderEach_N()`) or an External_Signal (triggers In_Place_Update).
2. WHEN a binding expression inside an Each_Block references only the Item_Variable and Index_Variable (no signals), THE Codegen SHALL NOT generate any invalidation case for that binding (it is fully static per render).
3. WHEN a binding expression references both the Source_Signal and an External_Signal, THE Codegen SHALL generate the `__renderEach_N()` call for the Source_Signal case and an In_Place_Update for the External_Signal case.
4. THE dependency analysis SHALL operate on the parsed binding expressions available at compile time without executing any code.
5. WHEN a binding expression calls a method that internally reads signals, THE Codegen SHALL NOT attempt to trace through the method (such bindings remain in `__effect` for this phase).

### Requirement 16: Each-Block Cleanup on Source Empty

**User Story:** As a compiler maintainer, I want each-blocks to properly clean up all DOM nodes and stored data when the source becomes empty, so that there are no memory leaks or stale references.

#### Acceptance Criteria

1. WHEN `__renderEach_N()` is called and the source evaluates to an empty array or zero, THE RenderEach_Method SHALL remove all nodes in the Node_Array from the DOM.
2. THE RenderEach_Method SHALL clear the Node_Array, Item_Data_Array, and Key_Map (if keyed) to release references.
3. WHEN a Nested_Each exists inside the items being removed, THE RenderEach_Method SHALL also clear the inner loop's Node_Array and Item_Data_Array.
4. THE In_Place_Update loops SHALL handle the case where Node_Array is empty by performing no iterations (no error on empty list).
