# Bugfix Requirements Document

## Introduction

Two critical bugs exist where directives nested inside `each` loops are not compiled correctly. The `walkBranch()` function (used by `processForBlocks`) calls `walkTree` which detects bindings, events, show, model, attr, slots, and child components — but does NOT call `processIfChains` or `processForBlocks` recursively within the branch template. Similarly, `generateItemSetup()` in codegen only handles flat bindings/events/show/attr/model — it has no concept of nested if blocks or nested for blocks within the loop body. This results in nested `each` directives producing `ReferenceError` at runtime and `if/else` chains inside loops rendering both branches simultaneously.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a template contains an `each` directive whose body contains another `each` directive (nested loop) THEN the system throws `ReferenceError: [innerVar] is not defined` because the inner `each` is not compiled as a nested forEach — it is left as literal HTML with unresolved template expressions

1.2 WHEN a template contains an `each` directive whose body contains an `if`/`else` chain THEN the system renders both the `if` branch and the `else` branch simultaneously instead of conditionally, because `processIfChains` is never called within the loop body template

1.3 WHEN a template contains an `each` directive whose body contains an `else-if` directive THEN the system renders all branches simultaneously because the if/else-if/else chain is not processed within the each body

### Expected Behavior (Correct)

2.1 WHEN a template contains an `each` directive whose body contains another `each` directive THEN the system SHALL compile the inner `each` as a nested forEach with proper variable scoping, where the inner loop variable is defined within the inner loop and outer loop variables (item, index) remain accessible in the inner scope

2.2 WHEN a template contains an `each` directive whose body contains an `if`/`else` chain THEN the system SHALL generate per-item conditional logic that evaluates the `if` expression for each loop iteration and renders only the matching branch (using anchor + template swap within the loop body)

2.3 WHEN a template contains an `each` directive whose body contains an `else-if` directive THEN the system SHALL evaluate the full if/else-if/else chain per item and render only the first matching branch

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a template contains a single-level `each` directive with text bindings, events, show, attr, and model directives (no nested directives) THEN the system SHALL CONTINUE TO compile and render the loop correctly with all bindings functional

3.2 WHEN a template contains an `if`/`else` chain at the top level (not inside an `each`) THEN the system SHALL CONTINUE TO compile and render the conditional correctly

3.3 WHEN a template contains a top-level `each` directive with child custom components inside the loop body THEN the system SHALL CONTINUE TO detect and mount child components correctly

3.4 WHEN a template contains a top-level `each` directive with `:key` expressions THEN the system SHALL CONTINUE TO use keyed diffing for efficient DOM updates

3.5 WHEN a template contains a top-level `each` directive with scoped slot bindings THEN the system SHALL CONTINUE TO resolve slot props correctly within the loop

---

## Bug Condition (Formal)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type ComponentTemplate
  OUTPUT: boolean

  // Returns true when the template has an each directive whose body
  // contains either another each directive or an if/else-if/else chain
  RETURN hasEachDirective(X) AND (
    eachBodyContains(X, "each") OR
    eachBodyContains(X, "if/else-if/else")
  )
END FUNCTION
```

### Fix Checking Property

```pascal
// Property: Fix Checking - Nested each compiles correctly
FOR ALL X WHERE isBugCondition(X) AND eachBodyContains(X, "each") DO
  result ← compile'(X)
  ASSERT no_runtime_error(result)
    AND innerLoopRendersItems(result)
    AND outerVarsAccessibleInInnerScope(result)
END FOR

// Property: Fix Checking - If/else inside each compiles correctly
FOR ALL X WHERE isBugCondition(X) AND eachBodyContains(X, "if/else-if/else") DO
  result ← compile'(X)
  ASSERT onlyMatchingBranchRendered(result)
    AND conditionEvaluatedPerItem(result)
END FOR
```

### Preservation Checking Property

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT compile(X) = compile'(X)
END FOR
```

This ensures that for all templates without nested directives inside `each`, the fixed compiler produces identical output to the original.
