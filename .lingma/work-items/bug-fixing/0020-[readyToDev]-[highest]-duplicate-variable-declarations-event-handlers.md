# BUG-0020: Duplicate Variable Declarations in Event Handlers (v0.16.30)

**Date:** 2026-05-19  
**Version Tested:** v0.16.30  
**Status:** 🧪 inTesting - Fix implemented, awaiting QA verification  
**Priority:** [highest]  
**Component:** lib/codegen.js (event handler variable generation)  
**Discovered during:** Testing BUG-0019 fix in v0.16.30  

---

## 🚨 Executive Summary

WCC Compiler v0.16.30 introduces a **CRITICAL SYNTAX ERROR** when generating event handlers inside loops. The compiler creates multiple `const __evt_target__` declarations in the same scope, which violates JavaScript syntax rules and causes complete module execution failure.

**Impact:** Components with multiple event handlers in loops **DO NOT RENDER AT ALL**.

---

## 🔍 Bug Details

### What Happens:

When a component has multiple event handlers within a loop (e.g., nested loops), the code generator creates duplicate `const` variable declarations:

```javascript
// Generated code (BROKEN):
category.items.forEach((item, __idx) => {
  const __key = item.id;
  const clone = template.content.cloneNode(true);
  const node = clone.firstChild;
  
  // First event handler
  const __evt_target__ = node.childNodes[3];  // Line 368
  if (__evt_target__) __evt_target__.addEventListener('click', () => { this._toggleCategory(category.id); });
  
  // Second event handler - DUPLICATE DECLARATION!
  const __evt_target__ = node.childNodes[3].childNodes[3].childNodes[3];  // Line 370 ❌
  if (__evt_target__) __evt_target__.addEventListener('click', () => { this._selectAllInCategory(category.id); });
  
  // Third event handler - ANOTHER DUPLICATE!
  const __evt_target__ = node.childNodes[3].childNodes[3].childNodes[5];  // Line 372 ❌
  if (__evt_target__) __evt_target__.addEventListener('click', () => { this._removeCategory(category.id); });
});
```

### Why It Fails:

JavaScript does not allow redeclaring a `const` variable in the same scope. This causes a **SyntaxError** at module load time:

```
SyntaxError: Identifier '__evt_target__' has already been declared
    at test-nested-loops.js:370:11
```

This prevents the entire module from executing, so the component never registers or renders.

---

## 📁 Source File for Reproduction

**File:** `c:\projects\wcc-test\src\12-edge-cases\test-nested-loops.wcc`

**Relevant template section:**
```html
<div each="category in categories()" key={category.id}>
  <div class="category-header" @click={{ toggleCategory(category.id) }}>
    <!-- ... -->
    <button class="success" @click={{ selectAllInCategory(category.id) }}>Select</button>
    <button class="danger" @click={{ removeCategory(category.id) }}>Remove</button>
  </div>
  
  <div if={{ category.expanded }} class="items-container">
    <!-- Inner loop with more event handlers -->
  </div>
</div>
```

**Three event handlers in the same loop iteration** → triggers the bug.

---

## 🧪 Testing Results

### Test Component: test-nested-loops.wcc

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Module loads | No errors | SyntaxError: duplicate declaration | ❌ FAIL |
| Component registers | Custom element defined | `undefined` | ❌ FAIL |
| Categories render | 3 headers visible | 0 elements | ❌ FAIL |
| Items render | Items on expand | N/A (component broken) | ❌ FAIL |
| Console errors | None | Multiple SyntaxErrors | ❌ FAIL |

### Browser Console Errors Captured:

```
msgid=8: Identifier '__evt_target__' has already been declared
msgid=9: Identifier '__evt_target__' has already been declared
msgid=11: Identifier '__evt_target__' has already been declared
msgid=3,4,6,7,10: [wcc] Effect error
msgid=5: Cannot read properties of undefined (reading 'bind')
```

### DOM State After Load:

```javascript
{
  componentFound: true,           // Element exists in HTML
  hasShadowRoot: false,           // No shadow DOM created
  lightDOMChildren: 0,            // Zero children
  innerHTML: "",                  // Empty
  totalElements: 0,               // Nothing rendered
  hasCategoryHeaders: 0,          // No categories
  hasItemsContainer: 0,           // No containers
  hasItemRows: 0                  // No items
}
```

