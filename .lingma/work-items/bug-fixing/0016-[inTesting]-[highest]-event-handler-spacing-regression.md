# BUG-0016: Event Handler Method Names Generated with Invalid Spacing

## Metadata
- **Status**: ✅ done
- **Priority**: [highest]
- **Reported by**: QA Team / Lingma AI Testing
- **Date reported**: 2026-05-18
- **Date moved to research**: 2026-05-18
- **Date moved to inProgress**: 2026-05-18
- **Date moved to inTesting**: 2026-05-18
- **Date moved to done**: 2026-05-18
- **Version discovered**: v0.16.23
- **Version fixed**: v0.16.24
- **Regression from**: v0.16.22 (worked correctly)
- **Severity**: Critical - Blocks all interactive functionality
- **Component**: Template Normalizer (Mustache expression trimming)
- **Related files**: 
  - `lib/template-normalizer.js` (Mustache attribute normalization with trim)
  - `lib/codegen.event-handler-spacing.test.js` (TDD tests for BUG-0016)
  - All compiled components with event directives
- **Discovered during**: Testing of new edge case components (test-error-recovery, test-nested-loops, test-large-dataset)

## Bug Summary

WCC Compiler v0.16.23 generates invalid JavaScript syntax when compiling event handlers. The compiler inserts spaces around method names in `.bind()` calls, creating syntactically invalid code that prevents components from loading and registering as custom elements.

## What Is the Problem?

When processing event directives like `@click={{ methodName }}`, the compiler generates malformed JavaScript with spaces around the method name.

### ❌ Generated Code (BROKEN - v0.16.23):
```javascript
this.__evt_click__makeUsernameNull__0.addEventListener('click', this._ makeUsernameNull .bind(this), { signal: this.__ac.signal });
```

### ✅ Should Be:
```javascript
this.__evt_click__makeUsernameNull__0.addEventListener('click', this._makeUsernameNull.bind(this), { signal: this.__ac.signal });
```

## Impact

**Severity:** BLOCKER - This bug prevents ALL components with event handlers from functioning.

### Affected Components:
- test-error-recovery.wcc: 10 broken event handlers
- test-nested-loops.wcc: 2 broken event handlers
- test-large-dataset.wcc: 6 broken event handlers
- **Total:** 18+ broken event handlers across 3 components

### Symptoms:
1. Components fail to register as custom elements
2. No DOM content rendered (innerHTML = 0 bytes)
3. `__connected` flag never set
4. Console shows syntax errors: `"missing ) after argument list"`
5. All interactive functionality completely broken
6. Components appear in DOM but are non-functional

### Console Errors:
```
[error] SyntaxError: missing ) after argument list
[error] TypeError: Cannot read properties of undefined (reading 'bind')
```

## Root Cause Analysis

The compiler's event handler code generation logic is inserting spaces around method names when generating `.bind()` calls.

**Likely Location:** `lib/codegen.js` - Event handler compilation section

**Hypothesis:** String interpolation or template literal processing is including unwanted spaces:
```javascript
// Compiler likely doing:
`this._ ${methodName} .bind(this)`  // ❌ WRONG - includes spaces

// Should be:
`this._${methodName}.bind(this)`     // ✅ CORRECT - no spaces
```

## Reproduction Steps

1. Create any component with event handlers:
```html
<button @click={{ handleClick }}>Click Me</button>
```

2. Compile with v0.16.23

3. Load component in browser

4. Observe:
   - Component doesn't render
   - Console shows syntax errors
   - Custom element not registered

## Test Components Provided

Three test components demonstrating the bug are available in:
- `src/12-edge-cases/test-error-recovery.wcc` (10 broken methods)
- `src/12-edge-cases/test-nested-loops.wcc` (2 broken methods)
- `src/12-edge-cases/test-large-dataset.wcc` (6 broken methods)

All three fail to load due to this bug.

## Expected Behavior

Event handlers should compile to valid JavaScript without spaces in method references:
```javascript
this.__evt_click__handleClick__0.addEventListener('click', this._handleClick.bind(this), { signal: this.__ac.signal });
```

## Actual Behavior

Event handlers compile to invalid JavaScript with spaces:
```javascript
this.__evt_click__handleClick__0.addEventListener('click', this._ handleClick .bind(this), { signal: this.__ac.signal });
```

## Regression Information

**This is a REGRESSION BUG.**

