# BUG-0009: Multi-Property :style Binding Generates Invalid Object Syntax

## Metadata
- **Status**: open
- **Priority**: 🔼 `high`
- **Reported by**: Dev Team / Lingma AI Testing
- **Date reported**: 2026-05-13
- **Date resolved**: (pending)
- **Severity**: High
- **Component**: codegen.js (attribute binding compilation)
- **Related files**: 
  - `lib/codegen.js`
  - `example/src/04-directives/wcc-attr-binding.wcc`

## Description
The WCC compiler generates invalid JavaScript syntax when processing `:style` bindings with multiple properties. The generated object literal has incorrect key-value pairs where reactive expressions are used as keys instead of property names.

## Steps to Reproduce
1. Create a component with multi-property `:style` binding:
   ```html
   <script>
   const textColor = signal('red')
   const fontSize = signal(16)
   </script>
   
   <template>
     <div :style="{ color: textColor(), fontSize: fontSize() + 'px' }">
       Styled Text
     </div>
   </template>
   ```

2. Compile the component
3. Run in browser
4. Observe: JavaScript syntax error or incorrect styling

## Expected Behavior
Generated code should produce valid JavaScript object:
```javascript
const __obj = { 
  color: this._s_textColor(), 
  fontSize: this._s_fontSize() + 'px',
  fontWeight: 'bold' 
}
```

## Actual Behavior
Compiler generates invalid syntax with reactive expressions as object keys:
```javascript
const __obj = { 
  color: this._s_textColor(), 
  this._s_fontSize(): this._s_fontSize() + 'px',
  fontWeight: 'bold' 
}
```

The second property has `this._s_fontSize()` as the key instead of `fontSize`, which is invalid JavaScript syntax.

## Environment
- **wcCompiler version**: v0.13.0
- **Node version**: v18.x.x
- **Browser**: Chrome/Firefox (any modern browser)
- **OS**: Windows 11

## Root Cause Analysis
*(To be filled during investigation)*

Similar to Bug #3 (dynamic :class), the issue is in how the compiler processes object literals in attribute bindings. When it encounters a reactive expression, it incorrectly uses the entire expression as both key and value instead of just the value.

## Proposed Solution
Fix the object literal parsing for `:style` and other attribute bindings to:
1. Properly distinguish between object keys (property names) and values (expressions)
2. Keep keys as string literals
3. Evaluate values as reactive expressions
4. Handle both static and dynamic properties correctly

## Test Cases to Cover
```javascript
// Single property
:style="{ color: textColor() }"

// Multiple properties
:style="{ color: textColor(), fontSize: fontSize() + 'px' }"

// Mixed static and dynamic
:style="{ color: 'red', fontSize: size() + 'px', fontWeight: 'bold' }"

// Complex expressions
:style="{ transform: `rotate(${angle()}deg)` }"
```

## Impact Assessment
- **User Impact**: High - Breaks dynamic inline styling
- **Frequency**: Every time `:style` is used with multiple properties
- **Workaround**: Manually patch compiled output or use single-property styles
- **Affected Components**: All components using dynamic inline styles

## Related Bugs
- Bug #3: Similar issue with dynamic `:class` bindings
- Both bugs indicate a systematic problem with object literal generation in attribute bindings

## Workaround
Use single property per `:style` binding or manually patch the compiled output:
```html
<!-- Workaround: Split into separate bindings -->
<div :style="{ color: textColor() }" style="font-size: 16px">
```

Or patch the compiled JavaScript to fix the object syntax.

## Additional Context
Discovered during Phase 4 testing (Directives). This bug prevents developers from using dynamic inline styles, which are common for theming, animations, and responsive design.

---

*Created from testing report dated 2026-05-13*
