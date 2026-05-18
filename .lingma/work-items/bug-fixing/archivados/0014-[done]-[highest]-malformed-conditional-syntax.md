# BUG-0014: Malformed Conditional Rendering Syntax in Generated Code

## Metadata
- **Status**: ✅ done
- **Priority**: [highest]
- **Reported by**: QA Team / Lingma AI Testing
- **Date reported**: 2026-05-18
- **Date moved to research**: 2026-05-18
- **Date moved to inProgress**: 2026-05-18
- **Date moved to inTesting**: 2026-05-18
- **Date moved to done**: 2026-05-18
- **Version fixed**: v0.16.22
- **Version discovered**: v0.16.17
- **Severity**: Critical - Prevents components with complex conditionals from rendering
- **Component**: SFC Parser / Template Compiler (conditional expression parsing)
- **Related files**: 
  - `lib/sfc-parser.js` (if/else-if directive parsing)
  - `lib/codegen.js` (conditional code generation)
- **Discovered during**: Complex edge case testing with test-kitchen-sink.wcc

## Bug Summary

WCC Compiler v0.16.17 generates malformed HTML when processing conditional directives (`if`, `else-if`) with comparison operators or complex expressions, causing components to fail initialization completely.

## What Is the Problem?

When using conditionals with comparison operators (`>`, `<`, `===`, etc.) or array method calls (`.length`), the compiler's expression parser breaks and generates invalid HTML attributes instead of proper conditional logic.

### Example Template:
```html
<div if="{{ items().length > 0 }}">
  <p>Has items</p>
</div>
<div else-if="{{ items().length === 0 }}">
  <p>No items</p>
</div>
```

### Current Behavior:
- ❌ Component fails to render (empty DOM)
- ❌ `connectedCallback` never completes
- ❌ `__connected` flag remains `false`
- ❌ Generated HTML contains malformed attributes
- ❌ No clear error messages

### Expected Behavior:
- ✅ Component renders correctly
- ✅ Conditionals evaluate properly
- ✅ UI shows/hides based on conditions
- ✅ Valid HTML in generated code

## Root Cause Analysis

The SFC parser's expression evaluator fails to handle:
1. Comparison operators within Mustache syntax
2. Array/object method calls (`.length`, `.size()`)
3. Multiple conditions with logical operators
4. Nested parentheses in expressions

### Generated Code (Current - WRONG):
```html
<!-- ❌ MALFORMED OUTPUT -->
<div items().length=""> 0 }}>
  <p>Has items</p>
</div>
```

The parser incorrectly interprets `if="{{ items().length > 0 }}"` as:
- Attribute name: `items().length`
- Attribute value: `""> 0 }}>`

This creates invalid HTML that breaks the entire component.

### Expected Generated Code:
```javascript
// Should generate something like:
const __condition_1 = this._items().length > 0;
if (__condition_1) {
  // Render "Has items" content
} else if (this._items().length === 0) {
  // Render "No items" content
}
```

Or in template with proper reactive binding:
```html
<div data-if="items().length > 0">
  <p>Has items</p>
</div>
```

## Impact Assessment

### Before Fix:
- ❌ Components with comparison conditionals fail to render
- ❌ Cannot show empty states, validation messages, etc.
- ❌ Silent failures make debugging difficult
- ❌ Forces developers to pre-compute all booleans (cumbersome)

### After Fix:
- ✅ Complex conditionals work correctly
- ✅ Can use comparisons directly in templates
- ✅ Better developer experience
- ✅ More expressive templates

## Recommended Solution

Fix the conditional expression parser to properly handle comparison operators:

### Option 1: Enhanced Expression Parser (Recommended)
Improve the Mustache expression parser to recognize and preserve comparison operators:

```javascript
// In sfc-parser.js conditional parsing:
function parseConditionalExpression(expr) {
  // Remove outer {{ }} if present
  expr = expr.replace(/^\{\{/, '').replace(/\}\}$/, '').trim();
  
  // Validate expression contains valid operators
  const validOperators = ['>', '<', '>=', '<=', '===', '!==', '==', '!='];
  const hasValidOperator = validOperators.some(op => expr.includes(op));
  
  if (hasValidOperator) {
    return {
      type: 'comparison',
      expression: expr,
      valid: true
    };
  }
  
  // Simple boolean expression
  return {
    type: 'boolean',
    expression: expr,
    valid: true
  };
}
```

