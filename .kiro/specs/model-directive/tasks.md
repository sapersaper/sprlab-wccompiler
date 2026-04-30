# Implementation Plan: wcCompiler v2 — model

## Overview

This plan implements `model` two-way data binding for wcCompiler v2. It extends the tree walker with `model` attribute detection, element type determination, validation, and attribute removal; extends the code generator with DOM element references in the constructor, reactive effects (signal → DOM) in `connectedCallback`, and event listeners (DOM → signal) in `connectedCallback`; and ensures the compiler pipeline passes `modelBindings` through to code generation. The implementation reuses v1 patterns from `lib/tree-walker.js` and `lib/codegen.js`.

All code extends existing modules in `v2/lib/`. Tests use vitest + fast-check. This feature depends on the core spec being implemented first.

## Tasks

- [ ] 1. Extend ParseResult types for model
  - [ ] 1.1 Add `ModelBinding` typedef in `v2/lib/types.js`
    - Add `@typedef {Object} ModelBinding` with fields: `varName` (string), `signal` (string), `prop` (string: 'value'|'checked'), `event` (string: 'input'|'change'), `coerce` (boolean), `radioValue` (string|null), `path` (string[])
    - Add `modelBindings: ModelBinding[]` field to `ParseResult` typedef
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 2. Implement tree walker extensions for model
  - [ ] 2.1 Implement `model` attribute detection and validation in `walkTree()` in `v2/lib/tree-walker.js`
    - During element node traversal, check if element has a `model` attribute
    - Validate element is a form element (`input`, `textarea`, `select`) → else throw error with code `INVALID_MODEL_ELEMENT`
    - Validate model value is non-empty and matches `/^[a-zA-Z_$][\w$]*$/` → else throw error with code `INVALID_MODEL_TARGET`
    - _Requirements: 1.1, 1.2, 7.1, 8.1, 8.2_

  - [ ] 2.2 Implement element type detection logic in `v2/lib/tree-walker.js`
    - For `<select>`: set prop=`value`, event=`change`, coerce=false, radioValue=null
    - For `<textarea>`: set prop=`value`, event=`input`, coerce=false, radioValue=null
    - For `<input type="checkbox">`: set prop=`checked`, event=`change`, coerce=false, radioValue=null
    - For `<input type="radio">`: set prop=`checked`, event=`change`, coerce=false, radioValue=el.getAttribute('value')
    - For `<input type="number">`: set prop=`value`, event=`input`, coerce=true, radioValue=null
    - For `<input>` (all other types or no type): set prop=`value`, event=`input`, coerce=false, radioValue=null
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.4, 3.5_

  - [ ] 2.3 Record ModelBinding and remove attribute in `v2/lib/tree-walker.js`
    - Remove the `model` attribute from the element
    - Record a ModelBinding with sequential varName (`__model0`, `__model1`, ...), signal name, prop, event, coerce, radioValue, and current DOM path
    - Support multiple `model` directives on different elements within the same template
    - Support `model` directives at any nesting depth
    - _Requirements: 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 9.1_

- [ ] 3. Extend the Code Generator for model
  - [ ] 3.1 Generate constructor DOM references for ModelBindings in `v2/lib/codegen.js`
    - For each ModelBinding: generate a DOM element reference by navigating from `__root` through the path segments
    - Example: `this.__model0 = __root.childNodes[0].childNodes[1];`
    - DOM reference MUST be assigned before `appendChild` moves nodes from the template root
    - _Requirements: 6.1, 6.2, 6.3, 9.4_

  - [ ] 3.2 Generate signal-to-DOM effects in connectedCallback for ModelBindings
    - For value-based bindings (text, number, textarea, select): `__effect(() => { this.__model0.value = this._<signal>() ?? ''; });`
    - For checkbox: `__effect(() => { this.__model1.checked = !!this._<signal>(); });`
    - For radio: `__effect(() => { this.__model2.checked = (this._<signal>() === '<radioValue>'); });`
    - Generate one `__effect` per ModelBinding
    - _Requirements: 4.1, 4.2, 4.3, 9.2_

  - [ ] 3.3 Generate DOM-to-signal event listeners in connectedCallback for ModelBindings
    - For text input / textarea: `this.__model0.addEventListener('input', (e) => { this._<signal>(e.target.value); });`
    - For checkbox: `this.__model1.addEventListener('change', (e) => { this._<signal>(e.target.checked); });`
    - For radio: `this.__model2.addEventListener('change', (e) => { this._<signal>(e.target.value); });`
    - For number input (coerce=true): `this.__model3.addEventListener('input', (e) => { this._<signal>(Number(e.target.value)); });`
    - For select: `this.__model4.addEventListener('change', (e) => { this._<signal>(e.target.value); });`
    - Generate one event listener per ModelBinding
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 9.3_

