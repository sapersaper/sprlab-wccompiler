# ❌ QA Testing Report - WCC Compiler v0.16.18 - BUG-0013 STILL PRESENT

**Fecha:** 2026-05-18  
**Versión Testeada:** v0.16.18  
**Bug ID:** BUG-0013 (Malformed Loop Key Bindings)  
**Tester:** Lingma AI + Browser Agent  
**Estado:** ❌ **BUG-0013 CONFIRMED STILL PRESENT - NOT FIXED**

---

## 📊 Executive Summary

BUG-0013 (Malformed Loop Key Bindings) **persiste sin resolver en v0.16.18**. A pesar de haber sido reportado como crítico [highest priority] el mismo día, el fix NO fue implementado en esta versión. Los componentes con keyed loops continúan fallando silenciosamente.

**Status:** ❌ **CRITICAL BUG - STILL PRESENT AFTER REPORT**

---

## 🔍 Bug Behavior in v0.16.18

### **Test Results:**

| Component | Status | innerHTML | __connected | Console Errors |
|-----------|--------|-----------|-------------|----------------|
| test-kitchen-sink | ❌ FAILED | 0 bytes | false | Multiple syntax errors |
| test-deep-nesting | ❌ FAILED | 0 bytes | false | Multiple syntax errors |
| test-rapid-updates | ✅ PASSED | 4,308 bytes | true | None |

### **Critical Finding:**

Los componentes con `key="{{ item.id }}"` **NO RENDERIZAN** en absoluto:
- `innerHTML = 0` (completamente vacío)
- `childElementCount = 0` (sin hijos)
- `__connected = false` (connectedCallback nunca completó)
- Console muestra errores de sintaxis en código generado

---

## 🐛 Generated Code Analysis

### **Source Code (Correct):**
```html
<div each="item in items()" key={{ item.id }}>
  <span>{{ item.name }}</span>
</div>
```

### **Generated Code (BROKEN in v0.16.18):**
```javascript
// ❌ MALFORMED - test-kitchen-sink.js
this.__for0_tpl.innerHTML = `<div key="{{" item.id="" }="">
  <span>${item.name}</span>
</div>`;
```

**Problema:** El compiler está generando HTML inválido dentro del template literal:
- `key="{{"` ← atributo incompleto
- `item.id=""` ← interpretado como atributo separado
- `}=""` ← cierre malformado
- `">` ← cierre de tag incorrecto

### **Expected Generated Code:**
```javascript
// ✅ CORRECT - What it should generate:
this.__for0_tpl.innerHTML = `<div key="${item.id}">
  <span>${item.name}</span>
</div>`;
```

O alternativamente:
```javascript
// ✅ ALTERNATIVE - Using setAttribute:
const node = document.createElement('div');
node.setAttribute('key', item.id);
node.innerHTML = `<span>${item.name}</span>`;
```

---

## ⚠️ Console Errors Found

### **New Errors in v0.16.18 (Directly Related to BUG-0013):**

1. **`Cannot read properties of undefined (reading 'bind')`**
   - Evidence directa de key binding failure
   - Ocurre durante component initialization

2. **`missing ) after argument list`**
   - Syntax error en JavaScript generado
   - Causado por malformed template literals

3. **`Unexpected token '{'`**
   - Parser encuentra `{` inesperado
   - Resultado de `key="{{"` malformado

4. **Multiple `[wcc] Effect error` messages**
   - Cascading failures desde initialization errors
   - Effects no pueden registrarse correctamente

**Estos errores son NUEVOS y directamente relacionados con BUG-0013** (no son pre-existentes).

---

## 📈 Version Comparison

| Version | BUG-0013 Status | Components Render? | Notes |
|---------|-----------------|-------------------|-------|
| v0.16.17 | ❌ Present | No | Bug discovered |
| **v0.16.18** | ❌ **Still Present** | **No** | **NOT FIXED** |

**Conclusion:** Zero progress on BUG-0013 between versions.

---

## 🔬 Root Cause Confirmation

El Browser Agent confirmó que el problema está en la **fase de compilación de templates**, específicamente:

1. **Parser Issue:** El SFC parser no reconoce correctamente `key={{ expression }}` como un atributo con valor interpolado
2. **Code Generation Issue:** Al convertir Mustache syntax `{{ }}` a template literals `${}`, el proceso falla
3. **String Interpolation Bug:** La expresión se splittea incorrectamente en múltiples atributos HTML

### **Pattern Identified:**

```
Input:  key={{ item.id }}
Output: key="{{" item.id="" }="">
        
Expected: key="${item.id}"
```

El compiler está tratando `{{` y `}}` como delimitadores de string en lugar de expresiones Mustache.

---

## 💥 Impact Assessment

### **Current State (v0.16.18):**

