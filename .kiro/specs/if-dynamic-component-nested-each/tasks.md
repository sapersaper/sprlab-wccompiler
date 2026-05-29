# Implementation Plan: if-dynamic-component-nested-each

## Overview

Enable `if/else` wrapping `<component :is>` inside nested forEach templates.

## Root Cause

The tree-walker computes `childNodes[n]` anchor paths for `<!-- if -->` comments using a
temporary DOM in `walkBranch`. At runtime, when the template is cloned via
`template.content.cloneNode(true)`, whitespace text nodes differ between the compile-time
DOM and the runtime DOM. This causes paths like `node.childNodes[1].childNodes[7].childNodes[5]`
to resolve to `undefined`.

The fix must happen in `walkBranch`/`processIfChains`: instead of computing paths from
the temporary `__branchRoot` DOM, compute them relative to the actual template content.

## Tasks

- [ ] 1. Fix anchor path calculation for nested templates
  - [ ] 1.1 In `walkBranch`, after processing ifBlocks, recalculate anchor paths so they
         are relative to the actual template content, not the `__branchRoot` wrapper
  - [ ] 1.2 Verify anchor paths resolve correctly in JSDOM for nested templates
  - [ ] 1.3 Ensure no regression: existing top-level if-blocks still work

- [ ] 2. Make if-branch nested forEach call `generateItemSetup` recursively
  - [ ] 2.1 Replace inline code with `const node` + `generateItemSetup(lines, ..., indent + '    ')`
  - [ ] 2.2 Remove duplicate inline bindings/events/show/dynamicComponents code

- [ ] 3. Make direct nested forEach call `generateItemSetup` recursively
  - [ ] 3.1 Replace inline code with `const node` + `generateItemSetup(lines, ..., indent + '  ')`
  - [ ] 3.2 Remove duplicate inline bindings/events/show/dynamicComponents code

- [ ] 4. Update `test-deep-nesting.wcc` to use `if/else` instead of `show`

- [ ] 5. Update e2e tests for if/else behavior (component destroyed/created, else text shown)

- [ ] 6. Update unit tests

- [ ] 7. Run final test suite

## Dependencies

Tasks 2 and 3 can be done in parallel, both depend on Task 1.
Tasks 4-7 depend on Tasks 2+3.
