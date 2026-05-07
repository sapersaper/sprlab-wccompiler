# Tasks

## 1. Extend ForBlock type and walkBranch() to detect nested directives

- [x] 1.1 Add `forBlocks` and `ifBlocks` optional fields to the `ForBlock` typedef in `lib/types.js`
- [x] 1.2 In `walkBranch()` (`lib/tree-walker.js`), call `processForBlocks` on the branch root after `walkTree` to detect nested `each` directives
- [x] 1.3 In `walkBranch()`, call `processIfChains` on the branch root after `walkTree` to detect nested `if`/`else-if`/`else` chains
- [x] 1.4 Strip first path segment from nested forBlock/ifBlock anchor paths (same pattern as existing bindings path stripping)
- [x] 1.5 Capture `processedHtml` AFTER all processing (move it after processForBlocks/processIfChains calls since they modify the DOM)
- [x] 1.6 Return `forBlocks` and `ifBlocks` in the `walkBranch()` result object
- [x] 1.7 In `processForBlocks`, store the nested `forBlocks` and `ifBlocks` from `walkBranch()` result in the ForBlock pushed to the array

## 2. Extend generateItemSetup() for nested each directives

- [x] 2.1 In `generateItemSetup()` (`lib/codegen.js`), add code generation for nested `forBlocks`: create inner template element, find inner anchor comment in the cloned node, iterate inner source with forEach
- [x] 2.2 Generate inner item bindings/events/show/attr/model code within the nested forEach, using `transformForExpr` with an excludeSet that includes BOTH outer and inner loop variables
- [x] 2.3 Handle nested keyed reconciliation if inner forBlock has a `keyExpr`

## 3. Extend generateItemSetup() for nested if/else chains

- [x] 3.1 In `generateItemSetup()`, add code generation for nested `ifBlocks`: create template elements for each branch, find anchor comment in the cloned node
- [x] 3.2 Generate per-item conditional evaluation using the outer loop's item variable (static evaluation, not reactive, since item is not a signal)
- [x] 3.3 Insert only the matching branch node and apply branch bindings/events/show/attr/model

## 4. Write exploratory tests (bug condition checking)

- [x] 4.1 Write test: nested `each` inside `each` — verify `walkBranch()` returns non-empty `forBlocks` array
- [x] 4.2 Write test: `if`/`else` inside `each` — verify `walkBranch()` returns non-empty `ifBlocks` array
- [x] 4.3 Write test: nested `each` codegen — verify generated code contains nested forEach with proper variable scoping
- [x] 4.4 Write test: `if`/`else` inside `each` codegen — verify generated code contains per-item conditional logic

## 5. Write preservation tests

- [x] 5.1 Verify all existing `codegen.each.test.js` tests pass unchanged
- [x] 5.2 Verify all existing `compiler.each.test.js` tests pass unchanged
- [x] 5.3 Verify all existing `codegen.if.test.js` tests pass unchanged
- [x] 5.4 Verify all existing `compiler.if.test.js` tests pass unchanged
- [x] 5.5 Write preservation test: single-level `each` with bindings/events/show/attr/model produces identical output before and after fix

## 6. Integration testing

- [x] 6.1 Write end-to-end compiler test: component with nested `each` compiles without error and generated code contains correct nested loop structure
- [x] 6.2 Write end-to-end compiler test: component with `if`/`else` inside `each` compiles without error and generated code renders only matching branch
- [x] 6.3 Write end-to-end compiler test: component with `else-if` inside `each` evaluates full chain per item
