# Implementation Plan: wcCompiler v2 — lifecycle-hooks

## Overview

This plan implements `onMount` / `onDestroy` lifecycle hooks for wcCompiler v2. It extends the parser with hook extraction using brace-depth tracking, extends the code generator with `connectedCallback` (end) and `disconnectedCallback` placement, and updates the pretty-printer for round-trip testing. The implementation reuses v1 patterns from `lib/parser.js` (renamed from `onMounted`/`onUnmounted`) and `lib/codegen.js`.

All code extends existing modules in `v2/lib/`. Tests use vitest + fast-check. This feature depends on the core spec being implemented first.

## Tasks

- [ ] 1. Extend ParseResult types for lifecycle hooks
  - [ ] 1.1 Add `LifecycleHook` typedef in `v2/lib/types.js`
    - Add `@typedef {Object} LifecycleHook` with field: `body` (string — the callback body JavaScript code)
    - Add `onMountHooks: LifecycleHook[]` field to `ParseResult` typedef
    - Add `onDestroyHooks: LifecycleHook[]` field to `ParseResult` typedef
    - _Requirements: 1.4, 2.4_

- [ ] 2. Implement parser extensions for lifecycle hooks
  - [ ] 2.1 Implement `extractLifecycleHooks` in `v2/lib/parser.js`
    - Export `function extractLifecycleHooks(script): { onMountHooks: LifecycleHook[], onDestroyHooks: LifecycleHook[] }`
    - Detect `onMount(() => {` and `onDestroy(() => {` patterns using regex: `/\bonMount\s*\(\s*\(\s*\)\s*=>\s*\{/` and `/\bonDestroy\s*\(\s*\(\s*\)\s*=>\s*\{/`
    - Only extract at top-level (brace depth === 0 when the call is encountered)
    - Use brace-depth tracking to capture multi-line bodies with nested braces
    - Dedent extracted body lines by removing common leading whitespace
    - Support multiple calls of each type, preserving source order
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [ ] 2.2 Update `extractRootVars` to skip lifecycle hook lines
    - Add `/onMount\s*\(/.test(line)` and `/onDestroy\s*\(/.test(line)` to the skip conditions
    - Prevents lifecycle hook calls from being misidentified as variable declarations
    - _Requirements: 7.2_

  - [ ] 2.3 Integrate `extractLifecycleHooks` into the main `parse()` function
    - Call `extractLifecycleHooks(trimmedScript)` after type stripping
    - Assign results to `onMountHooks` and `onDestroyHooks` fields of the returned ParseResult
    - _Requirements: 1.4, 2.4_

- [ ] 3. Extend the Code Generator for lifecycle hooks
  - [ ] 3.1 Generate mount hook bodies at end of `connectedCallback` in `v2/lib/codegen.js`
    - After all effects, event listeners, if-effects, and for-effects, emit transformed mount hook bodies
    - For each hook in `onMountHooks` array (in order): call `transformMethodBody(hook.body, ...)` and emit the result
    - Placement MUST be at the very end of `connectedCallback`, after all other setup code
    - _Requirements: 4.1, 4.2, 4.3, 6.1, 6.2, 6.3_

  - [ ] 3.2 Generate `disconnectedCallback` with destroy hook bodies in `v2/lib/codegen.js`
    - Only generate `disconnectedCallback` when `onDestroyHooks.length > 0`
    - For each hook in `onDestroyHooks` array (in order): call `transformMethodBody(hook.body, ...)` and emit the result
    - Place `disconnectedCallback` after `connectedCallback` and `attributeChangedCallback`
    - When no destroy hooks exist, omit the method entirely
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3_

- [ ] 4. Extend the Pretty Printer for lifecycle hooks
  - [ ] 4.1 Add lifecycle hook serialization in `v2/lib/printer.js`
    - For each hook in `onMountHooks`: emit `onMount(() => {\n  ${body}\n})\n`
    - For each hook in `onDestroyHooks`: emit `onDestroy(() => {\n  ${body}\n})\n`
    - Emit hooks after effects section, before end of file
    - Indent body lines by 2 spaces
    - _Requirements: 8.1, 8.2_

- [ ] 5. Checkpoint — Ensure all implementation compiles
  - Run `yarn test` from `v2/` to verify no regressions in core tests and new code compiles. Ask the user if questions arise.

