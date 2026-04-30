# Implementation Plan: wcCompiler v2 — show

## Overview

This plan implements `show` visibility toggling for wcCompiler v2. It extends the tree walker with `show` attribute detection, expression extraction, and attribute removal; extends the code generator with DOM element references in the constructor and reactive effects in `connectedCallback` that toggle `element.style.display`; and ensures the compiler pipeline passes `showBindings` through to code generation. The implementation reuses v1 patterns from `lib/tree-walker.js` and `lib/codegen.js`.

All code extends existing modules in `v2/lib/`. Tests use vitest + fast-check. This feature depends on the core spec being implemented first.

## Tasks

- [ ] 1. Extend ParseResult types for show
  - [ ] 1.1 Add `ShowBinding` typedef in `v2/lib/types.js`
    - Add `@typedef {Object} ShowBinding` with fields: `varName` (string), `expression` (string), `path` (string[])
    - Add `showBindings: ShowBinding[]` field to `ParseResult` typedef
    - _Requirements: 2.1, 2.2, 2.3_

- [ ] 2. Implement tree walker extensions for show
  - [ ] 2.1 Implement `show` attribute detection in `walkTree()` in `v2/lib/tree-walker.js`
    - During element node traversal, check if element has a `show` attribute
    - Extract the expression string from the `show` attribute value
    - Remove the `show` attribute from the element
    - Record a ShowBinding with the current DOM path, expression, and sequential varName (`__show0`, `__show1`, ...)
    - Support `show` directives at any nesting depth within the template
    - Support multiple `show` directives on different elements within the same template
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3_

  - [ ] 2.2 Verify conflicting directive validation for `show` + `if`
    - Confirm that the existing `processIfChains` validation pass detects `show` + `if` on the same element
    - If not already handled, add validation: throw error with code `CONFLICTING_DIRECTIVES` when both `show` and `if` are present on the same element
    - _Requirements: 6.1_

- [ ] 3. Extend the Code Generator for show
  - [ ] 3.1 Generate constructor DOM references for ShowBindings in `v2/lib/codegen.js`
    - For each ShowBinding: generate a DOM element reference by navigating from `__root` through the path segments
    - Example: `this.__show0 = __root.childNodes[0].childNodes[1];`
    - DOM reference MUST be assigned before `appendChild` moves nodes from the template root
    - _Requirements: 5.1, 5.2, 5.3, 7.3_

  - [ ] 3.2 Generate reactive effects in connectedCallback for ShowBindings
    - For each ShowBinding: generate an `__effect` that evaluates the expression and sets `element.style.display`
    - Use `transformExpr` to rewrite signal references to `this._<signalName>()`, computed to `this._c_<computedName>()`, and prop to `this._s_<propName>()`
    - Generated pattern: `__effect(() => { this.__show0.style.display = (transformedExpr) ? '' : 'none'; });`
    - Generate one `__effect` per ShowBinding
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 7.2_

- [ ] 4. Update the Compiler pipeline
  - [ ] 4.1 Ensure `showBindings` are passed through in `v2/lib/compiler.js`
    - Verify that `walkTree()` returns `showBindings` in its result object
    - Merge `showBindings` into ParseResult before passing to `generateComponent()`
    - _Requirements: 1.1, 2.1_

- [ ] 5. Checkpoint — Ensure all implementation compiles
  - Run `yarn test` from `v2/` to verify no regressions in core tests and new code compiles. Ask the user if questions arise.

