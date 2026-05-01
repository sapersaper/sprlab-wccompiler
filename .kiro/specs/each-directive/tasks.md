# Implementation Plan: wcCompiler v2 — each

## Overview

This plan implements `each` list rendering for wcCompiler v2. It extends the tree walker with `each` element detection, expression parsing, anchor replacement, and item template extraction via `walkBranch`; extends the code generator with constructor setup, reactive iteration effects, and static vs reactive binding classification; and updates the compiler pipeline to integrate `processForBlocks`. The implementation reuses v1 patterns from `lib/tree-walker.js` and `lib/codegen.js`, adapted for the v2 attribute naming convention (`each` instead of `v-for`).

All code extends existing modules in `v2/lib/`. Tests use vitest + fast-check. This feature depends on the core spec being implemented first.

## Tasks

- [ ] 1. Extend ParseResult types for each
  - [ ] 1.1 Add `ForBlock` and related typedefs in `v2/lib/types.js`
    - Add `@typedef {Object} ForBlock` with fields: `varName` (string), `itemVar` (string), `indexVar` (string|null), `source` (string), `keyExpr` (string|null), `templateHtml` (string), `anchorPath` (string[]), `bindings` (Binding[]), `events` (EventBinding[]), `showBindings` (ShowBinding[]), `attrBindings` (AttrBinding[])
    - Add `forBlocks: ForBlock[]` field to `ParseResult` typedef
    - _Requirements: 5.1, 5.2_

- [ ] 2. Implement tree walker extensions for each
  - [ ] 2.1 Implement `parseEachExpression` in `v2/lib/tree-walker.js`
    - Export `function parseEachExpression(expr): { itemVar, indexVar, source }`
    - Support simple form: `item in source` → `{ itemVar: 'item', indexVar: null, source: 'source' }`
    - Support destructured form: `(item, index) in source` → `{ itemVar: 'item', indexVar: 'index', source: 'source' }`
    - Throw error with code `INVALID_V_FOR` if `in` keyword is missing
    - Throw error with code `INVALID_V_FOR` if item variable is empty
    - Throw error with code `INVALID_V_FOR` if source expression is empty
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 2.2 Implement conflicting directive validation in `v2/lib/tree-walker.js`
    - Detect elements with both `each` and `if` attributes
    - Throw error with code `CONFLICTING_DIRECTIVES` when both are present
    - _Requirements: 12.1_

  - [ ] 2.3 Implement `processForBlocks` in `v2/lib/tree-walker.js`
    - Export `function processForBlocks(parent, parentPath, propsSet, computedNames, rootVarNames): ForBlock[]`
    - Recursively traverse all descendants of the parent element
    - For each element with an `each` attribute:
      - Validate no conflicting `if` directive on the same element
      - Parse the `each` expression via `parseEachExpression()`
      - Extract `:key` attribute value (or `null`), remove `:key` from element
      - Clone element, remove `each` attribute, get `outerHTML` as item template HTML
      - Call `walkBranch(html)` to discover internal bindings/events with paths relative to item root
      - Replace the original element with a `<!-- each -->` comment node
      - Compute `anchorPath` from current path + comment node index
      - Build `ForBlock` with all metadata
    - For elements without `each`: recurse into children
    - Assign sequential variable names (`__for0`, `__for1`, ...) in document order
    - Detect `each` elements at any nesting depth within the template
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3_

