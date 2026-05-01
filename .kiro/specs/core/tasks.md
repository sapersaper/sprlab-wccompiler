# Implementation Plan: wcCompiler v2 Core

## Overview

This plan implements the complete core compilation pipeline for wcCompiler v2. The architecture shifts from `.html` entry points (v1) to `.ts`/`.js` entry points, with a signals-based API (`signal`, `computed`, `effect`, `defineComponent`). Several modules are reused from v1 (reactive-runtime, css-scoper, config, dev-server), while parser, codegen, compiler, and printer are partially or fully rewritten.

All code is JavaScript (ESM), tests use vitest + fast-check, and the project uses Yarn 4 with PnP. Files go in `v2/lib/`, `v2/bin/`, and `v2/types/`.

## Tasks

- [x] 1. Set up project structure, types, and reusable modules
  - [x] 1.1 Create `v2/lib/types.js` with JSDoc typedefs for ParseResult, ReactiveVar, ComputedDef, EffectDef, MethodDef, Binding, EventBinding
    - Define all typedefs as documented in the design: `ParseResult`, `ReactiveVar`, `ComputedDef`, `EffectDef`, `MethodDef`, `Binding`, `EventBinding`
    - `ParseResult` fields: `tagName`, `className`, `template`, `style`, `signals`, `computeds`, `effects`, `methods`, `bindings`, `events`, `processedTemplate`
    - Export typedefs via `@typedef` JSDoc comments (no runtime code, types-only file)
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2_

  - [x] 1.2 Create `v2/lib/reactive-runtime.js` — copy from `lib/reactive-runtime.js` (v1)
    - Copy the file as-is: it exports `reactiveRuntime` as a string literal containing `__signal`, `__computed`, `__effect`
    - Verify the exported string contains all three functions and the `__currentEffect` global
    - _Requirements: 3.1, 3.2, 3.3, 3.7_

  - [x] 1.3 Create `v2/lib/css-scoper.js` — copy from `lib/css-scoper.js` (v1)
    - Copy the file as-is: it exports `scopeCSS(css, tagName)`
    - No modifications needed
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 2. Implement the Parser (`v2/lib/parser.js`)
  - [x] 2.1 Implement core parser with `defineComponent` extraction, signal/computed/effect/function extraction, macro import stripping, and TS type stripping
    - Export `async function parse(filePath): Promise<ParseResult>`
    - Read the source file from disk using `fs.readFileSync(filePath, 'utf-8')`
    - Implement `stripMacroImport(source)`: remove `import { ... } from 'wcc'` via regex `/import\s*\{[^}]*\}\s*from\s*['"]wcc['"]\s*;?/g`
    - Implement `stripTypes(tsCode)`: if file extension is `.ts`, call `esbuild.transform(code, { loader: 'ts', target: 'esnext' })` to strip type annotations
    - Implement `extractDefineComponent(source)`: extract `defineComponent({ tag, template, styles })` via regex `/defineComponent\(\s*\{([^}]*)\}\s*\)/`, then extract `tag`, `template`, `styles` from the object literal
    - Resolve `template` and `styles` paths relative to the source file directory using `path.resolve(path.dirname(filePath), templatePath)`, read file contents
    - Implement `extractSignals(source)`: extract `const x = signal(value)` using regex `/(?:const|let|var)\s+([$\w]+)\s*=\s*signal\(/` with parenthesis depth counting for the value argument (same pattern as v1's `extractRefArgument`)
    - Implement `extractComputeds(source)`: extract `const x = computed(() => expr)` using regex `/(?:const|let|var)\s+(\w+)\s*=\s*computed\(\s*\(\)\s*=>\s*([\s\S]*?)\)/g`
    - Implement `extractEffects(source)`: extract `effect(() => { body })` using brace depth tracking (same pattern as v1's lifecycle hook extraction)
    - Implement `extractFunctions(source)`: extract `function name(params) { body }` using brace depth tracking
    - Implement `toClassName(tagName)`: convert kebab-case to PascalCase (e.g., `wcc-counter` → `WccCounter`)
    - Throw error with code `MISSING_DEFINE_COMPONENT` if `defineComponent()` is not found
    - Throw error with code `TEMPLATE_NOT_FOUND` if template file doesn't exist
    - Throw error with code `STYLES_NOT_FOUND` if styles file doesn't exist (only when styles path is specified)
    - Return a `ParseResult` with `bindings: []`, `events: []`, `processedTemplate: null` (populated later by tree-walker)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12_

  - [x]* 2.2 Write unit tests for parser error cases and TS stripping (`v2/lib/parser.test.js`)
    - Test `MISSING_DEFINE_COMPONENT` error when source has no `defineComponent()`
    - Test `TEMPLATE_NOT_FOUND` error when template path doesn't resolve
    - Test `STYLES_NOT_FOUND` error when styles path doesn't resolve
    - Test that `import { signal, computed } from 'wcc'` is stripped
    - Test that TypeScript type annotations are stripped for `.ts` files (e.g., `const x: number = signal<number>(0)` → extracts signal correctly)
    - Test that `styles` is optional in `defineComponent()` (no error when omitted, `style` is empty string)
    - _Requirements: 1.8, 1.9, 1.10, 1.11, 1.12_

  - [x]* 2.3 Write property test for parser round-trip (Property 1)
    - **Property 1: Parser Round-Trip**
    - Use fast-check to generate arbitrary valid component sources with random tag names, signal names/values, computed names/bodies, effect bodies, and function names/params/bodies
    - For each generated source: write temp files (source + template + optional styles), call `parse()`, call `prettyPrint()` on the result, write the printed source to a new temp file, call `parse()` again, and assert the two ParseResult IRs are equivalent (same tagName, className, signals, computeds, effects, methods)
    - Minimum 100 iterations
    - Tag: `Feature: core, Property 1: Parser Round-Trip`
    - **Validates: Requirements 1.1, 1.4, 1.5, 1.6, 1.7, 11.1, 11.2**

- [x] 3. Implement the Tree Walker (`v2/lib/tree-walker.js`)
  - [x] 3.1 Implement tree walker with interpolation and event binding discovery
    - Export `function walkTree(rootEl, signalNames, computedNames): { bindings: Binding[], events: EventBinding[] }`
    - Accept a jsdom DOM element as `rootEl`, plus `Set<string>` for signal and computed names
    - Recursively walk the DOM tree, building path arrays of `childNodes[n]` segments
    - For element nodes: scan attributes for `@event="handler"` patterns, record `EventBinding` with event name, handler name, and DOM path, then remove the `@event` attribute
    - For text nodes matching `/\{\{[\w.]+\}\}/`: 
      - If `{{name}}` is sole content of parent and parent has only one child → bind to parent element (path excludes text node), clear text content
      - If mixed text/interpolations → split text node into `<span>` elements per binding, record each with its own path
    - Determine binding type: if name is in `signalNames` → `'signal'`, if in `computedNames` → `'computed'`, otherwise → `'method'`
    - This is a simplified version of v1's tree-walker, scoped to only `{{interpolation}}` and `@event` (no directives, no slots, no refs)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x]* 3.2 Write property test for interpolation discovery completeness (Property 2)
    - **Property 2: Interpolation Discovery Completeness**
    - Use fast-check to generate HTML templates with `{{varName}}` at various positions: sole content of elements, mixed with text, multiple per text node
    - Parse each template with jsdom, call `walkTree()`, assert every `{{varName}}` in the input is discovered with correct variable name, valid DOM path, and correct binding type
    - Minimum 100 iterations
    - Tag: `Feature: core, Property 2: Interpolation Discovery Completeness`
    - **Validates: Requirements 2.1, 2.3, 2.4**

  - [x]* 3.3 Write property test for event discovery and cleanup (Property 3)
    - **Property 3: Event Discovery and Cleanup**
    - Use fast-check to generate HTML templates with `@event="handler"` attributes on various elements
    - Call `walkTree()`, assert every `@event` is discovered with correct event name and handler, AND the processed DOM contains zero `@event` attributes
    - Minimum 100 iterations
    - Tag: `Feature: core, Property 3: Event Discovery and Cleanup`
    - **Validates: Requirements 2.2, 2.5**

  - [x]* 3.4 Write unit test for undeclared binding warning
    - Test that when `{{unknownVar}}` references a name not in signalNames or computedNames, the binding type is `'method'` (the compiler layer will handle the warning)
    - _Requirements: 2.6_

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement the Code Generator (`v2/lib/codegen.js`)
  - [x] 5.1 Implement code generator with signal/computed/effect transforms and output structure
    - Export `function generateComponent(parseResult): string`
    - Import `reactiveRuntime` from `./reactive-runtime.js` and `scopeCSS` from `./css-scoper.js`
    - Generate output in this order:
      1. Inline reactive runtime (trimmed string from `reactiveRuntime`)
      2. Scoped CSS injection: `const __css_ClassName = document.createElement('style'); __css_ClassName.textContent = \`scopedCSS\`; document.head.appendChild(...)` (only if styles provided)
      3. Template element: `const __t_ClassName = document.createElement('template'); __t_ClassName.innerHTML = \`processedTemplate\``
      4. HTMLElement class with constructor, connectedCallback, and methods
      5. `customElements.define(tagName, ClassName)` registration
    - **Constructor**: clone template, assign DOM refs for bindings/events using path expressions, initialize signals with `this._x = __signal(value)`, initialize computeds with `this._c_x = __computed(() => transformedExpr)`, append DOM
    - **connectedCallback**: generate `__effect` calls for each interpolation binding (`this.__b0.textContent = this._x() ?? ''`), generate `__effect` calls for each user effect (with transformed body), generate `addEventListener` calls for each event binding
    - **Methods**: transform user functions into class methods prefixed with `_` (e.g., `function increment(...)` → `_increment(...)`), applying expression transforms to the body
    - Implement `transformExpr(expr, signalNames, computedNames)`: rewrite variable references using word-boundary regex `/\b(varName)\b/g` — signals `x` → `this._x()`, computeds `x` → `this._c_x()`
    - Implement `transformMethodBody(body, signalNames, computedNames)`: rewrite `x.set(value)` → `this._x(value)`, `x()` → `this._x()`, computed `x()` → `this._c_x()`
    - Implement `pathExpr(parts, rootVar)`: convert path array to JS expression (e.g., `['childNodes[0]', 'childNodes[1]']` → `__root.childNodes[0].childNodes[1]`)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [x]* 5.2 Write property test for codegen structural completeness (Property 10)
    - **Property 10: Codegen Structural Completeness**
    - Use fast-check to generate valid ParseResult IRs with random tag names, class names, templates, optional styles, signals, computeds, effects, bindings, events
    - Call `generateComponent()`, assert the output contains: the reactive runtime text, `class ClassName extends HTMLElement`, `connectedCallback()`, `customElements.define('tagName', ClassName)`. When styles are provided, assert output contains `document.createElement('style')` and `document.head.appendChild`
    - Minimum 100 iterations
    - Tag: `Feature: core, Property 10: Codegen Structural Completeness`
    - **Validates: Requirements 5.1, 5.7, 5.8, 5.9**

  - [x]* 5.3 Write property test for codegen signal/computed initialization (Property 11)
    - **Property 11: Codegen Signal/Computed Initialization**
    - Use fast-check to generate ParseResult IRs with varying numbers of signals and computeds
    - Call `generateComponent()`, assert the constructor contains a `__signal(initialValue)` call for each signal and a `__computed(` call for each computed
    - Minimum 100 iterations
    - Tag: `Feature: core, Property 11: Codegen Signal/Computed Initialization`
    - **Validates: Requirements 5.2, 5.3**

  - [x]* 5.4 Write property test for codegen connectedCallback setup (Property 12)
    - **Property 12: Codegen ConnectedCallback Setup**
    - Use fast-check to generate ParseResult IRs with effects, bindings, and events
    - Call `generateComponent()`, assert the `connectedCallback` contains `__effect` calls for each user effect and each binding, and `addEventListener` calls for each event binding
    - Minimum 100 iterations
    - Tag: `Feature: core, Property 12: Codegen ConnectedCallback Setup`
    - **Validates: Requirements 5.4, 5.5, 5.6**

- [x] 6. Implement the Compiler pipeline (`v2/lib/compiler.js`)
  - [x] 6.1 Implement compiler orchestration: parse → walk → scope → generate
    - Export `async function compile(filePath, config?): Promise<string>`
    - Import `parse` from `./parser.js`, `walkTree` from `./tree-walker.js`, `generateComponent` from `./codegen.js`
    - Pipeline steps:
      1. Call `parse(filePath)` → get ParseResult with template, styles, signals, computeds, effects, methods
      2. Parse template HTML into jsdom DOM: `new JSDOM(\`<div id="__root">\${template}</div>\`)`, get root element
      3. Build name sets: `signalNames = new Set(signals.map(s => s.name))`, `computedNames = new Set(computeds.map(c => c.name))`
      4. Call `walkTree(rootEl, signalNames, computedNames)` → get bindings, events
      5. Merge tree-walker results into ParseResult: `parseResult.bindings = bindings`, `parseResult.events = events`, `parseResult.processedTemplate = rootEl.innerHTML`
      6. Call `generateComponent(parseResult)` → return the output JavaScript string (codegen internally calls `scopeCSS` and inlines `reactiveRuntime`)
    - Propagate errors from any step with original error code intact
    - _Requirements: 10.1, 10.2, 10.3_

  - [x]* 6.2 Write unit tests for compiler pipeline integration (`v2/lib/compiler.test.js`)
    - Test successful compilation of a minimal component (signal + interpolation + event)
    - Test that the output contains the reactive runtime, class definition, and customElements.define
    - Test error propagation: `MISSING_DEFINE_COMPONENT`, `TEMPLATE_NOT_FOUND`
    - Use temp files for test fixtures
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement the Pretty Printer (`v2/lib/printer.js`)
  - [x] 8.1 Implement pretty-printer for round-trip testing
    - Export `function prettyPrint(ir): string`
    - Accept a `ParseResult` IR and serialize it back to valid `.js` source format
    - Output format:
      1. `import { defineComponent, signal, computed, effect } from 'wcc'` (include only the macros actually used)
      2. Blank line
      3. `export default defineComponent({ tag: '...', template: '...', styles: '...' })` (omit `styles` if empty)
      4. Blank line
      5. Signal declarations: `const name = signal(value)` for each signal
      6. Computed declarations: `const name = computed(() => body)` for each computed
      7. Blank line
      8. Effect declarations: `effect(() => { body })` for each effect
      9. Blank line
      10. Function declarations: `function name(params) { body }` for each method
    - The printer does NOT need to preserve original formatting — it produces a canonical form
    - _Requirements: 11.1, 11.2_

- [x] 9. Implement reactive runtime property tests (`v2/lib/reactive-runtime.test.js`)
  - [x]* 9.1 Write property test for signal read/write consistency (Property 4)
    - **Property 4: Signal Read/Write Consistency**
    - Evaluate the `reactiveRuntime` string in a test context (via `new Function()` or `eval`) to get `__signal`, `__computed`, `__effect`
    - Use fast-check to generate arbitrary initial values and sequences of distinct new values
    - For each: create a signal, verify initial read, then for each new value call set and verify read returns new value, and verify subscribed effects were notified exactly once per change
    - Minimum 100 iterations
    - Tag: `Feature: core, Property 4: Signal Read/Write Consistency`
    - **Validates: Requirements 3.1, 3.4, 3.5**

  - [x]* 9.2 Write property test for computed derived value correctness (Property 5)
    - **Property 5: Computed Derived Value Correctness**
    - Use fast-check to generate initial values and pure transformation functions (e.g., `x => x * 2`, `x => x + 1`)
    - Create a signal, create a computed wrapping the transform, verify initial derived value, change signal, verify updated derived value
    - Minimum 100 iterations
    - Tag: `Feature: core, Property 5: Computed Derived Value Correctness`
    - **Validates: Requirements 3.2, 3.4**

  - [x]* 9.3 Write property test for effect execution on dependency change (Property 6)
    - **Property 6: Effect Execution on Dependency Change**
    - Use fast-check to generate initial values and sequences of distinct new values
    - Create a signal, create an effect that reads it and records execution count, verify immediate execution, then for each new value verify re-execution exactly once
    - Minimum 100 iterations
    - Tag: `Feature: core, Property 6: Effect Execution on Dependency Change`
    - **Validates: Requirements 3.3, 3.4, 3.5**

  - [x]* 9.4 Write property test for signal same-value notification skip (Property 7)
    - **Property 7: Signal Same-Value Notification Skip**
    - Use fast-check to generate arbitrary values
    - Create a signal, create an effect, set signal to same value multiple times, verify effect does NOT re-execute
    - Minimum 100 iterations
    - Tag: `Feature: core, Property 7: Signal Same-Value Notification Skip`
    - **Validates: Requirements 3.6**

- [x] 10. Implement CSS scoper property tests (`v2/lib/css-scoper.test.js`)
  - [x]* 10.1 Write property test for CSS selector prefixing (Property 8)
    - **Property 8: CSS Selector Prefixing**
    - Use fast-check to generate non-empty CSS strings with simple selectors (`.class`, `#id`, `element`) and comma-separated selectors, plus valid tag names
    - Call `scopeCSS()`, assert every selector in the output is prefixed with the tag name
    - Minimum 100 iterations
    - Tag: `Feature: core, Property 8: CSS Selector Prefixing`
    - **Validates: Requirements 4.1, 4.2**

  - [x]* 10.2 Write property test for CSS @media recursive scoping (Property 9)
    - **Property 9: CSS @media Recursive Scoping**
    - Use fast-check to generate CSS strings with `@media` blocks containing nested selectors
    - Call `scopeCSS()`, assert selectors inside `@media` are prefixed while the `@media` rule itself is preserved
    - Minimum 100 iterations
    - Tag: `Feature: core, Property 9: CSS @media Recursive Scoping`
    - **Validates: Requirements 4.3**

  - [x]* 10.3 Write unit tests for CSS scoper edge cases
    - Test `@keyframes` preservation (keyframe stops not prefixed)
    - Test statement at-rules (`@import`, `@charset`) preserved without modification
    - Test empty/whitespace-only input returns empty string
    - _Requirements: 4.4, 4.5, 4.6_

- [x] 11. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement Config, Dev Server, CLI, and Type Declarations
  - [x] 12.1 Create `v2/lib/config.js` — adapt from `lib/config.js` (v1)
    - Copy from v1 and adjust: the module is identical in behavior
    - Export `async function loadConfig(projectRoot): Promise<WccConfig>`
    - Default values: `port: 4100`, `input: 'src'`, `output: 'dist'`
    - Validate `port` (finite number), `input` (non-empty string), `output` (non-empty string)
    - Throw descriptive error on invalid values
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 12.2 Create `v2/lib/dev-server.js` — copy from `lib/dev-server.js` (v1)
    - Copy the file as-is: it exports `startDevServer({ port, root, outputDir })`
    - Serves static files with correct MIME types, injects polling-based live-reload script into HTML, provides `/__poll` endpoint, returns 404 for missing files
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 12.3 Create `v2/bin/wcc.js` — CLI entry point
    - Add `#!/usr/bin/env node` shebang
    - Parse `process.argv` for `build` or `dev` subcommand
    - **`wcc build`**:
      1. Call `loadConfig(process.cwd())`
      2. Glob `input/**/*.{ts,js}` excluding `*.test.*` and `*.d.ts` (use `fs.readdirSync` with recursive option or a simple glob)
      3. For each file: call `compile(filePath)`, write output to `output/` directory with `.js` extension
      4. On error: print to stderr, exit with code 1
    - **`wcc dev`**:
      1. Load config, perform initial build (errors print to stderr but don't exit)
      2. Start dev server via `startDevServer({ port, root: process.cwd(), outputDir })`
      3. Watch `input/` directory for changes using `fs.watch({ recursive: true })`
      4. On change: recompile changed file, errors print to stderr but continue watching
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 12.4 Create `v2/types/wcc.d.ts` — TypeScript type declarations
    - Declare module `'wcc'` with:
      - `interface Signal<T> { (): T; set(value: T): void; }`
      - `function signal<T>(value: T): Signal<T>`
      - `function computed<T>(fn: () => T): () => T`
      - `function effect(fn: () => void): void`
      - `function defineComponent(options: { tag: string; template: string; styles?: string }): void`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x]* 12.5 Write unit tests for config loader (`v2/lib/config.test.js`)
    - Test loading a valid `wcc.config.js` with custom port, input, output
    - Test defaults when `wcc.config.js` doesn't exist
    - Test validation errors for invalid port (non-number), invalid input (empty string), invalid output (empty string)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x]* 12.6 Write unit tests for dev server (`v2/lib/dev-server.test.js`)
    - Test that HTML responses include the polling script
    - Test that `/__poll` endpoint returns JSON with timestamp
    - Test that missing files return 404
    - Test correct MIME types for `.js`, `.css`, `.html`
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

  - [x]* 12.7 Write unit tests for CLI (`v2/bin/wcc.test.js`)
    - Test `wcc build` discovers `.ts` and `.js` files, excludes `*.test.*` and `*.d.ts`
    - Test `wcc build` writes compiled output to the configured output directory
    - Test `wcc build` exits with non-zero code on compilation error
    - Test `wcc dev` continues watching after compilation error
    - _Requirements: 6.1, 6.2, 6.5, 6.6_

  - [x]* 12.8 Write smoke test for type declarations (`v2/types/wcc.test.js`)
    - Verify `v2/types/wcc.d.ts` file exists
    - Verify it contains `signal`, `computed`, `effect`, `defineComponent` declarations
    - Verify `Signal<T>` interface has `(): T` and `set(value: T): void`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples, edge cases, and error paths
- v1 files to reuse: `lib/reactive-runtime.js`, `lib/css-scoper.js`, `lib/config.js`, `lib/dev-server.js`
- v1 files for reference (partial rewrite): `lib/parser.js`, `lib/codegen.js`, `lib/compiler.js`, `lib/printer.js`
- All tests go in `v2/lib/*.test.js` or `v2/bin/*.test.js`, run with `yarn test` from `v2/`

## Changelog

### 2026-04-30: ConstantVar support

Added detection and code generation for plain `const` declarations (non-reactive). When the parser encounters `const TAX_RATE = 0.21` at root level (not a `signal()`, `computed()`, `effect()`, or other macro call), it records a `ConstantVar { name, value }`. The codegen generates `this._const_TAX_RATE = 0.21` in the constructor, and `transformExpr`/`transformMethodBody` rewrite references to `this._const_TAX_RATE` (no function call, since constants are not reactive).

Files modified:
- `v2/lib/types.js` — Added `ConstantVar` typedef, added `constantVars: ConstantVar[]` to `ParseResult`
- `v2/lib/parser.js` — Added `extractConstants()` function with `REACTIVE_CALLS` exclusion pattern, integrated into `parse()`
- `v2/lib/codegen.js` — Added `constantNames` array, constant initialization in constructor, constant transform in `transformExpr` and `transformMethodBody` (new `constantNames` parameter with `[]` default)

### 2026-04-30: WCC Runtime auto-copy in CLI

The CLI now copies `v2/lib/wcc-runtime.js` to the output directory during `wcc build`, matching v1 behavior. This provides the optional `init()`, `on()`, `set()`, `get()` runtime utilities for host-page state management.

Files modified:
- `v2/lib/wcc-runtime.js` — Created (copied from `lib/wcc-runtime.js`)
- `v2/bin/wcc.js` — Added `copyFileSync` import and runtime copy after compilation

### 2026-04-30: Type declarations — added missing macros

Added `defineProps`, `defineEmits`, `templateRef`, `onMount`, and `onDestroy` to `v2/types/wcc.d.ts`. Previously only `signal`, `computed`, `effect`, and `defineComponent` were declared, causing TypeScript errors in components using props, emits, refs, or lifecycle hooks.

`defineEmits<T>()` uses an unconstrained generic `T` to support Vue-style call signature types like `{ (e: 'update', value: number): void }`.

Files modified:
- `v2/types/wcc.d.ts` — Added `defineProps` (generic + array overloads), `defineEmits` (generic + array overloads), `templateRef`, `onMount`, `onDestroy`

### 2026-04-30: `templateBindings()` macro

Added `templateBindings()` — a compile-time macro that declares which variables and functions are used in the template. This eliminates TypeScript `'x' is declared but its value is never read` warnings for template-only bindings.

```js
templateBindings({ count, doubled, handleUpdate })
```

The call is stripped at compile time (same as `import { ... } from 'wcc'`). It has no runtime effect — it's purely for TypeScript DX.

Files modified:
- `types/wcc.d.ts` — Added `templateBindings()` declaration
- `lib/parser.js` — Added `templateBindings` to `REACTIVE_CALLS` exclusion pattern
- `example/src/wcc-typescript.ts` — Added `templateBindings()` usage

### 2026-05-01: `watch()` — observe changes with old/new value

Added `watch('target', (newVal, oldVal) => { ... })` for observing specific signal/prop/computed changes with access to both old and new values. Unlike `effect()` which re-runs on any dependency change without old value access, `watch()` targets a specific variable and skips the initial run (only fires on subsequent changes).

The codegen generates a `__prev_target` variable in the constructor and an `__effect` in connectedCallback that compares against the previous value.

Files modified:
- `lib/types.js` — Added `WatcherDef` typedef, added `watchers: WatcherDef[]` to ParseResult
- `lib/parser.js` — Added `extractWatchers()`, added `watch` to `REACTIVE_CALLS` and hook stripping pattern
- `lib/codegen.js` — Added `__prev_target` init in constructor, watcher effects in connectedCallback
- `types/wcc.d.ts` — Added `watch<T>()` declaration
- `FEATURES.md` — Added watch to Script API table
- `README.md` — Added Watch section with example
