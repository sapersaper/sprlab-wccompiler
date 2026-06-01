# Requirements Document — defineModel

## Introduction

`defineModel` adds two-way bindable props to wcCompiler. A component author declares a model prop that is both an observed attribute (like `defineProps`) and a writable signal that emits a `wcc:model` CustomEvent on write. Framework-specific adapters (Vue, Angular) translate this event to each framework's convention, while WCC-to-WCC binding uses a new `model:propName` template directive.

## Glossary

- **Model_Prop**: A prop declared via `defineModel()` that is both externally settable (via attribute) and internally writable (via `.set()`), emitting a `wcc:model` event on internal writes.
- **Compiler**: The wcCompiler pipeline (parse → tree-walk → codegen) that transforms `.wcc` files into native web component JavaScript.
- **Signal**: A reactive primitive created by `__signal()` — read with `()`, write with `.set()` or call syntax.
- **Adapter**: A side-effect runtime script (~5 lines) that listens for `wcc:model` events at the document level and re-dispatches them in a framework-specific format.
- **Model_Directive_Named**: The `model:propName="signalName"` template syntax that binds a parent signal to a child's Model_Prop for WCC-to-WCC two-way binding.
- **WCC_Model_Event**: A bubbling CustomEvent with type `wcc:model` and detail `{ prop, value, oldValue }`.

## Requirements

### Requirement 1: defineModel Macro Declaration

**User Story:** As a component author, I want to declare two-way bindable props using `defineModel()`, so that parent components can bind to them bidirectionally.

#### Acceptance Criteria

1. WHEN a `defineModel({ name: 'propName', default: value })` call is present in the script, THE Compiler SHALL register `propName` as an observed attribute (identical to `defineProps` behavior).
2. WHEN a `defineModel({ name: 'propName', default: value })` call is present, THE Compiler SHALL generate a writable signal (`this._m_propName`) initialized with the default value.
3. WHEN a `defineModel({ name: 'propName', required: true })` call is present, THE Compiler SHALL generate a writable signal initialized with `undefined`.
4. THE Compiler SHALL support multiple `defineModel()` calls within a single component script.
5. WHEN the component script contains `defineModel()`, THE Compiler SHALL strip the `defineModel` call from the output (macro behavior, same as `defineProps`).

### Requirement 2: Model Prop Signal Behavior

**User Story:** As a component author, I want the model signal to behave like a regular writable signal in my component logic, so that I can read and write it naturally.

#### Acceptance Criteria

1. THE Compiler SHALL generate a model signal that is readable via function call syntax (e.g., `value()`).
2. THE Compiler SHALL generate a model signal that is writable via `.set(newValue)` method.
3. WHEN `.set(newValue)` is called on a model signal, THE Compiler SHALL emit a `wcc:model` CustomEvent on the host element with detail `{ prop: 'propName', value: newValue, oldValue: previousValue }`.
4. THE Compiler SHALL generate the `wcc:model` event with `bubbles: true` and `composed: true`.
5. WHEN the attribute changes externally (via `setAttribute` or framework binding), THE Compiler SHALL update the model signal value without emitting a `wcc:model` event.

### Requirement 3: Attribute Synchronization

**User Story:** As a framework consumer, I want model props to behave as standard observed attributes, so that I can set them from any framework using normal attribute/property binding.

#### Acceptance Criteria

1. THE Compiler SHALL include model prop names in `static get observedAttributes()`.
2. WHEN `attributeChangedCallback` fires for a model prop, THE Compiler SHALL update the model signal with the new attribute value (applying type coercion based on the default value type).
3. THE Compiler SHALL generate public getters and setters for each model prop (e.g., `get propName()`, `set propName(val)`).
4. WHEN the public setter is called, THE Compiler SHALL update the signal and call `setAttribute` (same as `defineProps` setters).

### Requirement 4: WCC_Model_Event Emission

**User Story:** As a framework adapter author, I want a consistent event contract from model props, so that I can translate it to any framework's convention.

#### Acceptance Criteria

1. WHEN a model signal's `.set()` is called internally (from component logic), THE Compiler SHALL dispatch a CustomEvent with type `wcc:model` on the host element.
2. THE WCC_Model_Event detail SHALL contain `prop` (string — the prop name), `value` (the new value), and `oldValue` (the previous value).
3. THE WCC_Model_Event SHALL have `bubbles: true` so document-level adapters can intercept it.
4. THE WCC_Model_Event SHALL have `composed: true` so it crosses shadow DOM boundaries.
5. WHEN the signal is updated via `attributeChangedCallback` (external change), THE Compiler SHALL NOT emit a `wcc:model` event.

