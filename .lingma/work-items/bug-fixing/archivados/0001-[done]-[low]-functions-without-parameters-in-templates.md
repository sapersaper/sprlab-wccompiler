# BUG-0001: Functions Without Parameters Don't Work in Templates

## Metadata
- **Status**: ✅ done
- **Priority**: 🔽 `low`
- **Reported by**: Dev Team / Lingma AI Testing
- **Date reported**: 2026-05-13
- **Date resolved**: 2026-05-14
- **Severity**: Medium (documentation + validation)
- **Component**: parser-extractors.js, parser.js, compiler.js
- **Related files**: 
  - `lib/parser-extractors.js` (validateNameCollisions function)
  - `lib/parser.js` (validation integration)
  - `lib/compiler.js` (validation integration)
  - `lib/parser-extractors.validateNameCollisions.test.js` (15 tests)
  - `example/src/bug-0001-functions-without-parameters-in-templates/` (test suite)

## Description
Functions without parameters can be defined in the script block and work correctly in methods/event handlers. However, calling them directly in template interpolations `{{ func() }}` may not work as expected due to how the compiler transforms expressions.

**Important**: Functions DO work when they don't collide with signal/computed/prop names.

## Steps to Reproduce

### Case 1: Function WITHOUT name collision (SHOULD WORK)
1. Create a component with a parameterless function that doesn't collide:
   ```html
   <script>
   const count = signal(0)
   
   function getGreeting() {
     return 'Hello World'
   }
   </script>
   
   <template>
     <div>{{ getGreeting() }}</div>
   </template>
   ```

2. Compile and run
3. Expected: Should display "Hello World"

### Case 2: Function WITH name collision (WILL FAIL)
1. Create a component where function name collides with signal:
   ```html
   <script>
   const greeting = signal('Hello')  // ← Signal named "greeting"
   function greeting() {              // ← ERROR: Can't have function with same name
     return 'Hi'
   }
   </script>
   
   <template>
     <div>{{ greeting() }}</div>  // ← Ambiguous: signal or function?
   </template>
   ```

2. Compile
3. Observe: JavaScript error - duplicate identifier

## Expected Behavior
Functions should be callable in templates when they don't collide with reactive variable names:

```javascript
// Generated code should transform:
this._getGreeting() // Calls user-defined method
```

The compiler already extracts user functions via `extractFunctions()` and generates wrapper methods (`this._methodName`).

## Actual Behavior

### When there's NO collision:
✅ Functions work correctly - the compiler transforms `getGreeting()` → `this._getGreeting()`

### When there IS a collision:
❌ JavaScript throws error: "Identifier 'greeting' has already been declared"

This is a fundamental JavaScript limitation - you cannot have a variable and function with the same name in the same scope.

## Environment
- **wcCompiler version**: v0.13.0
- **Node version**: v18.x.x
- **Browser**: Chrome/Firefox (any modern browser)
- **OS**: Windows 11

## Root Cause Analysis

This is NOT actually a bug in the compiler. It's a **JavaScript language limitation**:

```javascript
// ❌ INVALID JavaScript - duplicate identifier
const greeting = signal('Hello')
function greeting() { return 'Hi' } // ERROR!

// ✅ VALID JavaScript - different names
const greeting = signal('Hello')
function getGreeting() { return greeting() } // OK
```

The WCC Compiler correctly:
1. Extracts user functions via `extractFunctions()` in parser-extractors.js
2. Generates wrapper methods: `this._methodName(...)`
3. Transforms template calls: `methodName()` → `this._methodName()`

The issue occurs when users try to use the same name for both a signal and a function, which is invalid JavaScript regardless of the framework.

## Proposed Solution

### Option 1: Documentation Only (Recommended) ✅

Document this as a known limitation with clear guidance:

**Add to README.md:**

```markdown
### ⚠️ Naming Collisions

You cannot define functions with the same name as signals, props, or computed values:

```javascript
// ❌ WRONG - Duplicate identifier error
const greeting = signal('Hello')
function greeting() { return 'Hi' }

// ✅ CORRECT - Use different names
const greeting = signal('Hello')
function getGreeting() { return greeting() }

