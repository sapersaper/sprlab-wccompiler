# Design: extract-transform-utils

## Strategy

Pure extraction — copy functions to new files, update imports in codegen.js.
No renames, no refactoring, no logic changes. Each step is atomic and reversible.

## Module dependency graph

```
lib/transform/expr-transformer.js   (no deps)
lib/transform/for-transformer.js    (imports expr-transformer)
lib/transform/dep-graph.js          (imports expr-transformer, for-transformer)
lib/codegen.js                      (imports all three)
```

## What stays in codegen.js

- `pathExpr` — DOM path helper used throughout
- `wrapTernaryExpr` — expression wrapper for nullish coalescing
- `slotPropRef` — slot prop reference helper
- `generateEventHandler`, `generateForEventHandler` — event handler generators
- `generateItemSetup`, `generateNestedItemSetup` — item rendering (replaced in spec 5)
- `generateComponent` — main orchestrator
