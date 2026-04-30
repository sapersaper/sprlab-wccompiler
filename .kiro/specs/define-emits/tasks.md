# Implementation Plan: wcCompiler v2 — defineEmits

## Overview

This plan implements the `defineEmits` feature for wcCompiler v2. It extends the core parser and code generator to support typed custom event dispatching on custom elements. The implementation adds new extraction logic for both array form and TypeScript call signatures form, validation errors (assignment required, duplicate emits, object name conflicts, undeclared emits), code generation for the `_emit(name, detail)` method, emit call transformation (`emit('event', data)` → `this._emit('event', data)`), and exclusion of the emits object name from reactive transforms.

All code extends existing modules in `v2/lib/`. Tests use vitest + fast-check. This feature depends on the core spec and defineProps spec being implemented first.

## Tasks

- [ ] 1. Extend ParseResult types for emits
  - [ ] 1.1 Add emits fields to `ParseResult` in `v2/lib/types.js`
    - Add `emits: string[]` field to `ParseResult` typedef (event names, empty array if no defineEmits)
    - Add `emitsObjectName: string|null` field to `ParseResult` typedef (variable name from assignment)
    - _Requirements: 1.1, 2.1, 6.1_

- [ ] 2. Implement emits parsing in the Parser
  - [ ] 2.1 Implement `extractEmitsFromCallSignatures` — extract event names from TypeScript generic form (BEFORE type strip)
    - Internal function (not exported)
    - Regex: `/defineEmits\s*<\s*\{([\s\S]*?)\}\s*>\s*\(\s*\)/` to capture the generic body
    - Extract event names via `/\(\s*\w+\s*:\s*['"]([^'"]+)['"]/g` from each call signature
    - Must be called BEFORE `stripTypes()` since esbuild removes generics
    - Return `string[]` of event names (empty array if no generic form found)
    - Support both single-quoted and double-quoted string literals
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 2.2 Implement `extractEmits` — extract event names from array form (AFTER type strip)
    - Internal function (not exported)
    - Regex: `/defineEmits\(\[([^\]]*)\]\)/` to capture the array body
    - Extract event names via `/['"]([^'"]+)['"]/g`
    - Called AFTER type stripping
    - Return `string[]` of event names (empty array if no array form found)
    - Support both single-quoted and double-quoted string literals, preserve order
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 2.3 Implement `extractEmitsObjectName` — extract the variable name (AFTER type strip)
    - Export `function extractEmitsObjectName(source): string | null`
    - Regex: `/(?:const|let|var)\s+([$\w]+)\s*=\s*defineEmits\s*\(/`
    - Return the captured variable name or `null` if no assignment found
    - _Requirements: 3.1, 3.2_

  - [ ] 2.4 Implement `extractEmitsObjectNameFromGeneric` — extract variable name from generic form (BEFORE type strip)
    - Internal function (not exported)
    - Regex: `/(?:const|let|var)\s+([$\w]+)\s*=\s*defineEmits\s*<\s*\{/`
    - Return the captured variable name or `null` if no generic form found
    - _Requirements: 3.1, 3.2_

  - [ ] 2.5 Implement `validateEmitsAssignment` — detect bare defineEmits calls
    - Internal function (not exported)
    - Check if `defineEmits` appears in source without a preceding variable assignment
    - Strategy: if `defineEmits` is found in source but neither `extractEmitsObjectName` nor `extractEmitsObjectNameFromGeneric` returns a name → error
    - Throw error with code `EMITS_ASSIGNMENT_REQUIRED`
    - Message: `"Error en '{file}': defineEmits() debe asignarse a una variable (const emit = defineEmits(...))"`
    - _Requirements: 3.1_

  - [ ] 2.6 Implement `validateDuplicateEmits` — detect duplicate event names
    - Internal function (not exported)
    - Accept `string[]` of event names and `fileName`
    - Use a Set to detect duplicates
    - Throw error with code `DUPLICATE_EMITS` listing the duplicated names
    - Message: `"Error en '{file}': emits duplicados: {names}"`
    - _Requirements: 4.1_

  - [ ] 2.7 Implement `validateEmitsConflicts` — detect naming collisions
    - Internal function (not exported)
    - Accept `emitsObjectName`, `signalNames: Set`, `computedNames: Set`, `constantNames: Set`, `propNames: Set`, `propsObjectName: string|null`
    - If `emitsObjectName` is in any of the sets or matches `propsObjectName` → throw error with code `EMITS_OBJECT_CONFLICT`
    - Message: `"Error en '{file}': '{name}' colisiona con una declaración existente"`
    - _Requirements: 4.2_

  - [ ] 2.8 Implement `validateUndeclaredEmits` — detect emit calls with undeclared event names
    - Internal function (not exported)
    - Accept `source`, `emitsObjectName`, `emits: string[]`, `fileName`
    - Build dynamic regex from emitsObjectName: `new RegExp(\`\\b${escapeRegex(emitsObjectName)}\\(\\s*['"]([^'"]+)['\"]\`, 'g')`
    - For each match, check if the captured event name is in the emits array
    - If not, throw error with code `UNDECLARED_EMIT`
    - Message: `"Error en '{file}': emit no declarado: '{eventName}'"`
    - Validate all emit calls found in method bodies, effect bodies, and computed expressions
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 2.9 Integrate emits extraction into the main `parse()` function
    - Before type stripping: call `extractEmitsFromCallSignatures(source)` and `extractEmitsObjectNameFromGeneric(source)`
    - After type stripping: call `extractEmits(source)` (if call signatures didn't find emits), `extractEmitsObjectName(source)` (if generic didn't find name)
    - Merge: use whichever form was found (call signatures or array)
    - Run validations: `validateEmitsAssignment`, `validateDuplicateEmits`, `validateEmitsConflicts`, `validateUndeclaredEmits`
    - Add `emits` and `emitsObjectName` to the returned ParseResult
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 5.3_

