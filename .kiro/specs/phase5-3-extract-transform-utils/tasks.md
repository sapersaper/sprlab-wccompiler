# Tasks: extract-transform-utils

- [ ] 1. Create `lib/transform/expr-transformer.js` with `transformExpr`, `transformMethodBody`, `escapeRegex`
- [ ] 2. Create `lib/transform/for-transformer.js` with `transformForExpr`, `isStaticForBinding`, `isStaticForExpr`
- [ ] 3. Create `lib/transform/dep-graph.js` with `extractDeps`, `refsComputedOrMethod`, `extractComputedDeps`, `topologicalSortComputeds`, `buildDepGraph`, `generateUpdateOp`
- [ ] 4. Update codegen.js imports — import from new modules, remove inline definitions
- [ ] 5. Re-export moved functions from codegen.js for backward compatibility
- [ ] 6. Check other files that import from codegen.js (compiler.js, compiler-browser.js, tests) — update if needed
- [ ] 7. `npm test` — all 1307+ tests pass
