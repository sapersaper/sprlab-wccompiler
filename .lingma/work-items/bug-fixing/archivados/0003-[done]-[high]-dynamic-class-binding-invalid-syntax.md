# BUG-0003: Dynamic :class Binding Generates Invalid JavaScript Syntax

## Metadata
- **Status**: ✅ done
- **Priority**: 🔼 `high`
- **Reported by**: Dev Team / Lingma AI Testing
- **Date reported**: 2026-05-13
- **Date moved to testing**: 2026-05-14
- **Date resolved**: 2026-05-14
- **QA verified**: 2026-05-14
- **Severity**: High
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

## Resolution
**Status**: ✅ **VERIFIED FIXED** - Bug resolved by previous template expression fixes

**Root Cause**: The issue was automatically resolved when implementing the fix for parameterless functions in templates (Bug #0001). The template expression transformation logic now correctly handles object literals in `:class` bindings.

**Verification**:
- Created comprehensive test suite: `lib/codegen.class-binding-syntax.test.js` (5 tests) - all passing
- Created QA test component: `example/src/bug-0003-class-binding-test.wcc`
- Tested all variations: object syntax, string syntax, array syntax, static + dynamic combinations
- Generated code produces valid JavaScript with proper classList.add/remove operations
- QA team verified functionality in browser - all tests passing

**Generated Code Example** (CORRECT):
```javascript
const __obj = { active: this._isActive() };
for (const [__k, __val] of Object.entries(__obj)) {
  __val ? this.__attr_class_0.classList.add(__k) : this.__attr_class_0.classList.remove(__k);
}
```

**Conclusion**: No code changes were needed specifically for this bug. It was resolved as a side effect of the template expression transformation improvements implemented for Bug #0001.

---

*Created from testing report dated 2026-05-13*
*QA verified and closed on 2026-05-14*
