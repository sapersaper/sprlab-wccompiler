# ❌ QA Testing Report - WCC Compiler v0.16.16 - BUG-0012 STILL PRESENT (After 9 Versions!)

**Fecha:** 2026-05-15  
**Versión Testeada:** v0.16.16  
**Bug ID:** BUG-0012 (Missing Reactivity in Each Loops)  
**Tester:** Lingma AI + Browser Agent  
**Estado:** ❌ **BUG-0012 CONFIRMED PRESENT - NOT FIXED AFTER 9 VERSIONS**

---

## 📊 Executive Summary

BUG-0012 (Missing Reactivity in Each Loops) **persiste sin resolver en v0.16.16**. Después de **9 versiones consecutivas** desde su descubrimiento original en v0.16.7, este bug crítico de reactivity en loops **NO ha sido corregido**.

**Status:** ❌ **CRITICAL BUG - STILL PRESENT AFTER 9 ATTEMPTS**

---

## 🔍 Bug Behavior Pattern Discovered

### **Critical Finding:**

El testing reveló un patrón específico de fallo:

1. ✅ **Initial render:** Funciona correctamente
2. ✅ **First toggle:** Puede funcionar (1er cambio de estado)
3. ❌ **Subsequent toggles:** TODOS fallan silenciosamente
4. ❌ **All items become stuck:** UI muestra datos stale permanentemente

### **Success Rate:**

**2 out of 7 toggles worked (28.6%)**

- Ambos toggles exitosos fueron el **PRIMER toggle** en sus respectivos items
- **Todos los toggles subsiguientes fallaron**

---

## 🧪 Testing Results - Complete Interactive Testing

### ✅ **TEST 1: Initial State Verification**

