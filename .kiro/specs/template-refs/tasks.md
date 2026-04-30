# Implementation Plan: wcCompiler v2 — template-refs

## Overview

This plan implements `templateRef` template refs for wcCompiler v2. It extends the parser with `templateRef('name')` extraction; extends the tree walker with `ref="name"` attribute detection, removal, and duplicate validation; extends the code generator with constructor DOM reference assignments and getter properties; and updates the compiler pipeline to integrate validation (`REF_NOT_FOUND`, unused ref warning). The implementation reuses v1 patterns from `lib/parser.js`, `lib/tree-walker.js`, and `lib/codegen.js`.

All code extends existing modules in `v2/lib/`. Tests use vitest + fast-check. This feature depends on the core spec being implemented first.

## Tasks

- [ ] 1. Extend ParseResult types for template-refs
  - [ ] 1.1 Add `RefDeclaration` and `RefBinding` typedefs in `v2/lib/types.js`
    - Add `@typedef {Object} RefDeclaration` with fields: `varName` (string), `refName` (string)
    - Add `@typedef {Object} RefBinding` with fields: `refName` (string), `path` (string[])
    - Add `refs: RefDeclaration[]` field to `ParseResult` typedef
    - Add `refBindings: RefBinding[]` field to `ParseResult` typedef
    - _Requirements: 1.1, 2.1_

- [ ] 2. Implement parser extensions for templateRef
  - [ ] 2.1 Implement `extractRefs` function in `v2/lib/parser.js`
    - Add regex pattern: `/(?:const|let|var)\s+([$\w]+)\s*=\s*templateRef\(\s*['"]([^'"]+)['"]\s*\)/g`
    - Extract all `templateRef('name')` declarations from stripped source
    - Support both single-quoted and double-quoted ref name arguments
    - Support `const`, `let`, and `var` declarations
    - Return `RefDeclaration[]` in source order
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ] 2.2 Integrate `extractRefs` into `parse()` function
    - Call `extractRefs(strippedSource)` after existing extractions
    - Store result in `parseResult.refs`
    - Add `'templateRef'` to the macro import stripping list (already handled by existing `stripMacroImport`)
    - _Requirements: 1.1, 1.2_

- [ ] 3. Implement tree walker extensions for ref detection
  - [ ] 3.1 Implement `detectRefs` function in `v2/lib/tree-walker.js`
    - Export `function detectRefs(rootEl): RefBinding[]`
    - Use `rootEl.querySelectorAll('[ref]')` to find all elements with `ref` attribute at any depth
    - For each element: get ref name from attribute value, compute DOM path, remove `ref` attribute
    - Track seen ref names — if duplicate found, throw error with code `DUPLICATE_REF`
    - Return `RefBinding[]` in document order
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 6.1_

- [ ] 4. Extend the Code Generator for template-refs
  - [ ] 4.1 Generate constructor DOM reference assignments in `v2/lib/codegen.js`
    - For each RefBinding: generate `this._ref_<refName> = __root.<path.join('.')>;`
    - Generate assignments BEFORE `this.appendChild(__root)` (or `this.shadowRoot.appendChild(__root)`)
    - Path uses dot-joined segments (e.g., `__root.childNodes[0].childNodes[1]`)
    - _Requirements: 3.1, 3.2, 8.1_

  - [ ] 4.2 Generate getter properties on the class in `v2/lib/codegen.js`
    - For each RefDeclaration with a matching RefBinding: generate `get _<varName>() { return { value: this._ref_<refName> }; }`
    - Generate one getter per RefDeclaration
    - Place getters in the class body alongside other methods
    - _Requirements: 4.1, 4.2, 8.2_

  - [ ] 4.3 Extend `transformMethodBody` for ref access in `v2/lib/codegen.js`
    - Add transformation rule: `varName.value` → `this._<varName>.value` in method/effect bodies
    - Use word-boundary regex: `/\b(varName)\.value\b/g` for each ref variable name
    - _Requirements: 4.1, 8.2_

