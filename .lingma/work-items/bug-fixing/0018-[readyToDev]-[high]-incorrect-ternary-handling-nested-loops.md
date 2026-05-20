# BUG-0018: Incorrect Ternary Expression Handling in Nested Loops

## Metadata
- **Status**: 🧪 inTesting
- **Priority**: [high]
- **Reported by**: QA Team / Lingma AI Testing
- **Date reported**: 2026-05-19
- **Date moved to research**: 2026-05-19
- **Date moved to inProgress**: 2026-05-19
- **Date moved to inTesting**: 2026-05-19
- **Version discovered**: v0.16.25
- **Version fixed**: v0.16.26
- **Severity**: High - Breaks nested loop rendering
- **Component**: Code Generator (ternary expression handling in loops)
- **Related files**: 
  - `lib/codegen.js` (text content generation)
  - `src/12-edge-cases/test-nested-loops.wcc`
- **Discovered during**: Verification of test-nested-loops.wcc after BUG-0017 fix

## Bug Summary

WCC Compiler v0.16.25 generates invalid JavaScript syntax when processing ternary expressions inside text interpolations within nested loops. The generated code combines ternary operator with nullish coalescing (`??`) incorrectly, causing syntax errors that prevent the loop effect from executing.

## What Is the Problem?

### Source Code:
```html
<div each="item in category.items" key={{ item.id }}>
  <span class="stock-status">
    {{ item.inStock ? '✓ In Stock' : '✗ Out of Stock' }}
  </span>
</div>
```

### Generated Code (BROKEN):
```javascript
innerNode.childNodes[1].childNodes[1].childNodes[1].textContent =  
  item.inStock ? '✓ In Stock' : '✗ Out of Stock'  ?? '';
```

**Problem:** The compiler is generating:
```javascript
textContent = ternary_expression ?? ''
```

This is **invalid JavaScript syntax** because:
1. The ternary expression result is being used with nullish coalescing
2. The precedence is wrong - it should be `(ternary) ?? ''` not `ternary ?? ''`
3. Even with parentheses, this doesn't make semantic sense

### Expected Generated Code:
```javascript
innerNode.childNodes[1].childNodes[1].childNodes[1].textContent =  
  (item.inStock ? '✓ In Stock' : '✗ Out of Stock') ?? '';
```

Or better yet, just:
```javascript
innerNode.childNodes[1].childNodes[1].childNodes[1].textContent =  
  item.inStock ? '✓ In Stock' : '✗ Out of Stock';
```

## Impact

### Runtime Behavior:
1. Effect throws error during first execution
2. Error is caught by signal system: `console.error('[wcc] Effect error:', e)`
3. Effect is permanently disabled: `_active = false`
4. Loop never renders any items
5. Component appears empty despite having data

### Console Errors:
```
[wcc] Effect error: SyntaxError: Unexpected token '?'
Cannot read properties of undefined (reading 'bind')
```

### Affected Components:
- `test-nested-loops.wcc` - Completely broken, no categories or items render
- Any component using ternary expressions in text interpolations within loops

## Reproduction Steps

1. Create a WCC component with nested loops
2. Use ternary expression in text interpolation: `{{ condition ? 'A' : 'B' }}`
3. Compile with v0.16.25
4. Load component in browser
5. Observe console error and empty rendering

## Technical Analysis

### Root Cause:
The code generator applies nullish coalescing (`?? ''`) to ALL text content assignments for safety, but doesn't account for ternary expressions that already produce a definite value.

When the source has:
```
{{ item.inStock ? '✓ In Stock' : '✗ Out of Stock' }}
```

The compiler should recognize this as a complete expression and NOT add `?? ''` at the end.

### Likely Location:
File: `lib/codegen.js`
Function: Text content assignment generation for interpolations

The compiler needs to:
1. Detect if an expression is already a ternary
2. If yes, don't append `?? ''`
3. Or wrap in parentheses: `(ternary) ?? ''`

## Suggested Fix

### Option 1: Skip Nullish Coalescing for Ternaries
```javascript
// In codegen.js, when generating textContent assignments:
if (isTernaryExpression(expr)) {
  return `textContent = ${expr};`;
} else {
  return `textContent = ${expr} ?? '';`;
}
```

### Option 2: Always Wrap in Parentheses
```javascript
return `textContent = (${expr}) ?? '';`;
```

### Option 3: Smart Detection
Only add `?? ''` for simple variable references, not complex expressions:
- `{{ name }}` → `name ?? ''` ✅
- `{{ a + b }}` → `(a + b) ?? ''` ✅
- `{{ cond ? 'A' : 'B' }}` → `cond ? 'A' : 'B'` ✅ (no ?? needed)

## Related Bugs

- **BUG-0017** (v0.16.25): Internal method calls not getting `this._` prefix - FIXED
- **BUG-0018** (v0.16.25): Incorrect ternary handling in nested loops - THIS BUG

Both are code generation issues but in different areas (method calls vs. expression handling).

## Priority Justification

**High Priority** because:
1. Completely breaks nested loop rendering
2. Affects common pattern (conditional text in lists)
3. No easy workaround (would need to move logic to methods)
4. Makes nested loops unusable in production

## Additional Notes

This bug was discovered while verifying that BUG-0017 was fixed. It appears to be a separate issue in the code generator's handling of complex expressions within text interpolations.

The bug specifically affects nested loops, but may also impact single-level loops with ternary expressions. Further testing needed to determine full scope.