- [ ] 4. Update the Compiler pipeline
  - [ ] 4.1 Ensure `modelBindings` are passed through in `v2/lib/compiler.js`
    - Verify that `walkTree()` returns `modelBindings` in its result object
    - Merge `modelBindings` into ParseResult before passing to `generateComponent()`
    - _Requirements: 1.1, 3.1_

- [ ] 5. Checkpoint — Ensure all implementation compiles
  - Run `yarn test` from `v2/` to verify no regressions in core tests and new code compiles. Ask the user if questions arise.

- [ ] 6. Write tests for tree walker model extensions
  - [ ]* 6.1 Write property test for model attribute detection and ModelBinding structure (Property 1)
    - **Property 1: Model Attribute Detection and ModelBinding Structure**
    - Use fast-check to generate HTML templates with one or more form elements (`input`, `textarea`, `select`) with `model` attributes at various nesting depths
    - Call `walkTree()`, assert one ModelBinding per `model` element with sequential varNames (`__model0`, `__model1`, ...), correct signal name, and valid DOM path
    - Minimum 100 iterations
    - Tag: `Feature: model-directive, Property 1: Model Attribute Detection and ModelBinding Structure`
    - **Validates: Requirements 1.1, 1.2, 1.4, 1.5, 3.1, 3.2, 3.3, 9.1**

  - [ ]* 6.2 Write property test for element type detection correctness (Property 2)
    - **Property 2: Element Type Detection Correctness**
    - Use fast-check to generate form elements with various types (text, checkbox, radio, number, select, textarea)
    - Call `walkTree()`, assert correct `prop`, `event`, `coerce`, and `radioValue` for each element type
    - Minimum 100 iterations
    - Tag: `Feature: model-directive, Property 2: Element Type Detection Correctness`
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 3.4, 3.5**

  - [ ]* 6.3 Write property test for model attribute removal (Property 3)
    - **Property 3: Model Attribute Removal**
    - Use fast-check to generate HTML templates with `model` attributes on various form elements
    - Call `walkTree()`, assert the processed template contains zero `model` attributes
    - Minimum 100 iterations
    - Tag: `Feature: model-directive, Property 3: Model Attribute Removal`
    - **Validates: Requirements 1.3**

  - [ ]* 6.4 Write property test for invalid model element error (Property 6)
    - **Property 6: Invalid Model Element Error**
    - Use fast-check to generate non-form elements (`div`, `span`, `p`, `section`, `h1`, etc.) with `model` attributes
    - Assert `INVALID_MODEL_ELEMENT` error is thrown
    - Minimum 100 iterations
    - Tag: `Feature: model-directive, Property 6: Invalid Model Element Error`
    - **Validates: Requirements 7.1**

  - [ ]* 6.5 Write property test for invalid model target error (Property 7)
    - **Property 7: Invalid Model Target Error**
    - Use fast-check to generate form elements with `model` attributes containing empty strings or invalid identifiers (starting with numbers, containing spaces, special characters)
    - Assert `INVALID_MODEL_TARGET` error is thrown
    - Minimum 100 iterations
    - Tag: `Feature: model-directive, Property 7: Invalid Model Target Error`
    - **Validates: Requirements 8.1, 8.2**

  - [ ]* 6.6 Write unit tests for tree walker edge cases
    - Test multiple `model` directives in same parent element
    - Test deeply nested `model` elements
    - Test `<input type="radio">` records correct `radioValue` from element's `value` attribute
    - Test `<input type="number">` sets `coerce` to `true`
    - Test `model` alongside other bindings (`{{interpolation}}`, `@event`, `show`) on sibling elements
    - _Requirements: 1.4, 1.5, 2.1, 2.2, 3.4, 3.5, 9.1_

