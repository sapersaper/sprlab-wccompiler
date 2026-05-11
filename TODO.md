# TODO — Tareas pendientes

## 🔴 PRIORIDAD ALTA

- [ ] ⏫ **Tipado de componentes WCC en frameworks (DX)**
  - Vue: registrar stubs generados como tipos globales de Volar (autocompletado de props/events en templates)
  - React: ya funciona (JSX + .d.ts generados por `wcc build`)
  - Angular: generar interfaces tipadas (limitado por CUSTOM_ELEMENTS_SCHEMA)
  - WCC-to-WCC: language server lee `defineProps<T>` del hijo y ofrece autocompletado en template del padre

- [ ] ⏫ **Source maps** — generar `.map` que mapee el JS compilado al `.wcc` original

## core

- [ ]* Opciones adicionales en defineComponent (shadow, extends, formAssociated, mode)
- [ ]* Componente dinámico (`<component :is="...">`)

## volar-language-server

- [ ]* ⏫ Semantic tokens para colorear props, signals y computeds en template

## interop / compatibilidad (baja prioridad)

- [ ]* SSR (Server-Side Rendering) — Next.js, Nuxt, Angular Universal
- [ ]* Lazy loading — `import()` dinámico de WCC components
- [ ]* Form participation — `ElementInternals` y `formAssociated`
- [ ]* Accessibility (a11y) — roles ARIA en frameworks

---

`*` = opcional / futuro

## ✅ COMPLETADO

<details>
<summary>v0.11.x</summary>

- [x] Tree-shake runtime inline en standalone mode → v0.11.8
- [x] Comentarios inline opcionales en output (`--comments`) → v0.11.7
- [x] `onAdopt` lifecycle hook (adoptedCallback) → v0.11.4/v0.11.6
- [x] Minificación opcional via esbuild (`--minify`) → v0.11.5
- [x] Nombres descriptivos para bindings DOM → v0.11.2
- [x] Fix radio buttons con mismo model binding → v0.11.3
- [x] Fix múltiples v-model:prop "Duplicate attribute" → v0.11.1
- [x] Reducir dual-emit: 5/3 eventos → 2/2 → v0.11.0

</details>

<details>
<summary>v0.8.x — v0.10.x</summary>

- [x] Scoped slots cross-framework (slotProps) → v0.8.8+
- [x] Slots cross-framework: `slot="name"` en elementos regulares → v0.8.8
- [x] Vue integration: v-model:propName + fix createRequire → v0.8.7
- [x] Two-way binding nativo para frameworks → v0.8.0
- [x] Generador de stubs tipados (wcc-react.d.ts, wcc-vue.d.ts) → v0.9.0

</details>
