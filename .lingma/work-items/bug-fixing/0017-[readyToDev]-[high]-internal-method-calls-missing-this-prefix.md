# BUG-0017: Internal Method Calls Not Getting `this._` Prefix

## Metadata
- **Status**: 🔬 research
- **Priority**: [high]
- **Reported by**: QA Team / Lingma AI Testing
- **Date reported**: 2026-05-18
- **Date moved to research**: 2026-05-18
- **Version discovered**: v0.16.24
- **Severity**: High - Prevents method reuse within components
- **Component**: Code Generator (method call transformation)
- **Related files**: 
  - `lib/codegen.js` (method call code generation)
  - All compiled components with internal method calls
- **Discovered during**: Testing of test-large-dataset.wcc edge case component

## Bug Summary

WCC Compiler v0.16.24 fails to add the `this._` prefix when generating code for internal method calls within component functions. When one function calls another function defined in the same component's `<script>` section, the compiler does not transform the call to use the underscore-prefixed method name (`this._methodName()`), causing runtime ReferenceError exceptions.

## What Is the Problem?

When developers write component methods that call other methods internally, the generated JavaScript code is incorrect and causes runtime failures.

### Example Scenario:

**Source Code (test-large-dataset.wcc):**
```javascript
<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-large-dataset',
})

const largeList = signal([])
const filteredList = signal([])
const searchTerm = signal('')

function handleSearch(term) {
  searchTerm.set(term)
  
  if (!term) {
    filteredList.set(largeList())
    return
  }
  
  const lowerTerm = term.toLowerCase()
  const filtered = largeList().filter(item => 
    item.name.toLowerCase().includes(lowerTerm)
  )
  
  filteredList.set(filtered)
}

function sortBy(field) {
  const sorted = [...largeList()].sort((a, b) => {
    if (typeof a[field] === 'string') {
      return a[field].localeCompare(b[field])
    }
    return a[field] - b[field]
  })
  largeList.set(sorted)
  
  // Calling another internal method
  handleSearch(searchTerm())  // ← This call is NOT transformed correctly
}
</script>
```

**Generated Code (BROKEN):**
```javascript
_handleSearch(term) {
  this._searchTerm(term)
  
  if (!term) {
    this._filteredList(this._largeList())
    return
  }
  
  const lowerTerm = term.toLowerCase()
  const filtered = this._largeList().filter(item => 
    item.name.toLowerCase().includes(lowerTerm)
  )
  
  this._filteredList(filtered)
}

_sortBy(field) {
  const sorted = [...this._largeList()].sort((a, b) => {
    if (typeof a[field] === 'string') {
      return a[field].localeCompare(b[field])
    }
    return a[field] - b[field]
  })
  this._largeList(sorted)
  
  // ❌ ERROR: handleSearch is not defined in global scope
  handleSearch(this._searchTerm())  // ← Should be: this._handleSearch(...)
}
```

**Runtime Error:**
```
ReferenceError: handleSearch is not defined
    at TestLargeDataset._sortBy (test-large-dataset.js:593:3)
```

## Expected Behavior

The compiler should automatically detect when a function call references another method defined in the same component and add the `this._` prefix:

**Expected Generated Code:**
```javascript
_sortBy(field) {
  const sorted = [...this._largeList()].sort((a, b) => {
    if (typeof a[field] === 'string') {
      return a[field].localeCompare(b[field])
    }
    return a[field] - b[field]
  })
  this._largeList(sorted)
  
  // ✅ CORRECT: Uses this._ prefix for internal method call
  this._handleSearch(this._searchTerm())
}
```

## Current Behavior

Internal method calls are left unchanged without the `this._` prefix, causing them to reference non-existent global functions instead of the component's methods.

## Impact Analysis

### Affected Patterns:

| Pattern | Works? | Reason |
|---------|--------|--------|
| Signal calls: `mySignal()` | ✅ Yes | Transformed to `this._mySignal()` |
| Signal setters: `mySignal(value)` | ✅ Yes | Transformed to `this._mySignal(value)` |
| Template event handlers: `@click="methodName"` | ✅ Yes | Generated as `this._methodName.bind(this)` |
| **Internal method calls: `otherMethod()`** | ❌ **No** | **NOT transformed to `this._otherMethod()`** |

### Real-World Impact:

1. **Code Reusability Blocked**: Developers cannot extract common logic into helper methods
2. **DRY Principle Violated**: Forces code duplication to avoid method-to-method calls
3. **Maintenance Difficulty**: Inline logic is harder to maintain than reusable methods
4. **Testing Complexity**: Cannot unit test individual methods in isolation

### Components Affected:

- `test-large-dataset.wcc` - Multiple method-to-method calls (sortBy → handleSearch, bulkUpdateValues → handleSearch, reset → generateLargeDataset)
- `test-error-recovery.wcc` - Multiple error handlers calling `handleError()` internally
- Any component using method composition or helper functions

## Reproduction Steps

