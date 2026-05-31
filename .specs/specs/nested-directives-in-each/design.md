# Nested Directives in Each Bugfix Design

## Overview

Two bugs prevent nested directives from working inside `each` loops. The `walkBranch()` function processes bindings/events/show/attr/model within a loop body template but never calls `processForBlocks` or `processIfChains` recursively, so nested `each` and `if/else` directives are left as raw HTML. Similarly, `generateItemSetup()` in codegen only emits code for flat bindings — it has no logic to handle nested for blocks or if blocks within the loop body. The fix adds recursive directive processing in `walkBranch()` and nested code generation in `generateItemSetup()`.

## Glossary

- **Bug_Condition (C)**: A template containing an `each` directive whose body contains either another `each` directive or an `if`/`else-if`/`else` chain
- **Property (P)**: Nested directives inside `each` compile correctly — inner loops iterate with proper scoping, and if/else chains render only the matching branch per item
- **Preservation**: All existing single-level `each` behavior (bindings, events, show, attr, model, slots, keyed diffing, child components) remains unchanged
- **walkBranch()**: Function in `lib/tree-walker.js` that creates a temporary DOM from branch HTML and runs `walkTree` to discover bindings/events — currently does NOT call `processIfChains` or `processForBlocks`
- **generateItemSetup()**: Function in `lib/codegen.js` that emits per-item setup code for bindings/events/show/attr/model/slots — currently has no concept of nested if or for blocks
- **transformForExpr()**: Function in `lib/codegen.js` that rewrites expressions to exclude loop variables from signal transformation — must exclude BOTH outer and inner loop variables for nested loops
- **ForBlock**: IR type representing a parsed `each` directive with its template, bindings, anchor path, and iteration metadata
- **IfBlock**: IR type representing a parsed `if`/`else-if`/`else` chain with branches, each containing template HTML and bindings

## Bug Details

### Bug Condition

The bug manifests when a template contains an `each` directive whose body contains either another `each` directive or an `if`/`else-if`/`else` chain. The `walkBranch()` function calls `walkTree` (which detects bindings, events, show, attr, model, slots, child components) but does NOT call `processIfChains` or `processForBlocks` on the branch root. This means nested structural directives are never compiled into the IR.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ComponentTemplate
  OUTPUT: boolean

  RETURN hasEachDirective(input) AND (
    eachBodyContains(input, "each") OR
    eachBodyContains(input, "if/else-if/else")
  )
