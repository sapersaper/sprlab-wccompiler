# Release Notes — v0.9.0

## Resumen

Cross-framework scoped slots completos. Los slots de WCC ahora funcionan en Vue, React y Angular con soporte para named slots, scoped slots con props reactivos, y un mecanismo de deferred rendering para compatibilidad con Angular.

---

## Nuevas Features

### 1. Escape Syntax `{%prop%}` para Scoped Slots

Nueva sintaxis de interpolación que los frameworks host no reconocen ni procesan:

```html
<!-- React / Angular -->
<wcc-list>
  <div slot-template-item="<li>{%item%} - {%index%}</li>"></div>
</wcc-list>
```

- `{%prop%}` pasa intacto por Vue, Angular y React
- El runtime WCC reemplaza ambos `{{prop}}` y `{%prop%}` con el mismo regex combinado
- Soporta whitespace: `{% prop %}` equivale a `{%prop%}`
- Soporta parentheses: `{%prop()%}` para method-style access
- Null/undefined se reemplazan con string vacío

### 2. Atributo `slot-template-<name>` (React/Angular)

Nuevo patrón para pasar scoped slot templates como string attributes:

```html
<wcc-list>
  <div slot-template-item="<span>{%name%} is {%age%}</span>"></div>
</wcc-list>
```

- No requiere `<template>` (que no funciona en JSX ni Angular)
- El runtime detecta `slot-template-*` attributes en childNodes
- El atributo se remueve después de leerlo (cleanup)
- Prioridad: `slot="name"` element > `slot-template-name` attribute > fallback

### 3. Atributo `slot-props` (Vue Plugin)

El Vue plugin genera `slot-props="prop1, prop2"` para indicar qué props tiene el scoped slot:

```html
<!-- Plugin transforma esto: -->
<template #item="{ name, age }">{{name}} is {{age}}</template>

<!-- A esto: -->
<div slot="item" slot-props="name, age">{%name%} is {%age%}</div>
```

- Cuando `slot-props` está presente, se usa `innerHTML` (no `outerHTML`)
- El runtime lee y remueve el atributo

### 4. Vue Plugin — Scoped Slot Transform

El `wccVuePlugin` ahora transforma scoped slots automáticamente:

- `<template #name="{ prop1, prop2 }">{{prop1}}</template>` → `<div slot="name" slot-props="prop1, prop2">{%prop1%}</div>`
- Solo escapa `{{propName}}` para props declarados (deja `{{ vueExpr }}` para Vue)
- Soporta `<template v-slot:name="{ props }">` también
- Non-scoped `<template #name>` sigue transformándose a `<div slot="name">` sin modificar contenido

### 5. Deferred Slot Parsing (Angular Compatibility)

Angular conecta custom elements al DOM ANTES de proyectar children. Fix:

- Si el slot parsing no encuentra children en el primer pass, programa un `queueMicrotask`
- El microtask re-parsea childNodes (que Angular ya proyectó) y re-inyecta slots
- Para scoped slots, toca un signal para forzar re-render del reactive effect
- Vue y React no se ven afectados (children ya están presentes sincrónicamente)

---

## Bugs Fixeados

### Bug: `<template #name>` y `<template v-slot:name>` crasheaban Vue

**Causa**: Vue interceptaba `#name` y `v-slot:name` como directivas propias antes de que llegaran al DOM.

**Fix**: El `wccVuePlugin` pre-transform ahora corre con `enforce: 'pre'` y transforma `<template #name>` → `<div slot="name">` antes de que Vue compile el template.

### Bug: Angular Slot Timing Issue

**Causa**: Angular crea el custom element → lo inserta en DOM (triggering connectedCallback) → DESPUÉS proyecta children. El slot parsing corría sin children.

**Fix**: Deferred slot re-check con `queueMicrotask`. Si no hay children en el primer pass, el microtask los encuentra después de que Angular los proyecte.

---

## Regex Combinado (Codegen)

El regex generado ahora matchea ambas sintaxis en un solo pass:

```js
// Antes (solo {{prop}})
new RegExp('\\{\\{\\s*' + k + '(\\(\\))?\\s*\\}\\}', 'g')

// Ahora ({{prop}} + {%prop%})
new RegExp('(?:\\{\\{|\\{%)\\s*' + k + '(\\(\\))?\\s*(?:\\}\\}|%\\})', 'g')
```

---

## Matriz de Compatibilidad Verificada (Playwright)

| Feature | Vue 3 | React 19 | Angular 19 |
|---------|-------|----------|------------|
| Default slot (fallback) | ✅ | ✅ | ✅ |
| Default slot (con contenido) | ✅ | ✅ | ✅ |
| Named slots (`slot="name"`) | ✅ | ✅ | ✅ |
| `<template #name>` | ✅ (plugin) | N/A | N/A |
| `<template v-slot:name>` | ✅ (plugin) | N/A | N/A |
| Scoped slot (props reactivos) | ✅ | ✅ | ✅ |
| `slot-template-name` attribute | ✅ | ✅ | ✅ |
| Mixed framework + WCC interpolation | ✅ | N/A | N/A |
| Deferred slot (timing) | N/A | N/A | ✅ |

---

## Cómo Testear

### Vue
```bash
cd framework-testing/vue
npm install
npm run dev
# Abrir http://localhost:5173
```

### Angular
```bash
cd framework-testing/angular
npm install
NODE_OPTIONS="" npx ng serve --port 4200
# Abrir http://localhost:4200
```

---

## Tests Unitarios

- 666 tests pasando (75 archivos)
- Nuevos tests:
  - `lib/codegen.scoped-slot-regex.test.js` — 17 tests para el regex combinado
  - `lib/codegen.scoped-slot-regex.property.test.js` — 3 property tests (fast-check)
  - `lib/codegen.slot-template-attr.test.js` — 13 tests para slot-template-name detection
  - `lib/integrations.vue.test.js` — 7 tests nuevos para scoped slot transform
  - `lib/compiler.scoped-slots-wcc-to-wcc.test.js` — 3 integration tests
  - `lib/compiler.scoped-slots-escape-syntax.test.js` — 6 integration tests
  - `lib/compiler.scoped-slots-template-attr.test.js` — 6 integration tests

---

## Breaking Changes

Ninguno. `{{prop}}` sigue funcionando para WCC-to-WCC.
