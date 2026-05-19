# BUG-0019 - QA Testing Materials for Dev Team Investigation

**Date:** 2026-05-19  
**Version Tested:** v0.16.28  
**Status:** Code generation fixed, runtime errors persist  
**Purpose:** Provide complete information for dev team to debug runtime issues

---

## 📁 Component Source File

**Location:** `c:\projects\wcc-test\src\12-edge-cases\test-nested-loops.wcc`

The complete source file is available in the testing repository. Key structure:

```javascript
// Signals
const categories = signal([...]) // 3 categories with nested items
const selectedItems = signal([])
const totalValue = signal(0)
const itemCount = signal(0)

// Methods
function toggleCategory(categoryId) { ... }
function toggleItemSelection(itemId, price) { ... }
function selectAllInCategory(categoryId) { ... }
function clearSelections() { ... }
function addNewCategory() { ... }
function removeCategory(categoryId) { ... }
function deleteSelected() { ... }
```

**Template Structure:**
```html
<div class="nested-loops">
  <!-- Stats display -->
  <div class="stats">...</div>
  
  <!-- Action buttons -->
  <button @click={{ addNewCategory }}>Add New Category</button>
  <button @click={{ clearSelections }}>Clear All Selections</button>
  
  <!-- Outer loop: categories -->
  <div each="category in categories()" key={{ category.id }}>
    <div @click={{ () => toggleCategory(category.id) }} 
         :class={{ expanded: category.expanded }}>
      {{ category.name }} ({{ category.items.length }} items)
    </div>
    
    <!-- Conditional: show items only when expanded -->
    <div if={{ category.expanded }} class="items-container">
      <!-- Inner loop: items -->
      <div each="item in category.items" key={{ item.id }}
           :class={{ selected: selectedItems().includes(item.id), 
                     'out-of-stock': !item.inStock }}>
        
        <div class="item-info">
          <div class="item-name">
            {{ item.name }}
            <span :class={{ 'in-stock': item.inStock, 'out-of-stock': !item.inStock }}>
              {{ item.inStock ? '✓ In Stock' : '✗ Out of Stock' }}
            </span>
          </div>
          <div class="item-price">${{ item.price.toFixed(2) }}</div>
        </div>
        
        <button @click={{ () => toggleItemSelection(item.id, item.price) }}>
          Select
        </button>
      </div>
    </div>
  </div>
</div>
```

---

## 🔍 Generated Code Analysis

**Location:** `c:\projects\wcc-test\dist\12-edge-cases\test-nested-loops.js`

### ✅ What's Correct:

**Lines 380-426: Inner loop properly scoped inside conditional**
```javascript
if (__if0_branch !== null) {
  // Insert conditional wrapper
  const __if0_tpl = [__if0_t0][__if0_branch];
  const __if0_clone = __if0_tpl.content.cloneNode(true);
  const __if0_node = __if0_clone.firstChild;
  __if0_anchor.parentNode.insertBefore(__if0_node, __if0_anchor);
  
  // Inner loop INSIDE scope - uses SAFE anchor
  const __for0_tpl = document.createElement('template');
  __for0_tpl.innerHTML = `<div class="item-row">...</div>`;
  const __for0_anchor = __if0_node.childNodes[7].childNodes[1]; // ✅ Safe!
  const __for0_source = category.items;
  const __for0_iter = typeof __for0_source === 'number'
    ? Array.from({ length: __for0_source }, (_, i) => i + 1)
    : (__for0_source || []);
  const __for0_newNodes = [];
  __for0_iter.forEach((item, __idx) => {
    // Create and setup item nodes
    __for0_newNodes.push(innerNode);
  });
  for (const n of __for0_newNodes) { 
    __for0_anchor.parentNode.insertBefore(n, __for0_anchor); 
  }
} // ← Inner loop NEVER executes when conditional is false
```

This matches the recommended "Option A" fix perfectly. The scoping is correct.

### ❌ Runtime Issues:

Despite correct code generation, the following errors occur at runtime:

---

## 🐛 Runtime Errors Observed

### Error 1: Effect Errors
```
[wcc] Effect error
[wcc] Effect error
[wcc] Effect error
... (8+ occurrences)
```

**Frequency:** Multiple times on initial load  
**Source:** Signal system catching effect execution failures  
**Impact:** Effects are permanently disabled after first error

### Error 2: Bind Error
```
Cannot read properties of undefined (reading 'bind')
```