- [ ] 3. Extend the Code Generator for emits
  - [ ] 3.1 Generate `_emit(name, detail)` method on the HTMLElement class
    - When `emits.length > 0`, generate the `_emit` method in the class body
    - Method body: `this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))`
    - When emit call has no payload argument, `detail` is `undefined`
    - Place after constructor and connectedCallback methods
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 3.2 Implement emit call transformation in `transformMethodBody` and `transformExpr`
    - Before other reactive transforms, replace emit calls: `emitsObjectName(` → `this._emit(`
    - Regex: `new RegExp(\`\\b${escapeRegex(emitsObjectName)}\\(\`, 'g')` → `'this._emit('`
    - Apply in method bodies AND effect bodies
    - Only transform calls that use the captured emitsObjectName as callee — other function calls with same pattern are NOT transformed
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ] 3.3 Exclude emitsObjectName from signal/computed/constant transforms
    - In `transformExpr` and `transformMethodBody`, skip the `emitsObjectName` when applying word-boundary replacements for signals, computeds, and constants
    - Add `if (emitsObjectName && n === emitsObjectName) continue;` in each transform loop
    - Follows the exact same pattern used for `propsObjectName` exclusion
    - _Requirements: 7.5, 8.1, 8.2, 8.3_

  - [ ] 3.4 Update `transformExpr` and `transformMethodBody` signatures to accept `emitsObjectName`
    - Add `emitsObjectName` parameter to both functions
    - Thread the parameter through all call sites in `generateComponent()`
    - _Requirements: 7.1, 7.4, 7.5, 8.1, 8.2, 8.3_

- [ ] 4. Update the Compiler pipeline
  - [ ] 4.1 Pass `emitsObjectName` through the compiler in `compile()`
    - Ensure `emits` and `emitsObjectName` from ParseResult are available to the code generator
    - No new parameters needed — they are already part of ParseResult passed to `generateComponent()`
    - Verify the data flows correctly through the pipeline
    - _Requirements: 6.1, 7.1_

- [ ] 5. Extend the Pretty Printer for emits
  - [ ] 5.1 Serialize `emits` and `emitsObjectName` in `prettyPrint()`
    - If `emits.length > 0`, output: `const <emitsObjectName> = defineEmits(['event1', 'event2'])`
    - Use array form as canonical printed form (TS type info is lost after parsing)
    - Place after `defineComponent()` and `defineProps()` (if present), before signal declarations
    - Add `defineEmits` to the import list when emits are present
    - _Requirements: (supports round-trip testing, Property 1)_

- [ ] 6. Checkpoint — Ensure all implementation compiles
  - Run `yarn test` from `v2/` to verify no regressions in core tests and new code compiles. Ask the user if questions arise.

