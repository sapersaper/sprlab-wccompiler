# Implementation Plan: Explicit Component Imports

## Overview

Replace the current auto-detection of child components (filesystem-based resolution of hyphenated tags) with an explicit import system. Developers declare child component dependencies via standard ES module `import` statements in the `<script>` block, using PascalCase identifiers as template tag aliases. The implementation creates a new `import-resolver.js` module, modifies the template normalizer to validate PascalCase tags against the import map, updates the compiler to integrate the resolver and remove auto-detection, and updates codegen to emit named imports with guarded registration.

## Tasks

- [x] 1. Create import resolver module
  - [x] 1.1 Create `lib/import-resolver.js` with `extractWccImports()` function
    - Parse script source using regex or AST to find all `.wcc` import statements
    - Extract named default imports: identifier + source path + compiled path (`.wcc` → `.js`)
    - Extract side-effect imports: source path + compiled path
    - Return stripped source (script with `.wcc` import lines removed)
    - Reject namespace imports (`import * as Foo from './foo.wcc'`) with `INVALID_WCC_IMPORT` error
    - Reject named exports (`import { Foo } from './foo.wcc'`) with `INVALID_WCC_IMPORT` error
    - Preserve relative path segments (e.g., `../shared/wcc-button.wcc` → `../shared/wcc-button.js`)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 8.1, 9.1, 9.2, 9.3, 9.5_

  - [x] 1.2 Write property tests for import resolver (Property 1: Named import round-trip)
    - **Property 1: Named import round-trip**
    - Use fast-check to generate valid PascalCase identifiers and relative `.wcc` paths
    - Verify parsing then emitting preserves identifier name exactly and produces `.js` path
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 9.1, 9.3, 9.4**

  - [x] 1.3 Write property tests for import resolver (Property 11: Invalid import form rejection)
    - **Property 11: Invalid import form rejection**
    - Use fast-check to generate namespace and named-export import forms from `.wcc` files
    - Verify the resolver throws an error with a descriptive message
    - **Validates: Requirements 9.5**

  - [x] 1.4 Write unit tests for `extractWccImports()`
    - Test single named import extraction
    - Test multiple named imports extraction
    - Test side-effect import extraction
    - Test mixed named + side-effect imports
    - Test path preservation with `../` segments
    - Test error on namespace import
    - Test error on named export import
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 8.1, 9.1, 9.2, 9.3, 9.5_