**Note:** No `.bind(this)` found in generated code for this component  
**Hypothesis:** Error comes from signals/effects system internals  
**Stack trace:** Not captured (need browser console screenshot)

---

## 📊 Test Results Summary

| Test Scenario | Expected Behavior | Actual Behavior | Status |
|---------------|------------------|-----------------|--------|
| Initial render | 3 categories visible | ✅ 3 categories visible | ✅ PASS |
| Items visible initially | Items hidden (collapsed) | ✅ No items visible | ✅ PASS |
| Click category to expand | Items appear in container | ❌ Category disappears | ❌ FAIL |
| Click again to collapse | Items hide | ❌ Cannot test (already gone) | ❌ FAIL |
| Stock status text | "✓ In Stock" / "✗ Out of Stock" | ❌ Never visible | ❌ FAIL |
| Select item button | Item becomes selected | ❌ Cannot click (no items) | ❌ FAIL |
| Add new category | New category appears | ⚠️ Stats update but no visual | ⚠️ PARTIAL |
| Console errors | Clean or minimal | ❌ 8+ effect errors | ❌ FAIL |

---

## 🎯 Key Observations

### 1. Categories Render Initially ✅
- Unlike v0.16.26/27 where nothing rendered
- Shows outer loop works correctly
- Scoping fix helped with initial rendering

### 2. Items NEVER Render ❌
- Even when category should be expanded
- Inner loop effects failing silently
- No items-container div ever appears in DOM

### 3. Clicking Makes Category Disappear ❌
- Instead of expanding to show items
- Suggests effect execution corrupting DOM state
- Possible DOM manipulation conflict between effects

### 4. No `.bind(this)` in Generated Code
- All event handlers use arrow functions: `() => { this._toggleCategory(...) }`
- Error message suggests issue in signals/effects system internals
- Not in component-generated code

---

## 🔬 Debugging Information Needed

To help dev team investigate, we need:

### 1. Browser Console Full Stack Trace
**Action Required:** Open browser console, reproduce error, capture full stack trace

Expected format:
```
Cannot read properties of undefined (reading 'bind')
    at <function_name> (<file>:<line>:<column>)
    at <caller_function> (<file>:<line>:<column>)
    ...
```

### 2. DOM State Before/After Click
**Action Required:** Inspect DOM before and after clicking category

Check:
- Does category node exist after click?
- Are there any orphaned nodes?
- Is the comment anchor (`<!-- if -->`) still present?
- What does `node.childNodes[7]` contain after click?

### 3. Effect Execution Log
**Suggested debugging code to add:**
```javascript
// In generated code, add logging:
console.log('Creating outer loop effect for category:', category.id);
this.__disposers.push(__effect(() => {
  console.log('Outer effect executing, category:', category.id);
  console.log('__if0_branch:', __if0_branch);
  console.log('__if0_anchor:', __if0_anchor);
  
  if (__if0_branch !== null) {
    console.log('Conditional true, inserting wrapper');
    const __if0_node = __if0_clone.firstChild;
    console.log('__if0_node:', __if0_node);
    __if0_anchor.parentNode.insertBefore(__if0_node, __if0_anchor);
    
    console.log('Setting up inner loop');
    const __for0_anchor = __if0_node.childNodes[7]?.childNodes[1];
    console.log('__for0_anchor:', __for0_anchor);
    
    if (!__for0_anchor) {
      console.error('ANCHOR NOT FOUND! __if0_node.childNodes[7]:', __if0_node.childNodes[7]);
      return;
    }
    
    // Continue with inner loop...
  }
}));
```

### 4. Signal State Verification
**Check:**
- Does `categories()` signal contain correct data after click?
- Does `category.expanded` change from false to true?
- Do other components react to signal changes?

---

## 💡 Hypotheses to Investigate

### Hypothesis 1: Effect Execution Timing
**Theory:** Inner effects execute before DOM nodes are fully inserted

**Test:** Add delay or check DOM readiness before setting up inner effects

**Code to test:**
```javascript
if (__if0_branch !== null) {
  const __if0_node = __if0_clone.firstChild;
  __if0_anchor.parentNode.insertBefore(__if0_node, __if0_anchor);
  
  // Verify DOM is ready
  setTimeout(() => {
    const __for0_anchor = __if0_node.childNodes[7]?.childNodes[1];
    if (__for0_anchor) {
      // Execute inner loop
    } else {
      console.error('DOM not ready');
    }
  }, 0);
}
```

