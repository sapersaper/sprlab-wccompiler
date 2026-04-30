# Requirements Document

## Introduction

This document specifies the `onMount` / `onDestroy` lifecycle hooks feature for wcCompiler v2. Lifecycle hooks allow component authors to run code when the component is connected to (`onMount`) or disconnected from (`onDestroy`) the DOM. The hooks are script-level constructs — they do not involve template attributes or DOM manipulation by the tree walker. The Parser detects `onMount(() => { body })` and `onDestroy(() => { body })` calls in the component source, extracts the callback bodies, and the Code Generator places the transformed bodies in `connectedCallback` and `disconnectedCallback` respectively. This feature builds on the core spec (signal, computed, effect, defineComponent, template engine base, CSS scoping, CLI).

## Glossary

- **Parser**: The module that reads a `.ts`/`.js` source file, detects `defineComponent()`, reactive declarations, and lifecycle hook calls (defined in core spec)
- **Code_Generator**: The module that produces a self-contained `.js` file from the parsed intermediate representation (defined in core spec)
- **Lifecycle_Hook**: A call to `onMount(() => { body })` or `onDestroy(() => { body })` at the top level of a Component_Source file
- **Mount_Hook**: A lifecycle hook registered via `onMount(() => { body })` that executes when the component is connected to the DOM
- **Destroy_Hook**: A lifecycle hook registered via `onDestroy(() => { body })` that executes when the component is disconnected from the DOM
- **Callback_Body**: The JavaScript code inside the arrow function passed to `onMount` or `onDestroy`
- **Component_Source**: A `.ts` or `.js` file that contains a `defineComponent()` call and reactive logic (defined in core spec)
- **Pretty_Printer**: The module that serializes a ParseResult IR back to valid source format for round-trip testing (defined in core spec)

## Requirements

### Requirement 1: onMount Hook Extraction

**User Story:** As a component author, I want to write `onMount(() => { ... })` in my component source, so that the compiler detects the hook and runs my code when the component is added to the DOM.

#### Acceptance Criteria

1. WHEN the Component_Source contains an `onMount(() => { body })` call at the top level, THE Parser SHALL extract the Callback_Body
2. WHEN the Component_Source contains multiple `onMount` calls, THE Parser SHALL extract all Callback_Bodies and preserve their source order
3. WHEN the Component_Source contains `onMount` calls inside nested blocks (functions, if statements), THE Parser SHALL ignore them (only top-level calls are extracted)
4. THE Parser SHALL store extracted mount hook bodies in the `onMountHooks` array of the ParseResult

### Requirement 2: onDestroy Hook Extraction

**User Story:** As a component author, I want to write `onDestroy(() => { ... })` in my component source, so that the compiler detects the hook and runs my cleanup code when the component is removed from the DOM.

#### Acceptance Criteria

1. WHEN the Component_Source contains an `onDestroy(() => { body })` call at the top level, THE Parser SHALL extract the Callback_Body
2. WHEN the Component_Source contains multiple `onDestroy` calls, THE Parser SHALL extract all Callback_Bodies and preserve their source order
3. WHEN the Component_Source contains `onDestroy` calls inside nested blocks (functions, if statements), THE Parser SHALL ignore them (only top-level calls are extracted)
4. THE Parser SHALL store extracted destroy hook bodies in the `onDestroyHooks` array of the ParseResult

### Requirement 3: Callback Body Extraction via Brace-Depth Tracking

**User Story:** As a component author, I want to write multi-line callback bodies with nested braces inside lifecycle hooks, so that the compiler correctly captures the entire body regardless of complexity.

#### Acceptance Criteria

1. WHEN the Callback_Body contains nested braces (e.g., if statements, object literals, nested functions), THE Parser SHALL use brace-depth tracking to capture the complete body
2. WHEN the Callback_Body spans multiple lines, THE Parser SHALL capture all lines between the opening and closing braces of the arrow function
3. THE Parser SHALL dedent the extracted body lines by removing common leading whitespace

### Requirement 4: Code Generation — connectedCallback Placement

**User Story:** As a component author, I want my `onMount` code to run after all effects and event listeners are set up, so that I can safely interact with the fully initialized component DOM.

#### Acceptance Criteria

1. WHEN the ParseResult contains `onMountHooks`, THE Code_Generator SHALL place the transformed hook bodies at the END of `connectedCallback`, after all effects and event listeners
2. WHEN multiple mount hooks exist, THE Code_Generator SHALL emit them in source order (same order as `onMountHooks` array)
3. THE Code_Generator SHALL apply `transformMethodBody` to each mount hook body, rewriting signal reads, signal writes, computed reads, and prop references

### Requirement 5: Code Generation — disconnectedCallback Placement

**User Story:** As a component author, I want my `onDestroy` code to run when the component is removed from the DOM, so that I can clean up resources like intervals, subscriptions, and event listeners.

#### Acceptance Criteria

1. WHEN the ParseResult contains `onDestroyHooks`, THE Code_Generator SHALL generate a `disconnectedCallback` method containing the transformed hook bodies
2. WHEN multiple destroy hooks exist, THE Code_Generator SHALL emit them in source order (same order as `onDestroyHooks` array)
3. THE Code_Generator SHALL apply `transformMethodBody` to each destroy hook body, rewriting signal reads, signal writes, computed reads, and prop references
4. IF the ParseResult contains no `onDestroyHooks`, THEN THE Code_Generator SHALL omit the `disconnectedCallback` method entirely

### Requirement 6: Signal and Computed Transformation in Hook Bodies

**User Story:** As a component author, I want to use signals and computeds inside lifecycle hook bodies with the same syntax as in methods, so that I don't need to learn different patterns for hooks.

#### Acceptance Criteria

1. WHEN a mount or destroy hook body references a signal name `x`, THE Code_Generator SHALL transform `x()` reads to `this._x()` and `x.set(value)` writes to `this._x(value)`
2. WHEN a mount or destroy hook body references a computed name `x`, THE Code_Generator SHALL transform `x()` reads to `this._c_x()`
3. WHEN a mount or destroy hook body references a prop via `props.name`, THE Code_Generator SHALL transform it to `this._s_name()`

### Requirement 7: No Tree Walker Involvement

**User Story:** As a compiler developer, I want lifecycle hooks to be purely script-level constructs, so that the tree walker remains focused on template processing without lifecycle concerns.

#### Acceptance Criteria

1. THE Tree_Walker SHALL NOT process or detect any lifecycle hook-related attributes or elements in the template
2. THE Parser SHALL handle all lifecycle hook detection and extraction without delegating to the Tree_Walker

### Requirement 8: Pretty-Printer Round-Trip

**User Story:** As a compiler developer, I want the pretty-printer to serialize lifecycle hooks back to valid source format, so that round-trip testing verifies parsing correctness.

#### Acceptance Criteria

1. WHEN the ParseResult contains `onMountHooks`, THE Pretty_Printer SHALL emit `onMount(() => {\n  body\n})` for each hook in order
2. WHEN the ParseResult contains `onDestroyHooks`, THE Pretty_Printer SHALL emit `onDestroy(() => {\n  body\n})` for each hook in order
3. FOR ALL valid Component_Source inputs containing lifecycle hooks, parsing then printing then parsing SHALL produce an equivalent intermediate representation (round-trip property)
