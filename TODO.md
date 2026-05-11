# TODO — Tareas pendientes

## ✅ COMPLETADO (v0.11.0)

- [x] ~~**Reducir dual-emit: 5/3 eventos → 2/2**~~ → v0.11.0
  - `_modelSet`: solo emite `wcc:model` + `propChange` (antes: 5 eventos)
  - `_emit`: solo emite original + lowercase-sin-hyphens (antes: 3 eventos)
  - Adapters/plugins manejan formatos framework-specific
  - Vue plugin: transforma `v-model:prop` → `@wcc:model` con filtro por prop
  - Vue adapter: `vWccModel` escucha `wcc:model` (antes: `prop-changed`)
  - Angular adapter: nueva directiva `WccModel` (opcional, para uso avanzado)
  - Verificado con Playwright: Vue, Angular, React 19 ✅

## ✅ COMPLETADO (v0.8.8)

- [x] ~~**Scoped slots cross-framework (slotProps)**~~ → v0.8.8+
  - Sintaxis escape `{%prop%}` + `slot-template-name` attribute ✅
  - Vue plugin: auto-transform `{{prop}}` → `{%prop%}` para props declarados ✅
  - Angular: `slot-template-*` attribute + `WccSlotsDirective` con `registerSlotRenderer` ✅
  - React: render props + compound components via `wccReactPlugin` ✅
  - Regex combinado: matchea tanto `{{prop}}` como `{%prop%}` ✅
- [x] ~~**Slots cross-framework: soportar `slot="name"` en elementos regulares**~~ → v0.8.8
  - Runtime: slot parser detecta `slot="name"` en elementos regulares ✅
  - Vue plugin: transforma `<template #name>` y `<template v-slot:name>` → `<div slot="name">` ✅
  - Funciona en Vue, React, Angular sin breaking changes ✅
- [x] ~~**Vue integration: v-model:propName + fix createRequire**~~ → v0.8.7
  - Plugin Vite pre-transforma `v-model:prop` → `@wcc:model` con filtro por prop ✅
  - `createRequire` fix: adapter separado del plugin Vite ✅
  - `v-model` (modelValue) + `v-model:count` (multi-model) bidireccional ✅
  - Angular `(countChange)` funciona directo sin adapter ✅
- [x] ~~**Two-way binding nativo para frameworks**~~ → v0.8.0
  - `_modelSet` emite: `wcc:model` + `propChange`
  - React: `useWccModel` hook

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