- [ ] 6. Write tests for parser lifecycle hook extraction
  - [ ]* 6.1 Write property test for hook extraction completeness (Property 1)
    - **Property 1: Lifecycle Hook Extraction Completeness**
    - Use fast-check to generate component sources with varying numbers of `onMount` and `onDestroy` calls (0–5 each) with random body content (valid JS statements without unbalanced braces)
    - Call `extractLifecycleHooks()`, assert correct count and body content for each hook type, verify source order preservation
    - Minimum 100 iterations
    - Tag: `Feature: lifecycle-hooks, Property 1: Lifecycle Hook Extraction Completeness`
    - **Validates: Requirements 1.1, 1.2, 1.4, 2.1, 2.2, 2.4**

  - [ ]* 6.2 Write property test for brace-depth body capture (Property 2)
    - **Property 2: Brace-Depth Body Capture**
    - Use fast-check to generate callback bodies with nested braces at various depths (if/else, object literals, nested functions, template literals with `${}`)
    - Wrap each body in `onMount(() => { body })`, call `extractLifecycleHooks()`, assert extracted body matches original (after dedent)
    - Minimum 100 iterations
    - Tag: `Feature: lifecycle-hooks, Property 2: Brace-Depth Body Capture`
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ]* 6.3 Write property test for pretty-printer round-trip (Property 6)
    - **Property 6: Pretty-Printer Round-Trip**
    - Use fast-check to generate ParseResult IRs with lifecycle hooks (varying body content)
    - Call `prettyPrint(ir)` then `parse(printed)`, assert `onMountHooks` and `onDestroyHooks` are equivalent
    - Minimum 100 iterations
    - Tag: `Feature: lifecycle-hooks, Property 6: Pretty-Printer Round-Trip`
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [ ]* 6.4 Write unit tests for parser edge cases
    - Test that hooks inside nested functions are ignored (Req 1.3, 2.3)
    - Test empty hook body: `onMount(() => {})` → body is empty string
    - Test single-line hook body: `onMount(() => { console.log('hi') })`
    - Test hook with object literal in body (nested braces)
    - Test that `extractRootVars` skips lines with `onMount(`/`onDestroy(`
    - _Requirements: 1.3, 2.3, 3.1, 7.2_

- [ ] 7. Write tests for code generation
  - [ ]* 7.1 Write property test for codegen mount placement (Property 3)
    - **Property 3: Codegen Mount Placement**
    - Use fast-check to generate ParseResult IRs with effects, event bindings, and onMountHooks
    - Call `generateComponent()`, assert mount hook bodies appear AFTER all `__effect` and `addEventListener` calls in `connectedCallback`
    - Minimum 100 iterations
    - Tag: `Feature: lifecycle-hooks, Property 3: Codegen Mount Placement`
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [ ]* 7.2 Write property test for codegen destroy placement (Property 4)
    - **Property 4: Codegen Destroy Placement**
    - Use fast-check to generate ParseResult IRs with and without onDestroyHooks
    - Call `generateComponent()`, assert `disconnectedCallback` is present only when hooks exist, and contains transformed bodies in order
    - Minimum 100 iterations
    - Tag: `Feature: lifecycle-hooks, Property 4: Codegen Destroy Placement`
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

  - [ ]* 7.3 Write property test for signal/computed transformation in hooks (Property 5)
    - **Property 5: Signal/Computed Transformation in Hook Bodies**
    - Use fast-check to generate hook bodies referencing signal names, computed names, and prop references
    - Call `generateComponent()`, assert output contains `this._x()` for signal reads, `this._x(v)` for signal writes, `this._c_x()` for computed reads, `this._s_name()` for prop reads
    - Minimum 100 iterations
    - Tag: `Feature: lifecycle-hooks, Property 5: Signal/Computed Transformation in Hook Bodies`
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [ ]* 7.4 Write unit tests for codegen edge cases
    - Test no `disconnectedCallback` when `onDestroyHooks` is empty (Req 5.4)
    - Test mount hooks appear after if-effects and for-effects
    - Test multiple mount hooks emitted in order
    - Test multiple destroy hooks emitted in order
    - _Requirements: 4.2, 5.2, 5.4_

- [ ] 8. Write integration test
  - [ ]* 8.1 Write end-to-end compiler test with lifecycle hooks (`v2/lib/compiler.lifecycle.test.js`)
    - Create a temp component with `onMount` and `onDestroy` hooks using signal references
    - Include an interval setup in `onMount` and `clearInterval` in `onDestroy`
    - Compile and verify output contains: transformed mount body at end of `connectedCallback`, `disconnectedCallback` with transformed destroy body
    - Test that signal names in hook bodies are transformed to `this._name()`
    - _Requirements: 4.1, 4.3, 5.1, 5.3, 6.1, 6.2_

- [ ] 9. Final checkpoint — Ensure all tests pass
  - Run `yarn test` from `v2/` and verify all tests pass. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- This feature depends on the core spec being fully implemented
- v1 reference files: `lib/parser.js` (extractLifecycleHooks), `lib/codegen.js` (mountedHooks/unmountedHooks sections)
- The v2 API renames `onMounted`→`onMount` and `onUnmounted`→`onDestroy` for brevity
- Hook bodies use the same `transformMethodBody` as user methods — no new transformation logic needed
- The parser uses the same brace-depth tracking pattern as `effect()` extraction
- No tree walker changes are needed — this is a purely script-level feature
- `disconnectedCallback` is only generated when destroy hooks exist, matching the v1 pattern

## Changelog

### 2026-05-01: Async onMount/onDestroy support

Added support for `async` callbacks in `onMount` and `onDestroy`. The parser now matches `onMount(async () => { ... })` in addition to the sync form. The codegen wraps async hooks in an IIFE: `(async () => { body })()` to avoid making `connectedCallback`/`disconnectedCallback` themselves async.

```js
onMount(async () => {
  const data = await fetch('/api/items').then(r => r.json())
  items.set(data)
})
```

Files modified:
- `lib/types.js` — Added `async: boolean` to `LifecycleHook` typedef
- `lib/parser.js` — Updated regex to match `async () =>` pattern, stores `async` flag
- `lib/codegen.js` — Wraps async hooks in `(async () => { ... })()` IIFE
- `types/wcc.d.ts` — Updated `onMount`/`onDestroy` signatures to accept `() => void | Promise<void>`
