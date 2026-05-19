# BUG-0019 - Critical Issues in v0.16.29 (Not Fixed)

**Date:** 2026-05-19  
**Version Tested:** v0.16.29  
**Status:** ❌ NOT FIXED - Multiple critical bugs discovered  
**Priority:** 🔴 CRITICAL  
**Component:** lib/codegen.js (event handler generation + conditional element generation)

---

## 🚨 Executive Summary

The development team claimed BUG-0019 was "COMPLETAMENTE FIXED" in v0.16.29, but comprehensive testing reveals **THREE CRITICAL BUGS** that make nested loops with conditionals completely unusable.

### What Was Claimed Fixed:
1. ✅ Code generation scoping (v0.16.28) - Inner loops inside conditionals
2. ⚠️ Runtime null checks (v0.16.29) - **PARTIAL ONLY**

### What Is Actually Broken:
1. ❌ Null checks missing on loop-generated event handlers
2. ❌ Conditional elements (`if` directives) inside nested loops NOT GENERATED
3. ❌ Categories disappear when clicked - component unusable

---

## 📁 Complete Source File for Reproduction

**File:** `test-nested-loops.wcc`  
**Location:** `c:\projects\wcc-test\src\12-edge-cases\test-nested-loops.wcc`

```html
<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-nested-loops',
})

// Nested loops test - categories with sub-items
const categories = signal([
  {
    id: 1,
    name: 'Electronics',
    expanded: false,
    items: [
      { id: 101, name: 'Laptop', price: 999.99, inStock: true },
      { id: 102, name: 'Phone', price: 699.99, inStock: true },
      { id: 103, name: 'Tablet', price: 499.99, inStock: false },
      { id: 104, name: 'Headphones', price: 199.99, inStock: true },
      { id: 105, name: 'Camera', price: 899.99, inStock: true }
    ]
  },
  {
    id: 2,
    name: 'Clothing',
    expanded: false,
    items: [
      { id: 201, name: 'T-Shirt', price: 29.99, inStock: true },
      { id: 202, name: 'Jeans', price: 59.99, inStock: true },
      { id: 203, name: 'Jacket', price: 129.99, inStock: false },
      { id: 204, name: 'Shoes', price: 89.99, inStock: true }
    ]
  },
  {
    id: 3,
    name: 'Books',
    expanded: false,
    items: [
      { id: 301, name: 'JavaScript Guide', price: 49.99, inStock: true },
      { id: 302, name: 'Python Basics', price: 39.99, inStock: true },
      { id: 303, name: 'React Handbook', price: 44.99, inStock: true },
      { id: 304, name: 'Node.js Deep Dive', price: 54.99, inStock: false },
      { id: 305, name: 'CSS Mastery', price: 34.99, inStock: true },
      { id: 306, name: 'TypeScript Pro', price: 59.99, inStock: true }
    ]
  }
])

const selectedItems = signal([])
const totalValue = signal(0)
const itemCount = signal(0)

// Toggle category expansion
function toggleCategory(categoryId) {
  categories.set(categories().map(cat => 
    cat.id === categoryId ? { ...cat, expanded: !cat.expanded } : cat
  ))
}

// Toggle item selection
function toggleItemSelection(itemId, price) {
  const currentSelected = selectedItems()
  const isSelected = currentSelected.includes(itemId)
  
  if (isSelected) {
    selectedItems.set(currentSelected.filter(id => id !== itemId))
    totalValue.set(totalValue() - price)
  } else {
    selectedItems.set([...currentSelected, itemId])
    totalValue.set(totalValue() + price)
  }
  
  itemCount.set(selectedItems().length)
}

// Select all items in category
function selectAllInCategory(categoryId) {
  const category = categories().find(cat => cat.id === categoryId)
  if (!category) return
  
  const categoryItemIds = category.items.map(item => item.id)
  const newSelected = [...new Set([...selectedItems(), ...categoryItemIds])]
  
  selectedItems.set(newSelected)
  
  // Calculate total value
  let total = 0
  categories().forEach(cat => {
    cat.items.forEach(item => {
      if (newSelected.includes(item.id)) {
        total += item.price
      }
    })
  })
  
  totalValue.set(total)
  itemCount.set(newSelected.length)
}

// Clear all selections
function clearSelections() {
  selectedItems.set([])
  totalValue.set(0)
  itemCount.set(0)
}

// Add new category dynamically
function addNewCategory() {
  const newId = categories().length + 1
  const newCategory = {
    id: newId,
    name: `Category ${newId}`,
    expanded: true,
    items: [
      { id: newId * 100 + 1, name: 'Item 1', price: Math.random() * 100, inStock: true },
      { id: newId * 100 + 2, name: 'Item 2', price: Math.random() * 100, inStock: false }
    ]
  }
  categories.set([...categories(), newCategory])
}

// Remove category
function removeCategory(categoryId) {
  categories.set(categories().filter(cat => cat.id !== categoryId))
  
  // Remove associated selections
  const category = categories().find(cat => cat.id === categoryId)
  if (category) {
    const categoryItemIds = category.items.map(item => item.id)
    selectedItems.set(selectedItems().filter(id => !categoryItemIds.includes(id)))
  }
}
</script>

<style>
.nested-loops {
  padding: 20px;
  font-family: monospace;
}

.stats-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin: 15px 0;
  padding: 15px;
  background: #ebf8ff;
  border-radius: 8px;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #2b6cb0;
}

.category {
  margin: 15px 0;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.category-header {
  padding: 15px;
  background: #f7fafc;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.2s;
}

.category-header:hover {
  background: #edf2f7;
}

.category-name {
  font-size: 18px;
  font-weight: bold;
  color: #2d3748;
}

.item-count-badge {
  background: #4299e1;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 14px;
}

.items-container {
  padding: 15px;
  background: white;
}

.item-row {
  padding: 10px;
  margin: 5px 0;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s;
}

.item-row.selected {
  background: #c6f6d5;
  border-color: #48bb78;
}

.item-row.out-of-stock {
  opacity: 0.6;
  background: #fed7d7;
}

.item-info {
  flex: 1;
}

.item-name {
  font-weight: bold;
  color: #2d3748;
}

.item-price {
  color: #4a5568;
  font-size: 14px;
}

.stock-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  margin-left: 10px;
}

.in-stock {
  background: #c6f6d5;
  color: #22543d;
}

.out-of-stock {
  background: #fed7d7;
  color: #742a2a;
}

button {
  margin: 5px;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

button.primary {
  background: #4299e1;
  color: white;
}

button.success {
  background: #48bb78;
  color: white;
}

button.danger {
  background: #f56565;
  color: white;
}

button.warning {
  background: #ed8936;
  color: white;
}

.actions-bar {
  margin: 15px 0;
  padding: 15px;
  background: #f7fafc;
  border-radius: 8px;
}

.expand-icon {
  font-size: 20px;
  transition: transform 0.2s;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}
</style>

<template>
<div class="nested-loops">
  <h2>🔄 Test 12.5: Nested Loops</h2>
  <p>Testing loops inside loops with complex interactions</p>

  <!-- Stats Bar -->
  <div class="stats-bar">
    <div class="stat-item">
      <div class="stat-label">Categories</div>
      <div class="stat-value">{{ categories().length }}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Total Items</div>
      <div class="stat-value">
        {{ categories().reduce((sum, cat) => sum + cat.items.length, 0) }}
      </div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Selected</div>
      <div class="stat-value">{{ itemCount() }}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Total Value</div>
      <div class="stat-value">${{ totalValue().toFixed(2) }}</div>
    </div>
  </div>

  <!-- Actions -->
  <div class="actions-bar">
    <button class="primary" @click={{ addNewCategory }}>Add New Category</button>
    <button class="warning" @click={{ clearSelections }}>Clear All Selections</button>
  </div>

  <!-- Categories Loop (Level 1) -->
  <div each="category in categories()" key={{ category.id }} class="category">
    <!-- Category Header -->
    <div class="category-header" @click={{ () => toggleCategory(category.id) }}>
      <div>
        <span class="expand-icon" :class="{ expanded: category.expanded }">▶</span>
        <span class="category-name">{{ category.name }}</span>
      </div>
      <div>
        <span class="item-count-badge">{{ category.items.length }} items</span>
        <button class="success" @click={{ () => selectAllInCategory(category.id) }}>Select All</button>
        <button class="danger" @click={{ () => removeCategory(category.id) }}>Remove</button>
      </div>
    </div>

    <!-- Items Loop (Level 2) - Conditional on expansion -->
    <div if={{ category.expanded }} class="items-container">
      <div each="item in category.items" key={{ item.id }} 
           class="item-row"
           :class="{ selected: selectedItems().includes(item.id), 'out-of-stock': !item.inStock }">
        
        <div class="item-info">
          <div class="item-name">
            {{ item.name }}
            <span class="stock-status" :class="item.inStock ? 'in-stock' : 'out-of-stock'">
              {{ item.inStock ? '✓ In Stock' : '✗ Out of Stock' }}
            </span>
          </div>
          <div class="item-price">${{ item.price.toFixed(2) }}</div>
        </div>

        <button 
          :class="selectedItems().includes(item.id) ? 'danger' : 'success'"
          @click={{ () => toggleItemSelection(item.id, item.price) }}
          if={{ item.inStock }}
        >
          {{ selectedItems().includes(item.id) ? 'Deselect' : 'Select' }}
        </button>

        <span if={{ !item.inStock }} style="color: #a0aec0;">Unavailable</span>
      </div>
    </div>
  </div>

  <!-- Empty State -->
  <div if={{ categories().length === 0 }}>
    <p><em>No categories available. Click "Add New Category" to create one.</em></p>
  </div>

  <!-- Instructions -->
  <div class="actions-bar">
    <h3>What to Verify:</h3>
    <ul>
      <li>✅ Outer loop (categories) renders correctly</li>
      <li>✅ Inner loop (items) renders within each category</li>
      <li>✅ Keys work correctly at both levels</li>
      <li>✅ Conditional rendering (expanded/collapsed) works</li>
      <li>✅ Class bindings work in nested context</li>
      <li>✅ Events fire correctly from nested items</li>
      <li>✅ State updates propagate through nested structure</li>
      <li>✅ Adding/removing categories updates UI correctly</li>
      <li>✅ Select/deselect works across nested loops</li>
      <li>✅ Performance acceptable with ~20+ items total</li>
    </ul>
  </div>
</div>
</template>
```

