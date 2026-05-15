# BUG-0011: :class Directive Transforms String Literals in Ternary Expressions

## Metadata
- **Status**: 🔄 inProgress
- **Priority**: 🔼 `high`
- **Reported by**: QA Team
- **Date reported**: 2026-05-14
- **Date moved to research**: 2026-05-15
- **Date moved to inProgress**: 2026-05-15
- **Date moved to inTesting**: 2026-05-15
- **Date moved back to inProgress**: 2026-05-15 (QA reported partial fix - template literal issue)
- **Version fixed**: v0.16.15
- **Severity**: High
- **Component**: codegen.js (transformExpr function)
- **Related files**: 
  - `lib/codegen.js` (transformExpr function, lines ~120-200)
  - `lib/codegen.js` (class binding generation, line ~1600)
  - `lib/codegen.class-ternary.test.js` (test case documenting the bug)

## Description
When using ternary expressions in `:class` directives, the `transformExpr()` function incorrectly transforms string literals that contain signal names. This causes class names to be corrupted and components to render with incorrect classes.

## Steps to Reproduce
1. Create a component with ternary in :class binding:
   ```html
   <script>
   import { defineComponent, signal } from 'wcc'

   export default defineComponent({
     tag: 'test-class-ternary',
   })

   const theme = signal('light')
   </script>

   <template>
   <div :class="theme() === 'light' ? 'light-theme' : 'dark-theme'">Test</div>
   </template>
   ```

2. Compile the component
3. Inspect generated code

## Expected Behavior
Generated code should preserve string literals exactly as written:
```javascript
this.__attr_class_0.className = this._theme() === 'light' ? 'light-theme' : 'dark-theme';
```

## Actual Behavior
String literals containing signal names are incorrectly transformed:
```javascript
this.__attr_class_0.className = this._theme() === 'light' ? 'light-this._theme()' : 'dark-this._theme()';
//                                                      ^^^^^^^^^^^^^^^^     ^^^^^^^^^^^^^^^^^
//                                              String literals corrupted!
```

The strings `'light-theme'` and `'dark-theme'` become `'light-this._theme()'` and `'dark-this._theme()'`.

## Root Cause Analysis
The `transformExpr()` function uses regex patterns with word boundaries (`\b`) to find and transform signal/computed/method names. However, these regex patterns match occurrences of signal names **inside string literals**, not just as variable references.

For example, when transforming the expression:
```javascript
theme() === 'light' ? 'light-theme' : 'dark-theme'
```

The regex finds `theme` inside the string `'light-theme'` and replaces it with `this._theme()`, producing:
```javascript
this._theme() === 'light' ? 'light-this._theme()' : 'dark-this._theme()'
```

### Why This Happens
The current implementation in `transformExpr()` does simple string replacement without parsing the JavaScript expression structure. It cannot distinguish between:
- Variable references: `theme()` → should transform to `this._theme()`
- String literals: `'light-theme'` → should NOT be transformed

## Impact Assessment
- **User Impact**: High - Components render with wrong class names, breaking styling
- **Frequency**: Every time :class uses ternary expressions with string literals containing signal names
- **Workaround Available**: Yes, but inconvenient (use computed properties or methods)
- **Affected Components**: All components using :class with ternaries

### Workarounds
**Option 1: Use computed property**
```javascript
const getClass = () => theme() === 'light' ? 'light-theme' : 'dark-theme'
```
```html
<div :class="getClass()">Test</div>
```

**Option 2: Use object syntax**
```html
<div :class="{ 'light-theme': theme() === 'light', 'dark-theme': theme() !== 'light' }">Test</div>
```

**Option 3: Avoid signal names in class strings**
```html
<!-- Instead of 'light-theme', use 'theme-light' -->
<div :class="theme() === 'light' ? 'theme-light' : 'theme-dark'">Test</div>
```

## Test Cases to Cover
```javascript
// Simple ternary with string literals
theme() === 'light' ? 'light-theme' : 'dark-theme'

// Nested ternary
isActive() ? (size() === 'large' ? 'active-large' : 'active-small') : 'inactive'

// Multiple signals in strings
status() === 'error' ? 'error-state' : 'success-state'

// Complex expressions
count() > 0 ? 'has-items' : 'no-items'
```

## Proposed Solution
The fix requires modifying `transformExpr()` to properly parse JavaScript expressions and avoid transforming identifiers inside string literals.

### Approach 1: Expression Parser (Recommended)
Implement a proper JavaScript expression parser that:
1. Tokenizes the expression
2. Identifies string literal boundaries
3. Only transforms identifiers outside of strings
4. Handles nested expressions correctly

### Approach 2: Regex-Based String Protection (Quick Fix)
Temporarily replace string literals with placeholders before transformation:
```javascript
function transformExpr(expr, ...) {
  // 1. Extract string literals and replace with placeholders
  const strings = [];
  let placeholderExpr = expr.replace(/(['"`])(.*?)\1/g, (match, quote, content) => {
    strings.push(match);
    return `__STRING_${strings.length - 1}__`;
  });
  
  // 2. Apply transformations to non-string parts
  let transformed = applyTransforms(placeholderExpr, ...);
  
  // 3. Restore original string literals
  strings.forEach((str, i) => {
    transformed = transformed.replace(`__STRING_${i}__`, str);
  });
  
  return transformed;
}
```

### Approach 3: AST-Based Transformation (Most Robust)
Use a JavaScript parser (like Acorn or Babel) to build an AST, transform only identifier nodes, then regenerate code. This is the most correct solution but requires adding dependencies.

## Files to Modify
- `lib/codegen.js` - `transformExpr()` function needs major refactoring
- Potentially add new utility module for expression parsing

## Related Bugs
- Bug #0004: Operator precedence with ?? operator (FIXED in v0.16.4)
  - Note: Bug #0004 was about text interpolation `{{ }}`, this bug is specific to :class directives
  - Both involve expression transformation but have different root causes

## Additional Context
This bug was discovered during QA testing of v0.16.4. While the operator precedence fix (Bug #0004) was confirmed complete for text interpolations, QA found this separate issue affecting :class directives.

The bug is particularly insidious because:
1. No syntax errors are thrown
2. Component renders but with wrong classes
3. Difficult to debug without inspecting generated code
4. May go unnoticed until visual testing

## Priority Justification
Marked as **high priority** because:
- :class directives are commonly used in Vue.js-style components
- Ternary expressions in :class are a standard pattern
- The bug silently corrupts class names without errors
- Affects user-facing UI/styling

---

*Created from QA test report dated 2026-05-14*
*Discovered during v0.16.4 testing*
*Requires separate fix from Bug #0004*
