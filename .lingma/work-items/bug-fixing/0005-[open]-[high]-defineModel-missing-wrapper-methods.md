# BUG-0005: defineModel Missing Wrapper Methods

## Metadata
- **Status**: open
- **Priority**: 🔼 `high`
- **Reported by**: Dev Team / Lingma AI Testing
- **Date reported**: 2026-05-13
- **Date resolved**: (pending)
- **Severity**: High
- **Component**: codegen.js (defineModel compilation)
- **Related files**: 
  - `lib/codegen.js`
  - `lib/codegen.defineModel.test.js`
  - `example/src/03-props-events/wcc-defineModel.wcc`

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
*(To be filled during investigation)*

The `defineModel` code generation in `lib/codegen.js` creates the signal variables but fails to generate the corresponding wrapper methods that templates expect. The template compiler assumes these wrappers exist based on the naming convention.

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

---

*Created from testing report dated 2026-05-13*
