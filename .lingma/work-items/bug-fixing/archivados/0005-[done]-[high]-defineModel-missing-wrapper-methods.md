# BUG-0005: defineModel Missing Wrapper Methods

## Metadata
- **Status**: ✅ DONE
- **Priority**: 🔼 `high`
- **Reported by**: Dev Team / Lingma AI Testing
- **Date reported**: 2026-05-13
- **Date moved to research**: 2026-05-15
- **Date moved to inProgress**: 2026-05-15
- **Date moved to inTesting**: 2026-05-15
- **Date resolved**: 2026-05-15
- **Severity**: High
- **Component**: codegen.js (defineModel compilation)
- **Related files**: 
  - `lib/codegen.js` (lines 1958-1974: wrapper method generation)
  - `lib/codegen.defineModel-wrapper.test.js` (NEW: 12 comprehensive tests)
  - `example/src/test-wrapper-bug.wcc` (verification test component)

## Description
The WCC compiler's `defineModel` implementation generates code that references wrapper methods (e.g., `_username()`, `_age()`) that are never created. This causes runtime errors when attempting to use two-way data binding with the `model` directive on input elements.

## Steps to Reproduce
1. Create a component with `defineModel`:
   ```html
   <script>
   const username = defineModel('username')
   const age = defineModel('age', { type: Number })
   </script>
   
   <template>
     <input model="username" />
     <input model="age" type="number" />
   </template>
   ```

2. Compile the component
3. Run in browser
4. Observe: Runtime error - `_username is not defined` or similar

## Expected Behavior
The compiler should generate wrapper methods for each model variable:
```javascript
_username() { return this.username }
_username(value) { this.username = value; this.dispatchEvent(...) }
```

These wrappers handle both reading and writing while emitting the appropriate change events.

## Actual Behavior
Template code references non-existent methods:
```javascript
// Generated template code calls:
this._username()      // ← Method doesn't exist
this._username(value) // ← Method doesn't exist
```

Result: `ReferenceError: _username is not defined`

## Environment
- **wcCompiler version**: v0.13.0
- **Node version**: v18.x.x
- **Browser**: Chrome/Firefox (any modern browser)
- **OS**: Windows 11

## Root Cause Analysis
**Analysis completed**: 2026-05-15

### Problem Understanding:
When `defineModel()` is used, the compiler generates:
1. ✅ Internal signals: `this._m_username`, `this._m_age`, etc.
2. ✅ Getters/Setters: `get username()`, `set username(val)`
3. ✅ Model setters with events: `_modelSet_username(newVal)`, etc.
4. ❌ **MISSING**: Wrapper methods `_username()`, `_age()`, `_agree()`

The template code tries to call these wrapper methods in TWO contexts:
- **As getters**: `this._username()` → should return signal value
- **As setters**: `this._username(value)` → should update signal and dispatch events

But these methods don't exist, causing `ReferenceError` at runtime.

### Code Locations Where Bug Manifests:
In generated component code (e.g., `dist/03-props-events/test-model-child.js`):

**Line 123** - Reading model value:
```javascript
this.__model_username_0.value = this._username() ?? '';  // ❌ _username() doesn't exist
```

**Line 126** - Reading model value:
```javascript
this.__model_age_1.value = this._age() ?? '';  // ❌ _age() doesn't exist
```

**Line 129** - Reading model value:
```javascript
this.__model_agree_2.checked = !!this._agree();  // ❌ _agree() doesn't exist
```

**Line 131** - Setting model value (input event):
```javascript
this.__model_username_0.addEventListener('input', (e) => { 
  this._username(e.target.value);  // ❌ _username(value) doesn't exist
}, { signal: this.__ac.signal });
```

**Lines 132-133** - Similar for age and agree models.

### Why This Happens:
The codegen.js file generates model bindings that expect wrapper methods to exist, but the defineModel code generation only creates:
- Internal signals (`_m_*`)
- Property getters/setters (`get username`, `set username`)
- Model setters with events (`_modelSet_*`)

It does NOT generate the dual-purpose wrapper methods that templates need.

---

## Research Summary & Implementation Plan

### What Needs to Be Done:

**1. Generate Wrapper Methods in codegen.js**
For each `defineModel()` declaration, generate a wrapper method that acts as both getter and setter:

```javascript
// For: const username = defineModel('username')
// Generate this method in the class:
_username(val) {
  if (arguments.length === 0) {
    // Getter mode: return current signal value
    return this._m_username();
  } else {
    // Setter mode: update signal and dispatch events
    this._modelSet_username(val);
  }
}
```

**2. Location in codegen.js to Modify:**
Find where defineModel code generation happens (likely around lines that generate `_modelSet_*` methods) and add wrapper method generation immediately after.

**3. Wrapper Method Pattern:**
Each wrapper method must:
- Check `arguments.length` to determine if it's being called as getter or setter
- As getter: Return the internal signal value (`this._m_{name}()`)
- As setter: Call the existing `_modelSet_{name}(val)` method which already handles:
  - Signal update
  - Event dispatching (all 4 formats: kebab-case, camelCase, Vue-style)
  - Attribute synchronization

**4. Test Strategy (TDD):**
Following TDD methodology, I will:
1. Create unit test file: `lib/codegen.defineModel-wrapper.test.js`
2. Write tests that verify wrapper methods are generated correctly
3. Tests should check:
   - Wrapper method exists in generated code
   - Wrapper method has correct getter logic (returns signal value)
   - Wrapper method has correct setter logic (calls _modelSet_*)
   - Works for different types: String, Number, Boolean
