# Implementation Plan: wcCompiler v2 — Scoped Slots (Light DOM)

## Overview

This plan reimplements `<slot>` content distribution for wcCompiler v2 using **scoped slots in light DOM** — the same approach as v1. It replaces the previous Shadow DOM native slot implementation with a compiler-driven slot resolution system: the tree walker replaces `<slot>` elements with `<span data-slot="...">` placeholders, and the code generator produces runtime slot resolution code that reads consumer `childNodes`, builds a slot map, and injects content into placeholders. Scoped slots use reactive effects to resolve `{{propName}}` interpolations.

All code modifies existing modules in `v2/lib/`. Tests use vitest + fast-check.

## Tasks

- [x] 1. Update types for scoped slots
  - [x] 1.1 Replace `SlotInfo` with `SlotProp` and `SlotBinding` in `v2/lib/types.js`
    - Add `@typedef {Object} SlotProp` with fields: `prop` (string), `source` (string)
    - Add `@typedef {Object} SlotBinding` with fields: `varName` (string), `name` (string), `path` (string[]), `defaultContent` (string), `slotProps` (SlotProp[])
    - Remove `SlotInfo` typedef
    - Replace `slotInfo: SlotInfo` with `slots: SlotBinding[]` in ParseResult typedef
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 2. Update tree walker for slot replacement
  - [x] 2.1 Add slot processing to `walkTree()` in `v2/lib/tree-walker.js`
    - Add `slots` array and `slotIdx` counter to walkTree
    - In the `walk()` function, when `el.tagName === 'SLOT'`:
      - Read `name` attribute (empty string if absent)
      - Read `innerHTML.trim()` as defaultContent
      - Collect `:prop="expr"` attributes into slotProps array
      - Create `<span data-slot="name">` replacement with fallback content
      - Replace `<slot>` with the span in the DOM
      - Push SlotBinding to slots array
      - Return (don't recurse into replaced element)
    - Return `slots` from walkTree alongside bindings, events, etc.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4_

  - [x] 2.2 Remove `detectSlots()` function from `v2/lib/tree-walker.js`
    - Remove the `detectSlots` export
    - Slot detection is now integrated into `walkTree()`

- [x] 3. Update Code Generator for scoped slots
  - [x] 3.1 Remove Shadow DOM code from `v2/lib/codegen.js`
    - Remove `slotInfo` destructuring from generateComponent
    - Remove `this.attachShadow({ mode: 'open' })` generation
    - Remove `this.shadowRoot.appendChild` generation
    - Remove shadow root style injection code
    - Always generate light DOM pattern: `this.innerHTML = ''; this.appendChild(__root)`
    - Always generate scoped CSS into `document.head` when styles are provided
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 3.2 Add slot resolution code generation in `v2/lib/codegen.js`
    - Add `slots` to destructuring from parseResult (default: `[]`)
    - When `slots.length > 0`, generate `__slotMap` and `__defaultSlotNodes` construction code BEFORE cloning template
    - Generate DOM ref assignments for slot placeholders: `this.__s0 = pathExpr(slot.path, '__root')`
    - After `this.appendChild(__root)`, generate static slot injection:
      - Named slots (no slotProps): `if (__slotMap['name']) { this.__s0.innerHTML = __slotMap['name'].content; }`
      - Scoped slots (with slotProps): `if (__slotMap['name']) { this.__slotTpl_name = __slotMap['name'].content; }`
      - Default slot: `if (__defaultSlotNodes.length) { this.__s0.textContent = ''; __defaultSlotNodes.forEach(n => this.__s0.appendChild(n.cloneNode(true))); }`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 3.3 Add scoped slot effects in connectedCallback in `v2/lib/codegen.js`
    - For each slot with `slotProps.length > 0`, generate a reactive `__effect`:
      - Build props object mapping prop names to transformed source expressions
      - Replace `{{propName}}` patterns in stored template content
      - Update slot placeholder innerHTML
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 4. Update the Compiler pipeline
  - [x] 4.1 Update `compile()` in `v2/lib/compiler.js`
    - Remove `detectSlots` import and call
    - Get `slots` from walkTree return value
    - Merge `slots` into ParseResult instead of `slotInfo`
    - _Requirements: 1.1, 2.1_

- [x] 5. Checkpoint — Ensure all implementation compiles
  - Run `yarn test` from `v2/` to verify no regressions in core tests and new code compiles. Ask the user if questions arise.

- [x] 6. Rewrite tests for tree walker slot processing
  - [x] 6.1 Rewrite `v2/lib/tree-walker.slots.test.js`
    - Property test: Slot Replacement Completeness (Property 1)
    - Unit tests: no slots, named slots, default slot, scoped slot props, fallback content, deeply nested slots, slots alongside other directives
    - _Requirements: 1.1-1.6, 2.1-2.4, 7.1-7.4, 8.1_

- [x] 7. Rewrite tests for code generation
  - [x] 7.1 Rewrite `v2/lib/codegen.slots.test.js`
    - Property test: Light DOM Always (Property 2)
    - Property test: CSS Scoping Always (Property 3)
    - Property test: Slot Resolution Code Generation (Property 4)
    - Unit tests: named slot injection, default slot injection, scoped slot effects, no slots, mixed slots
    - _Requirements: 3.1-3.3, 4.1-4.6, 5.1-5.5, 8.1-8.3_

- [x] 8. Rewrite integration test
  - [x] 8.1 Rewrite `v2/lib/compiler.slots.test.js`
    - Test component with named slots, default slot, scoped slot props, fallback content, CSS
    - Verify output contains slot resolution code, light DOM pattern, scoped CSS
    - Verify output does NOT contain Shadow DOM code
    - Test component without slots still produces standard light DOM output
    - _Requirements: 1.1, 2.1, 3.1, 3.2, 3.3, 4.1-4.6, 5.1-5.4_

- [x] 9. Update example component
  - [x] 9.1 Update `v2/example/src/wcc-card.html` to use scoped slot syntax
  - [x] 9.2 Update `v2/example/src/wcc-card.js` if needed
  - [x] 9.3 Update `v2/example/index.html` to use `<template #name>` consumer syntax

- [x] 10. Final checkpoint — Ensure all tests pass
  - Run `yarn test` from `v2/` and verify all tests pass. Ask the user if questions arise.

## Notes

- This replaces the previous Shadow DOM native slot implementation
- v1 reference files: `lib/tree-walker.js` (slot replacement in walkTree), `lib/codegen.js` (slot resolution in constructor + scoped slot effects in connectedCallback)
- `detectSlots()` is removed — slot processing is now part of `walkTree()`
- `SlotInfo` type is removed — replaced by `SlotBinding[]` (the `slots` array)
- No Shadow DOM is used — all components render in light DOM
- CSS scoping is always applied via `scopeCSS()` — no special handling for slots
- Slot resolution reads `this.childNodes` BEFORE `this.innerHTML = ''` — order matters
- Scoped slot props use `{{propName}}` interpolation in consumer templates, resolved via string replacement in reactive effects

## Changelog

### 2026-04-30: Scoped slot fallback with reactive resolution

When a scoped slot (slot with `:prop` attributes) has no consumer template provided, the fallback content is now used as the template and resolved reactively via the same `__effect` mechanism. Previously, the fallback content was displayed as-is with unresolved `{{propName}}` placeholders.

Files modified:
- `v2/lib/codegen.js` — Scoped slot injection now generates `else { this.__slotTpl_name = \`fallbackContent\`; }` when `defaultContent` is non-empty, ensuring the reactive effect resolves the fallback just like a consumer template.

### 2026-04-30: Slots inside `each` blocks

Slots discovered inside `each` block item templates are now passed through from `walkBranch()` to `ForBlock`, and the codegen generates per-item scoped slot resolution. This enables components that iterate internally and expose scoped slots per item.

Files modified:
- `v2/lib/types.js` — Added `slots: SlotBinding[]` to `ForBlock` typedef
- `v2/lib/tree-walker.js` — `walkBranch()` includes `slots` in return value
- `v2/lib/codegen.js` — Each effect generates per-item scoped slot resolution