- [ ] 3. Extend the Code Generator for each
  - [ ] 3.1 Implement `transformForExpr` in `v2/lib/codegen.js`
    - Export `function transformForExpr(expr, itemVar, indexVar, propsSet, rootVarNames, computedNames): string`
    - Transform signal references to `this._<signalName>()` while leaving `itemVar` and `indexVar` untouched
    - Transform computed references to `this._c_<computedName>()` while leaving `itemVar` and `indexVar` untouched
    - Transform prop references to `this._s_<propName>()` while leaving `itemVar` and `indexVar` untouched
    - _Requirements: 7.2, 9.3, 13.1, 13.2, 13.3, 13.4_

  - [ ] 3.2 Implement `isStaticForBinding` and `isStaticForExpr` helpers in `v2/lib/codegen.js`
    - `isStaticForBinding(name, itemVar, indexVar)` — returns `true` if a text binding references only the item or index variable
    - `isStaticForExpr(expr, itemVar, indexVar, propsSet, rootVarNames, computedNames)` — returns `true` if an expression references only item/index (no component-level vars)
    - _Requirements: 8.1, 8.2, 8.3, 9.1_

  - [ ] 3.3 Generate constructor setup for For_Blocks in `v2/lib/codegen.js`
    - For each For_Block: generate `document.createElement('template')` and `innerHTML` assignment with the processed item template HTML
    - Generate anchor reference from cloned template root: `this.__for0_anchor = __root.childNodes[N]`
    - Initialize empty nodes tracking array: `this.__for0_nodes = []`
    - Anchor reference MUST be assigned before `appendChild` moves nodes
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 3.4 Generate reactive effect in connectedCallback for For_Blocks
    - Generate `__effect` that evaluates the source expression using `transformForExpr`
    - Remove all previously rendered item nodes from the DOM and clear the nodes array
    - Handle numeric range: when source is a number `N`, iterate values `1` through `N`
    - Handle array: iterate the array, cloning the item template once per element
    - Handle falsy source: treat as empty array (render nothing)
    - Per-item: clone template, set up bindings/events, insert before anchor, track node
    - _Requirements: 7.1, 7.3, 7.4, 7.5, 7.6_

  - [ ] 3.5 Generate per-item bindings in the iteration effect
    - **Static text bindings** (item/index-only): assign `textContent` directly without `__effect` wrapper
    - **Reactive text bindings** (component-level refs): wrap `textContent` assignment in `__effect`
    - **Static show bindings**: assign `display` style directly
    - **Reactive show bindings**: wrap `display` style assignment in `__effect`
    - **Static attr bindings**: assign attribute directly via `setAttribute`
    - **Reactive attr bindings**: wrap `setAttribute` in `__effect`
    - **Event bindings**: generate `addEventListener` with handler bound to component instance (`this._handler.bind(this)`)
    - Use `transformForExpr` for all reactive expressions to rewrite component-level references while preserving item/index scope
    - _Requirements: 8.1, 8.2, 8.3, 9.1, 9.2, 9.3, 10.1, 11.1, 11.2, 11.3, 11.4_

- [ ] 4. Update the Compiler pipeline
  - [ ] 4.1 Integrate `processForBlocks` into `compile()` in `v2/lib/compiler.js`
    - Call `processForBlocks(rootEl, [], propsSet, computedNames, rootVarNames)` before `processIfChains`
    - After all directive processing, normalize DOM and recompute anchor paths for For_Blocks (and If_Blocks)
    - Merge `forBlocks` into ParseResult
    - Recompute `processedTemplate` after element replacement: `rootEl.innerHTML`
    - _Requirements: 3.1, 3.2, 3.3, 5.1, 5.3_

- [ ] 5. Checkpoint — Ensure all implementation compiles
  - Run `yarn test` from `v2/` to verify no regressions in core tests and new code compiles. Ask the user if questions arise.

