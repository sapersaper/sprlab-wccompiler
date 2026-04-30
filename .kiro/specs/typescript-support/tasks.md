# Implementation Plan: wcCompiler v2 — TypeScript Support

## Overview

This plan implements full TypeScript support for wcCompiler v2. It extends the parser with pre-strip generic extraction for `defineProps<T>()` and `defineEmits<T>()`, ensures the `stripTypes()` function handles all TypeScript syntax correctly (enums, decorators, `as const`, `satisfies`, module augmentation), updates error handling for TypeScript syntax errors, and updates the pretty-printer for round-trip testing of TypeScript-originated sources.

All code extends existing modules in `v2/lib/`. Tests use vitest + fast-check. This feature depends on the core spec being implemented first.

## Tasks

- [ ] 1. Implement pre-strip generic extraction functions
  - [ ] 1.1 Implement `extractPropsGeneric(rawSource)` in `v2/lib/parser.js`
    - Add regex to match `defineProps<{ ... }>` and extract property names
    - Handle optional properties (`name?: type` → extract `name`)
    - Handle multi-line generic bodies
    - Return `string[] | null` (null when no generic found)
    - _Requirements: 3.1, 3.2, 3.3, 5.1_

  - [ ] 1.2 Implement `extractEmitsGeneric(rawSource)` in `v2/lib/parser.js`
    - Add regex to match `defineEmits<{ ... }>` and extract event names from call signatures
    - Handle multiple call signatures: `(e: 'event1', ...): void; (e: 'event2', ...): void`
    - Return `string[] | null` (null when no generic found)
    - _Requirements: 4.1, 4.2, 5.2_

  - [ ] 1.3 Update `parse()` to call pre-strip extraction before `stripTypes()`
    - Read raw source, call `extractPropsGeneric()` and `extractEmitsGeneric()`
    - Call `stripTypes()` on raw source to get JavaScript
    - Continue with existing regex extraction on stripped JavaScript
    - Merge: generic-extracted props/events take priority over runtime-extracted ones
    - _Requirements: 5.1, 5.2, 5.3, 3.4, 3.5, 3.6, 4.3, 4.4_

- [ ] 2. Ensure `stripTypes()` handles full TypeScript surface
  - [ ] 2.1 Verify and update `stripTypes()` in `v2/lib/parser.js`
    - Ensure `esbuild.transform()` is called with `{ loader: 'ts', sourcemap: false }`
    - Wrap esbuild errors with `TS_SYNTAX_ERROR` error code
    - Handle unsupported features with `TS_UNSUPPORTED_FEATURE` error code
    - Verify esbuild handles: interfaces, type aliases, enums, type assertions, `as const`, `satisfies`, decorators, module augmentation, `declare module`, `declare global`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 7.1, 7.2, 8.1, 8.2, 9.1, 9.2, 11.1, 11.2_

- [ ] 3. Update file extension handling
  - [ ] 3.1 Verify config glob patterns in `v2/lib/config.js`
    - Confirm glob uses `**/*.{ts,js}` pattern
    - Confirm exclusion of `**/*.test.*` and `**/*.d.ts`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 4. Update Pretty Printer for TypeScript-originated sources
  - [ ] 4.1 Update `prettyPrint()` in `v2/lib/printer.js` for generic-extracted props
    - When props exist but came from a generic (no runtime defaults), emit as `defineProps({ name: undefined, ... })`
    - Ensure round-trip: parse(ts) → print(js) → parse(js) produces equivalent IR
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 5. Checkpoint — Ensure all implementation compiles
  - Run `yarn test` from `v2/` to verify no regressions in core tests and new code compiles. Ask the user if questions arise.

- [ ] 6. Write tests for type stripping
  - [ ]* 6.1 Write property test for type stripping produces valid JavaScript (Property 1)
    - **Property 1: Type Stripping Produces Valid JavaScript**
    - Use fast-check to generate TypeScript source strings with: type annotations on variables/params/returns, interface declarations, type alias declarations, generic type parameters on function calls, type assertions (`as Type`), `as const` assertions, `satisfies` operator
    - Call `stripTypes()`, assert output contains no TypeScript-specific syntax (no `:` type annotations outside object literals, no `interface` keyword, no `type` alias declarations, no `as Type`, no `satisfies Type`)
    - Assert all runtime expressions are preserved
    - Minimum 100 iterations
    - Tag: `Feature: typescript-support, Property 1: Type Stripping Produces Valid JavaScript`
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 1.8, 2.1, 2.3, 2.4**

  - [ ]* 6.2 Write property test for type-only import removal (Property 2)
    - **Property 2: Type-Only Import Complete Removal**
    - Use fast-check to generate source strings with `import type { Name } from 'module'` and `export type { Name }` statements mixed with regular imports
    - Call `stripTypes()`, assert output contains zero `import type` or `export type` statements
    - Assert regular imports are preserved
    - Minimum 100 iterations
    - Tag: `Feature: typescript-support, Property 2: Type-Only Import Complete Removal`
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

  - [ ]* 6.3 Write property test for enum transformation (Property 7)
    - **Property 7: Enum Transformation to Runtime Object**
    - Use fast-check to generate TypeScript enum declarations (numeric and string enums)
    - Call `stripTypes()`, assert output does NOT contain `enum` keyword, assert output contains runtime representation (variable assignment or IIFE)
    - Minimum 100 iterations
    - Tag: `Feature: typescript-support, Property 7: Enum Transformation to Runtime Object`
    - **Validates: Requirements 1.4**

  - [ ]* 6.4 Write property test for no source map in output (Property 6)
    - **Property 6: No Source Map in Output**
    - Use fast-check to generate arbitrary TypeScript sources
    - Call `stripTypes()`, assert output does NOT contain `sourceMappingURL` or `sourceURL`
    - Minimum 100 iterations
    - Tag: `Feature: typescript-support, Property 6: No Source Map in Output`
    - **Validates: Requirements 11.1, 11.2**

  - [ ]* 6.5 Write property test for syntax error reporting (Property 8)
    - **Property 8: TypeScript Syntax Error Reporting**
    - Use fast-check to generate invalid TypeScript (unclosed generics, malformed annotations)
    - Call `stripTypes()`, assert error is thrown with code `TS_SYNTAX_ERROR` and message contains descriptive text
    - Minimum 100 iterations
    - Tag: `Feature: typescript-support, Property 8: TypeScript Syntax Error Reporting`
    - **Validates: Requirements 9.1, 9.2**

