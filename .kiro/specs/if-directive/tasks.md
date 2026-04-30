# Implementation Plan: wcCompiler v2 — if

## Overview

This plan implements `if` / `else-if` / `else` conditional rendering for wcCompiler v2. It extends the tree walker with chain detection, validation, branch extraction, and anchor replacement; extends the code generator with constructor setup, reactive effects, and branch setup methods; and updates the compiler pipeline to integrate `processIfChains`. The implementation reuses v1 patterns from `lib/tree-walker.js` and `lib/codegen.js`.

All code extends existing modules in `v2/lib/`. Tests use vitest + fast-check. This feature depends on the core spec being implemented first.

## Tasks

- [ ] 1. Extend ParseResult types for if
  - [ ] 1.1 Add `IfBlock`, `IfBranch`, and related typedefs in `v2/lib/types.js`
    - Add `@typedef {Object} IfBranch` with fields: `type` ('if'|'else-if'|'else'), `expression` (string|null), `templateHtml` (string), `bindings` (Binding[]), `events` (EventBinding[]), `showBindings` (ShowBinding[]), `attrBindings` (AttrBinding[])
    - Add `@typedef {Object} IfBlock` with fields: `varName` (string), `anchorPath` (string[]), `branches` (IfBranch[])
    - Add `ifBlocks: IfBlock[]` field to `ParseResult` typedef
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 2. Implement tree walker extensions for if
  - [ ] 2.1 Implement validation functions in `v2/lib/tree-walker.js`
    - Implement conflicting directive detection: `if` + `else` → `CONFLICTING_DIRECTIVES`, `if` + `else-if` → `CONFLICTING_DIRECTIVES`, `show` + `if` → `CONFLICTING_DIRECTIVES`
    - Implement orphan else detection: `else-if` or `else` without preceding `if`/`else-if` → `ORPHAN_ELSE`
    - Implement invalid else detection: `else` with non-empty value → `INVALID_V_ELSE`
    - Errors thrown with `.code` property following core error pattern
    - _Requirements: 8.1, 8.2, 8.3, 9.1, 9.2, 10.1_

  - [ ] 2.2 Implement `processIfChains` — detect and process conditional chains
    - Export `function processIfChains(parent, parentPath, propsSet, computedNames, rootVarNames): IfBlock[]`
    - First pass: validate all element children for conflicting directives
    - Second pass: iterate element children — `if` starts new chain, `else-if`/`else` extend chain, non-conditional closes chain and recurses
    - Recursively search all descendants for chains at any nesting depth
    - Support multiple independent chains within the same parent
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 11.1, 11.2_

  - [ ] 2.3 Implement `buildIfBlock` — replace chain with anchor, extract branches
    - For each branch: clone element, remove directive attribute, get `outerHTML`
    - Call `walkBranch(html)` to discover internal bindings/events with relative paths
    - Replace all chain elements with a single `<!-- if -->` comment node
    - Compute `anchorPath` from parent path + comment node index (recompute after DOM normalization)
    - Assign sequential variable names (`__if0`, `__if1`, ...) in document order
    - Return `IfBlock` with `varName`, `anchorPath`, `branches`
    - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2, 4.3_

  - [ ] 2.4 Implement `walkBranch` — walk branch HTML independently
    - Parse branch HTML into temp jsdom DOM: `<div id="__branchRoot">${html}</div>`
    - Call `walkTree(branchRoot, ...)` to discover bindings/events
    - Strip first path segment from all paths (at runtime `node = clone.firstChild` is the element itself)
    - Process `{{interpolation}}`, `@event`, `show`, `:attr`/`bind:attr` bindings with paths relative to branch root
    - Return bindings, events, showBindings, attrBindings, and processed HTML
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Extend the Code Generator for if
  - [ ] 3.1 Generate constructor setup for If_Blocks in `v2/lib/codegen.js`
    - For each If_Block: generate `document.createElement('template')` and `innerHTML` assignment per branch
    - Generate anchor reference from cloned template root: `this.__if0_anchor = __root.childNodes[N]`
    - Initialize tracking state: `this.__if0_current = null`, `this.__if0_active = undefined`
    - Anchor reference MUST be assigned before `appendChild` moves nodes
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 3.2 Generate reactive effect in connectedCallback for If_Blocks
    - Generate `__effect` that evaluates each branch condition in order using `transformExpr`
    - Signal `status` → `this._status()`, computed `isActive` → `this._c_isActive()`
    - Early return optimization: skip DOM manipulation when active branch index unchanged
    - Remove previous branch node when active branch changes
    - Clone template, insert before anchor, store reference when new branch becomes active
    - Render nothing when no condition is truthy and no `else` exists
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 12.1, 12.2, 12.3_

  - [ ] 3.3 Generate branch setup method for If_Blocks
    - When any branch has bindings/events, generate `__if0_setup(node, branch)` method
    - Use branch index to determine which bindings/events to initialize
    - Generate `__effect` calls for text bindings, show bindings, and attribute bindings
    - Generate `addEventListener` calls for event bindings
    - Only generate setup method when at least one branch has bindings or events
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 4. Update the Compiler pipeline
  - [ ] 4.1 Integrate `processIfChains` into `compile()` in `v2/lib/compiler.js`
    - After `walkTree()`, call `processIfChains(rootEl, [], signalNames, computedNames, rootVarNames)`
    - Merge `ifBlocks` into ParseResult
    - Recompute `processedTemplate` after chain replacement: `rootEl.innerHTML`
    - _Requirements: 1.1, 2.1, 4.1_