- [ ] 6. Write tests for tree walker each extensions
  - [ ]* 6.1 Write property test for each expression parsing round-trip (Property 1)
    - **Property 1: each Expression Parsing Round-Trip**
    - Use fast-check to generate valid identifier pairs `(itemVar, source)` and optional `indexVar`
    - Construct `each` expression strings in both forms and parse them via `parseEachExpression()`
    - Assert parsed result matches original `itemVar`, `indexVar` (or `null`), and `source`
    - Minimum 100 iterations
    - Tag: `Feature: each-directive, Property 1: each Expression Parsing Round-Trip`
    - **Validates: Requirements 1.1, 1.2**

  - [ ]* 6.2 Write property test for For_Block structure and anchor replacement (Property 2)
    - **Property 2: For_Block Structure and Anchor Replacement**
    - Use fast-check to generate HTML templates with one or more `each` elements at various nesting depths
    - Call `processForBlocks()`, assert one For_Block per `each` element with sequential varNames (`__for0`, `__for1`, ...), valid anchorPath, correct `itemVar`, `indexVar`, `source`, and `keyExpr`
    - Assert processed template contains `<!-- each -->` comment nodes in place of original elements
    - Minimum 100 iterations
    - Tag: `Feature: each-directive, Property 2: For_Block Structure and Anchor Replacement`
    - **Validates: Requirements 2.1, 2.2, 2.3, 3.1, 3.2, 5.1, 5.2, 5.3**

  - [ ]* 6.3 Write property test for item template extraction (Property 3)
    - **Property 3: Item Template Extraction and Internal Processing**
    - Use fast-check to generate `each` elements containing `{{interpolation}}`, `@event`, `show`, and `:attr` bindings
    - Assert extracted `templateHtml` does not contain `each` or `:key` attributes
    - Assert all internal bindings are discovered with paths relative to the item root element
    - Minimum 100 iterations
    - Tag: `Feature: each-directive, Property 3: Item Template Extraction and Internal Processing`
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

  - [ ]* 6.4 Write property test for conflicting directives error (Property 7)
    - **Property 7: Conflicting Directives Error**
    - Use fast-check to generate elements with both `each` and `if` attributes
    - Assert `CONFLICTING_DIRECTIVES` error is thrown
    - Minimum 100 iterations
    - Tag: `Feature: each-directive, Property 7: Conflicting Directives Error`
    - **Validates: Requirements 12.1**

  - [ ]* 6.5 Write property test for invalid each expression error (Property 8)
    - **Property 8: Invalid each Expression Error**
    - Use fast-check to generate strings missing `in` keyword, with empty item variable, or empty source expression
    - Assert `INVALID_V_FOR` error is thrown
    - Minimum 100 iterations
    - Tag: `Feature: each-directive, Property 8: Invalid each Expression Error`
    - **Validates: Requirements 1.3, 1.4, 1.5**

  - [ ]* 6.6 Write unit tests for tree walker edge cases
    - Test anchor path recomputation after DOM normalization (Req 3.3)
    - Test deeply nested `each` elements (Req 5.3)
    - Test multiple `each` elements in same parent (Req 5.2)
    - Test `:key` extraction and removal from template (Req 2.1, 2.2, 2.3)
    - Test `each` element with no internal bindings
    - _Requirements: 2.1, 2.2, 2.3, 3.3, 5.2, 5.3_

- [ ] 7. Write tests for code generation
  - [ ]* 7.1 Write property test for codegen constructor and effect structure (Property 4)
    - **Property 4: Codegen Constructor and Effect Structure**
    - Use fast-check to generate ParseResult IRs with For_Blocks (varying item/index vars, source expressions, signal/computed references)
    - Call `generateComponent()`, assert output contains: template creation with `innerHTML`, anchor reference, `_nodes = []` init, `__effect` with `transformForExpr`-applied source, node removal loop, array/numeric iteration, clone + insertBefore per item
    - Minimum 100 iterations
    - Tag: `Feature: each-directive, Property 4: Codegen Constructor and Effect Structure`
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 7.1, 7.3, 7.4, 7.5, 10.1**

  - [ ]* 7.2 Write property test for static vs reactive binding classification (Property 5)
    - **Property 5: Static vs Reactive Binding Classification**
    - Use fast-check to generate text/show/attr bindings with expressions referencing only item/index vars vs component-level signals/computeds/props
    - Assert static bindings produce direct assignments without `__effect` wrapper
    - Assert reactive bindings produce assignments wrapped in `__effect`
    - Minimum 100 iterations
    - Tag: `Feature: each-directive, Property 5: Static vs Reactive Binding Classification`
    - **Validates: Requirements 8.1, 8.2, 8.3, 9.1, 9.2, 11.1, 11.2, 11.3, 11.4**

  - [ ]* 7.3 Write property test for transformForExpr (Property 6)
    - **Property 6: transformForExpr Preserves Item/Index and Transforms Component Refs**
    - Use fast-check to generate expressions with a mix of item variable, index variable, and component-level signal/computed/prop references
    - Assert signals transform to `this._x()`, computeds to `this._c_y()`, props to `this._s_z()`
    - Assert item variable and index variable references remain untouched
    - Minimum 100 iterations
    - Tag: `Feature: each-directive, Property 6: transformForExpr Preserves Item/Index and Transforms Component Refs`
    - **Validates: Requirements 7.2, 9.3, 13.1, 13.2, 13.3, 13.4**

  - [ ]* 7.4 Write unit tests for codegen edge cases
    - Test numeric range handling: source is a number `N` → iterate `1` through `N` (Req 7.5)
    - Test falsy source handling: `null`/`undefined`/`0` → render nothing (Req 7.6)
    - Test no-binding items: no unnecessary effects generated
    - Test event binding with `this._handler.bind(this)` pattern (Req 10.1)
    - _Requirements: 7.5, 7.6, 10.1_