- [ ] 5. Update the Compiler pipeline
  - [ ] 5.1 Integrate `detectRefs` and validation into `compile()` in `v2/lib/compiler.js`
    - After `walkTree()`, call `detectRefs(rootEl)` to get RefBinding[]
    - Validate REF_NOT_FOUND: for each RefDeclaration, check matching RefBinding exists; throw error with code `REF_NOT_FOUND` if not
    - Validate unused ref: for each RefBinding without matching RefDeclaration, emit `console.warn`
    - Merge `refBindings` into ParseResult before passing to `generateComponent()`
    - Recompute `processedTemplate` after ref attribute removal: `rootEl.innerHTML`
    - _Requirements: 5.1, 6.1, 7.1_

- [ ] 6. Checkpoint — Ensure all implementation compiles
  - Run `yarn test` from `v2/` to verify no regressions in core tests and new code compiles. Ask the user if questions arise.

- [ ] 7. Write tests for parser templateRef extraction
  - [ ]* 7.1 Write property test for templateRef extraction (Property 1)
    - **Property 1: Parser templateRef Round-Trip**
    - Use fast-check to generate component sources with varying numbers of `templateRef('name')` declarations (1 to N), with random valid variable names and ref names, using const/let/var and single/double quotes
    - Call `extractRefs()`, assert: correct number of RefDeclarations extracted, each with correct varName and refName, in source order
    - Minimum 100 iterations
    - Tag: `Feature: template-refs, Property 1: Parser templateRef Round-Trip`
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [ ]* 7.2 Write unit tests for parser edge cases
    - Test single-quoted ref name: `templateRef('canvas')`
    - Test double-quoted ref name: `templateRef("canvas")`
    - Test `let` declaration: `let canvas = templateRef('canvas')`
    - Test `var` declaration: `var canvas = templateRef('canvas')`
    - Test multiple templateRef calls in same source
    - Test templateRef with different varName and refName: `const myCanvas = templateRef('canvas')`
    - Test source with no templateRef calls returns empty array
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 8. Write tests for tree walker ref detection
  - [ ]* 8.1 Write property test for ref detection and removal (Property 2)
    - **Property 2: Tree Walker ref Detection and Removal**
    - Use fast-check to generate HTML templates with varying numbers of `ref="name"` attributes (1 to N) at various nesting depths, on different element types
    - Call `detectRefs()`, assert: correct number of RefBindings, each with correct refName and valid DOM path, processed template contains zero `ref` attributes
    - Minimum 100 iterations
    - Tag: `Feature: template-refs, Property 2: Tree Walker ref Detection and Removal`
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

  - [ ]* 8.2 Write property test for duplicate ref error (Property 4)
    - **Property 4: Duplicate Ref Error**
    - Use fast-check to generate HTML templates with two or more elements sharing the same `ref` attribute value
    - Call `detectRefs()`, assert `DUPLICATE_REF` error is thrown
    - Minimum 100 iterations
    - Tag: `Feature: template-refs, Property 4: Duplicate Ref Error`
    - **Validates: Requirements 6.1**

  - [ ]* 8.3 Write unit tests for tree walker edge cases
    - Test ref on deeply nested element (3+ levels deep)
    - Test ref alongside `{{interpolation}}` and `@event` bindings on same element
    - Test ref alongside `if`, `show`, `:attr` directives on same element
    - Test single ref returns correct path
    - Test ref attribute is removed from processed template
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 9. Write tests for code generation
  - [ ]* 9.1 Write property test for codegen constructor and getter structure (Property 3)
    - **Property 3: Codegen Constructor and Getter Structure**
    - Use fast-check to generate ParseResult IRs with matched RefDeclarations and RefBindings (varying ref names, variable names, paths)
    - Call `generateComponent()`, assert output contains: `this._ref_<refName> = __root.<path>` assignment in constructor for each ref, `get _<varName>()` getter returning `{ value: this._ref_<refName> }` for each ref
    - Minimum 100 iterations
    - Tag: `Feature: template-refs, Property 3: Codegen Constructor and Getter Structure`
    - **Validates: Requirements 3.1, 3.2, 4.1, 4.2, 8.1**

  - [ ]* 9.2 Write unit tests for codegen edge cases
    - Test ref assignment appears before `appendChild` in constructor
    - Test getter returns object with `.value` property
    - Test multiple refs generate multiple assignments and getters
    - Test ref with different varName and refName generates correct mapping
    - Test `transformMethodBody` rewrites `canvas.value` to `this._canvas.value`
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 8.1, 8.2_

