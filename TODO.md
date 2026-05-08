# TODO — Tareas pendientes

## � COMPLETADO (v0.8.8)

- [x] ~~**Slots cross-framework: soportar `slot="name"` en elementos regulares**~~ → v0.8.8
  - Runtime: slot parser detecta `slot="name"` en elementos regulares ✅
  - Vue plugin: transforma `<template #name>` y `<template v-slot:name>` → `<div slot="name">` ✅
  - Funciona en Vue, React, Angular sin breaking changes ✅
- [x] ~~**Vue integration: v-model:propName + fix createRequire**~~ → v0.8.7
  - Plugin Vite pre-transforma `v-model:prop` → `:prop + @prop-changed` antes del compiler ✅
  - `createRequire` fix: adapter separado del plugin Vite ✅
  - `v-model` (modelValue) + `v-model:count` (multi-model) bidireccional ✅
  - Angular `[(prop)]` funciona directo sin adapter ✅
- [x] ~~**Two-way binding nativo para frameworks**~~ → v0.8.0
  - `_modelSet` emite: `wcc:model` + `propName-changed` (Vue) + `propNameChange` (Angular)
  - React: `useWccModel` hook

## 🔴 PRIORIDAD MÁXIMA

- [ ] **Scoped slots cross-framework (slotProps)**
  - Spec creado: `.kiro/specs/cross-framework-scoped-slots/`
  - Problema: `{{prop}}` dentro de scoped slots es interceptado por Vue/Angular compilers
  - Solución propuesta: sintaxis escape `{%prop%}` + `slot-template-name` attribute + Vue plugin auto-transform
  - Pendiente: design + tasks + implementación

## core

- [ ] ⏫ Source maps — generar `.map` que mapee el JS compilado al `.wcc` original
- [ ] ⏶ Nombres descriptivos para bindings DOM (`__text_count`, `__btn_increment` en vez de `__b0`, `__e0`)
- [ ]* Opciones adicionales en defineComponent (shadow, extends, formAssociated, mode)
- [ ]* Componente dinámico (`<component :is="...">`)
- [ ]* Generador de wrappers Vue estilo Stencil (`wcc generate --vue`)

## volar-language-server

- [ ]* ⏫ Semantic tokens para colorear props, signals y computeds en template

## interop / compatibilidad (baja prioridad)

- [ ]* SSR (Server-Side Rendering) — Next.js, Nuxt, Angular Universal
- [ ]* Lazy loading — `import()` dinámico de WCC components
- [ ]* Form participation — `ElementInternals` y `formAssociated`
- [ ]* Accessibility (a11y) — roles ARIA en frameworks

---

`*` = opcional / futuro