**Result:** Component is completely non-functional.

---

## 🔬 Code Analysis

### Generated Code Location:

**File:** `c:\projects\wcc-test\dist\12-edge-cases\test-nested-loops.js`

**Lines 368-373 (if block):**
```javascript
const __evt_target__ = node.childNodes[3];
if (__evt_target__) __evt_target__.addEventListener('click', () => { this._toggleCategory(category.id); });
const __evt_target__ = node.childNodes[3].childNodes[3].childNodes[3];  // ❌ DUPLICATE
if (__evt_target__) __evt_target__.addEventListener('click', () => { this._selectAllInCategory(category.id); });
const __evt_target__ = node.childNodes[3].childNodes[3].childNodes[5];  // ❌ DUPLICATE
if (__evt_target__) __evt_target__.addEventListener('click', () => { this._removeCategory(category.id); });
```

**Lines 438-443 (else block):**
```javascript
const __evt_target__ = node.childNodes[3];
if (__evt_target__) __evt_target__.addEventListener('click', () => { this._toggleCategory(category.id); });
const __evt_target__ = node.childNodes[3].childNodes[3].childNodes[3];  // ❌ DUPLICATE
if (__evt_target__) __evt_target__.addEventListener('click', () => { this._selectAllInCategory(category.id); });
const __evt_target__ = node.childNodes[3].childNodes[3].childNodes[5];  // ❌ DUPLICATE
if (__evt_target__) __evt_target__.addEventListener('click', () => { this._removeCategory(category.id); });
```

**Total duplicate declarations:** 6 (3 per block × 2 blocks)

---

## 💡 Root Cause

The code generator in `lib/codegen.js` uses a fixed variable name `__evt_target__` for all event handler targets without considering that multiple handlers may exist in the same scope.

**Likely problematic code pattern:**
```javascript
// In lib/codegen.js (hypothetical):
result += `const __evt_target__ = ${targetExpression};\n`;
result += `if (__evt_target__) __evt_target__.addEventListener('${event}', ${handler});\n`;
```

This works fine for a single event handler, but fails when there are multiple handlers in the same loop iteration or scope.

---

## ✅ Required Fix

### Option A: Unique Variable Names (Recommended)

Generate unique variable names for each event handler using a counter:

```javascript
// Fixed code generation:
let evtCounter = 0;

// For each event handler:
const varName = `__evt_target_${evtCounter++}__`;
result += `const ${varName} = ${targetExpression};\n`;
result += `if (${varName}) ${varName}.addEventListener('${event}', ${handler});\n`;
```

**Generated output:**
```javascript
const __evt_target_0__ = node.childNodes[3];
if (__evt_target_0__) __evt_target_0__.addEventListener('click', () => { this._toggleCategory(category.id); });

const __evt_target_1__ = node.childNodes[3].childNodes[3].childNodes[3];
if (__evt_target_1__) __evt_target_1__.addEventListener('click', () => { this._selectAllInCategory(category.id); });

const __evt_target_2__ = node.childNodes[3].childNodes[3].childNodes[5];
if (__evt_target_2__) __evt_target_2__.addEventListener('click', () => { this._removeCategory(category.id); });
```

### Option B: Reuse Single Variable

Reuse the same variable without redeclaration:

```javascript
// Fixed code generation:
result += `let __evt_target__;\n`;  // Declare once at top of scope

// For each event handler:
result += `__evt_target__ = ${targetExpression};\n`;
result += `if (__evt_target__) __evt_target__.addEventListener('${event}', ${handler});\n`;
```

**Generated output:**
```javascript
let __evt_target__;

__evt_target__ = node.childNodes[3];
if (__evt_target__) __evt_target__.addEventListener('click', () => { this._toggleCategory(category.id); });

__evt_target__ = node.childNodes[3].childNodes[3].childNodes[3];
if (__evt_target__) __evt_target__.addEventListener('click', () => { this._selectAllInCategory(category.id); });

__evt_target__ = node.childNodes[3].childNodes[3].childNodes[5];
if (__evt_target__) __evt_target__.addEventListener('click', () => { this._removeCategory(category.id); });
```

### Option C: Inline Without Variable

Skip the temporary variable entirely:

