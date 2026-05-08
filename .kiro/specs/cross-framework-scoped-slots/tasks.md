# Implementation Plan: Cross-Framework Scoped Slots

## Overview

Enable WCC scoped slots to work in Vue, React, and Angular by adding an escape interpolation syntax (`{%prop%}`), a string attribute delivery pattern (`slot-template-name`), and enhancing the Vue plugin to auto-transform scoped slot syntax.

## Tasks

- [ ] 1. Codegen — Combined regex for `{{prop}}` and `{%prop%}`
  - [ ] 1.1 Update the scoped slot regex in `lib/codegen.js`
    - Change the generated regex from matching only `{{prop}}` to matching both `{{prop}}` and `{%prop%}`
    - New pattern: `(?:\\{\\{|\\{%)\\s*propName(\\(\\))?\\s*(?:\\}\\}|%\\})`
    - Ensure the `g` flag is preserved for global replacement
    - _Requirements: 4.1, 4.3, 4.4, 5.1, 5.2_

  - [ ] 1.2 Write unit tests for combined regex
    - Test `{{prop}}` still works (backward compat)
    - Test `{%prop%}` works
    - Test `{% prop %}` with whitespace works
    - Test `{%prop()%}` with parentheses works
    - Test mixed `{{prop1}}` and `{%prop2%}` in same template
    - Test null/undefined values replaced with empty string
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 1.7_

  - [ ] 1.3 Write property test for interpolation equivalence
    - For any prop name and value, both `{{prop}}` and `{%prop%}` produce identical output
    - _Requirements: 5.5_

- [ ] 2. Codegen — Slot parser detects `slot-template-name` attributes
  - [ ] 2.1 Add `slot-template-<name>` detection in the slot resolution loop
    - After checking `slot="name"` on regular elements, check for `slot-template-*` attributes
    - Store attribute value as template string in `__slotMap[name]`
    - Element-based (`slot="name"`) takes priority over attribute-based
    - Remove the attribute after reading (cleanup)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 2.2 Add `slot-props` attribute detection for scoped slot prop names
    - When a `<div slot="name" slot-props="prop1, prop2">` is found, store `propsExpr`
    - This enables the Vue plugin transform to pass prop names alongside content
    - _Requirements: 2.1_

  - [ ] 2.3 Write unit tests for slot-template-name detection
    - Test basic `slot-template-item` attribute detection
    - Test priority: `slot="name"` element wins over `slot-template-name`
    - Test attribute removal after reading
    - Test multiple `slot-template-*` on same element
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 3.5_

- [ ] 3. Vue Plugin — Scoped slot transform
  - [ ] 3.1 Extend `wccVuePlugin` pre-transform for scoped slots
    - Detect `<template #name="{ prop1, prop2 }">content</template>` inside custom elements
    - Transform to `<div slot="name" slot-props="prop1, prop2">content</div>`
    - Replace `{{propName}}` → `{%propName%}` in the content for each declared prop
    - Replace `{{ propName }}` (with spaces) → `{% propName %}` as well
    - Do NOT transform `{{expr}}` that don't match declared prop names (leave for Vue)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ] 3.2 Write unit tests for Vue scoped slot transform
    - Test basic transform with single prop
    - Test transform with multiple props
    - Test that only declared prop interpolations are escaped
    - Test that non-scoped `<template #name>` (no props) is NOT affected
    - Test that `<template v-slot:name="{ props }">` syntax also works
    - Test preservation of other content/attributes
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [ ] 4. Integration tests
  - [ ] 4.1 Write integration test: WCC-to-WCC scoped slots still work
    - Compile a component with scoped slots using `{{prop}}` syntax
    - Verify the generated code replaces tokens correctly
    - _Requirements: 7.4, 1.7_

  - [ ] 4.2 Write integration test: `{%prop%}` syntax works in compiled output
    - Create a component with scoped slots
    - Verify the generated regex matches `{%prop%}` tokens
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 4.3 Write integration test: `slot-template-name` attribute works
    - Verify the generated slot parser code detects the attribute
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 5. Documentation
  - [ ] 5.1 Update `docs/QA-defineModel.md` or create `docs/QA-scoped-slots.md`
    - Vue example with plugin transform
    - React example with `slot-template-name` + `{%prop%}`
    - Angular example with `slot-template-name` + `{%prop%}`
    - WCC-to-WCC example (unchanged)
    - Explanation of why `{{prop}}` can't be used in Vue/Angular
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 6. Final verification
  - Run all existing slot tests to verify no regression
  - Run full test suite

## Notes

- The `{%prop%}` syntax was chosen because `{%` is not recognized by Vue, Angular, or React compilers
- The `slot-template-name` attribute pattern is the simplest delivery mechanism for React/Angular (no `<template>` needed)
- The Vue plugin auto-transforms familiar syntax so Vue devs don't need to learn `{%prop%}`
- Backward compatibility is critical — existing `{{prop}}` in WCC-to-WCC must continue working
- The combined regex uses alternation `(?:\\{\\{|\\{%)` for efficiency (single pass)
