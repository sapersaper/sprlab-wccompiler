# Implementation Plan: wcCompiler v2 — attr-bindings

## Overview

This plan implements attribute bindings (`:attr`, `:class`, `:style`) for wcCompiler v2. It extends the tree walker with binding attribute detection, kind classification, expression extraction, and attribute removal; extends the code generator with DOM element references in the constructor and reactive effects in `connectedCallback` that update attributes, classes, or styles based on binding kind; and ensures the compiler pipeline passes `attrBindings` through to code generation. The implementation reuses v1 patterns from `lib/tree-walker.js` and `lib/codegen.js`.

All code extends existing modules in `v2/lib/`. Tests use vitest + fast-check. This feature depends on the core spec being implemented first.

## Tasks

- [ ] 1. Extend ParseResult types for attr-bindings
  - [ ] 1.1 Add `AttrBinding` typedef in `v2/lib/types.js`
    - Add `@typedef {Object} AttrBinding` with fields: `varName` (string), `attr` (string), `expression` (string), `kind` ('attr'|'class'|'style'|'bool'), `path` (string[])
    - Add `attrBindings: AttrBinding[]` field to `ParseResult` typedef
    - Add `BOOLEAN_ATTRIBUTES` constant: `new Set(['disabled', 'checked', 'hidden', 'readonly', 'required', 'selected', 'multiple', 'autofocus', 'autoplay', 'controls', 'loop', 'muted', 'open', 'novalidate'])`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_

- [ ] 2. Implement tree walker extensions for attr-bindings
  - [ ] 2.1 Implement attribute binding detection in `walkTree()` in `v2/lib/tree-walker.js`
    - During element node traversal, iterate all attributes of the element
    - Detect attributes starting with `:` — extract attr name as `name.slice(1)`
    - Detect attributes starting with `bind:` — extract attr name as `name.slice(5)`
    - Extract the expression string from the attribute value
    - Classify binding kind: `class` → `'class'`, `style` → `'style'`, boolean attr → `'bool'`, otherwise → `'attr'`
    - Remove the binding attribute from the element
    - Record an AttrBinding with the current DOM path, attr, expression, kind, and sequential varName (`__attr0`, `__attr1`, ...)
    - Support multiple attribute bindings on the same element
    - Support attribute bindings at any nesting depth within the template
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 12.1_

- [ ] 3. Extend the Code Generator for attr-bindings
  - [ ] 3.1 Generate constructor DOM references for AttrBindings in `v2/lib/codegen.js`
    - For each AttrBinding: generate a DOM element reference by navigating from `__root` through the path segments
    - Example: `this.__attr0 = __root.childNodes[0].childNodes[1];`
    - When multiple AttrBindings share the same path, reuse the first reference: `this.__attr1 = this.__attr0;`
    - DOM reference MUST be assigned before `appendChild` moves nodes from the template root
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 12.3_

  - [ ] 3.2 Generate reactive effects for regular attribute bindings (kind `'attr'`)
    - For each AttrBinding with kind `'attr'`: generate an `__effect` in `connectedCallback`
    - Use `transformExpr` to rewrite signal references to `this._<signalName>()`, computed to `this._c_<computedName>()`, and prop to `this._s_<propName>()`
    - Generated pattern: evaluate expression, call `setAttribute(name, value)` when truthy or empty string, call `removeAttribute(name)` for other falsy values
    - _Requirements: 4.1, 4.2, 4.3, 10.1, 10.2, 10.3_

  - [ ] 3.3 Generate reactive effects for boolean attribute bindings (kind `'bool'`)
    - For each AttrBinding with kind `'bool'`: generate an `__effect` in `connectedCallback`
    - Use `transformExpr` to rewrite signal and computed references
    - Generated pattern: `element.disabled = !!(transformedExpr);` (property assignment with `!!` coercion)
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 3.4 Generate reactive effects for class bindings (kind `'class'`)
    - For each AttrBinding with kind `'class'`: generate an `__effect` in `connectedCallback`
    - Detect object vs string expression: check if expression starts with `{`
    - Object expression: evaluate object, iterate entries, call `classList.add(key)` for truthy values, `classList.remove(key)` for falsy values
    - String expression: set `element.className = value`
    - Use `transformExpr` to rewrite signal and computed references
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2_

  - [ ] 3.5 Generate reactive effects for style bindings (kind `'style'`)
    - For each AttrBinding with kind `'style'`: generate an `__effect` in `connectedCallback`
    - Detect object vs string expression: check if expression starts with `{`
    - Object expression: evaluate object, iterate entries, set `element.style[key] = value`
    - String expression: set `element.style.cssText = value`
    - Use `transformExpr` to rewrite signal and computed references
    - _Requirements: 8.1, 8.2, 8.3, 9.1, 9.2_

