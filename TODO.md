# TODO — Tareas pendientes

## 🔴 PRIORIDAD MÁXIMA

- [ ] **Slots cross-framework: soportar `slot="name"` en elementos regulares**
  - Actualmente el slot parser solo reconoce `<template #name>`, que no funciona en Vue/React/Angular
  - Fix: agregar detección de `child.getAttribute('slot')` en el loop de childNodes del codegen
  - Usar `child.outerHTML` (con `removeAttribute('slot')`) para proyectar el elemento completo
  - Resultado: `<div slot="header">` funciona en Vue ✅, React ✅, Angular ✅ (con timing fix separado)
  - `<template #name>` sigue funcionando para WCC-to-WCC (no breaking change)
  - **Angular timing issue** (follow-up): Angular proyecta content después de `connectedCallback` → necesita `queueMicrotask` defer en el slot resolution
  - Ref: reporte de QA "Slots cross-framework fix"

- [ ] **Vue integration fix: v-wcc-model directiva + fix createRequire + documentar convención modelValue**
  - **Bug 1**: `import '@sprlab/wccompiler/integrations/vue'` causa `createRequire is not a function` en Vite — separar el adapter del plugin de Vite (el adapter no debe importar `@vitejs/plugin-vue`)
  - **Bug 2**: `v-model:propName` no funciona en custom elements en Vue — es limitación de Vue, no bug nuestro
  - **Solución multi-model**: Crear directiva Vue `v-wcc-model` (~15 líneas):
    ```vue
    <wcc-form v-model="mainValue" v-wcc-model:count="countRef" v-wcc-model:title="titleRef"></wcc-form>
    ```
  - **Implementación robusta** (NO usar `binding.instance.$.setupState` — es internal frágil):
    - Usar pattern de getter/setter con `watch` + event listener
    - La directiva recibe un ref de Vue directamente, no necesita acceder a internals
  - **Convención**: documentar que el prop principal debe llamarse `modelValue` para que `v-model` estándar funcione
  - **Testeo QA**:
    - [ ] `v-model="mainValue"` con prop `modelValue` → bidireccional
    - [ ] `v-wcc-model:count="countRef"` para props adicionales → bidireccional
    - [ ] Adapter sin `createRequire` error en Vite
    - [ ] Ambas direcciones funcionan (parent→child y child→parent)
  - **Futuro (opcional)**: generador de wrappers Vue estilo Stencil (`wcc generate --vue`)

## core

- [ ] ⏫ Source maps — generar `.map` que mapee el JS compilado al `.wcc` original, permitiendo debuggear en DevTools con el código fuente en vez del output transformado (requiere trackear posiciones línea por línea durante codegen)
- [x] ~~⏫ Two-way binding nativo para frameworks (Vue v-model + Angular ngModel)~~ → Implementado en `feat/define-model` (v0.8.0)
  - **Vue**: Adapter `wcc:model → update:propName` (habilita `v-model:propName`)
  - **Angular**: Adapter `wcc:model → propNameChange` (habilita `[(propName)]`)
  - **React**: Hook `useWccModel` para convenience binding
- [ ] ⏶ Nombres descriptivos para bindings DOM (`__text_count`, `__btn_increment` en vez de `__b0`, `__e0`)
- [ ]* Opciones adicionales en defineComponent (shadow, extends, formAssociated, mode)
- [ ]* Componente dinámico (`<component :is="...">`) — similar al meta-component de Vue que permite renderizar componentes dinámicamente según una expresión reactiva. Analizar viabilidad dado que wcCompiler resuelve imports en compile-time.

## volar-language-server

- [ ]* ⏫ Semantic tokens para colorear props, signals y computeds en template

## interop / compatibilidad (baja prioridad)

- [ ]* SSR (Server-Side Rendering) — ¿los WCC components funcionan con Next.js, Nuxt, Angular Universal? Custom elements sin Shadow DOM suelen tener issues en SSR.
- [ ]* Lazy loading — ¿se puede importar un WCC component dinámicamente (`import()`) y que funcione cuando se renderiza?
- [ ]* Form participation — ¿un WCC input participa en un `<form>` nativo? (submit, validation, FormData). Requiere `ElementInternals` y `formAssociated`.
- [ ]* Accessibility (a11y) — ¿los WCC components exponen roles ARIA correctamente a los frameworks?

---

`*` = opcional / futuro
