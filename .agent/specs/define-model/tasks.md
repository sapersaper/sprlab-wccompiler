# Implementation Plan: defineModel

## Overview

Implement the `defineModel` macro for wcCompiler, spanning the full pipeline: parser extraction → compiler orchestration → tree walker → codegen → adapters. Tasks are organized by pipeline stage, with each stage building on the previous one. Property-based tests use fast-check (already in the project).

## Tasks

- [ ] 1. Parser Extractor — `extractModels()`
  - [x] 1.1 Implement `extractModels()` in `lib/parser-extractors.js`
    - Add a new exported function `extractModels(source)` that uses regex to match `defineModel({ ... })` calls
    - Extract `varName`, `name`, `default`, and `required` from each call
    - Return an array of `ModelDef` objects
    - Follow the same pattern as `extractSignals()` and `extractPropsDefaults()`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Write property test for `extractModels()` parsing
    - **Property 1: Model signal generation preserves declaration semantics (parser portion)**
    - Generate random valid `defineModel()` source strings with 1–5 declarations, unique names, and valid defaults
    - Assert that `extractModels()` returns the correct number of ModelDef objects with matching fields
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [x] 1.3 Write unit tests for `extractModels()` edge cases
    - Test single prop, multiple props, with/without defaults, with `required: true`
    - Test that non-`defineModel` calls are ignored
    - Test that `defineModel()` without assignment is still extracted (validation happens in compiler)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 2. Compiler Orchestration — integrate `extractModels`, validate, strip macro
  - [x] 2.1 Import and call `extractModels()` in `lib/compiler.js`
    - Import `extractModels` from `./parser-extractors.js`
    - Call it after type stripping in `compileSFC()`
    - Add model var names to the set of known signal-like names for `transformMethodBody`
    - Pass `modelDefs` to the `ParseResult` object handed to codegen
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 2.2 Add compile-time validations for `defineModel`
    - Validate each `defineModel()` has a `name` property → error `MODEL_MISSING_NAME`
    - Validate each `defineModel()` is assigned to a variable → error `MODEL_NO_ASSIGNMENT`
    - Validate no name conflicts with signals, computeds, constants, or defineProps → error `MODEL_NAME_CONFLICT`
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 2.3 Strip `defineModel()` calls from the output source
    - Remove `defineModel(...)` call expressions from the compiled output (macro behavior)
    - Follow the same stripping pattern used for `defineProps` and `defineEmits`
    - _Requirements: 1.5_

  - [x] 2.4 Write property test for name conflict detection
    - **Property 8: defineModel name conflict detection**
    - Generate components with `defineModel` prop names that conflict with existing signals/computeds/constants/props
    - Assert that the compiler throws an error with code `MODEL_NAME_CONFLICT`
    - **Validates: Requirements 9.2**

  - [x] 2.5 Write unit tests for compiler validations
    - Test `MODEL_MISSING_NAME` error when `defineModel()` has no `name` property
    - Test `MODEL_NO_ASSIGNMENT` error when `defineModel()` is not assigned
    - Test `MODEL_NAME_CONFLICT` error for each conflict type (signal, computed, constant, prop)
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 3. Checkpoint — Parser and compiler integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Tree Walker — `model:propName` detection
  - [x] 4.1 Detect `model:propName="signalName"` attributes in `lib/tree-walker.js`
    - In `walkTree()`, iterate element attributes looking for names starting with `model:`
    - Extract `propName` (after the colon) and `signal` (attribute value)
    - Validate the element is a custom element (tag contains a hyphen) → error `MODEL_PROP_INVALID_TARGET`
    - Generate a `ModelPropBinding` object with `varName`, `propName`, `signal`, and `path`
    - Remove the `model:propName` attribute from the DOM
    - Ensure existing `model="signal"` handling for form elements is not affected
    - _Requirements: 5.1, 5.2, 5.3, 9.4, 10.1, 10.3_

  - [x] 4.2 Add validation for `model:propName` signal references
    - Validate the referenced signal exists (is a declared signal or model var) → error `MODEL_PROP_UNKNOWN_VAR`
    - Validate the referenced variable is writable (not a prop, computed, or constant) → error `MODEL_PROP_READONLY`
    - _Requirements: 5.5, 5.6_

  - [x] 4.3 Write property test for model:propName validation
    - **Property 7: model:propName validation rejects invalid targets**
    - Generate templates with `model:propName` referencing undeclared variables, read-only props, computeds, and constants
    - Assert that the compiler throws appropriate errors
    - **Validates: Requirements 5.5, 5.6**

  - [x] 4.4 Write property test for disambiguation
    - **Property 10: Compiler distinguishes model= from model:propName=**
    - Generate templates containing both `model="signal"` on form elements and `model:propName="signal"` on custom elements
    - Assert that form-binding code is produced for the former and component-binding code for the latter
    - **Validates: Requirements 10.3**

