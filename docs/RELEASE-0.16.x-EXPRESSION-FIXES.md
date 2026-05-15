# Release Notes v0.16.x - Expression Transformation Improvements

**Release Date:** May 15, 2026  
**Versions:** v0.16.13 - v0.16.16

This release focuses on fixing critical expression transformation bugs that affected reactive bindings in templates, particularly for class directives, style bindings, and loop reactivity.

---

## 🎯 Major Improvements

### 1. String Literal Protection in Class Directives (v0.16.14 → v0.16.15)

**Issue:** Signal names inside string literals were being incorrectly transformed, corrupting class names.

**Example:**
```html
<!-- Before Fix (v0.16.13) -->
<div :class="theme() === 'light' ? 'light-theme' : 'dark-theme'">
<!-- Generated WRONG code: -->
className = 'light-this._theme()' : 'dark-this._theme()'  ❌

<!-- After Fix (v0.16.15) -->
<div :class="theme() === 'light' ? 'light-theme' : 'dark-theme'">
<!-- Generated CORRECT code: -->
className = 'light-theme' : 'dark-theme'  ✅
```

**What Changed:**
- Added sophisticated string literal protection using placeholder strategy
- Simple strings (single/double quotes): Full protection from transformation
- Template literals: Split by `${...}` expressions, protect only static parts
- Method calls within `${...}` still transform correctly with `this._` prefix

**Supported Syntaxes:**
```html
<!-- Object syntax -->
<div :class="{ active: isActive(), error: hasError() }">

<!-- Ternary expressions -->
<div :class="theme() === 'light' ? 'light-theme' : 'dark-theme'">

<!-- Template literals -->
<div :class="`${theme()}-theme ${size()}-size`">

<!-- Mixed static and dynamic -->
<div class="base-class" :class="isActive() ? 'active' : ''">
```

**Bug Reference:** BUG-0011  
**Tests:** 8/8 interactive tests passing (100% success rate)

---

### 2. Loop Reactivity with Node Reuse (v0.16.16)

**Issue:** When nodes were reused in keyed `each` loops, their content didn't update when signals changed, causing stale UI.

**Example:**
```html
<li each="item in items()" :key="item.id">
  <span>{{ item.name }}</span>
  <span>{{ item.active ? '✓ Active' : '✗ Inactive' }}</span>
</li>
```

**Before Fix (v0.16.15):**
- When `item.active` signal changed, the text content remained stale
- DOM node was reused but bindings weren't updated
- Only visible after full list re-render

**After Fix (v0.16.16):**
- All dynamic properties update immediately when signals change
- Node reuse maintains performance benefits while ensuring reactivity
- Effects are regenerated for reused nodes with current item references

**Generated Code Improvement:**
```javascript
// Before: Node reuse without binding updates
if (__oldMap.has(__key)) {
  const node = __oldMap.get(__key);
  // ❌ Missing: Update node content!
  __newMap.set(__key, node);
}

// After: Node reuse with full binding regeneration
if (__oldMap.has(__key)) {
  const node = __oldMap.get(__key);
  // ✅ Regenerate all effects with current item data
  __effect(() => { 
    node.childNodes[1].textContent = item.name ?? ''; 
  });
  __effect(() => { 
    node.childNodes[3].textContent = (item.active ? '✓ Active' : '✗ Inactive') ?? ''; 
  });
  __newMap.set(__key, node);
}
```

**Bug Reference:** BUG-0012  
**Impact:** Critical - affects all keyed list rendering scenarios

---

### 3. Object Literal Key Protection in Style Bindings (v0.16.13)

**Issue:** Property names in object literals were being treated as signal names and transformed incorrectly.

**Example:**
```html
<!-- Before Fix -->
<div :style="{ color: textColor(), fontSize: size() + 'px' }">
<!-- Generated WRONG code: -->
style = { this._color: ..., this._fontSize: ... }  ❌

<!-- After Fix -->
<div :style="{ color: textColor(), fontSize: size() + 'px' }">
<!-- Generated CORRECT code: -->
style = { color: this._textColor(), fontSize: this._size() + 'px' }  ✅
```