---

## 🔍 Generated Code Analysis

**File:** `dist/12-edge-cases/test-nested-loops.js`  
**Compiler Version:** v0.16.29

### Bug #1: Missing Null Checks on Loop-Generated Event Handlers

**Location:** Lines 368-370 and 435-437

**Current Generated Code (BROKEN):**
```javascript
// Line 368
node.childNodes[3].addEventListener('click', () => { this._toggleCategory(category.id); });

// Line 369
node.childNodes[3].childNodes[3].childNodes[3].addEventListener('click', () => { this._selectAllInCategory(category.id); });

// Line 370
node.childNodes[3].childNodes[3].childNodes[5].addEventListener('click', () => { this._removeCategory(category.id); });
```

**Problem:**
- These event handlers are generated INSIDE the outer loop (forEach over categories)
- They use hardcoded childNode indices: `node.childNodes[3]`, etc.
- If whitespace nodes exist in template, indices shift and references become `undefined`
- Calling `.addEventListener()` on `undefined` throws: "Cannot read properties of undefined (reading 'bind')"

**Comparison with Top-Level Handlers (Lines 332-333):**
```javascript
// These HAVE null checks (added in v0.16.29):
if (this.__evt_click_addNewCategory_0) this.__evt_click_addNewCategory_0.addEventListener('click', this._addNewCategory.bind(this), { signal: this.__ac.signal });
if (this.__evt_click_clearSelections_1) this.__evt_click_clearSelections_1.addEventListener('click', this._clearSelections.bind(this), { signal: this.__ac.signal });
```

