# BUG-0004: Ternary Expressions Have Misplaced Parentheses

## Metadata
- **Status**: ✅ done
- **Priority**: 🔼 `high`
- **Reported by**: Dev Team / Lingma AI Testing
- **Date reported**: 2026-05-13
- **Date moved to testing**: 2026-05-14
- **Date resolved**: 2026-05-14
- **QA verified**: 2026-05-14
- **Severity**: High
- **Component**: codegen.js (template expression parsing)
- **Related files**: 
  - `lib/codegen.js`
  - `lib/codegen.ternary-expression.test.js` (8 comprehensive tests)
  - `example/src/03-props-events/wcc-defineProps.wcc`

## Description
The WCC compiler generates incorrect JavaScript syntax for ternary expressions in templates. The closing parenthesis is misplaced, causing the ternary operator to be applied incorrectly and resulting in runtime errors.

## Steps to Reproduce
1. Create a component with ternary expression in template:
   ```html
   <script>
   const active = signal(true)
   </script>
   
   <template>
     <div>{{ active() ? 'Active' : 'Inactive' }}</div>
   </template>
   ```

2. Compile the component
3. Run in browser
4. Observe: JavaScript error or incorrect output

## Expected Behavior
Generated code should wrap the entire ternary expression properly:
```javascript
(this._s_active() ? 'Active' : 'Inactive')
```

## Actual Behavior
Compiler generates incorrect syntax with misplaced parentheses:
```javascript
this._s_active() ? 'Active' : 'Inactive'()
```

The closing parenthesis is placed after `'Inactive'` instead of wrapping the entire expression, making it appear as if `'Inactive'` is being called as a function.

## Environment
- **wcCompiler version**: v0.13.0
- **Node version**: v18.x.x
- **Browser**: Chrome/Firefox (any modern browser)
- **OS**: Windows 11

## Root Cause Analysis
*(To be filled during investigation)*

The issue is likely in the expression parser in `lib/codegen.js` that handles template interpolations `{{ }}`. When processing ternary operators, the compiler is not correctly identifying the boundaries of the expression and places the closing parenthesis at the wrong position.

## Proposed Solution
Fix the ternary expression parser to:
1. Correctly identify the full extent of ternary expressions (condition ? true-value : false-value)
2. Wrap the entire expression in parentheses
3. Handle nested ternary expressions properly
4. Add unit tests for various ternary expression patterns

## Test Cases to Cover
```javascript
// Simple ternary
active() ? 'A' : 'B'

// Nested ternary
status() === 'a' ? 'A' : status() === 'b' ? 'B' : 'C'

// Ternary with function calls
getValue() ? formatValue(getValue()) : 'default'

// Ternary in attribute binding
:class="isActive() ? 'active' : 'inactive'"
```

## Impact Assessment
- **User Impact**: High - Breaks conditional rendering logic
- **Frequency**: Every time ternary expressions are used in templates
- **Workaround**: Manually patch compiled output or avoid ternary expressions
- **Affected Components**: All components using conditional text or attributes

## Related Bugs
- This bug affects the same components as Bug #3 (dynamic bindings)

## Additional Context
Discovered during Phase 3 testing (Props and Events). Ternary expressions are a fundamental JavaScript feature and their incorrect handling severely limits template expressiveness.

## Resolution
**Status**: ✅ **VERIFIED FIXED** - Complete fix for operator precedence issues

**Root Cause**: When expressions with operators (ternary, ||, &&, ??) were combined with the nullish coalescing operator (`?? ''`), JavaScript's operator precedence caused incorrect parsing and runtime SyntaxErrors.

**Fix Applied**:
1. Added `wrapTernaryExpr()` helper function in `lib/codegen.js` to detect risky operators
2. Extended detection to cover: ternary (? :), logical OR (||), logical AND (&&), and nullish coalescing (??)
3. Wrapped all expressions with risky operators in parentheses before applying `?? ''`
4. Applied fix to 5+ locations in codegen.js where textContent and className bindings use `?? ''`

**Generated Code (CORRECT)**:
```javascript
// Ternary expressions
textContent = (this._active() ? 'Active' : 'Inactive') ?? '';

// Logical OR
textContent = (this._count() || 'No items') ?? '';

// Logical AND
textContent = (this._flag() && this._value()) ?? '';

// Nested nullish coalescing
textContent = (this._value() ?? this._fallback()) ?? '';
```

**Files Modified**:
- `lib/codegen.js` (lines 67-99: enhanced wrapTernaryExpr function)
- `lib/codegen.js` (multiple locations: applied wrapping to textContent and className assignments)
- `lib/codegen.ternary-expression.test.js` (created: 8 comprehensive tests)
- `lib/codegen.class-ternary.test.js` (created: test case for :class directive bug)

**Test Results**: All 1005 tests passing ✅

**QA Verification**: 
- ✅ v0.16.4 tested and confirmed fixed
- ✅ 9/9 expressions have correct parentheses (100% coverage)
- ✅ No SyntaxErrors in production
- ✅ Approved for production use

**Release**: v0.16.4 (patch release - critical fix for v0.16.3 partial fix)

---

*Created from testing report dated 2026-05-13*
*Archived after QA verification on 2026-05-14*
