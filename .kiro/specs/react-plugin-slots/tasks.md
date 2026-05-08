# Implementation Plan: React Plugin Slots

## Overview

Implement `wccReactPlugin()` as a Vite plugin that uses Babel AST to transform idiomatic React JSX slot patterns into WCC-compatible slot markup at build time. The plugin is added as a named export to the existing `integrations/react.js` file, coexisting with `useWccEvent` and `useWccModel` hooks.

## Tasks

- [x] 1. Add Babel dependencies and set up plugin scaffold
  - [x] 1.1 Add `@babel/parser`, `@babel/traverse`, `@babel/generator`, and `@babel/types` as dependencies in `package.json`
    - These are runtime dependencies (not devDependencies) since the plugin runs in the consumer's Vite build
    - Run `yarn install` to update lockfile
    - _Requirements: 4.1_

  - [x] 1.2 Create the `wccReactPlugin` function scaffold in `integrations/react.js`
    - Export `wccReactPlugin` as a named export alongside existing hooks
    - Return a Vite plugin object with `name: 'vite-plugin-wcc-react-slots'`, `enforce: 'pre'`
    - Add `transform(code, id)` hook that returns `null` for non-.jsx/.tsx files
    - Accept `WccReactPluginOptions` parameter (prefix, exclude, slotProps)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

- [x] 2. Implement prop classifier
  - [x] 2.1 Implement the `classifyProp` function
    - Rule 1: Always pass-through reserved props (`children`, `key`, `ref`, `className`, `id`, `style`, `slot`, `is`, `dangerouslySetInnerHTML`)
    - Rule 2: Always pass-through event handlers (`on` + uppercase)
    - Rule 3: Always pass-through `data-` and `aria-` prefixed props
    - Rule 4: Always pass-through props in the user's `exclude` list
    - Rule 5: Classify as render prop if name matches `/^render[A-Z]/` AND value is ArrowFunctionExpression
    - Rule 6: Always pass-through props whose values are not JSX expressions or string literals
    - Rule 7: Classify as named slot prop (respecting `slotProps` option if set)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.3, 7.4_

  - [x] 2.2 Write property tests for prop classification
    - **Property 6: Event handler props pass through**
    - **Property 7: Reserved props pass through**
    - **Property 8: data-/aria- props pass through**
    - **Property 9: Non-JSX value props pass through**
    - **Property 19: Exclude list**
    - **Property 20: Explicit slotProps list**
    - **Validates: Requirements 5.3, 5.4, 5.5, 5.6, 7.3, 7.4**

- [x] 3. Implement JSX-to-HTML serializer
  - [x] 3.1 Implement the `serializeJsxToHtml` function
    - Convert JSX attribute names to HTML equivalents (`className` → `class`, `htmlFor` → `for`, `tabIndex` → `tabindex`, etc.)
    - Handle void elements (br, img, input, hr, etc.) — no closing tag
    - Recursively serialize nested JSX elements
    - When `paramNames` is provided, replace `{paramName}` expressions with `{%paramName%}` tokens
    - Emit warnings for dynamic expressions that can't be statically serialized
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 3.2 Write property tests for JSX-to-HTML serialization
    - **Property 22: JSX attribute name mapping**
    - **Property 23: Void elements serialized without closing tag**
    - **Property 24: Nested elements serialized recursively**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 4. Implement slot element generators and slot name derivation
  - [x] 4.1 Implement `generateNamedSlotElement` — creates `<div slot="name">` wrapping JSX content
    - _Requirements: 2.1_

  - [x] 4.2 Implement `generateStringSlotElement` — creates `<span slot="name">` wrapping string text
    - _Requirements: 2.2_

  - [x] 4.3 Implement `generateScopedSlotElement` — creates `<div slot="name" slot-props="..." dangerouslySetInnerHTML={{__html: ...}}>` for render props
    - _Requirements: 3.1, 3.5_

  - [x] 4.4 Implement `deriveSlotName` — strips `render` prefix and lowercases first char
    - _Requirements: 3.2_

  - [x] 4.5 Write property tests for slot generation and name derivation
    - **Property 3: Named slot prop produces div child**
    - **Property 4: String slot prop produces span child**
    - **Property 10: Render prop produces scoped slot element**
    - **Property 11: Slot name derivation**
    - **Property 12: Parameter extraction to slot-props**
    - **Validates: Requirements 2.1, 2.2, 3.1, 3.2, 3.3, 3.5, 3.6**

