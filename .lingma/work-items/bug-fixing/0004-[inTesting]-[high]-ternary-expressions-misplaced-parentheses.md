# BUG-0004: Ternary Expressions Have Misplaced Parentheses

## Metadata
- **Status**: 🧪 inTesting
- **Priority**: 🔼 `high`
- **Reported by**: Dev Team / Lingma AI Testing
- **Date reported**: 2026-05-13
- **Date moved to testing**: 2026-05-14
- **Date resolved**: (pending)
- **Severity**: High
- **Component**: codegen.js (template expression parsing)
- **Related files**: 
  - `lib/codegen.js`
  - `lib/codegen.ternary-expression.test.js` (4 comprehensive tests)
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

---

*Created from testing report dated 2026-05-13*
*Ready for QA verification*