- [ ] 8. Write integration test
  - [ ]* 8.1 Write end-to-end compiler test with each (`v2/lib/compiler.each.test.js`)
    - Create a temp component with an `each` directive using signal-based source expression
    - Include `{{interpolation}}` (both static item-only and reactive component-level), `@event`, `show`, and `:attr` bindings inside the item template
    - Include `:key` attribute on the `each` element
    - Compile and verify output contains: template element with `innerHTML`, anchor reference, nodes array, reactive effect with transformed source expression, static bindings assigned directly, reactive bindings wrapped in `__effect`, event listeners bound to component instance
    - Test that signal names in source expression are transformed to `this._name()`
    - Test numeric range source (e.g., `each="n in 5"`)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.4, 7.5, 8.1, 8.3, 9.1, 9.2, 10.1, 13.1_

- [ ] 9. Final checkpoint — Ensure all tests pass
  - Run `yarn test` from `v2/` and verify all tests pass. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- This feature depends on the core spec being fully implemented
- v1 reference files: `lib/tree-walker.js` (processForBlocks, parseVForExpression, walkBranch, transformForExpr, isStaticForBinding), `lib/codegen.js` (for codegen sections)
- For_Blocks use sequential naming (`__for0`, `__for1`, ...) matching v1 convention
- `walkBranch` is shared with the `if` directive — reuse the same function for item template processing
- `transformForExpr` is critical for correct scoping: it must leave item/index variable references untouched while transforming component-level signal/computed/prop references
- Static vs reactive classification avoids unnecessary `__effect` overhead for item-local data
- The `:key` attribute is stored in the For_Block for potential future keyed reconciliation but is not used for DOM diffing in this implementation
- Validation errors (CONFLICTING_DIRECTIVES, INVALID_V_FOR) are detected during tree-walk phase before code generation

## Changelog

### 2026-04-30: Model bindings inside `each` blocks

`walkBranch()` now returns `modelBindings` and `slots` from the inner `walkTree()` call. The `ForBlock` type was updated to include `modelBindings: ModelBinding[]` and `slots: SlotBinding[]`. The codegen each effect now generates per-item model effects (signal → DOM) and event listeners (DOM → signal) for each model binding found in the item template.

Files modified:
- `v2/lib/types.js` — Added `modelBindings` and `slots` to `ForBlock` typedef
- `v2/lib/tree-walker.js` — `walkBranch()` includes `modelBindings` and `slots` in return value; `processForBlocks` passes them through to `ForBlock` objects
- `v2/lib/codegen.js` — Each effect generates per-item model effects and listeners (checkbox, radio, number coercion supported)

### 2026-04-30: Slots inside `each` blocks

The codegen each effect now generates scoped slot resolution per item. When a `<slot>` with `:prop` attributes appears inside an `each` block, the codegen resolves `{{propName}}` placeholders in the slot's fallback content using the loop iteration variables.

Files modified:
- `v2/lib/types.js` — Added `slots: SlotBinding[]` to `ForBlock` typedef
- `v2/lib/tree-walker.js` — `walkBranch()` includes `slots` in return value; `processForBlocks` passes them through
- `v2/lib/codegen.js` — Each effect generates per-item scoped slot resolution (builds props object from slot props, replaces `{{propName}}` patterns in slot innerHTML)

### 2026-05-01: Keyed reconciliation

When `:key` is present on an `each` element, the codegen now generates keyed reconciliation instead of destroy-all/recreate-all. The algorithm:

1. Builds a `Map<key, node>` from existing nodes (`__keyMap`)
2. For each item in the new list, checks if a node with that key exists
3. If yes: reuses the DOM node (moves to correct position)
4. If no: creates a new node from template with full binding setup
5. Removes leftover nodes not in the new list
6. Reorders all nodes before the anchor

This preserves DOM state (focus, scroll, animations) for items that haven't changed. Without `:key`, the original destroy-all/recreate-all behavior is preserved.

Files modified:
- `lib/codegen.js` — Added `generateItemSetup()` helper, split each effect into keyed/non-keyed paths
- `lib/compiler.each.test.js` — Updated assertion for keyed removal pattern