- [ ] 7. Write tests for emits parsing
  - [ ]* 7.1 Write unit tests for parser emits extraction (`v2/lib/parser.defineEmits.test.js`)
    - Test array form: `defineEmits(['change', 'reset'])` extracts correct event names
    - Test call signatures form: `defineEmits<{ (e: 'change', value: number): void; (e: 'reset'): void }>()` extracts correct event names
    - Test single-quoted and double-quoted string literals in both forms
    - Test order preservation of event names
    - Test `EMITS_ASSIGNMENT_REQUIRED` error for bare `defineEmits(...)` call
    - Test `DUPLICATE_EMITS` error for `defineEmits(['change', 'change'])`
    - Test `EMITS_OBJECT_CONFLICT` error when emitsObjectName matches a signal name
    - Test `EMITS_OBJECT_CONFLICT` error when emitsObjectName matches propsObjectName
    - Test `UNDECLARED_EMIT` error for `emit('nonexistent')` when not in declaration
    - Test that emitsObjectName is correctly extracted for const/let/var
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 5.3_

  - [ ]* 7.2 Write property test for emits parser round-trip (Property 1)
    - **Property 1: Emits Parser Round-Trip**
    - Use fast-check to generate valid component sources with defineEmits (random event names, random emitsObjectName)
    - Parse → prettyPrint → parse again → assert equivalent `emits` (names and order) and `emitsObjectName`
    - Minimum 100 iterations
    - Tag: `Feature: define-emits, Property 1: Emits Parser Round-Trip`
    - **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**

  - [ ]* 7.3 Write property test for bare call error detection (Property 2)
    - **Property 2: Bare Call Error Detection**
    - Use fast-check to generate component sources with `defineEmits()` calls NOT assigned to a variable
    - Parse and assert `EMITS_ASSIGNMENT_REQUIRED` error is thrown
    - Minimum 100 iterations
    - Tag: `Feature: define-emits, Property 2: Bare Call Error Detection`
    - **Validates: Requirements 3.1**

  - [ ]* 7.4 Write property test for duplicate emits detection (Property 3)
    - **Property 3: Duplicate Emits Detection**
    - Use fast-check to generate event name arrays that contain at least one duplicate
    - Parse and assert `DUPLICATE_EMITS` error is thrown
    - Minimum 100 iterations
    - Tag: `Feature: define-emits, Property 3: Duplicate Emits Detection`
    - **Validates: Requirements 4.1**

  - [ ]* 7.5 Write property test for emits object conflict detection (Property 4)
    - **Property 4: Emits Object Conflict Detection**
    - Use fast-check to generate component sources where emitsObjectName matches a signal, computed, constant, prop name, or propsObjectName
    - Parse and assert `EMITS_OBJECT_CONFLICT` error is thrown
    - Minimum 100 iterations
    - Tag: `Feature: define-emits, Property 4: Emits Object Conflict Detection`
    - **Validates: Requirements 4.2**

  - [ ]* 7.6 Write property test for undeclared emit detection (Property 5)
    - **Property 5: Undeclared Emit Detection**
    - Use fast-check to generate component sources with emit calls using event names NOT in the declared emits array
    - Parse and assert `UNDECLARED_EMIT` error is thrown
    - Minimum 100 iterations
    - Tag: `Feature: define-emits, Property 5: Undeclared Emit Detection`
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [ ] 8. Write tests for code generation
  - [ ]* 8.1 Write unit tests for codegen emits output (`v2/lib/codegen.defineEmits.test.js`)
    - Test that output contains `_emit(name, detail)` method with correct body
    - Test that `_emit` dispatches `new CustomEvent(name, { detail, bubbles: true, composed: true })`
    - Test no-payload emit: `emit('reset')` → `this._emit('reset')` (detail is undefined)
    - Test emit call transformation in method bodies: `emit('change', count())` → `this._emit('change', this._count())`
    - Test emit call transformation in effect bodies
    - Test that emitsObjectName is excluded from signal transforms (not transformed to `this._emit()` as signal read)
    - Test that emitsObjectName is excluded from computed transforms
    - Test that emitsObjectName is excluded from constant transforms
    - Test that non-emit function calls with similar patterns are NOT transformed
    - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3_

  - [ ]* 8.2 Write property test for emit call transformation (Property 6)
    - **Property 6: Emit Call Transformation**
    - Use fast-check to generate method bodies containing `emitsObjectName('eventName', payload)` calls with various event names and payloads
    - Call the transformation function, assert every `emitsObjectName(` is replaced with `this._emit(` and non-emit function calls are unchanged
    - Minimum 100 iterations
    - Tag: `Feature: define-emits, Property 6: Emit Call Transformation`
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

  - [ ]* 8.3 Write property test for emits object name exclusion from reactive transforms (Property 7)
    - **Property 7: Emits Object Name Exclusion from Reactive Transforms**
    - Use fast-check to generate method bodies where the emitsObjectName appears alongside signal/computed references
    - Call the transformation function, assert emitsObjectName is NOT transformed with `this._<name>()`, `this._c_<name>()`, or constant patterns
    - Minimum 100 iterations
    - Tag: `Feature: define-emits, Property 7: Emits Object Name Exclusion from Reactive Transforms`
    - **Validates: Requirements 7.5, 8.1, 8.2, 8.3**

- [ ] 9. Write integration test
  - [ ]* 9.1 Write end-to-end compiler test with defineEmits (`v2/lib/compiler.defineEmits.test.js`)
    - Create a temp component source with `defineEmits<{ (e: 'change', value: number): void; (e: 'reset'): void }>()`
    - Include a method body with `emit('change', count())` and `emit('reset')`
    - Compile and verify output contains: `_emit` method, transformed emit calls (`this._emit('change', ...)`), no reactive transforms on emitsObjectName
    - Test that `emit` variable is not treated as a signal or computed
    - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3_

- [ ] 10. Final checkpoint — Ensure all tests pass
  - Run `yarn test` from `v2/` and verify all tests pass. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- This feature depends on the core spec and defineProps spec being fully implemented
- The emits extraction follows the same two-phase pattern as defineProps: generic extraction BEFORE type strip, array extraction AFTER type strip
- The `_emit` method is only generated when `emits.length > 0`
- The emitsObjectName exclusion from reactive transforms follows the exact same pattern as propsObjectName exclusion in defineProps
- The pretty printer uses array form as canonical output since TypeScript type information is lost after parsing
- Undeclared emit validation uses a dynamic regex built from the captured emitsObjectName, ensuring only the declared emit variable's calls are checked
- Events are dispatched with `bubbles: true` and `composed: true` following Web Component conventions for cross-shadow-DOM propagation
