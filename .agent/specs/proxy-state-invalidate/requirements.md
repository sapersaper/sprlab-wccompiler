# Requirements Document

## Introduction

Phase 1 of the Zero Runtime Refactor for wcCompiler. This phase replaces the dynamic `__signal` getter/setter pattern with a `Proxy`-based state container (`this._state`) and generates a static `__invalidate(key)` method that encodes the dependency graph at compile time. The goal is to eliminate `__effect` wrappers for simple binding types (text, show, attribute, class, style) while maintaining backward compatibility for complex features (if/each/computed/watch/slots/dynamic components) that continue using `__effect` temporarily.

## Glossary

- **Codegen**: The code generation module (`lib/codegen.js`) that transforms parsed component data into a self-contained JavaScript Web Component class.
- **Proxy_State**: A single `Proxy`-wrapped object (`this._state`) containing all signal values as plain properties, where the Proxy setter intercepts writes and calls `this.__invalidate(key)`.
- **Invalidate_Method**: A generated instance method (`this.__invalidate(key)`) containing a `switch` statement that maps each signal key to the DOM update operations that depend on it.
- **Dependency_Graph**: A compile-time mapping from each signal name to the set of DOM nodes and update operations that read that signal.
- **Text_Binding**: A template interpolation (`{{expr}}`) that renders a signal or expression value as `textContent` of a DOM text node.
- **Show_Binding**: A `show="expr"` directive that toggles `style.display` between `''` and `'none'` based on a boolean expression.
- **Attr_Binding**: A `:attr="expr"` directive that sets or removes an HTML attribute based on an expression value.
- **Class_Binding**: A `:class="expr"` directive that sets `className` or manipulates `classList` based on an expression.
- **Style_Binding**: A `:style="expr"` directive that sets `style.cssText` or individual style properties based on an expression.
- **Multi_Signal_Binding**: A binding expression that depends on more than one signal (e.g., `{{firstName() + ' ' + lastName()}}`).
- **Initial_Render**: The first invocation of `__invalidate('*')` in `connectedCallback` after DOM setup, which renders all bindings to their initial values.
- **Effect_Runtime**: The existing `__effect` function that provides dynamic dependency tracking and automatic re-execution.
- **Simple_Binding**: A binding of type text, show, attr, class, or style that can be statically analyzed at compile time.
- **Complex_Feature**: A feature (if blocks, each loops, computed values, watchers, user effects, scoped slots, dynamic components, child component prop bindings, model bindings) that continues using `__effect` in this phase.

## Requirements

### Requirement 1: Proxy State Container Generation

**User Story:** As a compiler maintainer, I want signals to be stored in a single Proxy-wrapped object, so that all state mutations are intercepted uniformly and routed to the static invalidation method.

#### Acceptance Criteria

1. WHEN a component declares one or more signals, THE Codegen SHALL generate a `this._state = new Proxy({...}, handler)` assignment in the constructor containing all signal initial values as key-value pairs.
2. WHEN the Proxy setter is triggered by a property assignment, THE Proxy_State SHALL call `this.__invalidate(key)` with the name of the changed property only if the new value differs from the old value.
3. THE Proxy_State SHALL store the current value of each signal as a plain property accessible via `this._state.signalName`.
4. WHEN a signal is read in a template expression, THE Codegen SHALL generate `this._state.signalName` instead of `this._signalName()`.
5. WHEN a signal is written in a method body or event handler, THE Codegen SHALL generate `this._state.signalName = newVal` instead of `this._signalName(newVal)`.
6. THE Codegen SHALL NOT generate `__signal()` calls for signals that are fully covered by the Proxy_State (all signals in this phase).

### Requirement 2: Static Invalidate Method Generation

**User Story:** As a compiler maintainer, I want a generated `__invalidate(key)` method with a switch statement encoding the dependency graph, so that DOM updates are performed without dynamic dependency tracking overhead.

#### Acceptance Criteria

1. THE Codegen SHALL generate an `__invalidate(key)` instance method on the component class containing a `switch(key)` statement.
2. WHEN `__invalidate` is called with a signal key, THE Invalidate_Method SHALL execute all DOM update operations registered for that key in the Dependency_Graph.
3. WHEN `__invalidate` is called with the special key `'*'`, THE Invalidate_Method SHALL execute all DOM update operations for every signal in the component (initial render).
4. THE Invalidate_Method SHALL contain one `case` per signal that has at least one Simple_Binding depending on it.
5. WHEN a Multi_Signal_Binding depends on signals A and B, THE Invalidate_Method SHALL include the update operation in both `case 'A'` and `case 'B'`.