// ✅ BETTER - Use computed for derived values
const greeting = signal('Hello')
const displayGreeting = computed(() => greeting().toUpperCase())
```

**Best Practices:**
- For simple formatting: Use functions with unique names
- For derived state: Use `computed()` (recommended)
- For event handlers: Use methods normally
```

### Option 2: Add Collision Detection (Future Enhancement)

Add compile-time validation to detect and report collisions with helpful error messages:

```javascript
// During parsing, check if any function name matches:
// - signal names
// - computed names  
// - prop names
// - constant names

if (collisionDetected) {
  throw new Error(
    `Name collision: '${name}' is already defined as a ${collisionType}.\n` +
    `Solution: Rename your function or use computed instead.`
  );
}
```

## Workaround
Use one of these approaches:

### Approach 1: Different Names
```html
<script>
const greeting = signal('Hello')
function getGreeting() { return greeting() }
</script>

<template>
  <div>{{ getGreeting() }}</div>
</template>
```

### Approach 2: Use Computed (Recommended)
```html
<script>
const greeting = signal('Hello')
const displayGreeting = computed(() => greeting().toUpperCase())
</script>

<template>
  <div>{{ displayGreeting() }}</div>
</template>
```

### Approach 3: Inline Expression
```html
<script>
const firstName = signal('John')
const lastName = signal('Doe')
</script>

<template>
  <div>{{ firstName() + ' ' + lastName() }}</div>
</template>
```

## Impact Assessment
- **User Impact**: Medium - Confusion about naming, but workaround is straightforward
- **Frequency**: When users try to reuse signal names as function names
- **Workaround**: Available and simple (use different names or computed)
- **Affected Components**: Components with helper functions that share names with reactive state
- **Note**: This is a JavaScript language constraint, not a compiler bug

## Additional Context

### How WCC Compiler Handles User Functions

1. **Extraction**: Parser extracts functions via `extractFunctions()` in `lib/parser-extractors.js`
2. **Generation**: Codegen creates wrapper methods: `this._methodName(...args) { return this.methodName(...args); }`
3. **Transformation**: Template expressions transform `methodName()` → `this._methodName()`

### Why This Limitation Exists

All major frameworks have similar constraints:
- **Vue.js**: Recommends `computed` over methods for derived values
- **React**: Hooks must have stable names, can't be conditional
- **Angular**: Change detection runs methods on every cycle (performance concern)

The root cause is JavaScript's scoping rules, not framework design.

### Testing Verification

According to the testing report, functions WITHOUT collisions work correctly:
- Event handlers: ✅ Working
- Methods in templates: ✅ Working (when no collision)
- Parameterless functions: ✅ Working (when no collision)

Discovered during Phase 1 testing (Basics). This is better documented as a best practice rather than treated as a bug.

## Resolution

### What Was Fixed
The compiler now includes **early validation** to detect name collisions between signals/computed/props and functions. This prevents confusing runtime errors by catching the issue at compile time with clear, actionable error messages.

### Implementation
1. **Added `validateNameCollisions()` function** in `lib/parser-extractors.js`
   - Checks for collisions between signals, computeds, props, and methods
   - Detects duplicate function names
   - Provides helpful error messages in Spanish with suggested solutions

2. **Integrated validation** into both compilation paths:
   - `lib/parser.js` (line 247) - SFC parsing
   - `lib/compiler.js` (line 207) - Standalone compilation

3. **Created comprehensive test suite**:
   - 15 unit tests in `lib/parser-extractors.validateNameCollisions.test.js`
   - All tests passing ✅
   - Integration test components in `example/src/bug-0001-functions-without-parameters-in-templates/`

### Error Messages
When a collision is detected, the compiler shows:
```
Error en 'component.wcc': Colisión de nombres - 'greeting' está definido como signal y function.
Solución: Usa un nombre diferente para la función (ej: getGreeting) o convierte el signal a una función.
```

### Test Results
- **Test Case 1 (No Collision)**: ✅ Functions work perfectly when names don't collide
- **Test Case 2 (With Collision)**: ✅ Compiler rejects with clear error message
- **All existing tests**: ✅ 980 tests passing (no regressions)

### Key Findings
The original issue was **NOT a bug** - functions without parameters work correctly in templates. The real need was **better developer experience** through early validation and clear error messages, which has now been implemented.

---

*Created from testing report dated 2026-05-13*
*Archived on 2026-05-14 after QA verification*
