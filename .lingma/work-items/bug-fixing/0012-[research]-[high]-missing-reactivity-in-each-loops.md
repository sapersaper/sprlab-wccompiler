# BUG-0012: Missing Reactivity in Each Loops - UI Not Updating on Signal Changes

## Metadata
- **Status**: 🧪 inTesting
- **Priority**: 🔴 `high`
- **Reported by**: QA Team / Lingma AI Testing
- **Date reported**: 2026-05-15
- **Date moved to research**: 2026-05-15
- **Date moved to inProgress**: 2026-05-15
- **Date moved to inTesting**: 2026-05-15
- **Version fixed**: v0.16.17
- **Date resolved**: (pending)
- **Severity**: High - Blocks interactive list functionality, UI doesn't reflect data changes
- **Component**: codegen.js (each loop node reuse logic)
- **Related files**: 
  - `lib/codegen.js` (each loop reconciliation logic)
  - Discovered during testing of v0.16.7 (BUG-0007 fix)
- **Discovered in Version**: v0.16.7
- **Target Version**: v0.16.8

## Bug Summary

While verifying the fix for BUG-0007 (event handlers in each loops), QA discovered a separate reactivity bug that blocks interactive list functionality. Event handlers now work correctly (no ReferenceError), but the UI does not update after signals change.

## What Is the Problem?

When using reactive expressions inside `each` loops, the UI fails to update when the underlying signal changes, even though the signal itself updates correctly.

### Example Template:
```html
<li each="item in items()" :key="item.id">
  <span>{{ item.active ? '✓ Activo' : '✗ Inactivo' }}</span>
  <button @click="() => toggleActive(item.id)">Toggle</button>
</li>
```

### Current Behavior:
- ✅ Click on "Toggle" executes without errors (BUG-0007 fixed)
- ✅ Signal `items` updates correctly in memory
- ❌ **UI does NOT change** (continues showing old value)
- ❌ User receives no visual feedback
- ❌ Data and view become desynchronized

## Root Cause Analysis

The compiler generates keyed reconciliation code that reuses DOM nodes when keys don't change, but it fails to update the content of those reused nodes.

### Generated Code (Current - WRONG):
```javascript
// Lines 177-181 in generated output:
if (__oldMap.has(__key)) {
  const node = __oldMap.get(__key);
  // ❌ MISSING: Update node content with new item data!
  __newMap.set(__key, node);
  __newNodes.push(node);
  __oldMap.delete(__key);
}
```

Text content assignments only occur during node creation (lines 185-186), not when nodes are reused.

### Expected Behavior:
When a node is reused, its bindings should be updated to reflect the current state of the data.

## Impact Assessment

### Before Fix:
- ❌ Interactive lists provide no visual feedback
- ❌ UI and data become desynchronized
- ❌ Users think their clicks didn't work
- ❌ Poor user experience for any editable list

### After Fix:
- ✅ UI updates immediately on signal changes
- ✅ Correct visual feedback
- ✅ Data and view always synchronized

## Recommended Solution (Option 1)

Add property updates in the node reuse path:

```javascript
if (__oldMap.has(__key)) {
  const node = __oldMap.get(__key);
  
  // ✅ ADD THIS: Update all bindings for reused nodes
  node.childNodes[1].textContent = item.name ?? '';
  node.childNodes[3].textContent = item.active ? '✓ Activo' : '✗ Inactivo';
  
  __newMap.set(__key, node);
  __newNodes.push(node);
  __oldMap.delete(__key);
}
```

### Advantages:
- ✅ Minimal compiler change
- ✅ Good performance (reuses nodes)
- ✅ Preserves focus state and animations
- ✅ Consistent with current architecture

### Alternative Solutions:
- **Option 2**: Force full re-render on every change (simple but poor performance)
- **Option 3**: Use effects for each binding (complex, may have memory implications)

## Testing Evidence

Browser Agent executed 7 comprehensive tests:

| Test | Result |
|------|--------|
| Component Rendering | ✅ PASS |
| Toggle Button Click | ⚠️ Event works, UI doesn't update |
| Multiple Toggles | ⚠️ Same issue persists |
| Add Item + Toggle | ⚠️ New item appears, toggle doesn't update UI |
| Remove Item | ✅ PASS (causes full re-render) |
| Console Monitoring | ✅ No errors |
| Data vs View Sync | ❌ FAIL (mismatch confirmed) |

### Screenshots Available:
- `screenshot_v016_7_list_rendering_initial.png`
- `screenshot_v016_7_bug_0007_final.png`

## Acceptance Criteria

Please verify ALL of the following before marking bug as resolved:

- [ ] UI updates immediately when signal changes inside each loops
- [ ] Text bindings reflect current data state
- [ ] Conditional expressions (ternaries) update correctly
- [ ] Multiple items can be toggled independently
- [ ] Adding/removing items still works correctly
- [ ] No console errors during updates
- [ ] Performance remains acceptable (<100ms per update)
- [ ] Focus state preserved during updates
- [ ] Animations/transitions work correctly
- [ ] Nested loops update correctly
- [ ] Keyed reconciliation still provides performance benefits
- [ ] Non-keyed loops also update correctly
- [ ] All existing tests pass (no regressions)

## How to Reproduce

1. Create a component with an each loop containing reactive expressions
2. Add event handlers that modify the signal data
3. Compile with WCC Compiler v0.16.7
4. Run in browser
5. Click buttons/interact with list items
6. Observe: Signal updates but UI doesn't change

### Test Component Example:
```html
<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-loop-reactivity' })

const items = signal([
  { id: 1, name: 'Item 1', active: false },
  { id: 2, name: 'Item 2', active: true }
])

function toggleActive(id) {
  const updated = items().map(item => 
    item.id === id ? { ...item, active: !item.active } : item
  )
  items(updated)
}
</script>

<template>
<ul>
  <li each="item in items()" :key="item.id">
    <span>{{ item.name }} - {{ item.active ? '✓ Active' : '✗ Inactive' }}</span>
    <button @click="() => toggleActive(item.id)">Toggle</button>
  </li>
</ul>
</template>
```

## Priority Justification

This bug is HIGH priority because:

1. **Blocks Core Functionality**: Interactive lists are fundamental UI pattern
2. **Poor UX**: Users receive no feedback for their actions
3. **Data/View Desync**: Critical for application correctness
4. **Easy to Fix**: Option 1 requires minimal code changes
5. **Discovered Post-Release**: Found immediately after publishing v0.16.7

## Related Bugs

- **BUG-0007**: Event handlers in each loops don't resolve method references (FIXED in v0.16.7)
  - This bug was discovered while testing BUG-0007 fix
  - BUG-0007 fixed the event handler execution
  - BUG-0012 addresses the missing UI updates after events execute

## Workarounds (Until Fix is Available)

### Workaround 1: Force Re-render
Remove `:key` attribute to force full re-render on every change:
```html
<!-- Instead of: -->
<li each="item in items()" :key="item.id">

<!-- Use: -->
<li each="item in items()">
```
⚠️ Warning: Poor performance for large lists, loses focus state

### Workaround 2: Manual DOM Updates
Manually update DOM in event handlers (not recommended):
```javascript
function toggleActive(id) {
  const updated = items().map(...)
  items(updated)
  // Manually find and update DOM elements
}
```
⚠️ Warning: Breaks reactivity paradigm, fragile

## Questions or Issues?

If you need more information:
- Check QA report: `QA_BUG_REPORT_v016_8_LOOP_REACTIVITY.md`
- Review screenshots in `.playwright-mcp/` directory
- Test component behavior in browser with v0.16.7
- Compare with working non-loop scenarios

## Related Issues
- **Discovered while verifying**: BUG-0007 (Event Handlers in each Loops - RESOLVED)
- Note: BUG-0007 fixed event handler generation, but revealed missing reactivity in loop rendering
- BUG-0007: Compile-time issue (codegen) - FIXED in v0.16.7
- BUG-0012: Runtime reactivity issue - PENDING fix

---

**Report Generated**: 2026-05-15  
**Discovered By**: Lingma AI QA Team  
**Ready for Dev**: ✅ YES  

This bug prevents interactive lists from providing visual feedback and requires immediate attention.