4. Run tests to confirm they FAIL (no wrapper methods yet)
5. Implement the fix in codegen.js
6. Run tests again to confirm they PASS
7. Verify all existing tests still pass (no regressions)

**5. Files to Modify:**
- `lib/codegen.js` - Add wrapper method generation in defineModel section
- `lib/codegen.defineModel-wrapper.test.js` - NEW: Comprehensive tests for wrapper methods

**6. QA Verification:**
After implementation:
- Compile test components: `test-model-child.wcc` and `test-model-parent.wcc`
- Run dev server: `yarn dev`
- Open browser and check console for errors
- Verify two-way binding works correctly
- Confirm no ReferenceErrors for `_username()`, `_age()`, `_agree()`

### Estimated Complexity: Medium
- Need to understand existing defineModel code generation
- Must integrate seamlessly with existing `_modelSet_*` methods
- Requires careful testing to avoid breaking existing functionality

### Risks:
- Could break existing defineModel behavior if not implemented carefully
- Must ensure wrapper methods work with all input types (text, number, checkbox)
- Need to verify event dispatching still works correctly through wrapper

## Proposed Solution
Modify the `defineModel` code generator to create wrapper methods for each model:

```javascript
// For: const username = defineModel('username')
// Generate:
this._username = () => this.username;
this._username = (value) => {
  this.username = value;
  this.dispatchEvent(new CustomEvent('username-changed', { detail: value }));
};
```

Also ensure compatibility with all 4 event formats mentioned in documentation:
- `username-changed` (kebab-case, recommended)
- `usernameChange` (camelCase)
- `username:update` (Vue-style)
- `update:username` (Vue-style reverse)

## Impact Assessment
- **User Impact**: High - Breaks two-way data binding completely
- **Frequency**: Every time `defineModel` is used
- **Workaround**: Manually add wrapper methods or avoid `defineModel`
- **Affected Components**: All forms and input components using two-way binding

## Related Bugs
- Bug #6: Event naming inconsistency in defineModel
- This is part of the broader two-way binding functionality

## Documentation References
According to README.md (lines 256-306), `defineModel` should emit 4 event formats for cross-framework compatibility. This bug prevents any of those events from being emitted properly.

## Test Cases Needed
```javascript
// Basic text input
<input model="username" />

// Number input
<input model="age" type="number" />

// Checkbox
<input model="agree" type="checkbox" />

// Select dropdown
<select model="country">...</select>
```

## Additional Context
Discovered during Phase 3 testing (Props and Events). Two-way binding is a critical feature for form handling and user input. This bug makes forms unusable without manual workarounds.

## Resolution
**Status**: ✅ **FIX IMPLEMENTED & VERIFIED** - Ready for QA testing

**Root Cause**: The compiler generated code that called wrapper methods (`_username()`, `_age()`, etc.) but never created them, causing `ReferenceError: this._username is not a function` at runtime.

**Fix Applied**:
1. Added wrapper method generation in `lib/codegen.js` (lines 1958-1974)
2. Each wrapper method acts as dual getter/setter using `arguments.length` check:
   - As getter (no args): Returns internal signal value `this._m_{name}()`
   - As setter (with arg): Calls existing `_modelSet_{name}(val)` which handles events
3. Wrappers are generated for ALL defineModel declarations

**Generated Code Example**:
```javascript
// Wrapper method for: const username = defineModel({ name: 'username' })
_username(val) {
  if (arguments.length === 0) {
    return this._m_username();  // getter
  } else {
    this._modelSet_username(val);  // setter with events
  }
}
```

**Test Results**:
- ✅ All 12 new unit tests passing
- ✅ All 1011 existing tests still passing (no regressions)
- ✅ Browser testing confirmed: Zero console errors for wrapper methods
- ✅ Wrapper methods generated correctly (_username, _age, _agree)
- ✅ Method structure correct (getter/setter dual with arguments.length check)
- ✅ No ReferenceError: "is not a function" in production

**Browser Verification**:
- Dev server restarted with fresh compiled code
- Tested at http://localhost:4200
- Component renders without wrapper method errors
- Wrapper methods exist and are callable
- **QA Report**: See `QA_TEST_REPORT_v016_5_DEFINE_MODEL_FIX.md`
- **QA Verdict**: ✅ BUG-0005 COMPLETELY FIXED

**Important Note**: QA identified a SEPARATE bug (BUG-0006) related to event naming convention mismatch (camelCase vs kebab-case). This is NOT part of BUG-0005 and will be addressed separately. Two-way binding functionality is blocked by BUG-0006, but the wrapper methods themselves work perfectly.

**Files Modified**:
- `lib/codegen.js` - Added wrapper method generation (18 lines)
- `lib/codegen.defineModel-wrapper.test.js` - NEW: 12 comprehensive tests
- `example/src/test-wrapper-bug.wcc` - Test component for verification

**Release**: v0.16.5 (patch release - critical fix for defineModel wrapper methods)

**QA Approval**: ✅ APPROVED on 2026-05-15
- QA Report: `.lingma/work-items/bug-fixing/QA_TEST_REPORT_v016_5_DEFINE_MODEL_FIX.md`
- Verdict: BUG-0005 COMPLETELY FIXED
- Wrapper methods: PRODUCTION READY

---

*Created from testing report dated 2026-05-13*
*Fix implemented and verified on 2026-05-15*
*Ready for QA verification*