```javascript
// Fixed code generation:
result += `if (${targetExpression}) ${targetExpression}.addEventListener('${event}', ${handler});\n`;
```

**Generated output:**
```javascript
if (node.childNodes[3]) node.childNodes[3].addEventListener('click', () => { this._toggleCategory(category.id); });
if (node.childNodes[3].childNodes[3].childNodes[3]) node.childNodes[3].childNodes[3].childNodes[3].addEventListener('click', () => { this._selectAllInCategory(category.id); });
if (node.childNodes[3].childNodes[3].childNodes[5]) node.childNodes[3].childNodes[3].childNodes[5].addEventListener('click', () => { this._removeCategory(category.id); });
```

**Recommendation:** **Option A** (unique names) is safest and clearest. **Option C** (inline) is most concise but may be less readable.

---

## 📊 Impact Assessment

### Affected Components:

Any component with **multiple event handlers in the same loop** will fail to render.

**Known affected components in test suite:**
1. ❌ `test-nested-loops.wcc` - 3 handlers per category
2. ❌ `test-kitchen-sink.wcc` - Likely has multiple handlers
3. ⚠️ Any user component with similar patterns

### Severity:

🔴 **CRITICAL** - This is a regression that makes previously working components completely unusable.

---

## 🎯 Acceptance Criteria

For BUG-0020 to be considered fixed:

1. ✅ No duplicate variable declarations in generated code
2. ✅ `test-nested-loops.wcc` compiles without syntax errors
3. ✅ Component registers as custom element
4. ✅ Categories render initially
5. ✅ Items render when category expanded
6. ✅ All event handlers work correctly
7. ✅ No console errors during normal operation
8. ✅ Existing tests still pass (no regressions)

---

## 📝 Related Bugs

- **BUG-0019** - Nested loop structure issues (partially related, but this is a new critical issue)
- **BUG-0018** - Ternary handling (blocked by this bug since component doesn't load)

---

## 🔗 Files for Investigation

1. **Source:** `c:\projects\wcc-test\src\12-edge-cases\test-nested-loops.wcc`
2. **Generated:** `c:\projects\wcc-test\dist\12-edge-cases\test-nested-loops.js` (lines 368-373, 438-443)
3. **Compiler:** `lib/codegen.js` (event handler generation logic)

---

## 📸 Screenshots

Browser Agent captured these screenshots showing the failure:

1. [screenshot_bug_0019_v016_30_initial_state.png](c:\projects\wcc-test\screenshot_bug_0019_v016_30_initial_state.png) - Page loads but component area is empty
2. [screenshot_bug_0019_v016_30_test12_5_empty.png](c:\projects\wcc-test\screenshot_bug_0019_v016_30_test12_5_empty.png) - Test 12.5 section has no content
3. [screenshot_bug_0019_v016_30_console_errors.png](c:\projects\wcc-test\screenshot_bug_0019_v016_30_console_errors.png) - Console showing SyntaxErrors

---

## 🚀 Next Steps

1. ✅ Dev team identified event handler generation code in `lib/codegen.js`
2. ✅ Implemented Option A (unique variable names with counters)
3. ✅ Added TDD tests to verify unique naming pattern
4. ⏳ Publish as v0.16.31
5. ⏳ QA re-tests with clean reinstall

**Priority:** URGENT - This blocks all components with multiple event handlers in loops.

---

## ✅ Resolution

**Fixed in:** v0.16.31  
**Fix Approach:** Option A - Unique variable names with counters  
**Implementation Details:**

- Modified `generateItemSetup()` function to use `__evt_counter` and `__model_counter`
- Modified `generateNestedItemSetup()` function to use separate counters
- Generated variable names: `__evt_target_0__`, `__evt_target_1__`, `__evt_target_2__`, etc.
- Prevents duplicate const declarations in same scope
- All existing tests pass (1096/1097 passing)
- No regressions introduced

**Files Modified:**
- `lib/codegen.js` - Lines 623-628, 658-679, 1032-1037, 1068-1089
- `lib/codegen.event-handler-null-checks.test.js` - Updated test expectations for new naming pattern

**Testing:**
- Unit tests updated to match new naming pattern
- Verified generated code has unique variable names
- Full test suite: 1096/1097 passing (1 pre-existing Angular failure)
