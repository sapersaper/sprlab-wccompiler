# BUG-0019: Incorrect Nested Loop Structure Generation with Conditionals

## Metadata
- **Status**: 🔬 research
- **Priority**: [highest]
- **Reported by**: QA Team / Lingma AI Testing
- **Date reported**: 2026-05-19
- **Version discovered**: v0.16.26
- **Severity**: Critical - Completely breaks nested loops with conditionals
- **Component**: SFC Parser / Code Generator (nested structure compilation)
- **Related files**: 
  - `lib/sfc-parser.js` (nested directive parsing)
  - `lib/codegen.js` (nested loop code generation)
  - `src/12-edge-cases/test-nested-loops.wcc`
- **Discovered during**: Testing BUG-0018 fix in v0.16.26

## Bug Summary

WCC Compiler v0.16.26 generates incorrect DOM structure for nested loops that contain conditional rendering. The compiler places the inner loop execution BEFORE the conditional wrapper, resulting in items being rendered outside their conditional container. Additionally, variable shadowing between outer and inner loop templates causes confusion and runtime errors.

## What Is the Problem?

### Source Code Structure:
```html
<div each="category in categories()" key={{ category.id }}>
  <div @click={{ () => toggleCategory(category.id) }}>
    {{ category.name }}
  </div>
  
  <!-- Conditional should wrap the inner loop -->
  <div if={{ category.expanded }} class="items-container">
    <div each="item in category.items" key={{ item.id }}>
      {{ item.name }}
      {{ item.inStock ? '✓ In Stock' : '✗ Out of Stock' }}
    </div>
  </div>
</div>
```

### Expected Generated Structure:
```javascript
// Outer loop (categories)
categories().forEach(category => {
  // Create category node
  
  // Conditional check
  if (category.expanded) {
    // Create items-container
    const container = createContainer();
    
    // Inner loop (items) - INSIDE conditional
    category.items.forEach(item => {
      const itemNode = createItemNode(item);
      container.appendChild(itemNode);
    });
    
    // Insert container into DOM
    parentNode.appendChild(container);
  }
});
```

### Actual Generated Code (BROKEN):
```javascript
// Outer loop (categories)
categories().forEach(category => {
  // Create category node
  
  // ❌ WRONG ORDER: Inner loop executes FIRST
  const __for0_tpl = document.createElement('template');
  __for0_tpl.innerHTML = `<div class="item-row">...</div>`;
  
  category.items.forEach(item => {
    const itemNode = cloneTemplate(__for0_tpl);
    // Setup item node...
    __for0_newNodes.push(itemNode);
  });
  
  // Insert items DIRECTLY (not inside conditional!)
  for (const n of __for0_newNodes) {
    __for0_anchor.parentNode.insertBefore(n, __for0_anchor);
  }
  
  // ❌ Conditional created AFTER items already inserted
  const __if0_t0 = document.createElement('template');
  __if0_t0.innerHTML = `<div class="items-container"><!-- each --></div>`;
  
  if (category.expanded) {
    const container = cloneTemplate(__if0_t0);
    // Container is EMPTY - items already inserted elsewhere!
    __if0_anchor.parentNode.insertBefore(container, __if0_anchor);
  }
});
```

## Impact

### Runtime Behavior:
1. **Effect throws errors** during execution
2. **Console shows**: `[wcc] Effect error` (7+ times)
3. **No categories render** - outer loop fails
4. **No items render** - inner loop never executes properly
5. **Component appears completely empty** despite having data

### Console Errors:
```
[wcc] Effect error: TypeError: Cannot read properties of undefined
Cannot read properties of undefined (reading 'bind')
```

### Affected Components:
- `test-nested-loops.wcc` - Completely broken
- Any component with nested loops + conditionals
- Common patterns like expandable lists, accordions, tree views

## Reproduction Steps

1. Create WCC component with nested loops
2. Add conditional rendering around inner loop: `<div if={{ condition }}><div each="..."></div></div>`
3. Compile with v0.16.26
4. Load component in browser
5. Observe console errors and empty rendering

## Technical Analysis

### Root Causes:

#### 1. **Incorrect Code Generation Order**
The compiler generates code in this order:
1. Inner loop setup and execution
2. Inner loop node insertion
3. Conditional wrapper creation

Should be:
1. Conditional check
2. Conditional wrapper creation
3. Inner loop setup and execution (inside wrapper)
4. Wrapper insertion

#### 2. **Variable Shadowing**
```javascript
// Outer loop uses __for0_tpl implicitly
const __for0_tpl = document.createElement('template');  // Line 373 - shadows outer variable
```

Both outer and inner loops use similar variable names (`__for0_tpl`, `__for0_anchor`), causing conflicts.

#### 3. **Placeholder Comments Indicate Parsing Issues**
```html
<!-- if -->
<!-- each -->
```

These comments in the generated template HTML suggest the parser isn't properly handling the nested directive structure.

### Likely Location:
File: `lib/codegen.js`
Functions:
- Nested `each` directive handling
- `if` directive wrapping logic
- Template variable naming for nested scopes

## Suggested Fix

### Approach 1: Correct Code Generation Order
```javascript
// Pseudo-code for codegen.js
function generateNestedLoop(outerLoop, innerLoop, conditional) {
  // 1. Generate outer loop
  output(`${outerLoop.source}.forEach(${outerLoop.var} => {`);
  
  // 2. Check if conditional wraps inner loop
  if (conditional.wraps(innerLoop)) {
    // Generate conditional FIRST
    output(`if (${conditional.expression}) {`);
    output(`  const container = createWrapper();`);
    
    // Generate inner loop INSIDE conditional
    output(`  ${innerLoop.source}.forEach(${innerLoop.var} => {`);
    output(`    const node = createNode();`);
    output(`    container.appendChild(node);`);
    output(`  });`);
    
    output(`  parentNode.appendChild(container);`);
    output(`}`);
  }
  
  output(`});`);
}
```

### Approach 2: Unique Variable Naming
Use scoped variable names to avoid shadowing:
```javascript
// Outer loop
const __for0_outer_tpl = ...;
const __for0_outer_anchor = ...;

// Inner loop (nested)
const __for1_inner_tpl = ...;
const __for1_inner_anchor = ...;
```

### Approach 3: AST-Based Structural Validation
Before generating code:
1. Build complete AST of nested directives
2. Validate parent-child relationships
3. Determine correct nesting order
4. Generate code respecting hierarchy

## Related Bugs

- **BUG-0018** (v0.16.25): Incorrect ternary syntax in nested loops - FIXED (syntax corrected)
- **BUG-0019** (v0.16.26): Incorrect nested loop structure - THIS BUG (structural issue)

BUG-0018 was a syntax error (missing parentheses). BUG-0019 is a structural error (wrong code generation order).

## Priority Justification

**Highest Priority** because:
1. Completely breaks nested loops with conditionals
2. Very common pattern (expandable lists, accordions, trees)
3. No workaround possible (would need to restructure entire component)
4. Makes complex UI patterns impossible
5. Discovered while verifying BUG-0018 fix - shows deeper issues

## Additional Notes

This bug was discovered when testing if BUG-0018 was fixed in v0.16.26. While the ternary syntax was corrected (parentheses added), the underlying nested loop structure generation has a more fundamental flaw.

The compiler needs to properly understand and maintain the hierarchical relationship between:
- Outer loops
- Conditionals
- Inner loops
- Other directives

Current implementation treats them as flat sequence rather than nested structure.

## Testing Requirements

After implementing fix, verify:
1. ✅ Nested loops render correctly
2. ✅ Conditionals properly wrap inner content
3. ✅ Expand/collapse functionality works
4. ✅ No variable shadowing conflicts
5. ✅ No console errors
6. ✅ Items appear/disappear based on conditional
7. ✅ Multiple levels of nesting work (loop > conditional > loop > conditional)

Test components:
- `test-nested-loops.wcc` - Primary test case
- Create additional test: `test-deeply-nested.wcc` - 3+ levels
- Create test: `test-multiple-conditionals.wcc` - Multiple if/else-if in loops
