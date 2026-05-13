# Implementation Plan: Dynamic Component (`<component :is="expr">`)

## Overview

Implement the `<component :is="expr">` directive across the WCC compiler pipeline. The implementation follows the anchor + effect pattern used by `if`/`each` directives: a comment node marks the position, and a reactive effect swaps elements when the expression changes. Changes span five files: types, template-normalizer, tree-walker, codegen, and compiler integration.

## Tasks

- [x] 1. Define data types and core interfaces
  - [x] 1.1 Add `DynamicComponentBinding`, `DynPropBinding`, and `DynEventBinding` typedefs to `lib/types.js`
    - Add JSDoc `@typedef` for `DynamicComponentBinding` with fields: `varName`, `isExpression`, `props`, `events`, `anchorPath`
    - Add JSDoc `@typedef` for `DynPropBinding` with fields: `attr`, `expression`
    - Add JSDoc `@typedef` for `DynEventBinding` with fields: `event`, `handler`
    - Extend the `ParseResult` typedef to include `dynamicComponents` array field
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 2. Template normalizer — preserve `<component>` tags
  - [x] 2.1 Modify `lib/template-normalizer.js` to skip `<component>` tags
    - Inside the TAG_RE replace callback, add a guard before PascalCase conversion: if `tagName.toLowerCase() === 'component'`, return the match unchanged
    - Ensure no self-closing expansion is applied to `<component>` tags
    - _Requirements: 1.2_

  - [x] 2.2 Write property test: template normalizer preserves `<component>` tags
    - Create `lib/template-normalizer.dynamic-component.property.test.js`
    - **Property 1: Template normalizer preserves `<component>` tags**
    - **Validates: Requirements 1.2**
    - Use fast-check to generate arbitrary attribute combinations on `<component>` elements
    - Assert that `normalizeTemplate` output contains the `<component` tag unchanged
    - Use `{ numRuns: 20 }` for fast-check configuration

  - [x] 2.3 Write unit tests for template normalizer with `<component>` tags
    - Create `lib/template-normalizer.dynamic-component.test.js`
    - Test that `<component :is="expr">` passes through unchanged
    - Test that `<component :is="expr" :title="t()">` preserves all attributes
    - Test that other PascalCase tags still get converted (regression)
    - _Requirements: 1.2_

- [x] 3. Tree walker — detect and extract dynamic component bindings
  - [x] 3.1 Implement `processDynamicComponents` in `lib/tree-walker.js`
    - Add detection logic for elements with `tagName === 'COMPONENT'`
    - Validate `:is` attribute is present; throw error with code `MISSING_IS_ATTRIBUTE` if absent
    - Extract the `:is` expression value
    - Collect all `:attr="expr"` attributes (excluding `:is`) as prop bindings
    - Collect all `@event="handler"` attributes as event bindings
    - Replace the `<component>` element with a `<!-- dynamic -->` comment node
    - Compute the anchor path from root
    - Generate sequential `varName` values (`__dyn0`, `__dyn1`, ...)
    - Return a `DynamicComponentBinding` record
    - Integrate into the main walk function or as a separate pass (following `processIfChains`/`processForBlocks` pattern)
    - _Requirements: 1.1, 1.3, 1.4, 4.4, 5.4_

  - [x] 3.2 Write property test: missing `:is` attribute produces compilation error
    - Create `lib/tree-walker.dynamic-component.property.test.js`
    - **Property 2: Missing `:is` attribute produces compilation error**
    - **Validates: Requirements 1.3**
    - Use fast-check to generate `<component>` elements with random attributes but never `:is`
    - Assert that the tree walker throws an error with code `MISSING_IS_ATTRIBUTE`
    - Use `{ numRuns: 20 }` for fast-check configuration

  - [x] 3.3 Write property test: binding extraction completeness
    - Add to `lib/tree-walker.dynamic-component.property.test.js`
    - **Property 3: Binding extraction completeness**
    - **Validates: Requirements 1.1, 1.4, 4.4, 5.4, 10.1**
    - Use fast-check to generate varying numbers of `:prop` and `@event` bindings
    - Assert that the resulting `DynamicComponentBinding` has correct counts and values
    - Assert that the template contains `<!-- dynamic -->` in place of `<component>`
    - Use `{ numRuns: 20 }` for fast-check configuration

  - [x] 3.4 Write unit tests for tree walker dynamic component detection
    - Create `lib/tree-walker.dynamic-component.test.js`
    - Test basic detection of `<component :is="currentView()">`
    - Test extraction with multiple props and events
    - Test error thrown when `:is` is missing
    - Test anchor path computation
    - Test multiple `<component>` elements produce sequential varNames
    - _Requirements: 1.1, 1.3, 1.4_