- [ ] 5. Codegen — Model signal generation and _modelSet methods
  - [x] 5.1 Generate model signals in the constructor in `lib/codegen.js`
    - For each `ModelDef`, emit `this._m_{name} = __signal({default})` in the constructor
    - _Requirements: 1.2, 1.3_

  - [x] 5.2 Generate `_modelSet_{name}` methods
    - For each model prop, generate a method that reads the old value, writes the new value to the signal, and dispatches `wcc:model` with `{ prop, value, oldValue }`, `bubbles: true`, `composed: true`
    - _Requirements: 2.3, 2.4, 4.1, 4.2, 4.3, 4.4_

  - [x] 5.3 Transform `.set()` calls to `_modelSet` in `transformMethodBody`
    - In `transformMethodBody()`, detect `varName.set(expr)` for model signal var names and transform to `this._modelSet_{propName}(expr)`
    - In `transformExpr()`, detect model signal reads `varName()` and transform to `this._m_{propName}()`
    - _Requirements: 2.1, 2.2_

  - [x] 5.4 Write property test for .set() transformation
    - **Property 9: .set() transformation to _modelSet**
    - Generate random model var names and `.set()` call expressions
    - Assert that the output contains `this._modelSet_{propName}(expr)` and NOT `this._m_{propName}(expr)` for writes
    - **Validates: Requirements 2.2**

  - [x] 5.5 Generate `observedAttributes` entries for model props
    - Add model prop names to the `observedAttributes` static getter alongside defineProps prop names
    - _Requirements: 1.1, 3.1_

  - [x] 5.6 Generate `attributeChangedCallback` entries for model props
    - For each model prop, add a case that updates the signal directly (`this._m_{name}(newVal)`) without calling `_modelSet`
    - Apply type coercion based on default value type (same rules as defineProps)
    - _Requirements: 2.5, 3.2, 4.5_

  - [x] 5.7 Generate public getter/setter accessors for model props
    - Generate `get propName()` returning `this._m_{propName}()`
    - Generate `set propName(val)` that updates the signal and calls `setAttribute`
    - Public setter does NOT emit `wcc:model` (equivalent to external change)
    - _Requirements: 3.3, 3.4_

  - [x] 5.8 Write property test for model signal generation
    - **Property 1: Model signal generation preserves declaration semantics**
    - Generate random `ModelDef` arrays (1–5 props, unique names, valid defaults)
    - Run codegen and assert: (a) each prop in `observedAttributes`, (b) signal `this._m_{name}` initialized with default, (c) public get/set accessors
    - **Validates: Requirements 1.1, 1.2, 1.4, 3.1, 3.3**

  - [x] 5.9 Write property test for event emission structure
    - **Property 2: Internal write emits wcc:model with correct detail**
    - Generate random prop names and values
    - Assert `_modelSet_{name}` method dispatches `CustomEvent('wcc:model')` with correct detail, bubbles, composed
    - **Validates: Requirements 2.3, 2.4, 4.1, 4.2, 4.3, 4.4**

  - [x] 5.10 Write property test for external attribute change
    - **Property 3: External attribute change does NOT emit event**
    - Generate random prop names
    - Assert `attributeChangedCallback` handler updates signal directly without `dispatchEvent` or `_modelSet`
    - **Validates: Requirements 2.5, 4.5**

- [x] 6. Checkpoint — Core codegen complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Codegen — `model:propName` directive binding
  - [x] 7.1 Generate bidirectional binding code for `model:propName`
    - For each `ModelPropBinding`, generate an `__effect` that sets the child's attribute from the parent signal
    - Generate an event listener for `wcc:model` on the child element that updates the parent signal when `detail.prop` matches
    - Store child element reference using the binding's `varName` (e.g., `this.__modelProp0`)
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 7.2 Write property test for bidirectional binding
    - **Property 4: model:propName generates bidirectional binding**
    - Generate random `ModelPropBinding` objects
    - Assert generated code contains: (a) `__effect` setting child attribute, (b) event listener updating parent signal
    - **Validates: Requirements 5.1, 5.2, 5.4**

- [ ] 8. Adapters — Vue and Angular side-effect scripts
  - [x] 8.1 Create Vue adapter at `adapters/vue.js`
    - Register a document-level event listener for `wcc:model`
    - On event, dispatch `update:${detail.prop}` CustomEvent on the same element with the detail value
    - Side-effect import with no exports
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 8.2 Create Angular adapter at `adapters/angular.js`
    - Register a document-level event listener for `wcc:model`
    - On event, dispatch `${detail.prop}Change` CustomEvent on the same element with the detail value
    - Side-effect import with no exports
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 8.3 Write property test for Vue adapter
    - **Property 5: Vue adapter translates wcc:model to update:propName**
    - Generate random prop names and values, dispatch `wcc:model`, assert `update:${prop}` is dispatched
    - **Validates: Requirements 6.2**

  - [x] 8.4 Write property test for Angular adapter
    - **Property 6: Angular adapter translates wcc:model to propNameChange**
    - Generate random prop names and values, dispatch `wcc:model`, assert `${prop}Change` is dispatched
    - **Validates: Requirements 7.2**

  - [x] 8.5 Write unit tests for adapter behavior
    - Test that adapters register document-level listeners on import
    - Test graceful behavior when no adapter is loaded (component still emits events, no errors)
    - _Requirements: 6.1, 7.1, 8.1, 8.2, 8.3_

- [ ] 9. Integration Tests — Full pipeline
  - [x] 9.1 Write integration tests for `defineModel` compilation
    - Test full compile pipeline: component with `defineModel` → verify complete generated output
    - Test component with both `defineModel` and `model="signal"` on form elements → no regression
    - Test parent-child WCC binding via `model:propName`
    - Place tests in `lib/compiler.defineModel.test.js`
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 5.1, 5.2, 10.1, 10.2, 10.3_

  - [x] 9.2 Run existing model tests to verify no regression
    - Ensure all tests in `lib/codegen.model.test.js` still pass
    - Ensure all tests in `lib/compiler.model.test.js` still pass
    - _Requirements: 10.1, 10.2_

- [x] 10. Final checkpoint — All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The project uses `vitest` for testing and `fast-check` for property-based tests
- Run tests with `yarn vitest --run`
- The `_m_` prefix distinguishes model signals from regular signals (`_`) and prop signals (`_s_`)
- The `_modelSet_` prefix distinguishes internal writes (emit event) from external writes (no event)
