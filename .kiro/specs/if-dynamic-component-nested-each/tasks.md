# Implementation Plan: if-dynamic-component-nested-each

## Overview

Enable `if/else` wrapping `<component :is>` inside nested forEach templates.

## Status

**BLOCKED** — requires tree-walker anchor path refactor (see `.kiro/specs/tree-walker-anchor-paths/`).

## Root Cause Analysis

The tree-walker computes childNode indices for anchor paths (like `<!-- if -->`, `<!-- each -->`)
using a temporary DOM created by `walkBranch`. These paths are correct at compile time.

However, when the template HTML is serialized to a string and later cloned via
`template.content.cloneNode(true)`, the whitespace text nodes in the cloned DOM may differ
from the temporary DOM used during compilation. This causes anchor paths like
`node.childNodes[1].childNodes[7].childNodes[5]` to resolve to `undefined` at runtime.

The `stripFirstAnchorSegment` function removes the first segment (for the `__branchRoot`
wrapper), but does not address the whitespace mismatch.

**Why it works for `show`**: `show` uses a CSS display toggle directly on the element,
without anchor paths. No DOM insertion/removal is needed.

**Why it works for top-level `if/else`**: Top-level templates are processed once
(by the root `processIfChains`), and the anchor paths are calculated directly from the
root DOM which matches the actual template clone.

**Why it fails for nested `if/else`**: Nested templates are processed by `walkBranch`
which creates a temporary DOM. The anchor paths from this temp DOM don't match the
actual template clones at runtime.

## Prerequisites

- [ ] Anchor path refactor (separate spec): make anchor paths robust against whitespace
  differences between compile-time and runtime DOM

## Tasks

All tasks depend on the anchor path refactor being completed first.

- [ ] 1. Fix tree-walker anchor path calculation for nested templates (separate spec)
- [ ] 2. Make if-branch nested forEach call `generateItemSetup` recursively
  - [ ] 2.1 Replace inline bindings/events with recursive call using `node` variable
  - [ ] 2.2 Pass `indent + '    '` as indentOverride
- [ ] 3. Make direct nested forEach call `generateItemSetup` recursively
  - [ ] 3.1 Replace inline bindings/events with recursive call using `node` variable
  - [ ] 3.2 Pass `indent + '  '` as indentOverride
- [ ] 4. Update `test-deep-nesting.wcc` to use `if/else` instead of `show`
- [ ] 5. Update e2e tests for if/else behavior
- [ ] 6. Run final test suite