END FUNCTION
```

### Examples

- **Nested each**: `<li each="cat of categories"><span each="item of cat.items">{{item.name}}</span></li>` — Expected: inner loop renders items per category. Actual: `ReferenceError: item is not defined` because inner `each` is left as literal HTML
- **If inside each**: `<li each="item of items"><span if="item.active">Active</span><span else>Inactive</span></li>` — Expected: only matching branch rendered per item. Actual: both `<span>` elements render simultaneously
- **Else-if inside each**: `<li each="item of items"><span if="item.status === 'a'">A</span><span else-if="item.status === 'b'">B</span><span else>C</span></li>` — Expected: only first matching branch rendered. Actual: all three branches render
- **Nested each with outer variable access**: `<div each="cat of categories"><p each="item of cat.items">{{cat.name}}: {{item.name}}</p></div>` — Expected: inner loop can reference `cat` from outer scope. Actual: crashes because inner scope is never created

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Single-level `each` with text bindings, events, show, attr, model directives must continue to compile and render correctly
- Top-level `if`/`else` chains (not inside `each`) must continue to work
- `each` with child custom components must continue to detect and mount them
- `each` with `:key` expressions must continue to use keyed diffing
- `each` with scoped slot bindings must continue to resolve slot props
- `transformForExpr` must continue to correctly exclude the loop variable from signal transformation for single-level loops

**Scope:**
All templates that do NOT contain nested directives inside `each` should be completely unaffected by this fix. This includes:
- Single-level `each` loops with any combination of bindings/events/show/attr/model
- Top-level `if`/`else`/`else-if` chains
- Nested `each` at the top level (sibling `each` directives, not parent-child)
- Any template without `each` directives

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Missing recursive processing in `walkBranch()`**: The function calls `walkTree` (which handles bindings, events, show, attr, model, slots, child components) but never calls `processForBlocks` or `processIfChains` on the branch root. This means nested structural directives are invisible to the IR.

2. **Missing nested data in ForBlock IR**: The `ForBlock` type has no fields for `forBlocks` or `ifBlocks`. Even if `walkBranch()` detected them, there's nowhere to store them in the returned result.

3. **Missing codegen for nested directives in `generateItemSetup()`**: The function only handles flat bindings/events/show/attr/model/slots. It has no code path to emit nested `forEach` loops or per-item conditional logic.

4. **Variable scoping in nested loops**: `transformForExpr` builds an `excludeSet` containing only the current loop's `itemVar` and `indexVar`. For nested loops, the inner loop's codegen must exclude BOTH the outer loop variables AND the inner loop variables from signal transformation.

## Correctness Properties

Property 1: Bug Condition - Nested Each Compiles Correctly

_For any_ template containing an `each` directive whose body contains another `each` directive, the fixed compiler SHALL produce code that iterates the inner collection per outer item, with the inner loop variable defined in the inner scope and outer loop variables (item, index) accessible in the inner scope, producing no runtime errors.

**Validates: Requirements 2.1**

Property 2: Bug Condition - If/Else Inside Each Renders Conditionally

_For any_ template containing an `each` directive whose body contains an `if`/`else-if`/`else` chain, the fixed compiler SHALL produce per-item conditional logic that evaluates the condition for each loop iteration and renders only the first matching branch per item.

**Validates: Requirements 2.2, 2.3**

Property 3: Preservation - Single-Level Each Unchanged

_For any_ template containing a single-level `each` directive (no nested `each` or `if`/`else` inside the loop body), the fixed compiler SHALL produce identical output to the original compiler, preserving all existing bindings, events, show, attr, model, slot, and keyed diffing behavior.

**Validates: Requirements 3.1, 3.3, 3.4, 3.5**

Property 4: Preservation - Top-Level If/Else Unchanged

_For any_ template containing `if`/`else` chains at the top level (not inside an `each`), the fixed compiler SHALL produce identical output to the original compiler.

**Validates: Requirements 3.2**

## Fix Implementation

### Changes Required

**File**: `lib/types.js`

**Change**: Extend the `ForBlock` typedef to include optional `forBlocks` and `ifBlocks` fields for nested directives.

---

**File**: `lib/tree-walker.js`

**Function**: `walkBranch()`

**Specific Changes**:
1. **Call `processForBlocks` on the branch root** after `walkTree` completes, to detect nested `each` directives within the branch template
2. **Call `processIfChains` on the branch root** after `walkTree` completes, to detect `if`/`else-if`/`else` chains within the branch template
3. **Return the nested `forBlocks` and `ifBlocks`** in the result object so they are stored in the parent ForBlock
4. **Strip first path segment** from nested forBlock/ifBlock anchor paths (same as existing bindings path stripping)
5. **Capture processedHtml AFTER** all processing (including if/for processing which modifies the DOM by replacing elements with comment nodes)

---

**File**: `lib/codegen.js`

**Function**: `generateItemSetup()`

**Specific Changes**:
1. **Generate nested forEach code** for each nested `forBlock` in the ForBlock:
   - Create a `<template>` element for the inner loop's item HTML
   - Find the anchor comment node within the cloned outer item node
   - Iterate the inner source expression, clone the inner template per inner item
   - Apply inner item bindings/events/show/attr/model using the inner item variable
   - The `transformForExpr` calls for inner bindings must exclude BOTH outer and inner loop variables

2. **Generate per-item conditional logic** for each nested `ifBlock` in the ForBlock:
   - Create `<template>` elements for each branch
   - Find the anchor comment node within the cloned outer item node
   - Evaluate the if/else-if/else condition using the outer loop's item variable
   - Insert only the matching branch's cloned node
   - Apply branch bindings/events using the outer loop's item variable (static evaluation since item is not a signal)

3. **Variable scoping**: When generating inner loop code, build an `excludeSet` that includes both the outer `itemVar`/`indexVar` AND the inner `itemVar`/`indexVar` so that `transformForExpr` does not rewrite loop variables as signals.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write compiler tests that feed templates with nested directives inside `each` to the compiler and assert on the generated code structure. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Nested Each Test**: Compile `<li each="cat of categories"><span each="item of cat.items">{{item.name}}</span></li>` — expect generated code contains nested forEach (will fail on unfixed code)
2. **If Inside Each Test**: Compile `<li each="item of items"><span if="item.active">Yes</span><span else>No</span></li>` — expect generated code contains per-item conditional (will fail on unfixed code)
3. **Else-If Inside Each Test**: Compile template with if/else-if/else inside each — expect only matching branch logic (will fail on unfixed code)
4. **Outer Variable Access Test**: Compile nested each where inner template references outer variable — expect no ReferenceError in generated code (will fail on unfixed code)

**Expected Counterexamples**:
- Generated code contains no nested forEach — inner `each` is left as literal HTML in the template string
- Generated code contains no conditional logic for if/else inside each — both branches appear in template HTML
- Possible causes: `walkBranch()` never calls `processForBlocks`/`processIfChains`, `generateItemSetup()` has no nested directive handling

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed compiler produces correct output.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := compile_fixed(input)
  IF eachBodyContains(input, "each") THEN
    ASSERT generatedCodeContainsNestedForEach(result)
    ASSERT innerLoopVarDefinedInInnerScope(result)
    ASSERT outerLoopVarAccessibleInInnerScope(result)
  END IF
  IF eachBodyContains(input, "if/else-if/else") THEN
    ASSERT generatedCodeContainsPerItemConditional(result)
    ASSERT onlyMatchingBranchInserted(result)
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed compiler produces the same result as the original compiler.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT compile_original(input) = compile_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many single-level `each` configurations automatically
- It catches edge cases in binding/event/show/attr/model handling
- It provides strong guarantees that existing behavior is unchanged

**Test Plan**: Run existing codegen.each.test.js and compiler.each.test.js tests to verify all pass unchanged. Write additional property-based tests generating random single-level `each` templates and asserting output matches.

**Test Cases**:
1. **Single-Level Each Preservation**: Verify `each` with text bindings, events, show, attr, model produces identical output before and after fix
2. **Keyed Each Preservation**: Verify `each` with `:key` produces identical keyed reconciliation code
3. **Top-Level If Preservation**: Verify top-level `if`/`else` chains produce identical output
4. **Child Component Preservation**: Verify `each` with child components produces identical output

### Unit Tests

- Test `walkBranch()` returns `forBlocks` array when branch HTML contains nested `each`
- Test `walkBranch()` returns `ifBlocks` array when branch HTML contains `if`/`else` chain
- Test `generateItemSetup()` emits nested forEach when forBlock has nested `forBlocks`
- Test `generateItemSetup()` emits per-item conditional when forBlock has nested `ifBlocks`
- Test variable scoping: inner loop excludes both outer and inner variables from transformation

### Property-Based Tests

- Generate random nested `each` templates with varying inner/outer variable names and assert generated code contains properly scoped nested forEach
- Generate random `if`/`else-if`/`else` conditions inside `each` and assert generated code evaluates conditions using item variable
- Generate random single-level `each` templates and assert output is identical to original compiler (preservation)

### Integration Tests

- End-to-end compile of component with nested `each` and verify rendered DOM matches expected structure
- End-to-end compile of component with `if`/`else` inside `each` and verify only matching branches render
- End-to-end compile of component mixing nested `each` and `if`/`else` inside the same loop body