- [x] 4. Checkpoint — Ensure types, normalizer, and tree walker work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Codegen — emit swap effect and prop/event setup
  - [x] 5.1 Implement dynamic component code generation in `lib/codegen.js`
    - Emit anchor reference initialization: `this.__dyn0_anchor`, `this.__dyn0_current`, `this.__dyn0_tag`, `this.__dyn0_propDisposers`
    - Emit the swap reactive effect: compare tag, cleanup old element (dispose prop effects, remove element), create new element with `document.createElement`, `insertBefore` at anchor, `customElements.upgrade(el)`
    - Emit nested `__effect` calls for each prop binding (setAttribute with transformed expression)
    - Emit `addEventListener` calls for each event binding
    - Handle the case where the binding has zero props and zero events (basic swap only)
    - Handle the case where `:is` expression evaluates to falsy (remove only, no insert)
    - Transform expressions using the same expression transformer used by other directives
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 10.2, 10.3, 10.4, 10.5_

  - [x] 5.2 Write property test: swap effect structural correctness
    - Create `lib/codegen.dynamic-component.property.test.js`
    - **Property 4: Swap effect structural correctness**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 10.2, 10.3**
    - Use fast-check to generate `DynamicComponentBinding` records with varying expressions
    - Assert output contains: `__effect`, tag comparison, `.remove()`, `document.createElement`, `insertBefore`, anchor reference
    - Use `{ numRuns: 20 }` for fast-check configuration

  - [x] 5.3 Write property test: prop bindings emit nested reactive effects
    - Add to `lib/codegen.dynamic-component.property.test.js`
    - **Property 5: Prop bindings emit nested reactive effects**
    - **Validates: Requirements 4.1, 4.2, 4.3, 10.4**
    - Use fast-check to generate bindings with 1–5 prop bindings
    - Assert output contains exactly P nested `__effect` calls with `setAttribute` for each prop
    - Use `{ numRuns: 20 }` for fast-check configuration

  - [x] 5.4 Write property test: event bindings emit addEventListener calls
    - Add to `lib/codegen.dynamic-component.property.test.js`
    - **Property 6: Event bindings emit addEventListener calls**
    - **Validates: Requirements 5.1, 5.3, 10.5**
    - Use fast-check to generate bindings with 1–5 event bindings
    - Assert output contains exactly E `addEventListener` calls with correct event names
    - Use `{ numRuns: 20 }` for fast-check configuration

  - [x] 5.5 Write property test: arbitrary expressions compile without error
    - Add to `lib/codegen.dynamic-component.property.test.js`
    - **Property 7: Arbitrary expressions compile without error**
    - **Validates: Requirements 9.1, 9.2, 9.4**
    - Use fast-check to generate valid JS expression strings (ternaries, function calls, property access)
    - Assert the compiler does not throw and produces non-empty output
    - Use `{ numRuns: 20 }` for fast-check configuration

  - [x] 5.6 Write unit tests for codegen dynamic component output
    - Create `lib/codegen.dynamic-component.test.js`
    - Test basic compiled output for `<component :is="currentView()">`
    - Test compiled output with props: `:title="pageTitle()" :data="items()"`
    - Test compiled output with events: `@navigate="onNavigate" @click="handleClick"`
    - Test compiled output with ternary expression: `:is="isAdmin() ? 'admin-panel' : 'user-panel'"`
    - Test that prop disposers are cleaned up on swap
    - Test that falsy expression removes element without replacement
    - _Requirements: 2.1, 2.2, 2.3, 4.1, 5.1, 9.1, 10.2, 10.3, 10.4, 10.5_

- [x] 6. Compiler integration — wire dynamic components into ParseResult
  - [x] 6.1 Integrate dynamic component processing into `lib/compiler.js`
    - Initialize `dynamicComponents: []` in the ParseResult
    - Call `processDynamicComponents` (or integrate into existing tree walk) and populate the array
    - Pass `dynamicComponents` to codegen alongside other bindings
    - Ensure bundle mode (`--bundle`) wraps dynamic component output correctly in IIFE
    - _Requirements: 1.1, 8.1, 8.2_

  - [x] 6.2 Write unit tests for compiler integration
    - Create `lib/compiler.dynamic-component.test.js`
    - Test end-to-end compilation of a template with `<component :is="expr">`
    - Test compilation with props and events
    - Test bundle mode output produces valid IIFE
    - Test composition: `<component>` inside an `if` block
    - Test composition: `<component>` inside an `each` loop
    - Test multiple `<component>` elements in one template
    - _Requirements: 1.1, 7.1, 7.2, 8.1_

- [x] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All property tests use `{ numRuns: 20 }` per user preference for faster execution
- Source files are in `lib/` with tests co-located using `.test.js` and `.property.test.js` suffixes
- The implementation follows the same anchor + effect pattern as `if`/`each` directives

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "3.3", "3.4"] },
    { "id": 3, "tasks": ["5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "5.4", "5.5", "5.6"] },
    { "id": 5, "tasks": ["6.1"] },
    { "id": 6, "tasks": ["6.2"] }
  ]
}
```