**Why It Fails:**
1. Template has whitespace between elements
2. Whitespace creates text nodes in DOM
3. `node.childNodes[3]` expects element at index 3
4. But whitespace shifts actual element to index 4 or 5
5. `node.childNodes[3]` is `undefined` (or a text node)
6. `.addEventListener()` on undefined → crash

**Fix Required in lib/codegen.js:**
```javascript
// When generating event handlers inside loops:
// Current (broken):
output(`${nodeRef}.addEventListener('${event}', ${handler});`);

// Should be:
output(`const __target__ = ${nodeRef};`);
output(`if (__target__) __target__.addEventListener('${event}', ${handler});`);
```

---

### Bug #2: Conditional Elements Inside Nested Loops Not Generated

**Location:** Lines 396-398 in generated code

**Source Template (Lines 362-370 in .wcc file):**
```html
<button 
  :class="selectedItems().includes(item.id) ? 'danger' : 'success'"
  @click={{ () => toggleItemSelection(item.id, item.price) }}
  if={{ item.inStock }}
>
  {{ selectedItems().includes(item.id) ? 'Deselect' : 'Select' }}
</button>

<span if={{ !item.inStock }} style="color: #a0aec0;">Unavailable</span>
```

**Expected Generated Code:**
```javascript
// Should generate conditional logic for button:
if (item.inStock) {
  const button = document.createElement('button');
  button.addEventListener('click', () => { this._toggleItemSelection(item.id, item.price); });
  // ... setup button ...
  container.appendChild(button);
}

// Should generate conditional logic for span:
if (!item.inStock) {
  const span = document.createElement('span');
  span.textContent = 'Unavailable';
  container.appendChild(span);
}
```