- [ ] 10. Write tests for compiler validation
  - [ ]* 10.1 Write property test for REF_NOT_FOUND error (Property 5)
    - **Property 5: Ref Not Found Error**
    - Use fast-check to generate component sources with `templateRef('name')` declarations where the ref name does NOT appear in the template
    - Call `compile()`, assert `REF_NOT_FOUND` error is thrown
    - Minimum 100 iterations
    - Tag: `Feature: template-refs, Property 5: Ref Not Found Error`
    - **Validates: Requirements 5.1**

  - [ ]* 10.2 Write unit tests for compiler validation edge cases
    - Test REF_NOT_FOUND: `templateRef('missing')` with no `ref="missing"` in template
    - Test unused ref warning: `ref="extra"` in template with no `templateRef('extra')` in script (verify warning emitted, no error thrown)
    - Test valid case: all refs matched, no errors or warnings
    - _Requirements: 5.1, 7.1_

- [ ] 11. Write integration test
  - [ ]* 11.1 Write end-to-end compiler test with template-refs (`v2/lib/compiler.refs.test.js`)
    - Create a temp component with `templateRef('canvas')` and `templateRef('input')` in script
    - Template contains `<canvas ref="canvas"></canvas>` and `<input ref="input" />`
    - Include `onMount` callback that accesses `canvas.value` and `input.value`
    - Compile and verify output contains: `this._ref_canvas = __root.childNodes[0]`, `this._ref_input = __root.childNodes[1]`, getter methods for both refs, transformed `onMount` body with `this._canvas.value`
    - Verify processed template has no `ref` attributes
    - _Requirements: 1.1, 2.1, 2.3, 3.1, 4.1, 8.1, 8.2_

- [ ] 12. Final checkpoint — Ensure all tests pass
  - Run `yarn test` from `v2/` and verify all tests pass. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- This feature depends on the core spec being fully implemented
- v1 reference files: `lib/parser.js` (templateRef extraction), `lib/tree-walker.js` (ref detection), `lib/codegen.js` (ref codegen sections)
- Ref DOM references are assigned in the constructor BEFORE `appendChild` moves nodes — this is critical for correct element references
- The getter pattern (`get _varName() { return { value: this._ref_name }; }`) creates a new object on each access — this is intentional for simplicity (no caching needed since refs don't change)
- `DUPLICATE_REF` is detected in the tree walker (during `detectRefs`), while `REF_NOT_FOUND` is detected in the compiler (after both parser and tree walker have run)
- The unused ref warning is non-fatal — compilation continues successfully
- `transformMethodBody` must handle ref variable names to rewrite `canvas.value` → `this._canvas.value` in user code
- Refs work identically in both light DOM and Shadow DOM modes because paths are relative to `__root` (the cloned template content)

## Changelog

### 2026-04-30: Rename `useRef` → `templateRef`

Renamed the public API from `useRef('name')` to `templateRef('name')` for clarity — the name now explicitly communicates that it's a reference to a template DOM element, not a generic ref container.

Files modified:
- `v2/lib/parser.js` — Updated regex in `extractRefs()` and `REACTIVE_CALLS` pattern
- `v2/lib/compiler.js` — Updated error messages and warning messages
- `v2/lib/codegen.js` — Updated JSDoc comment
- `v2/lib/types.js` — Updated JSDoc comment on `RefDeclaration`
- `v2/types/wcc.d.ts` — Renamed export from `useRef` to `templateRef`
- `v2/example/src/wcc-lifecycle.js` — Updated import and usage
- `v2/lib/parser.refs.test.js` — Updated all test descriptions and assertions
- `v2/lib/compiler.refs.test.js` — Updated test source strings
- `v2/lib/compiler.refs.validation.test.js` — Updated test description
- `v2/lib/parser.typescript.roundtrip.test.js` — Updated reserved word list
- `v2/.kiro/specs/template-refs/*.md` — Updated all spec documents
