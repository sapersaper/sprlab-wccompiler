# Requirements: extract-transform-utils

## Overview

Move transform and dependency graph functions from `lib/codegen.js` into their own
modules under `lib/transform/`. No logic changes — pure code extraction.

## Files created

| File | Functions extracted from codegen.js |
|------|-------------------------------------|
| `lib/transform/expr-transformer.js` | `transformExpr`, `transformMethodBody`, `escapeRegex` |
| `lib/transform/for-transformer.js` | `transformForExpr`, `isStaticForBinding`, `isStaticForExpr` |
| `lib/transform/dep-graph.js` | `extractDeps`, `refsComputedOrMethod`, `extractComputedDeps`, `topologicalSortComputeds`, `buildDepGraph`, `generateUpdateOp` |

## Requirements

### REQ-1: Same behavior — all existing tests pass

Each extracted function shall produce identical output to the current inline version.

### REQ-2: Clean imports in codegen.js

`codegen.js` shall import the extracted functions from their new modules instead
of defining them inline.

### REQ-3: No circular dependencies

Transform modules shall not import from codegen.js. Dep-graph may import from
expr-transformer and for-transformer.

### REQ-4: Re-exports preserved

All functions currently exported from codegen.js that are moved shall still be
accessible via re-export, so existing direct imports don't break.