Then in codegen:
```javascript
// Generate proper conditional code
const conditionVar = `__condition_${conditionCount++}`;
code += `const ${conditionVar} = ${parsedExpression};\n`;
code += `if (${conditionVar}) {\n`;
// ... render content
code += `}\n`;
```

### Option 2: Use Special Directive Syntax
Introduce dedicated conditional directives that avoid Mustache conflicts:

```html
<!-- Alternative syntax -->
<div :if="items().length > 0">
<div :else-if="items().length === 0">
```

This would be parsed as JavaScript expressions directly, not as Mustache interpolation.

### Option 3: Pre-process Conditionals
Extract conditional expressions before main parsing:

```javascript
// Pre-processing step for conditionals
template = template.replace(
  /if="\{\{([^}]+)\}\}"/g,
  (match, expr) => {
    const conditionId = nextConditionId++;
    conditions[conditionId] = expr.trim();
    return `data-condition-id="${conditionId}"`;
  }
);

// Later in codegen, generate proper if statements
Object.entries(conditions).forEach(([id, expr]) => {
  code += `if (${expr}) { /* render element ${id} */ }\n`;
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
- `test-kitchen-sink.wcc` - Uses `if={{ items().length > 0 }}` → FAILS
- Any component with comparison in conditionals → FAILS

### Working Examples:
- Simple boolean: `if={{ isActive }}` → WORKS ✅
- Method call without comparison: `if={{ isVisible() }}` → WORKS ✅

### Failing Examples:
- Comparison: `if={{ count > 10 }}` → FAILS ❌
- Array length: `if={{ items().length > 0 }}` → FAILS ❌
- Equality: `if={{ status === 'active' }}` → FAILS ❌
- Multiple conditions: `if={{ a > b && c < d }}` → FAILS ❌

### Screenshots Available:
- `screenshot_test_12_1_kitchen_sink_initial.png` - Shows empty component

## Acceptance Criteria

Please verify ALL of the following before marking bug as resolved:

- [ ] Components with comparison conditionals render correctly
- [ ] No malformed attributes in generated HTML
- [ ] `connectedCallback` completes successfully
- [ ] `__connected` flag set to true
- [ ] Comparison operators work: `>`, `<`, `>=`, `<=`, `===`, `!==`
- [ ] Array/object method calls work: `.length`, `.size()`
- [ ] Logical operators work: `&&`, `||`
- [ ] else-if chains work correctly
- [ ] else blocks work correctly
- [ ] Nested conditionals work
- [ ] No console errors during rendering
- [ ] Conditionals update reactively when data changes
- [ ] All existing tests pass (no regressions)
- [ ] Error message shown if conditional syntax is invalid

## How to Reproduce

1. Create component with comparison conditional:
```html
<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-conditionals' })

const items = signal([1, 2, 3])
const count = signal(5)
</script>

<template>
<div>
  <div if="{{ items().length > 0 }}">
    <p>Has {{ items().length }} items</p>
  </div>
  
  <div else-if="{{ items().length === 0 }}">
    <p>No items</p>
  </div>
  
  <div if="{{ count > 10 }}">
    <p>Count is greater than 10</p>
  </div>
</div>
</template>
```

2. Compile with WCC Compiler v0.16.17
3. Load in browser
4. Observe: Component tag exists but is empty
5. Check DevTools: No errors, but no content rendered

## Priority Justification

This bug is HIGHEST priority because:

1. **Blocks Common Pattern**: Conditional rendering is fundamental to UI development
2. **Empty States Broken**: Cannot show "no data" messages
3. **Validation Messages**: Cannot show form validation feedback
4. **Silent Failure**: No error messages make debugging very difficult
5. **No Good Workaround**: Pre-computing all booleans is cumbersome and error-prone
6. **Affects Many Components**: Any app with dynamic content needs conditionals

## Related Bugs

- **BUG-0013**: Malformed Loop Key Bindings
  - Discovered in same testing session
  - Same root cause: SFC parser expression handling
  - Both affect attribute/expression parsing

- **BUG-0015**: Complex Feature Combination Failure
  - Conditionals are part of complex feature combinations
  - This bug contributes to overall complex template failures

## Workarounds (Until Fix is Available)

### Workaround 1: Pre-compute Booleans in Script
```javascript
const hasItems = () => items().length > 0
const isEmpty = () => items().length === 0
const isHighCount = () => count() > 10
```
```html
<div if="{{ hasItems() }}">
  <p>Has items</p>