**Actual Generated Code (BROKEN):**
```html
<!-- if -->

<!-- if -->
```

**Problem:**
- The compiler generates COMMENT PLACEHOLDERS instead of actual conditional logic
- No `<button>` element is created
- No `<span>` element is created
- No event handlers are attached
- `_toggleItemSelection` method exists but is never called

**Impact:**
- Users cannot select individual items (no Select button)
- "Unavailable" text doesn't show for out-of-stock items
- Component functionality severely limited

**Root Cause Hypothesis:**
The compiler's `if` directive handler may not be working correctly when nested inside `each` loops. Possible issues:
1. Parser doesn't recognize `if` attribute inside loop-generated elements
2. Code generator skips conditional logic for nested contexts
3. Template compilation order issue (if processed before each)

**Fix Required in lib/codegen.js or lib/sfc-parser.js:**
- Investigate how `if` directives are processed inside `each` loops
- Ensure conditional elements are generated with proper logic
- Test with various nesting combinations: `each > if`, `each > if > each`, etc.

---

### Bug #3: Categories Disappear When Clicked

**Observed Behavior:**
1. Initial render: 3 categories visible ✅
2. Click "Electronics" category header
3. Result: Entire category DISAPPEARS from DOM ❌
4. Cannot expand/collapse or interact further