- [ ] 5. Checkpoint — Ensure all implementation compiles
  - Run `yarn test` from `v2/` to verify no regressions in core tests and new code compiles. Ask the user if questions arise.

- [ ] 6. Write tests for tree walker if extensions
  - [ ]* 6.1 Write property test for chain detection and If_Block structure (Property 1)
    - **Property 1: Chain Detection and If_Block Structure**
    - Use fast-check to generate HTML templates with conditional chains (if, optional else-if, optional else) at various nesting depths
    - Call `processIfChains()`, assert one If_Block per chain with sequential varNames, valid anchorPath, correct branch types/expressions in order
    - Minimum 100 iterations
    - Tag: `Feature: if, Property 1: Chain Detection and If_Block Structure`
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 4.1, 4.2, 4.3, 11.1, 11.2**

  - [ ]* 6.2 Write property test for branch template extraction (Property 2)
    - **Property 2: Branch Template Extraction and Internal Processing**
    - Use fast-check to generate branch HTML with `{{interpolation}}`, `@event`, `show`, `:attr` bindings
    - Call `walkBranch()`, assert templateHtml has no directive attributes, all bindings discovered with relative paths
    - Minimum 100 iterations
    - Tag: `Feature: if, Property 2: Branch Template Extraction and Internal Processing`
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

  - [ ]* 6.3 Write property test for conflicting directives error (Property 5)
    - **Property 5: Conflicting Directives Error**
    - Use fast-check to generate elements with conflicting directive combinations (if+else, if+else-if, show+if)
    - Assert `CONFLICTING_DIRECTIVES` error is thrown
    - Minimum 100 iterations
    - Tag: `Feature: if, Property 5: Conflicting Directives Error`
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [ ]* 6.4 Write property test for orphan else error (Property 6)
    - **Property 6: Orphan Else Error**
    - Use fast-check to generate templates with `else-if` or `else` without preceding `if`
    - Assert `ORPHAN_ELSE` error is thrown
    - Minimum 100 iterations
    - Tag: `Feature: if, Property 6: Orphan Else Error`
    - **Validates: Requirements 9.1, 9.2**

  - [ ]* 6.5 Write property test for invalid else error (Property 7)
    - **Property 7: Invalid else Error**
    - Use fast-check to generate elements with `else="someExpression"` (non-empty value)
    - Assert `INVALID_V_ELSE` error is thrown
    - Minimum 100 iterations
    - Tag: `Feature: if, Property 7: Invalid else Error`
    - **Validates: Requirements 10.1**

  - [ ]* 6.6 Write unit tests for tree walker edge cases
    - Test anchor path recomputation after DOM normalization (Req 2.3)
    - Test multiple independent chains in same parent (Req 1.5)
    - Test deeply nested conditional chains (Req 11.1, 11.2)
    - Test chain without else (closed by non-conditional sibling, Req 1.4)
    - _Requirements: 1.4, 1.5, 2.3, 11.1, 11.2_