### Hypothesis 2: Comment Node Structure
**Theory:** `<!-- each -->` comment doesn't have expected child structure

**Test:** Check what `__if0_node.childNodes[7]` actually contains

**Debug code:**
```javascript
console.log('__if0_node:', __if0_node);
console.log('__if0_node.childNodes:', __if0_node.childNodes);
console.log('__if0_node.childNodes.length:', __if0_node.childNodes.length);
for (let i = 0; i < __if0_node.childNodes.length; i++) {
  console.log(`child[${i}]:`, __if0_node.childNodes[i], 
              'type:', __if0_node.childNodes[i].nodeType,
              'name:', __if0_node.childNodes[i].nodeName);
}
```

### Hypothesis 3: Effect Disposal Conflict
**Theory:** When category expands/collapses, old effects aren't disposed properly

**Test:** Track effect creation/disposal

**Debug code:**
```javascript
const disposer = __effect(() => {
  console.log('Effect running for category:', category.id);
});
console.log('Effect created, disposer:', disposer);
this.__disposers.push(disposer);
```

### Hypothesis 4: Signal Reactivity in Nested Context
**Theory:** Nested signals don't track dependencies correctly

**Test:** Verify signal updates trigger re-renders

**Debug code:**
```javascript
__effect(() => {
  const cats = this._categories();
  console.log('Categories signal updated, count:', cats.length);
  cats.forEach((cat, idx) => {
    console.log(`Category ${idx}:`, cat.id, 'expanded:', cat.expanded);
  });
});
```

---

## 📋 Minimal Reproduction Case

If the full component is too complex, here's a minimal test case:

```html
<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-minimal-nested',
})

const items = signal([
  { id: 1, name: 'Item 1', expanded: false, children: [
    { id: 11, name: 'Child 1.1' },
    { id: 12, name: 'Child 1.2' }
  ]},
  { id: 2, name: 'Item 2', expanded: false, children: [
    { id: 21, name: 'Child 2.1' },
    { id: 22, name: 'Child 2.2' }
  ]}
])

function toggle(id) {
  items.set(items().map(item => 
    item.id === id ? { ...item, expanded: !item.expanded } : item
  ))
}
</script>

<template>
  <div>
    <div each="item in items()" key={{ item.id }}>
      <div @click={{ () => toggle(item.id) }}>
        {{ item.name }} (expanded: {{ item.expanded }})
      </div>
      
      <div if={{ item.expanded }}>
        <div each="child in item.children" key={{ child.id }}>
          - {{ child.name }}
        </div>
      </div>
    </div>
  </div>
</template>
```

This isolates the core nested loop + conditional pattern without extra complexity.

---

## 🎯 Recommended Investigation Steps

### Step 1: Capture Full Error Details
1. Open browser console
2. Clear console
3. Reload page
4. Click on a category
5. Copy full error messages with stack traces
6. Take screenshot of console

### Step 2: Inspect DOM State
1. Right-click on a category → "Inspect Element"
2. Note the DOM structure before clicking
3. Click the category
4. Observe what happens to DOM
5. Check if category node still exists
6. Check if items-container was created

### Step 3: Add Debug Logging
Modify generated code temporarily to add console.log statements (see examples above)

### Step 4: Test Minimal Case
Create and test the minimal reproduction case to isolate the issue

### Step 5: Check reactive-runtime.js
If issue persists, problem may be in:
- `lib/reactive-runtime.js` - Effect execution logic
- `lib/signals.js` - Signal dependency tracking
- Effect disposal/re-creation mechanism

---

## 📞 Contact Information

**QA Tester:** Lingma AI + Browser Agent  
**Testing Environment:** 
- OS: Windows 22H2
- Browser: Chromium (via Playwright)
- Server: http://localhost:4100
- Version: @sprlab/wccompiler@0.16.28

**Files Available:**
- Source: `c:\projects\wcc-test\src\12-edge-cases\test-nested-loops.wcc`
- Generated: `c:\projects\wcc-test\dist\12-edge-cases\test-nested-loops.js`
- Screenshots: `c:\projects\wcc-test\screenshot_bug_0019_v016_28_*.png`

---

## ⚠️ CRITICAL: Information Still Needed from QA

To complete the investigation and fix BUG-0019 runtime issues, **dev team needs the following from QA**:

### 1. Complete Source File: `test-nested-loops.wcc` ❗ REQUIRED