- v0.16.22: Event handlers worked correctly ✅
- v0.16.23: Event handlers broken ❌

Something changed in v0.16.23 that broke event handler compilation.

## Recommendations for Fix

1. Review `lib/codegen.js` event handler generation logic
2. Check string interpolation/template literal processing
3. Ensure method name concatenation doesn't include spaces
4. Add validation to verify generated JavaScript is syntactically valid
5. Add unit tests for event handler code generation
6. Consider automated syntax checking in build pipeline

## Priority Justification

**Why [highest] priority:**

1. **Blocks Basic Functionality:** Event handlers are fundamental to interactive components
2. **Widespread Impact:** Affects ANY component with `@click`, `@input`, `@change`, etc.
3. **Regression:** Previously working feature is now broken
4. **No Workaround:** Cannot use event handlers at all until fixed
5. **Production Blocker:** Prevents deployment of any interactive application

## Additional Notes

This bug was discovered while testing newly created edge case components. All three new components (test-error-recovery, test-nested-loops, test-large-dataset) fail to load entirely due to this issue.

The bug suggests a systemic problem in the compiler's code generation logic that may affect other components beyond the test cases.

## Attachments

- QA Report: `QA_TEST_REPORT_v016_23_BUG0016_REGRESSION.md`
- Screenshots:
  - `screenshot_test_12_4_error_recovery_initial.png`
  - `screenshot_test_12_4_5_6_not_rendering.png`
- Test Components:
  - `src/12-edge-cases/test-error-recovery.wcc`
  - `src/12-edge-cases/test-nested-loops.wcc`
  - `src/12-edge-cases/test-large-dataset.wcc`

---

## Resolution

**Status**: ✅ RESOLVED in v0.16.24  
**Resolved by**: Template Normalizer Enhancement (Mustache expression trimming)  
**QA Verified**: YES - Confirmed fixed by QA Team on 2026-05-18  

### Solution Summary:

BUG-0016 was a critical regression bug introduced in v0.16.23 that caused the compiler to generate invalid JavaScript syntax for event handlers. The template normalizer was capturing whitespace around Mustache expressions, resulting in malformed code like `this._ handleClick .bind(this)` instead of `this._handleClick.bind(this)`.

### Root Cause:

The regex patterns in `lib/template-normalizer.js` were extracting Mustache expressions without trimming whitespace:
```javascript
// BEFORE (broken):
html = html.replace(/\b([\w:-]+)\s*=\s*"\{\{([^}]+)\}\}"/g, '$1="$2"');
// Captures " handleClick " with spaces
```

### Fix Implemented:

Added `.trim()` to both Mustache expression extraction patterns:
```javascript
// AFTER (fixed):
html = html.replace(/\b([\w:-]+)\s*=\s*"\{\{([^}]+)\}\}"/g, (match, attrName, expr) => {
  return `${attrName}="${expr.trim()}"`;
});
```

This ensures all whitespace is removed from extracted expressions before HTML parsing.

### Test Coverage:

**TDD Tests Added** (lib/codegen.event-handler-spacing.test.js):
- ✅ Simple event handler method names (no spaces)
- ✅ Event handlers with function calls
- ✅ Event handlers in loops
- ✅ Multiple event types (@input, @click)
- ✅ Arrow function event handlers

**Total Tests**: 5 new tests, all passing  
**Full Test Suite**: 113/113 files passing (no regressions)

### Verification Results:

✅ No spaces in generated event handler method names  
✅ Valid JavaScript syntax: `this._handleClick.bind(this)`  
✅ All interactive functionality restored  
✅ Components register correctly as custom elements  
✅ DOM content renders properly  
✅ Console shows no syntax errors  

### Files Modified:

- `lib/template-normalizer.js` - Added .trim() to Mustache expression extraction (2 patterns)
- `lib/codegen.event-handler-spacing.test.js` - Added 5 comprehensive TDD tests
- `package.json` - Version bumped to 0.16.24

### Impact:

This fix resolves a critical blocker that prevented ALL components with event handlers from functioning. The regression affected any component using `@click`, `@input`, `@change`, or other event directives.

---

**Report Generated**: 2026-05-18  
**Discovered By**: Lingma AI QA Team  
**Ready for Dev**: ✅ YES  
**Resolved**: 2026-05-18 in v0.16.24  
**QA Verified**: 2026-05-18 - Confirmed fixed
