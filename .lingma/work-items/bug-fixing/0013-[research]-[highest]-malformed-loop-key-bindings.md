# BUG-0013: Malformed Loop Key Bindings in Generated Code

## Metadata
- **Status**: 🔄 inProgress
- **Priority**: [highest]
- **Reported by**: QA Team / Lingma AI Testing
- **Date reported**: 2026-05-18
- **Date moved to research**: 2026-05-18
- **Date moved to inProgress**: 2026-05-18
- **Version discovered**: v0.16.17
- **Severity**: Critical - Prevents components with keyed loops from rendering entirely
- **Component**: SFC Parser / Template Compiler (attribute parsing logic)
- **Related files**: 
  - `lib/sfc-parser.js` (template attribute parsing)
  - `lib/codegen.js` (key binding generation)
- **Discovered during**: Complex edge case testing with test-kitchen-sink.wcc and test-deep-nesting.wcc

## Bug Summary

WCC Compiler v0.16.17 generates malformed HTML attributes when processing `key={{ item.property }}` bindings in each loops, especially when combined with other complex features (nested conditionals, dynamic components, slots). This causes components to fail initialization completely.

## What Is the Problem?

When using keyed loops with object property access, the compiler's attribute parser breaks the key expression into multiple invalid HTML attributes instead of generating a single proper key binding.

### Example Template:
```html
<div each="item in items()" key="{{ item.id }}">
  <span>{{ item.name }}</span>
</div>
```

### Current Behavior:
- ❌ Component fails to render (empty DOM)
- ❌ `connectedCallback` never completes
- ❌ `__connected` flag remains `false`
- ❌ No console errors (silent failure)
- ❌ Generated HTML contains malformed attributes

### Expected Behavior:
- ✅ Component renders correctly
- ✅ Key binding works for reconciliation
- ✅ UI updates when data changes
- ✅ No malformed attributes in generated code

## Root Cause Analysis

The SFC parser's attribute value tokenizer fails to properly handle Mustache-style interpolation (`{{ }}`) inside attribute values when:
1. The expression contains dots (property access): `item.id`
2. Combined with complex template structures
3. Nested within loops with other directives

### Generated Code (Current - WRONG):
```html
<!-- ❌ MALFORMED OUTPUT -->
<div key="{{" item.id="" }="">
  <span>Item Name</span>
</div>
```

The parser splits `{{ item.id }}` into separate attributes:
- `key="{{"`
- `item.id=""`
- `}=""`
- `"">`

### Expected Generated Code:
```html
<!-- ✅ CORRECT OUTPUT -->
<div key="1"> <!-- or reactive binding -->
  <span>Item Name</span>
</div>
```

Or in JavaScript runtime:
```javascript
// Should generate reactive key binding
node.key = item.id;
// Or use data attribute for reconciliation
node.setAttribute('data-key', item.id);
```

## Impact Assessment

### Before Fix:
- ❌ Components with keyed loops fail to render
- ❌ Silent failures (no clear error messages)
- ❌ Blocks development of real-world applications
- ❌ Forces developers to remove keys (causing BUG-0012 reactivity issues)

### After Fix:
- ✅ Keyed loops work correctly
- ✅ Proper reconciliation with performance benefits
- ✅ Clear component rendering
- ✅ No silent failures

## Recommended Solution

Fix the attribute value parser in SFC parser to properly handle Mustache interpolation:

### Option 1: Improve Tokenizer (Recommended)
Enhance the attribute parser to recognize complete Mustache expressions:

```javascript
// In sfc-parser.js attribute parsing logic:
function parseAttributeValue(value) {
  // Match complete {{ expression }} patterns
  const mustacheRegex = /\{\{([^}]+)\}\}/g;
  const matches = [...value.matchAll(mustacheRegex)];
  
  if (matches.length > 0) {
    // Extract and evaluate the expression
    const expression = matches[0][1].trim();
    return {
      type: 'expression',
      value: expression,
      raw: value
    };
  }
  
  // Handle static values
  return {
    type: 'static',
    value: value
  };
}
```

### Option 2: Use Different Syntax for Keys
Introduce special syntax for key bindings that avoids Mustache conflicts:

