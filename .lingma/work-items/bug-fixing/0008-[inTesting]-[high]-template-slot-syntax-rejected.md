# BUG-0008: Compiler Rejects template slot="name" Syntax

## Metadata
- **Status**: 🧪 inTesting
- **Priority**: 🔴 `high`
- **Reported by**: QA Team / Lingma AI Testing
- **Date reported**: 2026-05-13
- **Date moved to research**: 2026-05-15
- **Date moved to inProgress**: 2026-05-15
- **Date moved to inTesting**: 2026-05-15
- **Date moved back to inProgress**: 2026-05-15 (v0.16.8 fix failed, implementing proper solution)
- **Date moved to inTesting (v2)**: 2026-05-15 (proper fix implemented, ready for QA)
- **Date resolved**: (pending)
- **Severity**: Medium-High - Blocks Vue-style slot syntax, requires workaround
- **Component**: SFC Parser / Template Compiler
- **Related files**: 
  - `lib/parser.js` - SFC template parsing logic
  - `lib/codegen.js` - Slot code generation
  - `example/src/05-slots-models/test-slots-parent.wcc` (uses workaround)
  - `example/src/05-slots-models/test-slot-child.wcc`

## Description
The WCC compiler incorrectly rejects `<template slot="name">` syntax, treating it as a duplicate template block error. This prevents users from using the standard Vue/Angular pattern for named slots.

## Steps to Reproduce
1. Create a component with named slots using template tags:
   ```html
   <!-- Parent.wcc -->
   <script>
   </script>
   
   <template>
     <Child>
       <template slot="header">
         <h1>Header Content</h1>
       </template>
       
       <template slot="footer">
         <p>Footer Content</p>
       </template>
     </Child>
   </template>
   ```

2. Compile the component
3. Observe: Compilation error - "duplicate template blocks"

## Expected Behavior
The compiler should accept `<template slot="name">` as valid syntax for named slots, following Vue/Angular conventions:
```html
<Child>
  <template slot="header">...</template>
  <template slot="footer">...</template>
</Child>
```

## Actual Behavior
The SFC parser treats each `<template>` tag as a potential component template block and throws an error about duplicate templates, even though these are slot content templates, not component templates.

## Environment
- **wcCompiler version**: v0.13.0
- **Node version**: v18.x.x
- **Browser**: Chrome/Firefox (any modern browser)
- **OS**: Windows 11

## Root Cause Analysis
*(To be filled during investigation)*

The parser in `lib/parser.js` likely counts all `<template>` tags without distinguishing between:
1. The main component template (`<template>` at root level)
2. Slot content templates (`<template slot="...">` inside parent template)

## Proposed Solution
Update the SFC parser to:
1. Recognize `<template slot="...">` as slot content, not component templates
2. Only count root-level `<template>` tags as component templates
3. Allow multiple `<template slot="...">` tags within the main template
4. Maintain backward compatibility with existing slot syntax

## Workaround
Use regular HTML elements instead of template tags for named slots:
```html
<!-- Instead of: -->
<template slot="header">
  <h1>Header</h1>
</template>

<!-- Use: -->
<div slot="header">
  <h1>Header</h1>
</div>
```

This workaround was confirmed working in testing (Test 5.1).

## Impact Assessment
- **User Impact**: Low - Workaround available and functional
- **Frequency**: When using named slots with template tags
- **Workaround**: Available (use div or other elements with slot attribute)
- **Affected Components**: Components using named slots
- **Standards Compliance**: Doesn't follow Vue/Angular conventions

## Documentation References
According to testing results, the correct syntax is `<div slot="header">` NOT `<template slot="header">`. This limitation should be documented if it's intentional.

## Additional Context
Discovered during Phase 5 testing (Slots). While the workaround works, this limits compatibility with Vue/Angular code migration and goes against established framework conventions.

---

*Created from testing report dated 2026-05-13*