1. Create a WCC component with two methods where one calls the other:
   ```javascript
   function helperMethod() {
     // Some logic
   }
   
   function mainMethod() {
     helperMethod()  // Call helper
   }
   ```

2. Compile the component with WCC Compiler v0.16.24

3. Load the component in a browser

4. Trigger `mainMethod()` via an event handler

5. Observe console error: `ReferenceError: helperMethod is not defined`

## Workaround

Currently, developers must inline all method logic to avoid internal method calls:

```javascript
// WORKAROUND: Inline everything instead of calling methods
function sortBy(field) {
  const sorted = [...largeList()].sort((a, b) => {
    if (typeof a[field] === 'string') {
      return a[field].localeCompare(b[field])
    }
    return a[field] - b[field]
  })
  largeList.set(sorted)
  
  // Inlined handleSearch logic (duplicated code)
  const term = searchTerm()
  if (!term) {
    filteredList.set(largeList())
  } else {
    const lowerTerm = term.toLowerCase()
    const filtered = largeList().filter(item => 
      item.name.toLowerCase().includes(lowerTerm)
    )
    filteredList.set(filtered)
  }
}
```

**Downsides of workaround:**
- Code duplication
- Harder to maintain
- Larger bundle sizes
- Violates DRY principle

## Technical Analysis

### Root Cause:

The code generator appears to have different transformation rules for:
1. **Template bindings** (event handlers, expressions) - Correctly adds `this._` prefix
2. **Script-internal calls** (method-to-method) - Does NOT add `this._` prefix

This suggests the AST traversal or symbol resolution logic doesn't properly identify when a function call references a component method versus a global function.

### Likely Location:

File: `lib/codegen.js`
Function: Method body code generation / expression transformation

The compiler needs to:
1. Build a symbol table of all component methods during parsing
2. During code generation, check if a called function exists in the symbol table
3. If yes, transform the call to `this._methodName(...)`
4. If no, leave it as-is (for external/global functions)

### Comparison with Signal Handling:

Signals work correctly because they're likely tracked differently (perhaps as special AST node types). Methods need similar tracking.

## Suggested Fix

### Option 1: Symbol Table Approach (Recommended)

During the parsing phase, build a set of all method names defined in the component:

```javascript
// Pseudo-code for codegen.js
const componentMethods = new Set(['handleSearch', 'sortBy', 'generateLargeDataset', ...])

function transformCallExpression(node) {
  if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
    const methodName = node.callee.name
    
    // Check if this is a component method
    if (componentMethods.has(methodName)) {
      // Transform to this._methodName()
      return createMemberExpression(
        createThisExpression(),
        createIdentifier(`_${methodName}`)
      )
    }
  }
  
  // Otherwise, leave as-is
  return node
}
```

### Option 2: Naming Convention Enforcement

Require developers to use `this.methodName()` explicitly in source code, and have the compiler transform it to `this._methodName()`. However, this is less ergonomic and breaks the current pattern where signals work without explicit `this.`.

### Option 3: Post-Generation Patching

After generating the class methods, do a second pass to find and fix untransformed method calls. This is more complex and error-prone.

## Testing Requirements

After implementing the fix, verify:

1. **Basic method-to-method call**: One method calls another
2. **Chained method calls**: A → B → C
3. **Conditional method calls**: `if (condition) { methodA() } else { methodB() }`
4. **Method calls in callbacks**: `array.map(item => helperMethod(item))`
5. **Method calls with arguments**: `helperMethod(arg1, arg2)`
6. **Method calls in template expressions**: Should still work as before
7. **No regression**: Signal calls and event handlers continue working

Test components to verify:
- `test-large-dataset.wcc` - Remove inlined workarounds, restore method calls
- `test-error-recovery.wcc` - Restore `handleError()` calls
- Create new test: `test-method-composition.wcc` - Dedicated test for method-to-method calls

## Related Bugs

- **BUG-0016** (v0.16.23): Event handler method names generated with invalid spacing - FIXED in v0.16.24
- **BUG-0017** (v0.16.24): Internal method calls not getting `this._` prefix - THIS BUG

Both bugs affect code generation but in different areas (event handlers vs. internal method calls).

## Priority Justification

**High Priority** because:
1. Blocks fundamental JavaScript patterns (method composition, DRY principle)
2. Forces code duplication and poor maintainability
3. Affects multiple existing test components
4. No elegant workaround (inlining leads to code bloat)
5. Critical for production applications that use helper methods

However, not **Critical** because:
1. Workaround exists (inline all logic)
2. Only affects method-to-method calls, not basic functionality
3. Components can still function if written without method composition

## Additional Notes

This bug was discovered while testing the newly created edge case component `test-large-dataset.wcc`, which intentionally uses method composition to organize complex data manipulation logic. The bug prevented the component from functioning until all method calls were inlined as a workaround.

The same issue likely affects `test-error-recovery.wcc`, which has multiple error handling methods that call a common `handleError()` helper method.
