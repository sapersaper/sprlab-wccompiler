# Implementation Plan: if-dynamic-component-nested-each

## Overview

Enable `if/else` wrapping `<component :is>` inside nested forEach templates by making
the nested forEach codegen call `generateItemSetup` recursively and fixing the tree-walker's
anchor path recalculation for if-blocks.

## Prerequisites

Phase 4 core features must be complete: `__renderEach_N()`, `__renderIf_N()`,
`generateItemSetup` with ifBlocks + dynamicComponents, `processNestedForBlock` dep graph.

## Tasks

- [ ] 1. Fix tree-walker: strip first anchor segment for if-blocks
  - [ ] 1.1 In `walkBranch`, after `processIfChains`, call `stripFirstAnchorSegment(ifBlocks)`
  - [ ] 1.2 Verify anchor paths are correct in the compiled output (JSDOM test)
  - [ ] 1.3 Ensure no regression on top-level if-blocks

- [ ] 2. Make if-branch nested forEach call `generateItemSetup` recursively
  - [ ] 2.1 Replace inline bindings/events/show/dynamicComponents generation with recursive call
  - [ ] 2.2 Use `const node = clone2.content.firstChild` (not `innerNode2`)
  - [ ] 2.3 Pass `indent + '    '` as indentOverride
  - [ ] 2.4 Verify compile output matches expected JS

- [ ] 3. Make direct nested forEach call `generateItemSetup` recursively
  - [ ] 3.1 Replace inline bindings/events/show/dynamicComponents generation with recursive call
  - [ ] 3.2 Use `const node = clone.content.firstChild` (not `innerNode`)
  - [ ] 3.3 Pass `indent + '  '` as indentOverride
  - [ ] 3.4 Verify compile output matches expected JS

- [ ] 4. Update `test-deep-nesting.wcc` to use `if/else`
  - [ ] 4.1 Replace `<div show="level3Visible">` with `<div if="level3Visible">...</div><div else>...</div>`
  - [ ] 4.2 Compile and verify `document.createElement(__tag)` is generated
  - [ ] 4.3 Verify component renders correctly in JSDOM

- [ ] 5. Update e2e tests
  - [ ] 5.1 Update Toggle Visibility test to verify if/else behavior (component destroyed, else text shown)
  - [ ] 5.2 Verify all existing e2e tests still pass

- [ ] 6. Update unit tests
  - [ ] 6.1 Fix `codegen.event-handler-null-checks.test.js` to match new variable names
  - [ ] 6.2 Fix any other tests broken by the recursive codegen change
  - [ ] 6.3 Add test: if + component inside nested forEach compiles correctly

- [ ] 7. Run final test suite
  - [ ] 7.1 `npm test` — all 1268+ tests pass
  - [ ] 7.2 `npx playwright test` — all ~200 e2e tests pass
  - [ ] 7.3 Manual test: deep-nesting Toggle Visibility shows/hides component via if/else

## Task Dependency Graph

```
[1] → [2, 3] → [4] → [5, 6] → [7]
```

- Task 1 (anchor fix) must be done first
- Tasks 2 and 3 can be done in parallel
- Task 4 depends on 2 and 3
- Tasks 5 and 6 depend on 4
- Task 7 is final verification