**Current Status:** Document only has partial structure/template
**Needed:** The COMPLETE file with all imports, signals, methods, and template

**Why:** Dev team cannot reproduce the exact error without compiling the actual component.

**Action for QA:** Please provide the full content of `c:\projects\wcc-test\src\12-edge-cases\test-nested-loops.wcc`

---

### 2. Full Stack Traces from Browser Console ❗ REQUIRED

**Current Status:** Only error messages captured, no stack traces
**Needed:** Complete error output with file names, line numbers, and call stacks

**Example format needed:**
```
Cannot read properties of undefined (reading 'bind')
    at <function_name> (test-nested-loops.js:123:45)
    at Effect.run (reactive-runtime.js:67:12)
    at Signal.notify (signals.js:89:8)
    ...
```

**Why:** Stack trace will show exactly WHERE the `.bind()` call is happening and what's undefined.

**Action for QA:** 
1. Open browser console
2. Clear console
3. Reload page
4. Click on a category to trigger error
5. Copy FULL error message including stack trace
6. Paste here or attach as text file

---

### 3. Browser Console Screenshots ❗ HIGHLY RECOMMENDED

**Current Status:** Screenshots mentioned but not included in this document
**Needed:** Visual evidence of:
- All "[wcc] Effect error" messages with timestamps
- DOM state before/after clicking category
- Any other errors or warnings visible

**Action for QA:** Please share screenshots from `c:\projects\wcc-test\screenshot_bug_0019_v016_28_*.png`

---

### 4. Debug Logging Output (if attempted) ❗ HELPFUL

**Current Status:** Unknown if QA tried the suggested debug logging
**Needed:** Console output from adding logging statements to generated code

**Suggested logging to add:**
```javascript
// In generated code around line 380-426:
console.log('Creating outer loop effect for category:', category.id);
this.__disposers.push(__effect(() => {
  console.log('Outer effect executing, category:', category.id);
  console.log('__if0_branch:', __if0_branch);
  console.log('__if0_anchor exists?', !!__if0_anchor);
  
  if (__if0_branch !== null) {
    console.log('Conditional true, inserting wrapper');
    const __if0_node = __if0_clone.firstChild;
    console.log('__if0_node exists?', !!__if0_node);
    
    const __for0_anchor = __if0_node.childNodes[7]?.childNodes[1];
    console.log('__for0_anchor exists?', !!__for0_anchor);
    
    if (!__for0_anchor) {
      console.error('ANCHOR NOT FOUND!');
      console.log('__if0_node.childNodes.length:', __if0_node.childNodes.length);
      for (let i = 0; i < __if0_node.childNodes.length; i++) {
        console.log(`child[${i}]:`, __if0_node.childNodes[i].nodeType, __if0_node.childNodes[i].nodeName);
      }
      return;
    }
    
    // Continue with inner loop...
  }
}));
```

**Why:** This will show exactly where execution fails and what the DOM state looks like.

**Action for QA:** If possible, temporarily modify generated JS file to add these logs, then re-test and share console output.

---

### 5. DOM Inspection Details ❗ HELPFUL

**Current Status:** Not captured
**Needed:** DOM structure analysis before and after clicking

**Check these specific things:**
- Does the category node still exist after click?
- Are there orphaned nodes in the DOM?
- Is the comment anchor (`<!-- if -->`) still present?
- What does `node.childNodes[7]` contain after click?

**Action for QA:** Use browser DevTools → Elements tab to inspect DOM before/after click and report findings.

---

## 🎯 Priority Order for QA Response:

1. **IMMEDIATE (Blocks Investigation):** Complete `test-nested-loops.wcc` file
2. **IMMEDIATE (Blocks Investigation):** Full stack traces with line numbers
3. **HIGH PRIORITY:** Browser console screenshots
4. **MEDIUM PRIORITY:** Debug logging output (if feasible)
5. **LOW PRIORITY:** DOM inspection details

**Without items 1 and 2, dev team CANNOT proceed with fixing the runtime issue.**

---

## ✅ Next Steps

1. **Dev team reviews this document**
2. **Dev team requests specific files/logs if needed**
3. **Dev team implements debugging approach**
4. **QA re-tests with debug build**
5. **Iterate until root cause identified**
6. **Implement fix in v0.16.29**

**Priority:** CRITICAL - This blocks all nested loop functionality despite correct code generation.

---

**Document Status:** ✅ COMPLETE - Ready for dev team investigation
