# Implementation Plan: wcCompiler v2 — defineProps

## Overview

This plan implements the `defineProps` feature for wcCompiler v2. It extends the core parser, tree-walker, and code generator to support typed props with defaults, received as HTML attributes and exposed as reactive signals. The implementation adds new extraction logic, a new binding type (`'prop'`), validation errors, and code generation for `observedAttributes`, `attributeChangedCallback`, prop signals, getters/setters, and `props.x` → `this._s_x()` transformation.

All code extends existing modules in `v2/lib/`. Tests use vitest + fast-check. This feature depends on the core spec being implemented first.

## Tasks

- [x] 1. Extend ParseResult types and add PropDef
  - [x] 1.1 Add `PropDef` typedef and extend `ParseResult` in `v2/lib/types.js`
    - Add `@typedef {Object} PropDef` with fields: `name` (string), `default` (string), `attrName` (string)
    - Add `propDefs: PropDef[]` field to `ParseResult` typedef
    - Add `propsObjectName: string|null` field to `ParseResult` typedef
    - _Requirements: 1.1, 2.1, 5.1_

- [x] 2. Implement props parsing in the Parser
  - [x] 2.1 Implement `camelToKebab` utility function in `v2/lib/parser.js`
    - Export `function camelToKebab(name): string`
    - Convert camelCase identifiers to kebab-case: `itemCount` → `item-count`
    - Regex: `/([a-z0-9])([A-Z])/g` → `'$1-$2'` then `.toLowerCase()`
    - Already-kebab or all-lowercase names pass through unchanged
    - _Requirements: 5.1_

  - [x] 2.2 Implement `extractPropsGeneric` — extract prop names from TypeScript generic form
    - Internal function (not exported)
    - Regex: `/defineProps\s*<\s*\{([^}]*)\}\s*>/` to capture the generic body
    - Extract prop names via `/(\w+)\s*[?]?\s*:/g` from the captured body
    - Must be called BEFORE `stripTypes()` since esbuild removes generics
    - Return `string[]` of prop names (empty array if no generic form found)
    - _Requirements: 1.1, 1.4_

  - [x] 2.3 Implement `extractPropsArray` — extract prop names from array form
    - Internal function (not exported)
    - Regex: `/defineProps\(\s*\[([^\]]*)\]\s*\)/` to capture the array body
    - Extract prop names via `/['"]([^'"]+)['"]/g`
    - Called AFTER type stripping
    - Return `string[]` of prop names (empty array if no array form found)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.4 Implement `extractPropsDefaults` — extract default values from defaults object
    - Internal function (not exported)
    - After type stripping, the generic form `defineProps<{...}>({...})` becomes `defineProps({...})`
    - Regex to find `defineProps(` then use parenthesis depth counting to extract the argument
    - If argument starts with `{`, parse as object literal: extract `key: value` pairs via regex or simple parsing
    - If argument starts with `[`, it's the array form — no defaults (return empty map)
    - Return `Record<string, string>` mapping prop name → default value expression
    - Handle nested values (objects, arrays) via depth counting
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 2.5 Implement `extractPropsObjectName` — extract the variable name
    - Export `function extractPropsObjectName(source): string | null`
    - Regex: `/(?:const|let|var)\s+([$\w]+)\s*=\s*defineProps\s*[<(]/`
    - Also support generic form before type strip: `/(?:const|let|var)\s+([$\w]+)\s*=\s*defineProps\s*</`
    - Return the captured variable name or `null` if no assignment found
    - _Requirements: 3.1, 3.2_

  - [x] 2.6 Implement `validatePropsAssignment` — detect bare defineProps calls
    - Internal function (not exported)
    - Check if `defineProps` appears in source without a preceding variable assignment
    - Strategy: if `defineProps` is found in source but `extractPropsObjectName` returns null → error
    - Throw error with code `PROPS_ASSIGNMENT_REQUIRED`
    - Message: `"Error en '{file}': defineProps() debe asignarse a una variable (const props = defineProps(...))"`
    - _Requirements: 3.1_

  - [x] 2.7 Implement `validateDuplicateProps` — detect duplicate prop names
    - Internal function (not exported)
    - Accept `string[]` of prop names and `fileName`
    - Use a Set to detect duplicates
    - Throw error with code `DUPLICATE_PROPS` listing the duplicated names
    - Message: `"Error en '{file}': props duplicados: {names}"`
    - _Requirements: 4.1_

  - [x] 2.8 Implement `validatePropsConflicts` — detect naming collisions
    - Internal function (not exported)
    - Accept `propsObjectName`, `signalNames: Set`, `computedNames: Set`, `constantNames: Set`
    - If `propsObjectName` is in any of the sets → throw error with code `PROPS_OBJECT_CONFLICT`
    - Message: `"Error en '{file}': '{name}' colisiona con una declaración existente"`
    - _Requirements: 4.2_

  - [x] 2.9 Integrate props extraction into the main `parse()` function
    - Before type stripping: call `extractPropsGeneric(source)` and `extractPropsObjectName(source)` (for generic form)
    - After type stripping: call `extractPropsArray(source)` (if generic didn't find props), `extractPropsDefaults(source)`
    - Merge: use generic prop names if found, otherwise array prop names
    - Build `PropDef[]` by combining prop names with defaults map and `camelToKebab` for attrName
    - Run validations: `validatePropsAssignment`, `validateDuplicateProps`, `validatePropsConflicts`
    - Add `propDefs` and `propsObjectName` to the returned ParseResult
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 4.2_

- [x] 3. Extend the Tree Walker for prop bindings
  - [x] 3.1 Update `walkTree` to accept `propNames` parameter and classify prop bindings
    - Add `propNames: Set<string>` as fourth parameter to `walkTree()`
    - Update binding type classification order: prop → signal → computed → method
    - When `{{name}}` matches a name in `propNames`, set binding type to `'prop'`
    - Update the `Binding` type to include `'prop'` in the type union
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 4. Extend the Code Generator for props
  - [x] 4.1 Generate `static get observedAttributes()` in the class
    - When `propDefs.length > 0`, generate the static getter
    - Return array of `attrName` values (kebab-case) from propDefs
    - Place before the constructor in the class body
    - _Requirements: 5.1_

  - [x] 4.2 Generate prop signal initialization in the constructor
    - For each PropDef: `this._s_<name> = __signal(<default>)`
    - Place BEFORE user signal initialization
    - Use the `default` field from PropDef (already a valid JS expression string)
    - _Requirements: 5.2_

  - [x] 4.3 Generate `attributeChangedCallback` with type coercion
    - Generate `attributeChangedCallback(name, oldVal, newVal)` method
    - For each prop, generate an `if (name === '<attrName>')` branch
    - Type coercion logic based on default value:
      - Default matches `/^-?\d+(\.\d+)?$/` (number) → `this._s_<name>(newVal != null ? Number(newVal) : <default>)`
      - Default is `'true'` or `'false'` (boolean) → `this._s_<name>(newVal != null)`
      - Default is `'undefined'` → `this._s_<name>(newVal)`
      - Otherwise (string) → `this._s_<name>(newVal ?? <default>)`
    - _Requirements: 5.3, 8.1, 8.2, 8.3_

  - [x] 4.4 Generate public getters and setters for each prop
    - Getter: `get <propName>() { return this._s_<propName>(); }`
    - Setter: `set <propName>(val) { this._s_<propName>(val); this.setAttribute('<attrName>', String(val)); }`
    - Place after `attributeChangedCallback` in the class body
    - _Requirements: 5.4, 5.5_

  - [x] 4.5 Implement `props.x` → `this._s_x()` transformation in expressions
    - Update `transformExpr` to handle `propsObjectName.propName` patterns
    - Regex: `/\b<propsObjectName>\.(\w+)/g` → check if captured group is a known prop name → replace with `this._s_$1()`
    - If captured group is NOT a known prop name, leave unchanged (don't transform)
    - Apply this transformation BEFORE signal/computed transforms to avoid conflicts
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 4.6 Exclude propsObjectName from signal/computed/constant transforms
    - In `transformExpr` and `transformMethodBody`, skip the `propsObjectName` when applying word-boundary replacements for signals, computeds, and constants
    - The propsObjectName itself should never be transformed to `this._<name>()` or `this._c_<name>()`
    - _Requirements: 6.4_

  - [x] 4.7 Generate prop binding effects in connectedCallback
    - For bindings with type `'prop'`, generate: `__effect(() => { this.<varName>.textContent = this._s_<name>() ?? ''; })`
    - Same pattern as signal bindings but using `_s_` prefix
    - _Requirements: 7.2, 7.3_

- [x] 5. Update the Compiler pipeline
  - [x] 5.1 Pass `propNames` to tree walker in `compile()`
    - Build `propNames = new Set(propDefs.map(p => p.name))` from ParseResult
    - Pass as fourth argument to `walkTree(rootEl, signalNames, computedNames, propNames)`
    - _Requirements: 7.1_

- [x] 6. Extend the Pretty Printer for props
  - [x] 6.1 Serialize `propDefs` and `propsObjectName` in `prettyPrint()`
    - If `propDefs.length > 0`, output: `const <propsObjectName> = defineProps({ <name>: <default>, ... })`
    - Place after `defineComponent()` and before signal declarations
    - Add `defineProps` to the import list when props are present
    - _Requirements: (supports round-trip testing)_

- [x] 7. Checkpoint — Ensure all implementation compiles
  - Run `yarn test` from `v2/` to verify no regressions in core tests and new code compiles.

- [x] 8. Write tests for props parsing
  - [ ]* 8.1 Write unit tests for parser props extraction (`v2/lib/parser.defineProps.test.js`)
    - Test generic form: `defineProps<{ label: string, count: number }>({ label: 'Click', count: 0 })` extracts correct propDefs
    - Test generic form without defaults: `defineProps<{ label: string }>()` extracts props with 'undefined' defaults
    - Test array form: `defineProps(['label', 'count'])` extracts correct prop names
    - Test `camelToKebab`: 'itemCount' → 'item-count', 'label' → 'label', 'myLongPropName' → 'my-long-prop-name'
    - Test `PROPS_ASSIGNMENT_REQUIRED` error for bare `defineProps(...)` call
    - Test `DUPLICATE_PROPS` error for `defineProps(['a', 'a'])`
    - Test `PROPS_OBJECT_CONFLICT` error when propsObjectName matches a signal name
    - Test that propsObjectName is correctly extracted for const/let/var
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 4.2_

  - [ ]* 8.2 Write property test for props extraction completeness (Property 2)
    - **Property 2: Props Extraction Completeness**
    - Use fast-check to generate sets of distinct valid JS identifiers as prop names
    - For each set: construct a `defineProps(['name1', 'name2', ...])` source string, parse it, assert all prop names are extracted exactly once in order
    - Also test generic form with generated prop names
    - Minimum 100 iterations
    - Tag: `Feature: define-props, Property 2: Props Extraction Completeness`
    - **Validates: Requirements 1.1, 1.4, 2.1**

  - [ ]* 8.3 Write property test for duplicate props detection (Property 7)
    - **Property 7: Duplicate Props Detection**
    - Use fast-check to generate prop name arrays that contain at least one duplicate
    - Parse and assert `DUPLICATE_PROPS` error is thrown
    - Minimum 100 iterations
    - Tag: `Feature: define-props, Property 7: Duplicate Props Detection`
    - **Validates: Requirements 4.1**

- [x] 9. Write tests for code generation
  - [ ]* 9.1 Write unit tests for codegen props output (`v2/lib/codegen.defineProps.test.js`)
    - Test that output contains `static get observedAttributes()` with correct attribute names
    - Test that constructor contains `__signal(default)` for each prop
    - Test `attributeChangedCallback` with number coercion, boolean coercion, string passthrough
    - Test getter/setter generation for each prop
    - Test `props.x` → `this._s_x()` transformation in method bodies
    - Test that propsObjectName is excluded from signal transforms
    - Test prop binding effects in connectedCallback
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 7.2, 7.3, 8.1, 8.2, 8.3_

  - [ ]* 9.2 Write property test for observedAttributes consistency (Property 3)
    - **Property 3: Codegen observedAttributes Consistency**
    - Use fast-check to generate ParseResult IRs with varying numbers of propDefs (1-10 props with random camelCase names)
    - Call `generateComponent()`, parse the `observedAttributes` array from output, assert it contains exactly N kebab-case names matching the propDefs
    - Minimum 100 iterations
    - Tag: `Feature: define-props, Property 3: Codegen observedAttributes Consistency`
    - **Validates: Requirements 5.1**

  - [ ]* 9.3 Write property test for prop signal initialization (Property 4)
    - **Property 4: Codegen Prop Signal Initialization**
    - Use fast-check to generate ParseResult IRs with propDefs containing various default values (numbers, strings, undefined)
    - Call `generateComponent()`, assert constructor contains `__signal(<default>)` for each prop
    - Minimum 100 iterations
    - Tag: `Feature: define-props, Property 4: Codegen Prop Signal Initialization`
    - **Validates: Requirements 5.2**

  - [ ]* 9.4 Write property test for props access transformation (Property 5)
    - **Property 5: Props Access Transformation Correctness**
    - Use fast-check to generate method bodies containing `props.propName` references (where propName is from a generated set of prop names)
    - Call the transformation function, assert every `props.propName` is replaced with `this._s_propName()` and non-prop references are unchanged
    - Minimum 100 iterations
    - Tag: `Feature: define-props, Property 5: Props Access Transformation Correctness`
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 10. Write integration test
  - [ ]* 10.1 Write end-to-end compiler test with defineProps (`v2/lib/compiler.defineProps.test.js`)
    - Create a temp component source with `defineProps<{ label: string, count: number }>({ label: 'Hello', count: 0 })`
    - Create a template with `{{label}}` and `{{count}}`
    - Compile and verify output contains: observedAttributes, attributeChangedCallback, prop signals, getters/setters, binding effects
    - Test that `props.label` in a method body is transformed to `this._s_label()`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 7.2, 8.1, 8.2, 8.3_

- [x] 11. Write round-trip property test
  - [ ]* 11.1 Write property test for props parser round-trip (Property 1)
    - **Property 1: Props Parser Round-Trip**
    - Use fast-check to generate valid component sources with defineProps (random prop names, random defaults)
    - Parse → prettyPrint → parse again → assert equivalent propDefs and propsObjectName
    - Minimum 100 iterations
    - Tag: `Feature: define-props, Property 1: Props Parser Round-Trip`
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3**

- [x] 12. Final checkpoint — Ensure all tests pass
  - Run `yarn test` from `v2/` and verify all tests pass. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- This feature depends on the core spec being fully implemented
- The `_s_` prefix for prop signals distinguishes them from user signals (`_`) and computeds (`_c_`)
- camelCase → kebab-case conversion follows standard Web Component attribute conventions
- Type coercion is intentionally simple (Number, boolean presence, string) — complex types are not supported via attributes
- The propsObjectName exclusion from transforms is critical to avoid `props` being treated as a signal named `props`
- v1 reference: `lib/parser.js` already has `extractProps`, `extractPropsFromGeneric`, `extractPropsObjectName` — these patterns are adapted for v2's file-based architecture