</div>
<div else-if="{{ isEmpty() }}">
  <p>No items</p>
</div>
```
⚠️ Warning: Cumbersome, requires extra functions, harder to maintain

### Workaround 2: Use Ternary in Text Content
Instead of conditional elements, use ternary in text:
```html
<p>{{ items().length > 0 ? `Has ${items().length} items` : 'No items' }}</p>
```
⚠️ Warning: Limited to text content, can't conditionally render different structures

### Workaround 3: CSS Display Toggle
Render both and toggle visibility with CSS:
```html
<div :style="{ display: items().length > 0 ? 'block' : 'none' }">
  Has items
</div>
```
⚠️ Warning: Still renders DOM nodes (performance impact), may not work if parser issue affects :style too

---

## Test Component for Development

Use this component to reproduce and test the fix:

```html
<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'test-bug-0014-conditionals',
})

const items = signal([])
const count = signal(0)
const status = signal('inactive')

function addItem() {
  items.set([...items(), `Item ${items().length + 1}`])
  count.set(items().length)
}

function removeItem() {
  if (items().length > 0) {
    items.set(items().slice(0, -1))
    count.set(items().length)
  }
}

function toggleStatus() {
  status.set(status() === 'active' ? 'inactive' : 'active')
}
</script>

<style>
.test-container {
  padding: 20px;
  font-family: Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
}

.status-box {
  padding: 15px;
  border-radius: 8px;
  margin: 10px 0;
  text-align: center;
  font-weight: bold;
}

.status-active {
  background: #c6f6d5;
  color: #22543d;
  border: 2px solid #48bb78;
}

.status-inactive {
  background: #fed7d7;
  color: #742a2a;
  border: 2px solid #f56565;
}

.empty-state {
  background: #fefcbf;
  color: #744210;
  border: 2px solid #ecc94b;
  padding: 20px;
  text-align: center;
  border-radius: 8px;
}

.item-list {
  list-style: none;
  padding: 0;
}

.item-card {
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 10px;
  margin: 5px 0;
}

button {
  padding: 10px 20px;
  margin: 5px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
}