- [ ] 6. Write tests for tree walker show extensions
  - [ ]* 6.1 Write property test for show attribute detection and ShowBinding structure (Property 1)
    - **Property 1: Show Attribute Detection and ShowBinding Structure**
    - Use fast-check to generate HTML templates with one or more elements with `show` attributes at various nesting depths
    - Call `walkTree()`, assert one ShowBinding per `show` element with sequential varNames (`__show0`, `__show1`, ...), correct expression string, and valid DOM path
    - Minimum 100 iterations
    - Tag: `Feature: show-directive, Property 1: Show Attribute Detection and ShowBinding Structure`
    - **Validates: Requirements 1.1, 1.2, 1.4, 1.5, 2.1, 2.2, 2.3, 7.1**

  - [ ]* 6.2 Write property test for show attribute removal (Property 2)
    - **Property 2: Show Attribute Removal**
    - Use fast-check to generate HTML templates with `show` attributes on various elements
    - Call `walkTree()`, assert the processed template contains zero `show` attributes
    - Minimum 100 iterations
    - Tag: `Feature: show-directive, Property 2: Show Attribute Removal`
    - **Validates: Requirements 1.3**

  - [ ]* 6.3 Write property test for conflicting directives error (Property 5)
    - **Property 5: Conflicting Directives Error**
    - Use fast-check to generate elements with both `show` and `if` attributes
    - Assert `CONFLICTING_DIRECTIVES` error is thrown
    - Minimum 100 iterations
    - Tag: `Feature: show-directive, Property 5: Conflicting Directives Error`
    - **Validates: Requirements 6.1**

  - [ ]* 6.4 Write unit tests for tree walker edge cases
    - Test multiple `show` directives in same parent element
    - Test deeply nested `show` elements
    - Test `show` with complex expressions (e.g., `count > 0 && isActive`)
    - Test `show` alongside other bindings (`{{interpolation}}`, `@event`) on the same element
    - _Requirements: 1.4, 1.5, 7.1_

- [ ] 7. Write tests for code generation
  - [ ]* 7.1 Write property test for codegen effect structure (Property 3)
    - **Property 3: Codegen Effect Structure**
    - Use fast-check to generate ParseResult IRs with ShowBindings (varying paths, expressions, signal/computed/prop references)
    - Call `generateComponent()`, assert output contains: DOM element reference per ShowBinding in constructor, `__effect` per ShowBinding in `connectedCallback` with `style.display` assignment using `transformExpr`-ed expression
    - Minimum 100 iterations
    - Tag: `Feature: show-directive, Property 3: Codegen Effect Structure`
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3, 7.2, 7.3**

  - [ ]* 7.2 Write property test for expression auto-unwrap (Property 4)
    - **Property 4: Expression Auto-Unwrap**
    - Use fast-check to generate `show` expressions with a mix of signal, computed, and prop references
    - Assert signals transform to `this._x()`, computeds to `this._c_y()`, props to `this._s_z()`
    - Minimum 100 iterations
    - Tag: `Feature: show-directive, Property 4: Expression Auto-Unwrap`
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [ ]* 7.3 Write unit tests for codegen edge cases
    - Test complex expression transformation (e.g., `count > 0 && isActive` → `this._count() > 0 && this._isActive()`)
    - Test multiple show effects are generated in document order
    - Test show effect alongside other effects (text bindings, event bindings)
    - Test that DOM references are assigned before `appendChild`
    - _Requirements: 3.4, 5.3, 7.2_

- [ ] 8. Write integration test
  - [ ]* 8.1 Write end-to-end compiler test with show (`v2/lib/compiler.show.test.js`)
    - Create a temp component with multiple `show` directives using signal-based expressions
    - Include `{{interpolation}}` and `@event` bindings alongside `show` directives
    - Compile and verify output contains: DOM element references in constructor, reactive effects with transformed expressions setting `style.display`, correct ordering of show effects relative to other effects
    - Test that signal names in expressions are transformed to `this._name()`
    - Test complex expression: `show="count > 0"` → `this._count() > 0`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 5.1, 5.2, 7.2_

- [ ] 9. Final checkpoint — Ensure all tests pass
  - Run `yarn test` from `v2/` and verify all tests pass. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- This feature depends on the core spec being fully implemented
- v1 reference files: `lib/tree-walker.js` (show detection in walkTree), `lib/codegen.js` (show codegen sections)
- ShowBindings use sequential naming (`__show0`, `__show1`, ...) matching v1 convention
- The `show` directive is significantly simpler than `if`/`each` — no anchors, no templates, no branch logic, no item iteration
- The `show` + `if` conflicting directive validation is shared with the if-directive spec and may already be implemented
- `transformExpr` is reused from core/if — no new transformation logic needed for show
- Show bindings discovered inside `if` or `each` branches are handled by those directives' setup methods (via `walkBranch`), not by the top-level show codegen

