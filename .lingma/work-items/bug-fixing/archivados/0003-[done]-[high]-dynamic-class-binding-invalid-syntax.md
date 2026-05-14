# BUG-0003: Dynamic :class Binding Generates Invalid JavaScript Syntax

## Metadata
- **Status**: ✅ done
- **Priority**: 🔼 `high`
- **Reported by**: Dev Team / Lingma AI Testing
- **Date reported**: 2026-05-13
- **Date resolved**: 2026-05-14
- **Date verified**: 2026-05-14
- **Severity**: High (VERIFIED: Not reproducible - feature working correctly)
- **Component**: codegen.js (template compilation)
- **Related files**: 
  - `lib/codegen.js` (lines 1542-1556 - class binding generation)
  - `lib/codegen.class-binding-syntax.test.js` (5 comprehensive tests)
  - `example/src/bug-0003-class-binding-test.wcc` (QA test component)

## Description
The WCC compiler generates invalid JavaScript syntax when processing dynamic `:class` bindings in templates. The generated code creates object literals with incorrect key-value pairs that cause runtime errors.

## Steps to Reproduce
1. Create a component with dynamic `:class` binding:
   ```html
   <script>
   const active = signal(false)
   </script>
   
   <template>
     <div :class="{ active: active() }">Content</div>
   </template>
   ```

2. Compile the component using `wcc compile`
3. Run the compiled output in browser
4. Observe: JavaScript syntax error in console

## Expected Behavior
Generated code should produce valid JavaScript:
```javascript
{ 'active': this._s_active() }
```

## Actual Behavior
Compiler generates invalid syntax:
```javascript
{ this._s_active(): this._s_active() }
```

This creates an object where the key is a function call instead of a string literal, which is invalid JavaScript.

## Environment
- **wcCompiler version**: v0.13.0
- **Node version**: v18.x.x
- **Browser**: Chrome/Firefox (any modern browser)
- **OS**: Windows 11

## Root Cause Analysis
*(To be filled during investigation)*

Likely issue in `lib/codegen.js` template processing where dynamic class bindings are converted to JavaScript object literals. The compiler is not properly wrapping keys as string literals.

## Proposed Solution
Fix the code generation logic for `:class` bindings to ensure:
1. Object keys are always string literals
2. Object values are the reactive expressions
3. Proper escaping/sanitization of class names

## Impact Assessment
- **User Impact**: High - Breaks dynamic styling functionality
- **Frequency**: Every time `:class` is used with dynamic values
- **Workaround**: Avoid dynamic `:class` bindings or manually patch compiled output
- **Affected Components**: All components using conditional classes

## Related Bugs
- Bug #9: Similar issue with `:style` multi-property bindings

## Additional Context
Discovered during Phase 3 testing (Props and Events). This prevents developers from using one of the most common Vue/Angular patterns for conditional styling.

## Verification & Resolution
**Status**: ✅ **VERIFIED WORKING** - Bug not reproducible in current codebase

**Testing Performed**:
1. Created comprehensive test suite: `lib/codegen.class-binding-syntax.test.js` (5 tests)
2. Created QA test component: `example/src/bug-0003-class-binding-test.wcc`
3. Tested all variations of :class syntax:
   - Object syntax: `{ active: isActive() }`
   - String syntax: `theme()`
   - Array syntax: `[customClass(), size()]`
   - Static + Dynamic combination
   - Multiple conditions

**Generated Code Analysis**:
The compiler correctly generates valid JavaScript for object :class bindings:
```javascript
// Generated code (CORRECT):
const __obj = { active: this._isActive() };
for (const [__k, __val] of Object.entries(__obj)) {
  __val ? this.__attr_class_0.classList.add(__k) : this.__attr_class_0.classList.remove(__k);
}
```

**Implementation Details** (`lib/codegen.js`, lines 1542-1556):
- Object syntax uses `classList.add/remove` with `Object.entries()` iteration
- String syntax uses direct `className` assignment
- Both approaches generate valid, efficient JavaScript
- Signal transformations work correctly (`isActive()` → `this._isActive()`)

**Test Results**:
- ✅ All 5 unit tests passing
- ✅ No syntax errors in generated code
- ✅ Reactive updates working correctly
- ✅ classList API used efficiently

**Conclusion**: The :class dynamic binding feature is fully functional and generates correct JavaScript. The originally reported bug may have been fixed in a previous version or was based on outdated code.

---

*Created from testing report dated 2026-05-13*
*Verified and closed on 2026-05-14 - Feature working correctly*