- [x] 2. Modify template normalizer to support import map validation
  - [x] 2.1 Update `normalizeTemplate()` in `lib/template-normalizer.js` to accept `options` parameter
    - Add optional `options` parameter with `importMap` (Map<string, string>) and `fileName` (string)
    - When `importMap` is provided: convert PascalCase tags that match an import key to kebab-case
    - When `importMap` is provided: throw `UNRESOLVED_COMPONENT` error for PascalCase tags with no matching import
    - Include unresolved tag name and source file path in error message
    - Hyphenated tags pass through unchanged (plain custom elements)
    - Maintain backward compatibility: when no `importMap` is provided, behave as before (convert all PascalCase to kebab-case)
    - _Requirements: 2.1, 2.3, 6.1, 6.2, 6.3, 6.4_

  - [x] 2.2 Write property tests for template normalizer (Property 2: PascalCase tag exact-case resolution)
    - **Property 2: PascalCase tag exact-case resolution**
    - Use fast-check to generate import maps and PascalCase tags
    - Verify tag resolves if and only if it exactly matches (case-sensitive) an import identifier
    - **Validates: Requirements 2.1, 2.3**

  - [x] 2.3 Write property tests for template normalizer (Property 3: Self-closing equivalence)
    - **Property 3: Self-closing equivalence**
    - Use fast-check to generate valid component usages
    - Verify self-closing `<Badge />` produces identical output to `<Badge></Badge>`
    - **Validates: Requirements 2.4**

  - [x] 2.4 Write property tests for template normalizer (Property 7: Unresolved PascalCase tag error)
    - **Property 7: Unresolved PascalCase tag error**
    - Use fast-check to generate PascalCase tags not in the import map
    - Verify the compiler throws an error containing both the tag name and file path
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

  - [x] 2.5 Write unit tests for updated `normalizeTemplate()`
    - Test PascalCase tag resolved via importMap
    - Test PascalCase tag throws UNRESOLVED_COMPONENT when not in importMap
    - Test hyphenated tags pass through unchanged
    - Test self-closing expansion with importMap
    - Test error message contains tag name and file path
    - _Requirements: 2.1, 2.3, 2.4, 6.1, 6.2, 6.3_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update types and codegen for named imports and guarded registration
  - [x] 4.1 Update `ChildComponentImport` typedef in `lib/types.js`
    - Add `identifier` property (PascalCase, e.g., 'WccBadge')
    - Add `sideEffect` boolean property (true if side-effect import)
    - _Requirements: 3.1, 8.1_

  - [x] 4.2 Modify `generateComponent()` in `lib/codegen.js` to emit named imports and guarded registration
    - Emit `import Identifier from './path.js'` for named child imports (instead of side-effect `import './path.js'`)
    - Emit guarded `customElements.define` call: `if (!customElements.get(Identifier.__meta.tag)) customElements.define(Identifier.__meta.tag, Identifier);`
    - Emit side-effect imports as `import './path.js'` with no registration call
    - Add `static __meta = { tag: 'tag-name' };` to the component class
    - Change final `customElements.define(...)` to guarded form: `if (!customElements.get('tag-name')) customElements.define('tag-name', ClassName);`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 7.1, 7.4, 8.3_

  - [x] 4.3 Write property tests for codegen (Property 4: Guarded child registration)
    - **Property 4: Guarded child registration for matched imports**
    - Verify compiled output contains named import and guarded `customElements.define` using `Identifier.__meta.tag`
    - **Validates: Requirements 2.2, 3.2, 3.3**

  - [x] 4.4 Write property tests for codegen (Property 5: Guarded self-registration)
    - **Property 5: Guarded self-registration**
    - Verify compiled output ends with guarded `customElements.define` using the component's own tag name
    - **Validates: Requirements 4.1, 4.2**

  - [x] 4.5 Write property tests for codegen (Property 8: Static imports only)
    - **Property 8: Static imports only**
    - Verify compiled output uses only static `import` declarations (no dynamic `import()`)
    - **Validates: Requirements 7.1, 7.4**

  - [x] 4.6 Write property tests for codegen (Property 9: Unused imports preserved)
    - **Property 9: Unused imports preserved**
    - Verify named `.wcc` imports not referenced in template still appear in compiled output
    - **Validates: Requirements 7.2**

  - [x] 4.7 Write property tests for codegen (Property 10: Side-effect import handling)
    - **Property 10: Side-effect import handling**
    - Verify side-effect imports emit `import './child.js'` with no `customElements.define` call
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 9.2**

- [x] 5. Integrate import resolver into compiler and remove auto-detection
  - [x] 5.1 Modify `compileSFC()` in `lib/compiler.js` to use `extractWccImports()`
    - Call `extractWccImports(source, fileName)` after `stripMacroImport`
    - Build `importMap` (Map<string, string>) from named imports: identifier → kebab-case tag
    - Pass `{ importMap, fileName }` to `normalizeTemplate()`
    - Build `childImports` array from extracted named imports (with identifier, tag, importPath, sideEffect)
    - Include side-effect imports in `childImports` with `sideEffect: true`
    - Use `strippedSource` (with `.wcc` imports removed) for subsequent extraction steps
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 5.4, 8.4_

  - [x] 5.2 Remove auto-detection logic from `lib/compiler.js`
    - Remove the `resolveChildComponent()` function
    - Remove the filesystem-scanning loop in step 18 (the `allChildTags` / `resolveChildComponent` block)
    - Remove the old `wccImportRe` regex and `manualImports` extraction (replaced by `extractWccImports`)
    - Hyphenated tags without a corresponding import are treated as plain HTML custom elements (no import generated)
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 5.3 Write property tests for compiler integration (Property 6: Hyphenated tags without imports are plain elements)
    - **Property 6: Hyphenated tags without imports are plain elements**
    - Verify hyphenated tags without matching imports produce no import or registration in output
    - **Validates: Requirements 5.1, 5.3**

  - [x] 5.4 Write integration tests for the full compilation pipeline
    - Compile a component with one named import used in template → verify output structure
    - Compile a component with multiple imports (named + side-effect) → verify all appear correctly
    - Compile a component with unresolved PascalCase tag → verify error thrown
    - Compile a component with hyphenated tags only → verify no child imports generated
    - Compile a component with unused named import → verify import still emitted
    - _Requirements: 1.1, 2.1, 3.1, 5.3, 6.1, 7.2, 8.1_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses vitest for testing and fast-check for property-based tests
- All code is JavaScript (ES modules) — no TypeScript compilation needed for implementation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "4.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "4.2"] },
    { "id": 3, "tasks": ["4.3", "4.4", "4.5", "4.6", "4.7", "5.1"] },
    { "id": 4, "tasks": ["5.2"] },
    { "id": 5, "tasks": ["5.3", "5.4"] }
  ]
}
```
