# BUG-0006: defineModel Incorrect Event Names

## Metadata
- **Status**: ✅ DONE
- **Priority**: 🔴 `high`
- **Reported by**: QA Team / Lingma AI Testing
- **Date reported**: 2026-05-13
- **Date moved to research**: 2026-05-15
- **Date moved to inProgress**: 2026-05-15
- **Date moved to inTesting**: 2026-05-15
- **Date resolved**: 2026-05-15
- **Severity**: High - Blocks two-way data binding functionality
- **Component**: codegen.js (defineModel event emission)
- **Related files**: 
  - `lib/codegen.js` (event name generation in _modelSet_* methods)
  - `lib/codegen.defineModel.test.js`
  - `example/src/03-props-events/test-model-child.wcc`
  - `example/src/03-props-events/test-model-parent.wcc`

## Description
The WCC compiler's `defineModel` implementation generates incorrect event names for two-way binding. The emitted events don't follow the expected naming convention, causing parent components to not receive updates properly.

## Steps to Reproduce
1. Create a child component with `defineModel`:
   ```html
   <!-- Child.wcc -->
   <script>
   const username = defineModel('username')
   </script>
   
   <template>
     <input model="username" />
   </template>
   ```

2. Use the child component in a parent:
   ```html
   <!-- Parent.wcc -->
   <script>
   const username = signal('John')
   
   function handleUsernameChange(event) {
     console.log('New value:', event.detail)
   }
   </script>
   
   <template>
     <Child :username="username()" @username-changed="handleUsernameChange" />
   </template>
   ```

3. Type in the input field
4. Observe: Parent doesn't receive the event or receives it with wrong name

## Expected Behavior
According to documentation, `defineModel` should emit events in multiple formats for cross-framework compatibility:
- `username-changed` (kebab-case, recommended)
- `usernameChange` (camelCase)
- `username:update` (Vue-style)
- `update:username` (Vue-style reverse)

## Actual Behavior
The compiler emits events with incorrect names that don't match any of the expected formats. For example, it might emit `usernameChange` when the parent is listening for `username-changed`.

## Environment
- **wcCompiler version**: v0.13.0
- **Node version**: v18.x.x
- **Browser**: Chrome/Firefox (any modern browser)
- **OS**: Windows 11

## Root Cause Analysis
*(To be filled during investigation)*

The event naming logic in the `defineModel` code generator is not following the documented convention. It may be using camelCase instead of kebab-case, or vice versa.

## Proposed Solution
Fix the event emission logic to dispatch events in all 4 formats:

```javascript
// When model value changes:
this.dispatchEvent(new CustomEvent('username-changed', { detail: newValue }))
this.dispatchEvent(new CustomEvent('usernameChange', { detail: newValue }))
this.dispatchEvent(new CustomEvent('username:update', { detail: newValue }))
this.dispatchEvent(new CustomEvent('update:username', { detail: newValue }))
```

This ensures compatibility with different framework conventions.

## Impact Assessment
- **User Impact**: Medium - Two-way binding works but with inconsistent event names
- **Frequency**: Every time `defineModel` is used with parent listeners
- **Workaround**: Listen for the actual emitted event name instead of documented name
- **Affected Components**: All parent-child communication using defineModel

## Related Bugs
- Bug #5: Missing wrapper methods in defineModel
- These bugs together make two-way binding difficult to use

## Documentation References
README.md (lines 256-306) documents that `defineModel` emits 4 event formats. This bug indicates the implementation doesn't match the documentation.

## Additional Context
Discovered during Phase 3 testing (Props and Events). While workarounds exist, this inconsistency creates confusion and breaks expected framework integration patterns.

## Resolution
**Status**: ✅ **FIXED & QA APPROVED** - Production Ready

**Root Cause**: The compiler generated event names in camelCase (`usernameChange`) instead of kebab-case (`username-changed`), violating Web Components conventions and preventing parent components from receiving events.

**Fix Applied**:
1. Modified `lib/codegen.js` to convert model names to kebab-case before generating CustomEvent dispatches
2. Formula: `userName → user-name-changed` (camelCase → kebab-case + '-changed' suffix)
3. Generic `wcc:model` event remains unchanged for backward compatibility

**QA Verification Results** (v0.16.6):
- ✅ All 12 acceptance criteria met
- ✅ Two-way binding works 100% (text, number, checkbox inputs)
- ✅ Parent state updates immediately on input changes
- ✅ Bidirectional binding confirmed (parent ↔ child)
- ✅ Zero console errors related to events
- ✅ Performance excellent (<50ms latency)
- ✅ Event listeners receive all events correctly
- ✅ Rapid changes handled smoothly (20 events/sec)

**Test Evidence**:
- Text input: "TestUser123" → Parent updated immediately ✅
- Number input: "25" → Parent shows number 25 ✅
- Checkbox: Toggle true/false → Both directions work ✅
- Reset button: Parent-to-child binding confirmed ✅
- Event verification: 18/18 events received without loss ✅

**Files Modified**:
- `lib/codegen.js` - Event name conversion logic (lines 1945-1955)
- `lib/codegen.defineModel-event-names.test.js` - NEW: 6 comprehensive tests
- `lib/codegen.defineModel-wrapper.test.js` - Updated 1 test expectation

**Release**: v0.16.6 (patch release - critical fix for two-way binding)

**QA Report**: `QA_TEST_REPORT_v016_6_EVENT_NAMING_FIX.md`
**QA Verdict**: ✅ BUG-0006 COMPLETELY FIXED - PRODUCTION READY

---

*Created from testing report dated 2026-05-13*
*Fix implemented and verified on 2026-05-15*
*QA approved on 2026-05-15*

---

*Created from testing report dated 2026-05-13*