- [ ] 7. Write tests for code generation
  - [ ]* 7.1 Write property test for codegen constructor and effect structure (Property 3)
    - **Property 3: Codegen Constructor and Effect Structure**
    - Use fast-check to generate ParseResult IRs with If_Blocks (varying branch counts, expressions, signal/computed references)
    - Call `generateComponent()`, assert output contains: template creation per branch, anchor reference, state init, `__effect` with `transformExpr`-ed conditions
    - Minimum 100 iterations
    - Tag: `Feature: if, Property 3: Codegen Constructor and Effect Structure`
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 12.1, 12.2, 12.3**

  - [ ]* 7.2 Write property test for codegen setup method (Property 4)
    - **Property 4: Codegen Setup Method**
    - Use fast-check to generate If_Blocks where branches have varying combinations of bindings, events, show, and attr bindings
    - Call `generateComponent()`, assert setup method is generated with correct `__effect`/`addEventListener` calls per branch index
    - Minimum 100 iterations
    - Tag: `Feature: if, Property 4: Codegen Setup Method`
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**

  - [ ]* 7.3 Write unit tests for codegen edge cases
    - Test early return optimization when branch index unchanged (Req 6.6)
    - Test no-branch rendering when no condition matches and no else (Req 6.5)
    - Test branch removal logic (Req 6.3)
    - Test clone/insert before anchor logic (Req 6.4)
    - Test that setup method is NOT generated when no branch has bindings
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 7.1_

- [ ] 8. Write integration test
  - [ ]* 8.1 Write end-to-end compiler test with if (`v2/lib/compiler.if.test.js`)
    - Create a temp component with a if/else-if/else chain using signal-based expressions
    - Include `{{interpolation}}` and `@event` bindings inside branches
    - Compile and verify output contains: template elements, anchor reference, reactive effect with transformed expressions, setup method with binding effects and event listeners
    - Test that signal names in expressions are transformed to `this._name()`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 7.1, 7.3, 7.4, 12.1, 12.2_

- [ ] 9. Final checkpoint — Ensure all tests pass
  - Run `yarn test` from `v2/` and verify all tests pass. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- This feature depends on the core spec being fully implemented
- v1 reference files: `lib/tree-walker.js` (processIfChains, buildIfBlock, walkBranch), `lib/codegen.js` (if codegen sections)
- If_Blocks use sequential naming (`__if0`, `__if1`, ...) matching v1 convention
- Branch-local walkTree ensures binding paths are relative to the branch root, not the component root
- The setup method is only generated when at least one branch has bindings/events — pure static branches skip it
- Validation errors (CONFLICTING_DIRECTIVES, ORPHAN_ELSE, INVALID_V_ELSE) are detected during tree-walk phase before code generation

## Changelog

### 2026-04-30: Model bindings inside `if` branches

`walkBranch()` now returns `modelBindings` and `slots` from the inner `walkTree()` call. The `IfBranch` type was updated to include `modelBindings: ModelBinding[]` and `slots: SlotBinding[]`. The codegen `_setup()` method for if branches now generates model effects (signal → DOM) and event listeners (DOM → signal) for each model binding found in the branch. The `hasSetup` check was updated to include `modelBindings.length > 0`.

Files modified:
- `v2/lib/types.js` — Added `modelBindings` and `slots` to `IfBranch` typedef
- `v2/lib/tree-walker.js` — `walkBranch()` now strips first path segment from `modelBindings` and `slots`, includes them in return value; `buildIfBlock` passes them through to branch objects
- `v2/lib/codegen.js` — If branch `_setup()` method generates model effects and listeners; `hasSetup` check includes `modelBindings`