- [x] 5. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement the main AST transform logic
  - [x] 6.1 Implement the `transform` hook body
    - Parse source with `@babel/parser` (plugins: `jsx`, `typescript`)
    - Traverse AST looking for JSXElements with hyphenated tag names
    - Apply prefix filtering if `prefix` option is set
    - For each matching element: classify all props, generate slot children, rewrite the element
    - Preserve existing children before generated slot elements
    - Remove transformed slot props from the element's attributes
    - Return `null` if no transformations were made (no custom elements found)
    - Return `{ code, map }` from `@babel/generator` when transformations occur
    - _Requirements: 1.5, 2.3, 2.4, 4.2, 4.3, 4.4, 4.6, 7.1, 7.2_

  - [x] 6.2 Implement parameter reference replacement in render prop bodies
    - Replace `{paramName}` expression references with `{%paramName%}` tokens in text content and attribute values
    - Do NOT replace occurrences in tag names or attribute names
    - Handle multiple parameters independently
    - _Requirements: 3.4, 3.6, 3.7, 10.1, 10.2, 10.3_

  - [x] 6.3 Write property tests for the main transform
    - **Property 1: File extension filtering**
    - **Property 2: No-op for files without custom elements**
    - **Property 5: Children ordering invariant**
    - **Property 13: Parameter reference replacement**
    - **Property 14: No replacement in tag/attribute names**
    - **Property 15: Non-slot props preserved on element**
    - **Property 16: Source map returned**
    - **Property 17: Default processes all hyphenated tags**
    - **Property 18: Prefix filtering**
    - **Validates: Requirements 1.4, 1.5, 2.3, 2.4, 3.4, 3.7, 4.4, 4.6, 7.1, 7.2, 9.3, 10.1, 10.2, 10.3**

- [x] 7. Implement error handling and warnings
  - [x] 7.1 Handle parse errors gracefully — return `null` and log warning via `this.warn()`
    - _Requirements: 8.3_

  - [x] 7.2 Warn on invalid render prop values (non-arrow-function) — leave prop unchanged
    - _Requirements: 8.1_

  - [x] 7.3 Warn on unsupported expressions in render prop bodies — leave prop unchanged
    - _Requirements: 8.2_

  - [x] 7.4 Warn on dynamic expressions in named slot props — leave prop unchanged
    - _Requirements: 6.5, 8.4_

  - [x] 7.5 Write unit tests for error handling scenarios
    - Test parse error pass-through
    - Test invalid render prop warning
    - Test unsupported expression warning
    - Test warning format includes file path and line number
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 8. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Integration verification and hook coexistence
  - [x] 9.1 Write unit tests verifying coexistence with existing hooks
    - Verify `useWccEvent` calls are not modified in transformed files
    - Verify `useWccModel` calls are not modified in transformed files
    - Verify `ref` prop is preserved when used alongside slot props
    - Verify TypeScript annotations in `.tsx` files parse correctly
    - Verify nested custom elements in slot values are serialized without recursive transformation
    - _Requirements: 9.1, 9.2, 9.3, 4.3, 4.5_

  - [x] 9.2 Write property test for hook preservation
    - **Property 21: Hook calls not modified**
    - **Validates: Requirements 9.1, 9.2**

  - [x] 9.3 Write property test for scoped slot semantic equivalence
    - **Property 25: Semantic equivalence of render prop output**
    - **Validates: Requirements 10.4**

- [x] 10. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The plugin is implemented in JavaScript (matching existing `integrations/react.js`)
- Test file: `lib/integrations.react-slots.test.js` (following project convention)
- All property tests use `fast-check` with minimum 100 iterations
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