### Requirement 3: Text Binding Invalidation

**User Story:** As a compiler maintainer, I want text bindings to be updated via `__invalidate` instead of `__effect`, so that text interpolation has zero runtime overhead from dependency tracking.

#### Acceptance Criteria

1. WHEN a Text_Binding depends on a single signal, THE Invalidate_Method SHALL generate `node.textContent = this._state.signalName ?? ''` in the corresponding case.
2. WHEN a Text_Binding depends on a computed value, THE Invalidate_Method SHALL NOT handle it (computed bindings remain in `__effect` for this phase).
3. WHEN a Text_Binding contains a complex expression referencing multiple signals, THE Invalidate_Method SHALL generate the full expression evaluation in each signal's case.
4. THE Codegen SHALL NOT generate `this.__disposers.push(__effect(() => {...}))` for Text_Bindings that are handled by the Invalidate_Method.

### Requirement 4: Show Binding Invalidation

**User Story:** As a compiler maintainer, I want show directives to be updated via `__invalidate` instead of `__effect`, so that visibility toggling is performed with minimal overhead.

#### Acceptance Criteria

1. WHEN a Show_Binding expression depends on one or more signals, THE Invalidate_Method SHALL generate `node.style.display = (expr) ? '' : 'none'` in each dependent signal's case.
2. THE Codegen SHALL NOT generate `this.__disposers.push(__effect(() => {...}))` for Show_Bindings that are handled by the Invalidate_Method.
3. IF a Show_Binding expression references a computed value, THEN THE Codegen SHALL keep the existing `__effect` pattern for that binding.

### Requirement 5: Attribute Binding Invalidation

**User Story:** As a compiler maintainer, I want attribute bindings to be updated via `__invalidate` instead of `__effect`, so that attribute manipulation avoids dynamic tracking.

#### Acceptance Criteria

1. WHEN an Attr_Binding of kind `attr` depends on signals, THE Invalidate_Method SHALL generate logic that calls `setAttribute` when the value is truthy or empty string, and `removeAttribute` when the value is null or false.
2. WHEN an Attr_Binding of kind `bool` depends on signals, THE Invalidate_Method SHALL generate `node.propName = !!(expr)`.
3. THE Codegen SHALL NOT generate `this.__disposers.push(__effect(() => {...}))` for Attr_Bindings that are handled by the Invalidate_Method.
4. IF an Attr_Binding expression references a computed value, THEN THE Codegen SHALL keep the existing `__effect` pattern for that binding.

### Requirement 6: Class Binding Invalidation

**User Story:** As a compiler maintainer, I want class bindings to be updated via `__invalidate` instead of `__effect`, so that class manipulation is performed statically.

#### Acceptance Criteria

1. WHEN a Class_Binding uses an object expression (`{active: isActive()}`), THE Invalidate_Method SHALL generate `classList.add/remove` logic for each dependent signal's case.
2. WHEN a Class_Binding uses an array expression, THE Invalidate_Method SHALL generate `node.className = expr.join(' ')` logic for each dependent signal's case.
3. WHEN a Class_Binding uses a string expression, THE Invalidate_Method SHALL generate `node.className = expr` logic for each dependent signal's case.
4. THE Codegen SHALL preserve static class values when generating class binding updates (prepending the static prefix).
5. THE Codegen SHALL NOT generate `this.__disposers.push(__effect(() => {...}))` for Class_Bindings that are handled by the Invalidate_Method.
6. IF a Class_Binding expression references a computed value, THEN THE Codegen SHALL keep the existing `__effect` pattern for that binding.

### Requirement 7: Style Binding Invalidation

**User Story:** As a compiler maintainer, I want style bindings to be updated via `__invalidate` instead of `__effect`, so that style manipulation is performed statically.

#### Acceptance Criteria

1. WHEN a Style_Binding uses an object expression, THE Invalidate_Method SHALL generate `node.style[key] = value` logic for each dependent signal's case.
2. WHEN a Style_Binding uses a string expression, THE Invalidate_Method SHALL generate `node.style.cssText = expr` logic for each dependent signal's case.
3. THE Codegen SHALL preserve static style values when generating style binding updates (prepending the static prefix).
4. THE Codegen SHALL NOT generate `this.__disposers.push(__effect(() => {...}))` for Style_Bindings that are handled by the Invalidate_Method.
5. IF a Style_Binding expression references a computed value, THEN THE Codegen SHALL keep the existing `__effect` pattern for that binding.