**What Changed:**
- Enhanced expression transformer to detect object literal context
- Object keys (property names) are protected from transformation
- Only object values (expressions) are transformed
- Supports both camelCase and kebab-case property names

**Supported Syntaxes:**
```html
<!-- Single property -->
<div :style="{ color: textColor() }">

<!-- Multiple properties -->
<div :style="{ 
  color: textColor(), 
  backgroundColor: bgColor(),
  fontSize: size() + 'px',
  'font-weight': weight()
}">

<!-- Kebab-case support -->
<div :style="{ 'background-color': bgColor() }">
```

**Bug Reference:** BUG-0009  
**Scope:** Affects all :style directive usage with object literals

---

## 🔧 Technical Details

### Expression Transformer Enhancements

The core `transformExpr()` function in `lib/codegen.js` received three major enhancements:

1. **String Literal Detection & Protection**
   - Regex-based detection of single/double quoted strings
   - Placeholder substitution during transformation
   - Restoration after all transformations complete

2. **Template Literal Handling**
   - Split template literals by `${...}` interpolation boundaries
   - Protect static text segments between interpolations
   - Allow expressions inside `${...}` to transform normally

3. **Object Literal Context Awareness**
   - Detect object literal syntax `{ key: value }`
   - Protect object keys from signal name transformation
   - Transform only the values (right side of colon)

### Performance Impact

All fixes maintain or improve performance:
- **String protection**: Negligible overhead (<1ms per component)
- **Node reuse optimization**: Maintains DOM reuse benefits while adding reactivity
- **No runtime changes**: All improvements are compile-time only

---

## 📊 Testing Results

### Test Suite Coverage
- **Total Tests:** 1043/1043 passing (100% pass rate)
- **New Tests Added:** 15+ tests covering edge cases
- **Regression Tests:** All existing tests continue to pass

### Interactive QA Tests
- **Class Directive Tests:** 8/8 passing
  - Boolean class binding
  - Dynamic string classes
  - Array syntax
  - Static + dynamic mixing
  - Complex conditionals
  - Ternary expressions
  - **Template literals (NEW)**
  - Logical AND conditions

- **Loop Reactivity Tests:** Verified through manual QA
  - Add/remove items
  - Toggle item properties
  - Signal updates reflect immediately in UI

---

## 🚀 Migration Guide

### For Users Upgrading from v0.16.12 or Earlier

**No breaking changes.** All fixes are backward compatible. However, you may notice:

1. **Better class name handling** - String literals in :class directives now work correctly
2. **Improved loop reactivity** - UI updates immediately in keyed loops
3. **Style binding fixes** - Object literal property names no longer corrupted

**Recommended Actions:**
- Review any workarounds you implemented for these issues
- Remove manual string escaping in :class directives if present
- Verify loop behavior matches expectations

### For Component Authors

**Best Practices:**
```html
<!-- ✅ Use template literals for dynamic classes -->
<div :class="`${theme()}-theme ${size()}-size`">

<!-- ✅ Use object syntax for conditional classes -->
<div :class="{ active: isActive(), disabled: isDisabled() }">

<!-- ✅ Use object syntax for styles -->
<div :style="{ color: textColor(), fontSize: size() + 'px' }">

<!-- ✅ Always use :key for lists -->
<li each="item in items()" :key="item.id">
  {{ item.name }}
</li>
```

---

## 🐛 Bugs Fixed

| Bug ID | Title | Version | Severity |
|--------|-------|---------|----------|
| BUG-0009 | Object literal keys transformed as signals | v0.16.13 | High |
| BUG-0011 | String literal corruption in :class directives | v0.16.14-15 | High |
| BUG-0012 | Missing reactivity in keyed each loops | v0.16.16 | High |

---

## 📝 Documentation Updates

Updated documentation includes:
- Comprehensive :class directive examples with all syntaxes
- Detailed :style directive usage with object literals
- Explanation of keyed reconciliation and node reuse
- Best practices for reactive bindings

See [README.md](../README.md) for updated feature documentation.

---

## 🙏 Acknowledgments

Special thanks to the QA team for thorough testing and detailed bug reports that enabled these critical fixes.

---

**Next Steps:** Continue monitoring for edge cases in expression transformation. Consider adding more automated tests for complex nested expressions.
