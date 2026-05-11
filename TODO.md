# TODO — Tareas pendientes

## 🔴 PRIORIDAD ALTA

- [ ] ⏫ **WCC-to-WCC: autocompletado de props de componentes hijos en template**
  - El language server (`vscode-wcc/`) actualmente lee `defineProps<T>` del componente **propio** y expone las variables al template
  - Falta: cuando escribís `<wcc-child :` en un template, resolver el archivo `wcc-child.wcc`, leer su `defineProps`, y ofrecer autocompletado de sus props/events
  - Impacto alto — es la DX principal para WCC-to-WCC

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

- [x] Tipado Vue: `wcc build` genera `dist/wcc-vue.d.ts` con `declare module 'vue' { GlobalComponents }` → v0.11.10
  - Consumidor agrega `"dist/wcc-vue.d.ts"` a tsconfig `include` y Volar ofrece autocompletado
- [x] Tipado React: stubs `.d.ts` generados por `wcc build` (custom elements son `any` en JSX por diseño de React)
- [x] Tipado Angular: N/A (`CUSTOM_ELEMENTS_SCHEMA` desactiva type-checking por diseño del framework)
- [x] Tree-shake runtime inline en standalone mode → v0.11.8
- [x] Comentarios inline opcionales en output (`--comments`) → v0.11.7/v0.11.9
- [x] `onAdopt` lifecycle hook (adoptedCallback) → v0.11.4/v0.11.6
- [x] Minificación opcional via esbuild (`--minify`) → v0.11.5
- [x] Nombres descriptivos para bindings DOM → v0.11.2/v0.11.3
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

---

## Notas de integración

### Vue — Autocompletado en templates

`wcc build` genera `dist/wcc-vue.d.ts` con tipos globales para Volar. Para activar:

```json
// tsconfig.json del proyecto consumidor
{
  "include": ["src/**/*", "dist/wcc-vue.d.ts"]
}
```

Después de eso, Volar ofrece autocompletado de props y events en templates `.vue`.

### React — Custom Elements

React 19 trata custom elements (tags con hyphen) como `any` en JSX — no hay type-checking de props. Los stubs de compound components (`WccCard.Header`) requieren el `wccReactPlugin()` activo para funcionar.

### Angular — CUSTOM_ELEMENTS_SCHEMA

Angular desactiva todo type-checking en custom elements cuando se usa `CUSTOM_ELEMENTS_SCHEMA`. No hay forma de forzar tipos desde la librería.