- [ ] 4. Update the Compiler pipeline
  - [ ] 4.1 Ensure `attrBindings` are passed through in `v2/lib/compiler.js`
    - Verify that `walkTree()` returns `attrBindings` in its result object
    - Merge `attrBindings` into ParseResult before passing to `generateComponent()`
    - _Requirements: 1.1, 3.1_

- [ ] 5. Checkpoint — Ensure all implementation compiles
  - Run `yarn test` from `v2/` to verify no regressions in core tests and new code compiles. Ask the user if questions arise.

- [ ] 6. Write tests for tree walker attr-binding extensions
  - [ ]* 6.1 Write property test for attribute binding detection and AttrBinding structure (Property 1)
    - **Property 1: Attribute Binding Detection and AttrBinding Structure**
    - Use fast-check to generate HTML templates with one or more elements with `:attr` or `bind:attr` attributes at various nesting depths
    - Call `walkTree()`, assert one AttrBinding per binding attribute with sequential varNames (`__attr0`, `__attr1`, ...), correct attr name (prefix removed), correct expression, correct kind classification, and valid DOM path
    - Minimum 100 iterations
    - Tag: `Feature: attr-bindings, Property 1: Attribute Binding Detection and AttrBinding Structure`
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 12.1**

  - [ ]* 6.2 Write property test for binding attribute removal (Property 2)
    - **Property 2: Binding Attribute Removal**
    - Use fast-check to generate HTML templates with `:attr` and `bind:attr` attributes on various elements
    - Call `walkTree()`, assert the processed template contains zero attributes starting with `:` or `bind:`
    - Minimum 100 iterations
    - Tag: `Feature: attr-bindings, Property 2: Binding Attribute Removal`
    - **Validates: Requirements 1.5**

  - [ ]* 6.3 Write property test for binding kind classification (Property 3)
    - **Property 3: Binding Kind Classification**
    - Use fast-check to generate attribute bindings with attribute names from all four categories (class, style, boolean attrs, regular attrs)
    - Assert correct kind classification for each: `class` → `'class'`, `style` → `'style'`, boolean → `'bool'`, other → `'attr'`
    - Minimum 100 iterations
    - Tag: `Feature: attr-bindings, Property 3: Binding Kind Classification`
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

  - [ ]* 6.4 Write unit tests for tree walker edge cases
    - Test multiple bindings on the same element (`:href`, `:class`, `:disabled` on one element)
    - Test deeply nested attribute bindings
    - Test `bind:` prefix form produces same result as `:` prefix
    - Test attribute bindings alongside other bindings (`{{interpolation}}`, `@event`, `show`) on the same element
    - Test empty expression value (`:href=""`)
    - _Requirements: 1.2, 1.6, 1.7, 12.1_