### Requirement 8: Initial Render via Wildcard Invalidation

**User Story:** As a compiler maintainer, I want all bindings to render their initial values through a single `__invalidate('*')` call, so that the initial render path is unified with the update path.

#### Acceptance Criteria

1. THE Codegen SHALL generate a `this.__invalidate('*')` call at the end of `connectedCallback` after all DOM setup is complete.
2. WHEN `__invalidate('*')` is called, THE Invalidate_Method SHALL execute the update operation for every signal-dependent binding in the component.
3. THE Initial_Render SHALL produce the same DOM output as the previous `__effect`-based approach for all Simple_Bindings.

### Requirement 9: Backward Compatibility for Complex Features

**User Story:** As a compiler maintainer, I want complex features to continue working with `__effect` while reading from the new Proxy state, so that this phase does not break any existing functionality.

#### Acceptance Criteria

1. WHILE a component uses if blocks, THE Codegen SHALL continue generating `__effect`-based rendering for those blocks.
2. WHILE a component uses each loops, THE Codegen SHALL continue generating `__effect`-based rendering for those loops.
3. WHILE a component uses computed values, THE Codegen SHALL continue generating `__computed` functions that read from `this._state` properties.
4. WHILE a component uses watchers, THE Codegen SHALL continue generating `__effect`-based watcher patterns.
5. WHILE a component uses user-defined effects, THE Codegen SHALL continue generating `__effect` calls for those effects.
6. WHILE a component uses scoped slots, THE Codegen SHALL continue generating `__effect`-based slot rendering.
7. WHILE a component uses dynamic components, THE Codegen SHALL continue generating `__effect`-based dynamic component logic.
8. WHILE a component uses child component prop bindings, THE Codegen SHALL continue generating `__effect`-based attribute propagation.
9. WHILE a component uses model bindings, THE Codegen SHALL continue generating `__effect`-based model synchronization.
10. THE Effect_Runtime SHALL read signal values from `this._state.signalName` instead of `this._signalName()` when used by Complex_Features.

### Requirement 10: Dependency Graph Analysis

**User Story:** As a compiler maintainer, I want the codegen to statically analyze which signals each binding depends on, so that the `__invalidate` switch cases are correct and complete.

#### Acceptance Criteria

1. WHEN a binding expression contains a direct signal reference (e.g., `signalName()`), THE Codegen SHALL register that binding under the signal's key in the Dependency_Graph.
2. WHEN a binding expression contains multiple signal references, THE Codegen SHALL register that binding under each signal's key in the Dependency_Graph.
3. WHEN a binding expression references only props (not signals), THE Codegen SHALL register that binding under the prop's key in the Dependency_Graph.
4. WHEN a binding expression references a method call that internally reads signals, THE Codegen SHALL NOT attempt to trace through the method (method-based bindings remain in `__effect` for this phase).
5. THE Dependency_Graph analysis SHALL operate on the parsed binding expressions available at compile time without executing any code.

### Requirement 11: Runtime Pruning

**User Story:** As a compiler maintainer, I want the inlined runtime to exclude `__signal` when all signals use the Proxy pattern, so that the generated output is smaller.

#### Acceptance Criteria

1. WHEN a component has no Complex_Features requiring `__effect`, THE Codegen SHALL NOT include `__signal` or `__effect` in the inlined runtime.
2. WHEN a component has Complex_Features requiring `__effect`, THE Codegen SHALL include `__effect` in the inlined runtime but SHALL NOT include `__signal`.
3. WHEN a component uses computed values, THE Codegen SHALL include `__computed` in the inlined runtime.
4. THE Codegen SHALL include the runtime globals (`__currentEffect`, `__batchDepth`, `__pendingEffects`) only when `__effect` or `__computed` is needed.

### Requirement 12: Proxy State Integration with Existing Patterns

**User Story:** As a compiler maintainer, I want the Proxy state to integrate correctly with props, model definitions, and attributeChangedCallback, so that external state updates trigger the invalidation path.

#### Acceptance Criteria

1. WHEN `attributeChangedCallback` receives a new prop value, THE Codegen SHALL generate `this._state.propName = newVal` to trigger invalidation through the Proxy setter.
2. WHEN a model definition receives an external update via attribute, THE Codegen SHALL generate `this._state.modelName = newVal` to trigger invalidation through the Proxy setter.
3. THE Proxy_State SHALL include prop signal values alongside user-defined signal values in the same state object.
4. WHEN a prop value changes via the Proxy setter, THE Invalidate_Method SHALL update all bindings that depend on that prop.