### Requirement 5: model:propName Template Directive (WCC-to-WCC Binding)

**User Story:** As a WCC component author, I want to use `model:propName="parentSignal"` on child components in my template, so that I get automatic two-way binding between parent and child WCC components.

#### Acceptance Criteria

1. WHEN a `model:propName="signalName"` directive is present on a child custom element, THE Compiler SHALL set the child's `propName` attribute to the parent signal's current value reactively.
2. WHEN a `model:propName="signalName"` directive is present, THE Compiler SHALL generate an event listener for `wcc:model` on the child element that updates the parent signal when `detail.prop` matches `propName`.
3. THE Compiler SHALL remove the `model:propName` attribute from the rendered template output.
4. WHEN the parent signal changes, THE Compiler SHALL update the child's attribute via an `__effect`.
5. IF `model:propName` references an undeclared signal, THEN THE Compiler SHALL emit a compile-time error.
6. IF `model:propName` references a read-only variable (prop, computed, or constant), THEN THE Compiler SHALL emit a compile-time error.

### Requirement 6: Vue Adapter

**User Story:** As a Vue developer, I want to use `v-model:propName` on WCC components, so that two-way binding works with Vue's convention.

#### Acceptance Criteria

1. WHEN the Vue adapter script is imported, THE Adapter SHALL register a document-level event listener for `wcc:model` events.
2. WHEN a `wcc:model` event is intercepted, THE Adapter SHALL dispatch a new CustomEvent with type `update:${detail.prop}` on the same element with the same detail value.
3. THE Adapter SHALL be a side-effect import (`import '@sprlab/wccompiler/adapters/vue'`) with no exports required.

### Requirement 7: Angular Adapter

**User Story:** As an Angular developer, I want to use `[(propName)]` on WCC components, so that two-way binding works with Angular's convention.

#### Acceptance Criteria

1. WHEN the Angular adapter script is imported, THE Adapter SHALL register a document-level event listener for `wcc:model` events.
2. WHEN a `wcc:model` event is intercepted, THE Adapter SHALL dispatch a new CustomEvent with type `${detail.prop}Change` on the same element with the same detail value.
3. THE Adapter SHALL be a side-effect import (`import '@sprlab/wccompiler/adapters/angular'`) with no exports required.

### Requirement 8: Graceful Degradation Without Adapter

**User Story:** As a vanilla JS developer, I want WCC components with model props to work without any adapter, so that I can listen to `wcc:model` events directly.

#### Acceptance Criteria

1. WHEN no adapter is loaded, THE component SHALL still emit `wcc:model` events on internal signal writes.
2. WHEN no adapter is loaded, THE component SHALL still accept attribute changes for one-way prop binding.
3. WHEN no adapter is loaded, THE component SHALL NOT throw errors or produce broken behavior.

### Requirement 9: Compile-Time Validations

**User Story:** As a component author, I want clear compile-time errors when I misuse `defineModel`, so that I catch mistakes early.

#### Acceptance Criteria

1. IF `defineModel()` is called without a `name` property in the options object, THEN THE Compiler SHALL emit an error.
2. IF `defineModel()` declares a prop name that conflicts with an existing signal, computed, constant, or `defineProps` prop, THEN THE Compiler SHALL emit an error.
3. IF `defineModel()` is called without assigning the result to a variable, THEN THE Compiler SHALL emit an error.
4. IF the `model:propName` directive targets a non-custom-element (e.g., a plain `<div>`), THEN THE Compiler SHALL emit an error.

### Requirement 10: Interaction with Existing model Directive

**User Story:** As a component author, I want the existing `model="signal"` directive on HTML form elements to continue working unchanged alongside `defineModel`, so that there is no regression.

#### Acceptance Criteria

1. THE Compiler SHALL preserve the existing `model="signal"` behavior on `<input>`, `<textarea>`, and `<select>` elements without modification.
2. WHEN a component uses both `defineModel()` for external binding and `model="signal"` for internal form binding, THE Compiler SHALL handle both independently without conflict.
3. THE Compiler SHALL distinguish between `model="signal"` (form element binding) and `model:propName="signal"` (named component binding) based on the presence of the colon separator.