```html
<!-- Alternative syntax -->
<div each="item in items()" :key="item.id">
```

This would be parsed differently from regular attributes.

### Option 3: Pre-process Attributes
Before main parsing, extract and replace Mustache expressions with placeholders:

```javascript
// Pre-processing step
const placeholders = [];
template = template.replace(/\{\{([^}]+)\}\}/g, (match, expr) => {
  const placeholder = `__MUSTACHE_${placeholders.length}__`;
  placeholders.push(expr);
  return placeholder;
});

// Parse template with placeholders
// ...

// Restore expressions in codegen
placeholders.forEach((expr, i) => {
  // Replace __MUSTACHE_i__ with actual expression
});
```

## Testing Evidence

Browser Agent testing revealed:

| Test | Result |
|------|--------|
| Component Initialization | ❌ FAIL - connectedCallback never completes |
| DOM Rendering | ❌ FAIL - innerHTML = 0 (empty) |
| Console Errors | ⚠️ None (silent failure) |
| __connected Flag | ❌ Remains false |
| Generated HTML | ❌ Contains malformed attributes |

### Affected Components:
- `test-kitchen-sink.wcc` - Uses `key={{ item.id }}` in loop → FAILS
- `test-deep-nesting.wcc` - Uses `key={{ item.id }}` in nested loops → FAILS
- `test-rapid-updates.wcc` - Doesn't use keys → WORKS ✅

### Screenshots Available:
- `screenshot_test_12_1_kitchen_sink_initial.png` - Shows empty component tag

## Acceptance Criteria

Please verify ALL of the following before marking bug as resolved:

- [ ] Components with `key="{{ item.property }}"` render correctly
- [ ] No malformed attributes in generated HTML
- [ ] `connectedCallback` completes successfully
- [ ] `__connected` flag set to true
- [ ] Key-based reconciliation works (items maintain identity)
- [ ] UI updates when keyed items change
- [ ] No console errors during rendering
- [ ] Works with nested loops
- [ ] Works with dynamic property access: `key="{{ item.user.id }}"`
- [ ] Works with function calls: `key="{{ getKey(item) }}"`
- [ ] Performance benefits of keyed reconciliation preserved
- [ ] All existing tests pass (no regressions)
- [ ] Error message shown if key binding is invalid (instead of silent failure)

## How to Reproduce

1. Create component with keyed loop using object property:
```html
<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-keyed-loop' })

const items = signal([
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' }
])
</script>

<template>
<ul>
  <li each="item in items()" key="{{ item.id }}">
    {{ item.name }}
  </li>
</ul>
</template>
```

2. Compile with WCC Compiler v0.16.17
3. Load in browser
4. Observe: Component tag exists but is empty, no content rendered
5. Check DevTools: No errors in console, but DOM is empty

## Priority Justification

This bug is HIGHEST priority because:

1. **Blocks Core Feature**: Keyed loops are essential for list performance
2. **Silent Failure**: No error messages make debugging difficult
3. **Cascading Impact**: Without keys, BUG-0012 (loop reactivity) may resurface
4. **Real-World Impact**: Most production apps use keyed lists
5. **Easy to Trigger**: Any component with `key="{{ item.property }}"` fails
6. **No Workaround**: Removing keys causes performance/reactivity issues

## Related Bugs

- **BUG-0012**: Missing Reactivity in Each Loops (FIXED in v0.16.17)
  - Related: Both affect loop functionality
  - BUG-0012 was about UI updates, this is about rendering
  - If keys don't work, may need to remove them, which could cause BUG-0012-like issues

- **BUG-0014**: Malformed Conditional Rendering Syntax
  - Discovered in same testing session
  - Same root cause: SFC parser attribute/expression handling

## Workarounds (Until Fix is Available)

### Workaround 1: Remove Keys (NOT RECOMMENDED)
```html
<!-- Instead of: -->
<li each="item in items()" key="{{ item.id }}">

<!-- Use: -->
<li each="item in items()">
```
⚠️ Warning: Causes poor performance, may trigger BUG-0012 reactivity issues, loses focus state