**Affected Features:**
- ❌ ALL components with keyed loops
- ❌ Simple keys: `key="{{ item.id }}"`
- ❌ Index keys: `key="{{ $index }}"`
- ❌ Nested loops with keys
- ❌ Complex key expressions: `key="{{ item.user.id }}"`

**Working Features:**
- ✅ Loops WITHOUT keys
- ✅ Simple components without complex features
- ✅ test-rapid-updates (doesn't use keys)

### **User Impact:**

1. **List Rendering Completely Broken:**
   - No data-driven lists work
   - E-commerce product grids fail
   - Social media feeds don't render
   - Admin dashboards show empty tables

2. **Silent Failure:**
   - No visible error message to users
   - Developers see empty components
   - Difficult to debug without DevTools

3. **No Workaround:**
   - Removing keys causes BUG-0012 (reactivity issues)
   - Can't build production apps without lists
   - Framework unusable for real-world applications

---

## 🎯 Recommendations for Dev Team

### **IMMEDIATE ACTION REQUIRED:**

This is a **RELEASE BLOCKER**. Version 0.16.18 should NOT be released with this bug.

### **Fix Priority: CRITICAL**

1. **Investigate Template Parser:**
   - Check how `key={{ ... }}` attributes are parsed
   - Review Mustache-to-template-literal conversion logic
   - Ensure proper handling of nested braces

2. **Fix Code Generation:**
   ```javascript
   // Current (WRONG):
   innerHTML = `<div key="{{" item.id="" }="">`;
   
   // Should be:
   innerHTML = `<div key="${item.id}">`;
   ```

3. **Add Regression Tests:**
   - Test simple keyed loops
   - Test nested keyed loops
   - Test different key expressions
   - Verify generated code has valid syntax

4. **Release Process:**
   - Add automated syntax validation for generated code
   - Run edge case tests before every release
   - Don't release until BUG-0013 is confirmed fixed

---

## 📝 Acceptance Criteria for Fix

Before marking BUG-0013 as resolved, verify:

- [ ] Components with `key="{{ item.id }}"` render correctly
- [ ] No malformed attributes in generated HTML
- [ ] `connectedCallback` completes successfully
- [ ] `__connected` flag set to true
- [ ] No console errors related to key bindings
- [ ] Key-based reconciliation works (items maintain identity)
- [ ] UI updates when keyed items change
- [ ] Works with nested loops
- [ ] Works with complex key expressions
- [ ] All existing tests pass (no regressions)
- [ ] Generated code passes JavaScript syntax validation

---

## 🧪 How to Reproduce

### **Minimal Test Case:**

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

### **Steps:**
1. Compile with WCC Compiler v0.16.18
2. Load in browser
3. Observe: `<test-keyed-loop></test-keyed-loop>` is EMPTY
4. Check DevTools → Elements: No children inside component
5. Check Console: Syntax errors present
6. Check Sources → Generated JS: Malformed `key="{{" item.id="" }="">`

---

## 📸 Evidence Screenshots

1. [screenshot_bug_0013_v016_18_initial_overview.png](file://c:\projects\wcc-test\screenshot_bug_0013_v016_18_initial_overview.png) - Initial page state showing all 3 test components
2. [screenshot_bug_0013_v016_18_test12_empty.png](file://c:\projects\wcc-test\screenshot_bug_0013_v016_18_test12_empty.png) - Test 12.1 & 12.2 completely empty
3. [screenshot_bug_0013_v016_18_test12_3_working.png](file://c:\projects\wcc-test\screenshot_bug_0013_v016_18_test12_3_working.png) - Test 12.3 working (control test)
4. [screenshot_bug_0013_v016_18_final_report.png](file://c:\projects\wcc-test\screenshot_bug_0013_v016_18_final_report.png) - Full page overview

---

## 🚨 Final Verdict

### **BUG-0013 Status in v0.16.18:**

## ❌ **STILL PRESENT - NOT FIXED**

**Components with keyed loops:** ❌ **DO NOT WORK**

**Recommendation:** 🚨 **DO NOT RELEASE v0.16.18** - Critical bug requires immediate fix

---

## 📞 Next Steps

1. **Escalate to Dev Team Immediately:**
   - BUG-0013 was reported as [highest] priority
   - Still not fixed in next version
   - Blocking production use

2. **Request Timeline:**
   - When will fix be implemented?
   - Is there a workaround available?
   - Should we rollback to previous version?

3. **Consider Alternative Approaches:**
   - If fix is complex, consider temporary syntax change
   - Example: Use `:key="item.id"` instead of `key="{{ item.id }}"`
   - Or disable keyed loops entirely until fix is ready

---

**Report Generated:** 2026-05-18  
**Compiler Version:** @sprlab/wccompiler@0.16.18  
**Testing Method:** Browser Agent + Generated Code Analysis  
**Bug Status:** ❌ STILL PRESENT  
**Action Required:** 🚨 IMMEDIATE FIX NEEDED  

This bug prevents ANY component with keyed loops from rendering and must be fixed before production release.