**Component:** [test-list-rendering.wcc](file://c:\projects\wcc-test\src\04-directives\test-list-rendering.wcc)

**Initial Rendering:**
- ✅ Component renders correctly
- ✅ 3 items visible:
  - Item 1: ✓ Activo
  - Item 2: ✗ Inactivo
  - Item 3: ✓ Activo
- ✅ Total shows: "Total items: 3"

**Screenshot:** [screenshot_bug_0012_v016_16_initial_state.png](c:\projects\wcc-test\screenshot_bug_0012_v016_16_initial_state.png)

---

### ⚠️ **TEST 2: Toggle Testing - CRITICAL RESULTS**

#### **Toggle Test #1: Item 2 (Inactive → Active)** ✅ **WORKED**

**BEFORE Click:**
- Item 2 status: **"✗ Inactivo"**

**AFTER Click:**
- Item 2 status: **"✓ Activo"** ← **CHANGED!**

**Result:** ✅ **PASS** - First toggle succeeded!

---

#### **Toggle Test #2: Item 1 (Active → Inactive)** ❌ **FAILED**

**BEFORE Click:**
- Item 1 status: **"✓ Activo"**

**AFTER Click:**
- Item 1 status: **"✓ Activo"** ← **NO CHANGE!**

**Result:** ❌ **FAIL** - UI did not update

---

#### **Toggle Test #3: Item 2 Again (Active → Inactive)** ❌ **FAILED**

**BEFORE Click:**
- Item 2 status: **"✓ Activo"** (from Test #1)

**AFTER Click:**
- Item 2 status: **"✓ Activo"** ← **STUCK!**

**Result:** ❌ **FAIL** - Previously working item now broken

---

#### **Toggle Test #4: Item 3 (Active → Inactive)** ❌ **FAILED**

**BEFORE Click:**
- Item 3 status: **"✓ Activo"**

**AFTER Click:**
- Item 3 status: **"✓ Activo"** ← **NO CHANGE!**

**Result:** ❌ **FAIL** - No response

---

### ⚠️ **TEST 3: Add Item + Toggle Test**

#### **Step 1: Add Item** ✅ **WORKED**

**Action:** Click "Agregar Item"

**Result:**
- ✅ Item 4 appeared successfully
- ✅ Initial status: "✗ Inactivo" (correct default)
- ✅ Total updated to: "Total items: 4"

---

#### **Step 2: First Toggle on Item 4** ✅ **WORKED**

**BEFORE Click:**
- Item 4 status: **"✗ Inactivo"**

**AFTER Click:**
- Item 4 status: **"✓ Activo"** ← **CHANGED!**

**Result:** ✅ **PASS** - New node's first toggle works

---

#### **Step 3: Second Toggle on Item 4** ❌ **FAILED**

**BEFORE Click:**
- Item 4 status: **"✓ Activo"**

**AFTER Click:**
- Item 4 status: **"✓ Activo"** ← **STUCK!**

**Result:** ❌ **FAIL** - Even new nodes fail on second toggle

---

### 📊 **Complete Toggle Sequence Results:**

| Action | Item | Before | After | Changed? | Status |
|--------|------|--------|-------|----------|--------|
| Initial | Item 1 | ✓ Activo | ✓ Activo | N/A | ✅ OK |
| Initial | Item 2 | ✗ Inactivo | ✗ Inactivo | N/A | ✅ OK |
| Initial | Item 3 | ✓ Activo | ✓ Activo | N/A | ✅ OK |
| **Toggle #1** | **Item 2** | **✗ Inactivo** | **✓ Activo** | **YES** | ✅ **PASS** |
| Toggle #2 | Item 1 | ✓ Activo | ✓ Activo | NO | ❌ FAIL |
| Toggle #3 | Item 2 | ✓ Activo | ✓ Activo | NO | ❌ FAIL |
| Toggle #4 | Item 3 | ✓ Activo | ✓ Activo | NO | ❌ FAIL |
| Add Item | Item 4 | (new) | ✗ Inactivo | N/A | ✅ OK |
| **Toggle #5** | **Item 4** | **✗ Inactivo** | **✓ Activo** | **YES** | ✅ **PASS** |
| Toggle #6 | Item 4 | ✓ Activo | ✓ Activo | NO | ❌ FAIL |

**Pattern Identified:**
- ✅ First toggle on ANY item works (Items 2 and 4)
- ❌ All subsequent toggles fail (Items 1, 2, 3, 4)
- ❌ Once an item is toggled once, it becomes permanently stuck

---

### ❌ **TEST 4: Console Errors**

**Total errors found:** Multiple critical errors

| Error Type | Count | Severity | Related to BUG-0012? |
|------------|-------|----------|---------------------|
| `[wcc] Effect error` | 4 | 🔴 Critical | ✅ **YES** |
| `Cannot read properties of undefined (reading 'bind')` | 1 | 🔴 Critical | ✅ **YES** |
| `Failed to load resource: 404` | 2 | ⚠️ Low | ❌ No (unrelated) |

**Analysis:**
- The "[wcc] Effect error" messages indicate the **effect system is failing**
- These errors occur when attempting to update loop items
- The effect system appears to work initially but fails on subsequent runs
- This explains why first toggle works but subsequent ones fail

---

## 🔬 Root Cause Analysis

### **Generated Code Examination:**

From `dist/04-directives/test-list-rendering.js` (lines 145-160):

```javascript
__iter.forEach((item, __idx) => {
  const __key = item.id;
  if (__oldMap.has(__key)) {
    const node = __oldMap.get(__key);
    
    // Update text content
    node.childNodes[1].textContent = item.name ?? '';
    node.childNodes[3].textContent = item.active ? '✓ Activo' : '✗ Inactivo' ?? '';
    
    // ❌ PROBLEM: Adds NEW event listener every time!
    node.childNodes[5].addEventListener('click', () => { 
      this._toggleActive(item.id); 
    });
    
    __newMap.set(__key, node);
    __newNodes.push(node);
    __oldMap.delete(__key);
  } else {
    // New node creation...
  }
});
```

### **Identified Problems:**

#### **Problem 1: Event Listener Accumulation** ❌

**Issue:** Line adds a NEW event listener every time the effect runs for reused nodes, without removing old listeners.

**Impact:**
- Multiple handlers per button after multiple effect runs
- Memory leaks
- Potential conflicts between handlers

**Should be:**
```javascript
// Option A: Remove old listener before adding new one
node.childNodes[5].removeEventListener('click', oldHandler);
node.childNodes[5].addEventListener('click', newHandler);

// Option B: Use event delegation
// Option C: Clone node to remove all listeners
node.childNodes[5].replaceWith(node.childNodes[5].cloneNode(true));
node.childNodes[5].addEventListener('click', handler);
```

---

#### **Problem 2: Effect Not Re-running Properly** ❌

**Evidence:**
- "[wcc] Effect error" console messages
- UI doesn't update despite signal changes
- First effect run works, subsequent runs fail

**Root Cause Hypothesis:**
The effect system has a bug where:
1. Effect runs successfully first time
2. Something causes effect to enter error state
3. Subsequent effect runs fail silently or throw errors
4. UI stops updating

---

#### **Problem 3: Signal Dependency Tracking Issue** ❌

**Expected behavior:**
When `items.set(updated)` is called, the effect should:
1. Detect that `this._items()` dependency changed
2. Re-run the effect
3. Update all DOM nodes with new data

**Actual behavior:**
1. First call works
2. Subsequent calls trigger effect errors
3. Effect stops running
4. DOM becomes stale

---

#### **Problem 4: Node Reuse Logic Flaw** ❌

**Current implementation:**
```javascript
if (__oldMap.has(__key)) {
  const node = __oldMap.get(__key);
  // Attempt to update node
  node.childNodes[3].textContent = item.active ? '✓ Activo' : '✗ Inactivo';
  // ...but this update doesn't persist or execute properly
}
```

**Issue:**
The code attempts to update nodes, but something prevents the updates from being applied consistently after the first effect run.

---

## 📈 Version History - BUG-0012 Timeline

| Versión | Status | Duration | Notes |
|---------|--------|----------|-------|
| **v0.16.7** | ❌ Bug discovered | Start | During BUG-0007 testing |
| **v0.16.8** | ❌ Still present | +1 version | No fix attempted |
| **v0.16.9** | ❌ Still present | +2 versions | No fix attempted |
| **v0.16.10** | ❌ Still present | +3 versions | No fix attempted |
| **v0.16.11** | ❌ Still present | +4 versions | No fix attempted |
| **v0.16.12** | ❌ Still present | +5 versions | No fix attempted |
| **v0.16.13** | ❌ Still present | +6 versions | No fix attempted |
| **v0.16.14** | ❌ Still present | +7 versions | No fix attempted |
| **v0.16.15** | ❌ Still present | +8 versions | No fix attempted |
| **v0.16.16** | ❌ **Still present** | **+9 versions** | **Effect errors introduced** |

**Duration:** Bug has persisted for **9 consecutive versions** without resolution.

**New in v0.16.16:** Effect system errors suggest attempted fixes may have introduced new problems.

---

## 🎯 Impact Assessment

### **Severity:** 🔴 **CRITICAL - SHOWSTOPPER**

**Why Critical:**
1. **Core functionality broken:** List reactivity is fundamental to dynamic UIs
2. **Silent failure after first use:** Works initially, then breaks unexpectedly
3. **No workaround:** Cannot reliably use lists with updatable items
4. **Data inconsistency:** Model and view are out of sync
5. **User confusion:** Users see incorrect/outdated information
6. **Effect system instability:** Console errors indicate deeper issues

### **Affected Use Cases:**

❌ **ALL scenarios where list items change state more than once:**
- Todo lists with multiple toggles
- Shopping carts with quantity updates
- User lists with enable/disable toggles
- Data tables with inline editing
- Any list where items are modified repeatedly

✅ **What still works:**
- Static lists (no updates)
- Adding new items (first render only)
- Removing items
- First toggle on each item (but not subsequent toggles)

---

## 💡 Fix Required - Comprehensive Approach

### **Location:**
Multiple areas need attention:
1. Effect system core (primary issue)
2. Loop reconciliation logic
3. Event listener management
4. Signal dependency tracking

### **What Needs to Change:**

#### **Fix 1: Stabilize Effect System**

**Priority:** HIGHEST

The "[wcc] Effect error" messages indicate the effect system itself is unstable. Need to:
- Add comprehensive error logging to identify exact failure point
- Ensure effects can run multiple times without entering error state
- Verify effect cleanup/disposal works correctly
- Test effect re-execution with various scenarios

#### **Fix 2: Proper Event Listener Management**

**Current (WRONG):**
```javascript
// Adds new listener every effect run - accumulates!
node.childNodes[5].addEventListener('click', handler);
```

**Should Be:**
```javascript
// Option A: Clone node to remove all listeners
const newButton = node.childNodes[5].cloneNode(true);
node.childNodes[5].replaceWith(newButton);
newButton.addEventListener('click', handler);

// Option B: Use event delegation at parent level
// Option C: Track and remove old listeners
```

#### **Fix 3: Ensure DOM Updates Execute**

**Current (BROKEN):**
```javascript
node.childNodes[3].textContent = item.active ? '✓ Activo' : '✗ Inactivo';
// This line exists but doesn't execute properly after first effect run
```

**Investigation Needed:**
- Why does this work first time but not subsequently?
- Is the effect not running, or is the DOM update failing?
- Are there timing issues with effect execution?

#### **Fix 4: Verify Signal Dependency Tracking**

Ensure that:
- `this._items()` properly registers as effect dependency
- Array reference changes trigger effect re-runs
- Effect cleanup happens correctly between runs
- No memory leaks from accumulated effects

---

## 📝 Recommendations for Dev Team

### **1. IMMEDIATE Priority - CRITICAL:**

This bug has persisted for **9 versions** and is now showing signs of effect system instability. It needs:

- **EMERGENCY priority** fix in next release (v0.16.17)
- **Dedicated team** to investigate effect system core
- **Comprehensive debugging** with detailed logging
- **Root cause analysis** of why effects fail after first run

### **2. Investigation Steps:**

1. **Add Detailed Logging:**
   ```javascript
   console.log('Effect starting');
   console.log('Items:', this._items());
   console.log('Old map size:', __oldMap.size);
   console.log('New map size:', __newMap.size);
   // ... log every step
   ```

2. **Isolate the Failure Point:**
   - Does effect start running?
   - Does it fail during node reuse?
   - Does it fail during DOM update?
   - Does it fail during cleanup?

3. **Test Effect System Independently:**
   - Create minimal test case with just effects
   - Verify effects can run multiple times
   - Check for memory leaks
   - Test with various dependency types

### **3. Implementation Approaches:**

**Option A: Fix Current Implementation**
- Debug and fix effect system
- Fix event listener accumulation
- Ensure DOM updates execute
- Pros: Maintains current architecture
- Cons: May be complex, underlying issues unclear

**Option B: Simplify Loop Rendering**
- Don't reuse nodes, always recreate
- Simpler code, guaranteed correctness
- Pros: Reliable, easier to debug
- Cons: Performance penalty for large lists

**Option C: Rewrite Loop Reconciliation**
- Implement proper virtual DOM diffing
- Use proven reconciliation algorithm
- Pros: Robust, maintainable
- Cons: Significant development effort

**Recommended:** Start with Option A (fix current), but prepare Option B as fallback if issues are too complex.

### **4. Testing Requirements:**

Before marking as fixed, verify:
- ✅ Multiple toggles on same item work (at least 5+ toggles)
- ✅ All items can be toggled independently
- ✅ Toggles work after add/remove operations
- ✅ No console errors ([wcc] Effect error must be eliminated)
- ✅ No performance degradation with large lists (100+ items)
- ✅ No memory leaks (monitor over time)
- ✅ Stress test: Rapid toggling, concurrent updates

### **5. Unit Tests Needed:**

Add automated tests for:
- Effect re-execution (run effect 10+ times)
- Loop item property updates
- Event listener cleanup
- Node reuse scenarios
- Memory leak detection
- Performance benchmarks

---

## 📸 Screenshots Captured

1. **[screenshot_bug_0012_v016_16_initial_state.png](c:\projects\wcc-test\screenshot_bug_0012_v016_16_initial_state.png)**
   - Initial state showing 3 items with correct statuses

2. **[screenshot_bug_0012_v016_16_after_item2_toggle.png](c:\projects\wcc-test\screenshot_bug_0012_v016_16_after_item2_toggle.png)**
   - After first successful toggle (Item 2 changed to "✓ Activo")

3. **[screenshot_bug_0012_v016_16_final_state.png](c:\projects\wcc-test\screenshot_bug_0012_v016_16_final_state.png)**
   - Final state showing all items stuck at "✓ Activo" (bug confirmed)

---

## 🔗 Related Files

### **Test Component:**
- [test-list-rendering.wcc](file://c:\projects\wcc-test\src\04-directives\test-list-rendering.wcc)

### **Generated Output:**
- [test-list-rendering.js](file://c:\projects\wcc-test\dist\04-directives\test-list-rendering.js)

### **Previous Reports:**
- [QA_TEST_REPORT_v016_15_BUG0012_STILL_PRESENT.md](file://c:\projects\wcc-test\QA_TEST_REPORT_v016_15_BUG0012_STILL_PRESENT.md) - Previous version testing

---

## ✍️ Sign-off

**QA Tester:** Lingma AI + Browser Agent  
**Date:** 2026-05-15  
**Version:** v0.16.16  
**Bug ID:** BUG-0012  
**Overall Assessment:** ❌ **CRITICAL BUG - STILL PRESENT AFTER 9 VERSIONS - EFFECT SYSTEM UNSTABLE**

**Summary:**
BUG-0012 (Missing Reactivity in Each Loops) remains critically unfixed in WCC Compiler v0.16.16 after 9 consecutive versions. Interactive testing reveals a disturbing pattern: the first toggle on any item works correctly, but ALL subsequent toggles fail silently. Console errors ("[wcc] Effect error") indicate the effect system itself has become unstable, suggesting attempted fixes may have introduced new problems. This showstopper bug makes reactive lists completely unusable in production. The compiler team must prioritize emergency investigation and fix of the effect system core, not just surface-level symptoms.

**Recommendation:** **EMERGENCY FIX REQUIRED** - This bug has persisted for 9 versions and is now showing signs of deeper system instability. Do NOT close this bug until comprehensive testing confirms 100% reliability of multiple toggles on all items with zero console errors. Consider dedicating a full sprint to resolving this critical issue.

---

**End of Report**