### Workaround 2: Use Index as Key (LIMITED)
```html
<li each="(item, index) in items()" key="{{ index }}">
```
⚠️ Warning: Only works if list order never changes, can cause bugs with reordering

### Workaround 3: Compute Key in Script
```javascript
const itemsWithKeys = () => items().map(item => ({
  ...item,
  _key: String(item.id) // Convert to string
}))
```
```html
<li each="item in itemsWithKeys()" key="{{ item._key }}">
```
⚠️ Warning: May not work if parser issue is with Mustache syntax itself

## Questions or Issues?

If you need more information:
- Check QA report: `QA_EDGE_CASE_BUGS_v016_17_CRITICAL.md`
- Review screenshots in project root
- Test with provided component code below
- Compare generated code between working/failing components

---

## Test Component for Development

Use this component to reproduce and test the fix:

```html
<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-bug-0013-keyed-loops',
})

const items = signal([
  { id: 1, name: 'Item 1', active: true },
  { id: 2, name: 'Item 2', active: false },
  { id: 3, name: 'Item 3', active: true }
])

const nextId = signal(4)

function addItem() {
  const newItem = {
    id: nextId(),
    name: `Item ${nextId()}`,
    active: false
  }
  items.set([...items(), newItem])
  nextId.set(nextId() + 1)
}

function toggleActive(id) {
  items.set(items().map(item => 
    item.id === id ? { ...item, active: !item.active } : item
  ))
}

function removeLastItem() {
  const currentItems = items()
  if (currentItems.length > 0) {
    items.set(currentItems.slice(0, -1))
  }
}
</script>

<style>
.test-container {
  padding: 20px;
  font-family: Arial, sans-serif;
}

.item-list {
  list-style: none;
  padding: 0;
}

.item-card {
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  padding: 15px;
  margin: 10px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-card.active {
  border-color: #48bb78;
  background: #f0fff4;
}

.item-card.inactive {
  border-color: #f56565;
  background: #fff5f5;
  opacity: 0.7;
}

button {
  padding: 8px 16px;
  margin: 0 5px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
}

.btn-toggle { background: #667eea; color: white; }
.btn-add { background: #48bb78; color: white; }
.btn-remove { background: #f56565; color: white; }
</style>

<template>
<div class="test-container">
  <h2>BUG-0013 Test: Keyed Loop Rendering</h2>
  <p>This component should render a list of items with proper key bindings.</p>
  
  <div style="margin-bottom: 15px;">
    <button class="btn-add" @click="addItem()">Add Item</button>
    <button class="btn-remove" @click="removeLastItem()">Remove Last</button>
  </div>
  
  <p>Total items: {{ items().length }}</p>
  
  <ul class="item-list">
    <li each="item in items()" key="{{ item.id }}">
      <div class="item-card" :class="{ active: item.active, inactive: !item.active }">
        <div>
          <strong>{{ item.name }}</strong>
          <p>Status: {{ item.active ? '✓ Active' : '✗ Inactive' }}</p>
          <small>ID (key): {{ item.id }}</small>
        </div>
        <button class="btn-toggle" @click="toggleActive(item.id)">Toggle</button>
      </div>
    </li>
  </ul>
  
  <div if={{ items().length === 0 }}>
    <p style="color: #718096; text-align: center; padding: 20px;">
      No items. Click "Add Item" to create some.
    </p>
  </div>
</div>
</template>
```

### Expected Behavior After Fix:
1. Component renders immediately on page load
2. Shows 3 initial items with correct styling
3. "Add Item" button creates new items with unique keys
4. "Remove Last" button removes items correctly
5. "Toggle" button changes item status and updates UI
6. Items maintain their identity (no flickering)
7. No console errors
8. Smooth performance even with 50+ items

### What to Check in Generated Code:
1. Look for `key=` attributes - should NOT be split into multiple attributes
2. Verify reconciliation logic uses keys correctly
3. Check that effects capture current item references
4. Ensure no malformed HTML in output

---

**Report Generated**: 2026-05-18  
**Discovered By**: Lingma AI QA Team  
**Ready for Dev**: ✅ YES - Component code included above for testing  

This bug prevents any component with keyed loops from rendering and requires immediate attention.