.btn-add { background: #48bb78; color: white; }
.btn-remove { background: #f56565; color: white; }
.btn-toggle { background: #667eea; color: white; }
</style>

<template>
<div class="test-container">
  <h2>BUG-0014 Test: Conditional Rendering with Comparisons</h2>
  <p>This component tests various conditional expressions.</p>
  
  <div style="margin-bottom: 15px;">
    <button class="btn-add" @click="addItem()">Add Item</button>
    <button class="btn-remove" @click="removeItem()">Remove Item</button>
    <button class="btn-toggle" @click="toggleStatus()">Toggle Status</button>
  </div>
  
  <p>Current count: {{ count() }}</p>
  <p>Current status: {{ status() }}</p>
  
  <!-- Test 1: Array length comparison -->
  <div if="{{ items().length > 0 }}">
    <h3>✅ Test 1: Has Items</h3>
    <ul class="item-list">
      <li each="item in items()" class="item-card">
        {{ item }}
      </li>
    </ul>
  </div>
  
  <div else-if="{{ items().length === 0 }}">
    <div class="empty-state">
      <h3>⚠️ Test 1: Empty State</h3>
      <p>No items yet. Click "Add Item" to create some.</p>
    </div>
  </div>
  
  <!-- Test 2: Count threshold -->
  <div if="{{ count() >= 5 }}">
    <div style="background: #c6f6d5; padding: 10px; border-radius: 4px; margin: 10px 0;">
      <strong>🎉 Test 2: High Count</strong>
      <p>You have {{ count() }} items (5 or more)!</p>
    </div>
  </div>
  
  <div else-if="{{ count() > 0 }}">
    <div style="background: #fefcbf; padding: 10px; border-radius: 4px; margin: 10px 0;">
      <strong>ℹ️ Test 2: Medium Count</strong>
      <p>You have {{ count() }} items (less than 5).</p>
    </div>
  </div>
  
  <div else>
    <div style="background: #fed7d7; padding: 10px; border-radius: 4px; margin: 10px 0;">
      <strong>❌ Test 2: Zero Count</strong>
      <p>No items yet.</p>
    </div>
  </div>
  
  <!-- Test 3: String equality -->
  <div if="{{ status() === 'active' }}">
    <div class="status-box status-active">
      <h3>✓ Test 3: Active Status</h3>
      <p>The system is currently ACTIVE</p>
    </div>
  </div>
  
  <div else>
    <div class="status-box status-inactive">
      <h3>✗ Test 3: Inactive Status</h3>
      <p>The system is currently INACTIVE</p>
    </div>
  </div>
  
  <!-- Test 4: Multiple conditions -->
  <div if="{{ count() > 0 && status() === 'active' }}">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 8px; margin: 10px 0;">
      <h3>🌟 Test 4: Combined Conditions</h3>
      <p>Both conditions met: Has items AND status is active!</p>
    </div>
  </div>
  
  <div else-if="{{ count() === 0 || status() === 'inactive' }}">
    <div style="background: #e2e8f0; padding: 15px; border-radius: 8px; margin: 10px 0;">
      <h3>⚪ Test 4: Not Ready</h3>
      <p>Either no items OR status is inactive.</p>
    </div>
  </div>
</div>
</template>
```

### Expected Behavior After Fix:
1. Component renders immediately showing empty state
2. "Add Item" button adds items and switches from empty state to list
3. When count reaches 5+, shows "High Count" message
4. "Toggle Status" button switches between active/inactive states
5. Combined conditions show special message when both are true
6. All conditionals update reactively
7. No console errors
8. Smooth transitions between states

### What to Check in Generated Code:
1. Look for proper if/else-if/else structure in JavaScript
2. Verify comparison operators are preserved (> , <, ===, etc.)
3. Check that array method calls (.length) work correctly
4. Ensure no malformed HTML attributes
5. Verify reactive updates when signals change

---

## Resolution

**Status**: ✅ RESOLVED in v0.16.22  
**Resolved by**: Template Normalizer Enhancement  
**QA Verified**: YES - Confirmed fixed by QA Team  

### Solution Summary:

The bug was fixed by enhancing the template normalizer (`lib/template-normalizer.js`) to pre-process ALL Mustache-style attribute bindings before the HTML parser sees them.

**Key Changes:**
1. Replaced specific patterns for `if`/`else-if` with generic patterns that handle ANY attribute
2. Pattern 1: `attr="{{ expr }}"` → `attr="expr"` (quoted syntax)
3. Pattern 2: `attr={{ expr }}` → `attr="expr"` (unquoted syntax)
4. Handles: `if`, `else-if`, `@click`, `:is`, `:key`, and any future attributes

**Files Modified:**
- `lib/template-normalizer.js` - Added generic Mustache attribute normalization
- `lib/codegen.conditional-syntax.test.js` - Added 12 comprehensive unit tests
- `lib/codegen.key-bindings.test.js` - Added 3 additional tests for complex scenarios

**Test Coverage:**
- 12 tests for conditional syntax (all comparison operators, else-if chains, event handlers, dynamic components)
- 6 tests for key bindings (including complex combinations)
- All 1061 tests passing (100% pass rate, no regressions)

**Verification:**
- ✅ Comparison operators work: `>`, `<`, `>=`, `<=`, `===`, `!==`
- ✅ Logical operators work: `&&`, `||`
- ✅ Event handlers work: `@click={{ handler() }}`
- ✅ Dynamic components work: `:is={{ component() }}`
- ✅ No raw `{{` in generated JavaScript code
- ✅ No HTML entities (`&gt;`, `&lt;`) in generated code
- ✅ Valid JavaScript syntax in all generated conditionals

### QA Sign-off:

**QA Report**: BUG-0014 confirmed FIXED in v0.16.22  
**Testing Method**: Browser Agent E2E testing with test-kitchen-sink.wcc and test-bug-0014-conditionals.wcc  
**Result**: All components render correctly with complex conditionals  

---

**Report Generated**: 2026-05-18  
**Discovered By**: Lingma AI QA Team  
**Ready for Dev**: ✅ YES - Component code included above for testing  
**Resolved**: 2026-05-18 in v0.16.22

This bug prevented components with comparison-based conditionals from rendering and has been completely resolved.