- [ ] 7. Write tests for pre-strip generic extraction
  - [ ]* 7.1 Write property test for defineProps generic extraction (Property 3)
    - **Property 3: defineProps Generic Extraction**
    - Use fast-check to generate `defineProps<{ prop1: type1, prop2?: type2 }>()` with varying numbers of properties, types, and optional markers
    - Call `extractPropsGeneric()`, assert all property names are extracted without `?` markers
    - Minimum 100 iterations
    - Tag: `Feature: typescript-support, Property 3: defineProps Generic Extraction`
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6, 5.1**

  - [ ]* 7.2 Write property test for defineEmits generic extraction (Property 4)
    - **Property 4: defineEmits Generic Extraction**
    - Use fast-check to generate `defineEmits<{ (e: 'event1', ...): void; (e: 'event2'): void }>()` with varying numbers of call signatures
    - Call `extractEmitsGeneric()`, assert all event names are extracted
    - Minimum 100 iterations
    - Tag: `Feature: typescript-support, Property 4: defineEmits Generic Extraction`
    - **Validates: Requirements 4.1, 4.2, 4.4, 5.2**

  - [ ]* 7.3 Write unit tests for generic extraction edge cases
    - Test `defineProps` without generic (returns null, falls back to runtime)
    - Test `defineProps` with generic AND runtime defaults (generic wins for names, runtime for defaults)
    - Test `defineEmits` without generic (returns null)
    - Test multi-line generic bodies
    - Test generic with complex types (arrays, unions, intersections — only names matter)
    - _Requirements: 3.4, 3.5, 4.3_

- [ ] 8. Write tests for round-trip
  - [ ]* 8.1 Write property test for parser round-trip with TypeScript sources (Property 5)
    - **Property 5: Parser Round-Trip (TypeScript Sources)**
    - Use fast-check to generate valid TypeScript component sources with `defineComponent()`, `signal<T>()`, `computed<T>()`, `effect()`, `function`, `defineProps<T>()`, `defineEmits<T>()`
    - Parse the TypeScript source → print the IR → parse the printed JavaScript
    - Assert both ParseResults are equivalent (same tag, signals, computeds, effects, methods, prop names, event names)
    - Minimum 100 iterations
    - Tag: `Feature: typescript-support, Property 5: Parser Round-Trip (TypeScript Sources)`
    - **Validates: Requirements 10.1, 10.2, 10.3**

- [ ] 9. Write unit tests for edge cases
  - [ ]* 9.1 Write unit tests for decorator handling
    - Test that decorators on classes/methods/properties don't cause errors
    - Test that esbuild error on unsupported decorator syntax is wrapped with descriptive message
    - _Requirements: 7.1, 7.2_

  - [ ]* 9.2 Write unit tests for module augmentation
    - Test `declare module '...' { ... }` is removed entirely
    - Test `declare global { ... }` is removed entirely
    - Test that runtime code around declarations is preserved
    - _Requirements: 8.1, 8.2_

  - [ ]* 9.3 Write unit tests for specific TypeScript features
    - Test `as const` assertion removal
    - Test `satisfies` operator removal
    - Test inline type imports (`import { type Foo, Bar }` → only `Bar` remains)
    - Test generic type parameters on `signal<number>(0)` are stripped
    - Test `.js` files pass through without error
    - _Requirements: 1.6, 1.7, 1.8, 2.2, 6.1, 6.2_

- [ ] 10. Write integration test
  - [ ]* 10.1 Write end-to-end compiler test with TypeScript (`v2/lib/compiler.typescript.test.js`)
    - Create a temp TypeScript component with: type annotations, interface, `defineProps<T>()`, `defineEmits<T>()`, `signal<number>()`, `computed<string>()`, type-only imports, `as const`, enum
    - Compile and verify: output is valid JavaScript, no TypeScript syntax remains, prop names from generic are in ParseResult, event names from generic are in ParseResult, enum is transformed to runtime object
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 3.1, 4.1, 5.1, 5.2, 5.3_

- [ ] 11. Final checkpoint — Ensure all tests pass
  - Run `yarn test` from `v2/` and verify all tests pass. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- This feature depends on the core spec being fully implemented
- esbuild is already a dependency (used in core spec for type stripping)
- The pre-strip extraction is the ONLY TypeScript-aware code in the parser — everything else delegates to esbuild
- `extractPropsGeneric` uses a simple regex that matches `defineProps<{ ... }>` — it does NOT handle nested braces in types (e.g., `{ callback: (a: { x: number }) => void }`). This is acceptable because prop type complexity doesn't affect name extraction
- `extractEmitsGeneric` matches `(e: 'eventName'` patterns — it handles multiple signatures separated by `;`
- Enum transformation is handled entirely by esbuild — the parser doesn't need special enum handling
- Decorators are handled by esbuild's default behavior (currently stripped) — no parser changes needed
- The pretty-printer emits JavaScript format because TypeScript type info is not preserved in the IR