- [ ] 7. Write tests for code generation
  - [ ]* 7.1 Write property test for codegen signal-to-DOM effect structure (Property 4)
    - **Property 4: Codegen Signal-to-DOM Effect Structure**
    - Use fast-check to generate ParseResult IRs with ModelBindings (varying element types, signal names, paths)
    - Call `generateComponent()`, assert output contains: DOM element reference per ModelBinding in constructor, `__effect` per ModelBinding in `connectedCallback` with correct property assignment (`value` or `checked`)
    - Minimum 100 iterations
    - Tag: `Feature: model-directive, Property 4: Codegen Signal-to-DOM Effect Structure`
    - **Validates: Requirements 4.1, 4.2, 4.3, 6.1, 6.2, 6.3, 9.2, 9.4**

  - [ ]* 7.2 Write property test for codegen DOM-to-signal event listener structure (Property 5)
    - **Property 5: Codegen DOM-to-Signal Event Listener Structure**
    - Use fast-check to generate ParseResult IRs with ModelBindings (varying element types, signal names)
    - Call `generateComponent()`, assert output contains: one `addEventListener` per ModelBinding with correct event name, correct DOM property read (`e.target.value` or `e.target.checked`), and `Number()` wrapping for coerced bindings
    - Minimum 100 iterations
    - Tag: `Feature: model-directive, Property 5: Codegen DOM-to-Signal Event Listener Structure`
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 9.3**

  - [ ]* 7.3 Write unit tests for codegen edge cases
    - Test number coercion: `Number(e.target.value)` for `<input type="number">`
    - Test radio checked comparison: `this._signal() === 'radioValue'`
    - Test multiple model effects are generated in document order
    - Test model effects alongside other effects (text bindings, show bindings, event bindings)
    - Test that DOM references are assigned before `appendChild`
    - _Requirements: 4.3, 5.5, 6.3, 9.2, 9.3_

- [ ] 8. Write integration test
  - [ ]* 8.1 Write end-to-end compiler test with model (`v2/lib/compiler.model.test.js`)
    - Create a temp component with multiple `model` directives: text input, checkbox, radio, number, select, textarea
    - Include `{{interpolation}}` and `@event` bindings alongside `model` directives
    - Compile and verify output contains: DOM element references in constructor, signal-to-DOM effects with correct property assignments, DOM-to-signal event listeners with correct events and value reads
    - Test that checkbox uses `!!this._signal()` and `e.target.checked`
    - Test that radio uses `this._signal() === 'value'` and `e.target.value`
    - Test that number uses `Number(e.target.value)`
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 9.2, 9.3_

- [ ] 9. Final checkpoint — Ensure all tests pass
  - Run `yarn test` from `v2/` and verify all tests pass. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- This feature depends on the core spec being fully implemented
- v1 reference files: `lib/tree-walker.js` (model detection in walkTree), `lib/codegen.js` (model codegen sections)
- ModelBindings use sequential naming (`__model0`, `__model1`, ...) — v1 uses `__m0`, `__m1` but v2 uses the more descriptive prefix
- The `model` directive is self-contained — no anchors, no templates, no branch logic
- Model bindings discovered inside `if` or `each` branches are handled by those directives' setup methods (via `walkBranch`), not by the top-level model codegen
- The `model` value is always a bare signal name, not an arbitrary expression — no `transformExpr` needed
- Radio inputs need the element's `value` attribute stored at compile time for the checked comparison
- Number inputs need `Number()` coercion to maintain type consistency with the signal

## Changelog

### 2026-04-30: Model target validation in compiler

Added compile-time validation that `model` targets are valid signals. The compiler now rejects:
- `model="propName"` → `MODEL_READONLY` (props are read-only, updated via attributes)
- `model="computedName"` → `MODEL_READONLY` (computeds are derived, not writable)
- `model="constantName"` → `MODEL_READONLY` (constants never change)
- `model="undeclaredVar"` → `MODEL_UNKNOWN_VAR` (variable not found in signals)

Files modified:
- `v2/lib/compiler.js` — Added model binding validation after ref validation (checks against `propNames`, `computedNames`, `constantNames`, `signalNames`)

### 2026-04-30: Model bindings inside `if` branches

`walkBranch()` now returns `modelBindings` from the inner `walkTree()` call, and the codegen `_setup()` method for if branches generates model effects (signal → DOM) and event listeners (DOM → signal) per branch. Previously, `model` directives inside conditional branches were silently ignored.

Files modified:
- `v2/lib/types.js` — Added `modelBindings: ModelBinding[]` to `IfBranch` typedef
- `v2/lib/tree-walker.js` — `walkBranch()` now strips first path segment from `modelBindings` and includes them in return value
- `v2/lib/codegen.js` — If branch `_setup()` method now generates model effects and listeners (checkbox, radio, number coercion supported)

### 2026-04-30: Model bindings inside `each` blocks

`walkBranch()` now returns `modelBindings` for each blocks too, and the codegen each effect generates per-item model effects and event listeners. Previously, `model` directives inside loop items were silently ignored.

Files modified:
- `v2/lib/types.js` — Added `modelBindings: ModelBinding[]` to `ForBlock` typedef
- `v2/lib/tree-walker.js` — `walkBranch()` includes `modelBindings` in return, `processForBlocks` passes them to `ForBlock`
- `v2/lib/codegen.js` — Each effect now generates per-item model effects (signal → DOM) and event listeners (DOM → signal)