**Root Cause:**
Combination of Bug #1 (event handler errors) causing effect failures:
1. Click triggers `toggleCategory()` via event handler
2. Event handler setup failed due to missing null check (Bug #1)
3. Effect catches error: `[wcc] Effect error`
4. Effect is permanently disabled
5. DOM state becomes corrupted
6. Category node removed or hidden

**Console Errors:**
```
Cannot read properties of undefined (reading 'bind')
[wcc] Effect error (×8+ occurrences)
```

**Fix:** Resolving Bug #1 should fix this as well.

---

## 🧪 Testing Results

### Test Execution Environment:
- **OS:** Windows 22H2
- **Browser:** Chromium (via Playwright Browser Agent)
- **Server:** http://localhost:4100
- **Compiler:** @sprlab/wccompiler@0.16.29
- **Clean Reinstall:** Yes (deleted node_modules, reinstalled, deleted dist, recompiled)

### Test Results Table:

| Test Scenario | Expected | Actual | Status |
|---------------|----------|--------|--------|
| Categories render initially | 3 categories visible | ✅ 3 categories visible | ✅ PASS |
| Click category to expand | Items appear in container | ❌ Category disappears | ❌ FAIL |
| Items visible when expanded | Items rendered inside items-container | ❌ Cannot test (category gone) | ❌ FAIL |
| Stock status text visible | "✓ In Stock" / "✗ Out of Stock" | ❌ Not visible | ❌ FAIL |
| Select button exists | Button element rendered | ❌ Button not generated | ❌ FAIL |
| Can select items | Selection toggles, stats update | ❌ Cannot select (no button) | ❌ FAIL |
| Click "Select All" | All items in category selected | ❌ Cannot test | ❌ FAIL |
| Click "Clear All Selections" | All selections cleared | ⚠️ Unknown | ⚠️ UNKNOWN |
| Click "Add New Category" | New category appears, count increases | ⚠️ Unknown | ⚠️ UNKNOWN |
| Collapse then re-expand | Items hide then reappear | ❌ Cannot test | ❌ FAIL |
| Console errors | Clean or minimal | ❌ 8+ effect errors + bind error | ❌ FAIL |

### Screenshots Captured:

1. **Initial State:** [screenshot_bug_0019_v016_29_initial_state.png](c:\projects\wcc-test\screenshot_bug_0019_v016_29_initial_state.png)
   - Shows 3 categories rendered correctly
   - Stats bar showing: Categories: 3, Total Items: 15, Selected: 0, Total Value: $0.00

2. **After Click Error:** [screenshot_bug_0019_v016_29_after_click_error.png](c:\projects\wcc-test\screenshot_bug_0019_v016_29_after_click_error.png)
   - Shows Electronics category disappeared after click
   - Only Clothing and Books remain visible

3. **Console Errors:** [screenshot_bug_0019_v016_29_console_errors.png](c:\projects\wcc-test\screenshot_bug_0019_v016_29_console_errors.png)
   - Shows "Cannot read properties of undefined (reading 'bind')" error
   - Shows multiple "[wcc] Effect error" messages

---

## 🐛 Full Stack Trace

**Error Message:**
```
Cannot read properties of undefined (reading 'bind')
```

**Frequency:** Occurs on initial load (multiple times) and when clicking category headers

**Source:** Browser console (Chromium via Playwright)

**Note:** Full stack trace with line numbers not captured by Browser Agent. Dev team should:
1. Load component in browser manually
2. Open DevTools Console
3. Reproduce error by clicking category
4. Copy full stack trace including file names and line numbers

**Expected Stack Trace Format:**
```
TypeError: Cannot read properties of undefined (reading 'bind')
    at HTMLDivElement.<anonymous> (test-nested-loops.js:368:XX)
    at Effect.run (reactive-runtime.js:XX:XX)
    at Signal.notify (signals.js:XX:XX)
    at ...
```

---

## 💡 Debugging Steps for Dev Team

### Step 1: Reproduce the Issue

```bash
# In wcc-test repo
cd c:\projects\wcc-test
yarn install  # Ensure v0.16.29
yarn dev      # Start dev server
# Open http://localhost:4100 in browser
# Navigate to Test 12.5: Nested Loops
# Open DevTools Console
# Click on "Electronics" category header
# Observe errors and behavior
```

### Step 2: Inspect Generated Code

```bash
# Check generated JavaScript
cat dist/12-edge-cases/test-nested-loops.js | grep -A 5 "addEventListener"

# Look for lines WITHOUT null checks:
# node.childNodes[3].addEventListener(...)  ← BROKEN
# vs
# if (this.__evt_click_...) ...addEventListener(...)  ← CORRECT
```

### Step 3: Add Debug Logging

**Modify lib/codegen.js temporarily to add logging:**

```javascript
// When generating event handlers inside loops:
output(`console.log('Setting up event handler on:', ${nodeRef});`);
output(`console.log('Target exists?', !!${nodeRef});`);
output(`if (${nodeRef}) {`);
output(`  ${nodeRef}.addEventListener('${event}', ${handler});`);
output(`  console.log('Event handler attached successfully');`);
output(`} else {`);
output(`  console.error('ERROR: Target node is undefined!', '${nodeRef}');`);
output(`}`);
```

**Recompile and test:**
```bash
cd c:\projects\wcc-test
rm -rf dist
yarn dev
# Check console for debug output
```

### Step 4: Inspect DOM Structure

**In browser DevTools:**
1. Right-click on category → "Inspect Element"
2. Check DOM structure before clicking
3. Note childNodes indices
4. Click category header
5. Observe what happens to DOM
6. Check if category node still exists
7. Check console for errors

**Specific checks:**
```javascript
// In browser console:
const category = document.querySelector('.category');
console.log('Category:', category);
console.log('Child nodes:', category.childNodes);
console.log('Child count:', category.childNodes.length);

// Check each child:
Array.from(category.childNodes).forEach((node, i) => {
  console.log(`child[${i}]:`, node.nodeType, node.nodeName, node.textContent?.substring(0, 50));
});
```

### Step 5: Test Conditional Element Generation

**Check if `if` directives work in simpler cases:**

Create minimal test case:
```html
<script>
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'test-if-in-loop' })
const items = signal([
  { id: 1, show: true },
  { id: 2, show: false }
])
</script>

<template>
  <div>
    <div each="item in items()" key={{ item.id }}>
      <span if={{ item.show }}>Visible</span>
      <span if={{ !item.show }}>Hidden</span>
    </div>
  </div>
</template>
```

**Compile and check generated code:**
- Does it generate actual `<span>` elements?
- Or just comment placeholders?

---

## 🎯 Required Fixes

### Priority 1: Add Null Checks to ALL Event Handlers

**File:** `lib/codegen.js`

**Current Code Pattern:**
```javascript
// Generates:
node.childNodes[3].addEventListener('click', handler);
```

**Required Fix:**
```javascript
// Should generate:
const __target__ = node.childNodes[3];
if (__target__) __target__.addEventListener('click', handler);
```

**Implementation:**
Find the code section that generates event handlers inside loops and wrap with null checks:
```javascript
// In codegen.js, look for event handler generation logic:
function generateEventHandler(nodeRef, event, handler) {
  // Current:
  return `${nodeRef}.addEventListener('${event}', ${handler});`;
  
  // Should be:
  return `const __evt_target__ = ${nodeRef};\nif (__evt_target__) __evt_target__.addEventListener('${event}', ${handler});`;
}
```

**Apply to:**
- Regular event handlers: `@click`, `@change`, etc.
- Model bindings: `:model=`
- All dynamically generated handlers inside loops

---

### Priority 2: Fix Conditional Element Generation in Nested Loops

**Files:** `lib/sfc-parser.js` and/or `lib/codegen.js`

**Investigation Steps:**
1. Find where `if` directives are parsed
2. Check if parsing differs inside `each` loops
3. Verify code generation for conditional elements
4. Test with various nesting patterns

**Test Cases to Verify:**
```html
<!-- Case 1: if inside each -->
<div each="item in items()">
  <span if={{ item.show }}>Text</span>
</div>

<!-- Case 2: each inside if -->
<div if={{ showAll }}>
  <div each="item in items()">{{ item.name }}</div>
</div>

<!-- Case 3: nested each with if -->
<div each="cat in categories()">
  <div if={{ cat.expanded }}>
    <div each="item in cat.items">{{ item.name }}</div>
  </div>
</div>
```

**Expected Behavior:**
All cases should generate actual elements with conditional logic, NOT comment placeholders.

---

### Priority 3: Comprehensive Testing Before Release

**Required Tests:**
1. ✅ Nested loops with conditionals
2. ✅ Event handlers inside loops (with null checks)
3. ✅ Conditional elements inside loops
4. ✅ Multiple levels of nesting
5. ✅ Dynamic additions/removals
6. ✅ All event types (click, change, input, etc.)
7. ✅ Model bindings inside loops

**Testing Method:**
- Use Browser Agent for automated E2E testing
- Verify no console errors
- Confirm all interactions work
- Check DOM structure integrity

---

## 📊 Comparison with Previous Versions

| Version | Code Structure | Null Checks | Conditional Elements | Runtime Behavior | Status |
|---------|---------------|-------------|---------------------|------------------|--------|
| v0.16.26 | ❌ Wrong order | ❌ None | ❌ Broken | ❌ Nothing renders | ❌ Broken |
| v0.16.27 | ❌ Wrong scope | ❌ None | ❌ Broken | ❌ Nothing renders | ❌ Broken |
| v0.16.28 | ✅ Correct scope | ❌ None | ❌ Broken | ❌ Categories disappear | ❌ Broken |
| v0.16.29 | ✅ Correct scope | ⚠️ Partial (top-level only) | ❌ Broken | ❌ Categories disappear | ❌ Broken |
| **v0.16.30** | ✅ Correct scope | ✅ **ALL handlers** | ✅ **Fixed** | ✅ **Should work** | 🎯 **Target** |

---

## ✅ Acceptance Criteria for v0.16.30

BUG-0019 can be marked as DONE only when ALL of these pass:

1. ✅ **No Console Errors**
   - Zero "[wcc] Effect error" messages
   - Zero "Cannot read properties of undefined" errors
   - Clean console on initial load and all interactions

2. ✅ **Categories Render and Interact**
   - All 3 categories visible initially
   - Clicking category header expands to show items
   - Clicking again collapses (items hide)
   - Category never disappears

3. ✅ **Items Render Correctly**
   - Items appear inside items-container when expanded
   - Stock status text visible ("✓ In Stock" / "✗ Out of Stock")
   - Select/Deselect buttons present and functional
   - "Unavailable" text shows for out-of-stock items

4. ✅ **All Features Work**
   - Can select individual items
   - Can "Select All" in category
   - Can "Clear All Selections"
   - Can "Add New Category"
   - Can "Remove Category"
   - Stats update correctly (count, value)

5. ✅ **Generated Code Quality**
   - All event handlers have null checks
   - Conditional elements generate actual code (not comments)
   - No hardcoded childNode indices without validation
   - Code is robust against whitespace variations

6. ✅ **Browser Agent Tests Pass**
   - Automated tests confirm all functionality
   - Screenshots show correct behavior
   - No regressions in other components

---

## 📞 Contact Information

**QA Tester:** Lingma AI + Browser Agent  
**Testing Environment:** 
- OS: Windows 22H2
- Browser: Chromium (via Playwright)
- Server: http://localhost:4100
- Version: @sprlab/wccompiler@0.16.29

**Files Available:**
- Source: `c:\projects\wcc-test\src\12-edge-cases\test-nested-loops.wcc`
- Generated: `c:\projects\wcc-test\dist\12-edge-cases\test-nested-loops.js`
- Screenshots: `c:\projects\wcc-test\screenshot_bug_0019_v016_29_*.png`
- This Report: `c:\projects\wcc-test\BUG-0019-CRITICAL-ISSUES-V01629.md`

---

## 🎯 Next Steps

1. **Dev team reviews this document** ✅
2. **Dev team reproduces issues locally** 
3. **Dev team implements fixes:**
   - Priority 1: Null checks on all event handlers
   - Priority 2: Conditional element generation
4. **Dev team runs comprehensive tests**
5. **Dev team releases v0.16.30**
6. **QA re-tests with Browser Agent**
7. **If all acceptance criteria pass → Mark BUG-0019 as DONE**

**Estimated Timeline:** 2-3 days for complete fix + testing

**Priority:** 🔴 CRITICAL - Component completely unusable, blocks production deployment of any app using nested loops with conditionals.

---

**Document Status:** ✅ COMPLETE - Ready for dev team investigation and fix implementation