- [ ] 7. Write tests for code generation
  - [ ]* 7.1 Write property test for codegen regular attribute effect (Property 4)
    - **Property 4: Codegen Regular Attribute Effect**
    - Use fast-check to generate ParseResult IRs with AttrBindings of kind `'attr'` (varying paths, attr names, expressions, signal/computed/prop references)
    - Call `generateComponent()`, assert output contains: DOM element reference in constructor, `__effect` in `connectedCallback` with `setAttribute`/`removeAttribute` logic and `transformExpr`-ed expression
    - Minimum 100 iterations
    - Tag: `Feature: attr-bindings, Property 4: Codegen Regular Attribute Effect`
    - **Validates: Requirements 4.1, 4.2, 4.3, 10.1, 10.2, 10.3, 11.1, 11.2, 11.3**

  - [ ]* 7.2 Write property test for codegen boolean attribute effect (Property 5)
    - **Property 5: Codegen Boolean Attribute Effect**
    - Use fast-check to generate ParseResult IRs with AttrBindings of kind `'bool'` (varying boolean attr names, expressions)
    - Call `generateComponent()`, assert output contains: `__effect` with property assignment using `!!` coercion
    - Minimum 100 iterations
    - Tag: `Feature: attr-bindings, Property 5: Codegen Boolean Attribute Effect`
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [ ]* 7.3 Write property test for codegen class binding effect (Property 6)
    - **Property 6: Codegen Class Binding Effect**
    - Use fast-check to generate ParseResult IRs with AttrBindings of kind `'class'` with both object expressions (starting with `{`) and string expressions
    - Call `generateComponent()`, assert output contains: `classList.add`/`classList.remove` for object expressions, `className =` for string expressions
    - Minimum 100 iterations
    - Tag: `Feature: attr-bindings, Property 6: Codegen Class Binding Effect`
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 7.1, 7.2**

  - [ ]* 7.4 Write property test for codegen style binding effect (Property 7)
    - **Property 7: Codegen Style Binding Effect**
    - Use fast-check to generate ParseResult IRs with AttrBindings of kind `'style'` with both object expressions (starting with `{`) and string expressions
    - Call `generateComponent()`, assert output contains: `style[key] = value` for object expressions, `style.cssText =` for string expressions
    - Minimum 100 iterations
    - Tag: `Feature: attr-bindings, Property 7: Codegen Style Binding Effect`
    - **Validates: Requirements 8.1, 8.2, 8.3, 9.1, 9.2**

  - [ ]* 7.5 Write unit tests for codegen edge cases
    - Test shared DOM references when multiple bindings target the same element
    - Test object vs string expression detection for `:class` and `:style`
    - Test complex expression transformation (e.g., `size + 'px'` → `this._size() + 'px'`)
    - Test that DOM references are assigned before `appendChild`
    - Test multiple attr effects are generated in document order
    - _Requirements: 10.1, 10.2, 10.3, 11.4, 12.2_

- [ ] 8. Write integration test
  - [ ]* 8.1 Write end-to-end compiler test with attr-bindings (`v2/lib/compiler.attr-bindings.test.js`)
    - Create a temp component with multiple attribute bindings: `:href`, `:disabled`, `:class` (object and string), `:style` (object and string)
    - Include `{{interpolation}}` and `@event` bindings alongside attribute bindings
    - Compile and verify output contains: DOM element references in constructor, reactive effects with correct patterns per binding kind, correct expression transformation
    - Test `bind:attr` form produces same output as `:attr` form
    - Test that signal names in expressions are transformed to `this._name()`
    - _Requirements: 1.1, 1.2, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 10.1, 11.1, 12.1, 12.2_

- [ ] 9. Final checkpoint — Ensure all tests pass
  - Run `yarn test` from `v2/` and verify all tests pass. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- This feature depends on the core spec being fully implemented
- v1 reference files: `lib/tree-walker.js` (attr binding detection in walkTree), `lib/codegen.js` (attr codegen sections)
- AttrBindings use sequential naming (`__attr0`, `__attr1`, ...) matching v1 convention
- The attr-bindings feature is self-contained like `show` — no anchors, no templates, no branch logic
- `transformExpr` is reused from core/if — no new transformation logic needed for attr-bindings
- Attr bindings discovered inside `if` or `each` branches are handled by those directives' setup methods (via `walkBranch`), not by the top-level attr codegen
- Object vs string expression detection uses a simple `expression.trimStart().startsWith('{')` check
- Boolean attributes use property assignment for correct DOM behavior (e.g., `element.disabled = true` vs `element.setAttribute('disabled', 'true')`)
- When multiple bindings target the same element, the code generator reuses DOM references to avoid redundant path navigation
