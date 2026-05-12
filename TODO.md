# TODO — Tareas pendientes

## 🔴 PRIORIDAD ALTA

- [ ] ⏫ **Bug: TypeScript hover/go-to-definition no funciona en .wcc**
  - El TS service de Volar no provee tipos en script ni template
  - Autocompletado HTML y props de hijos SÍ funcionan
  - Reproducible en VS Code y Kiro con la extensión 0.1.5
  - Investigar: `getServiceScript`/`getExtraServiceScripts` en languagePlugin.ts, dependencias de Volar

## core

- [ ]* Source maps — generar `.map` que mapee el JS compilado al `.wcc` original
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

- [x] WCC-to-WCC autocompletado automático de props de hijos en template → v0.11.11
  - El language server escanea los `.wcc` del workspace al inicializar
  - Ofrece `:propName` y `@eventName` sin config del usuario
  - Funciona en Kiro y VS Code automáticamente
- [x] Tipado Vue: `wcc build` genera `dist/wcc-vue.d.ts` con `declare module 'vue' { GlobalComponents }` → v0.11.10
  - Consumidor agrega `"dist/wcc-vue.d.ts"` a tsconfig `include` y Volar ofrece autocompletado
- [x] Tipado React: stubs `.d.ts` generados por `wcc build` (custom elements son `any` en JSX por diseño de React)
- [x] Tipado Angular: N/A (`CUSTOM_ELEMENTS_SCHEMA` desactiva type-checking por diseño del framework)
- [x] Top-level section comments en output (`--comments`) → v0.11.9
- [x] Tree-shake runtime inline en standalone mode → v0.11.8
- [x] Comentarios inline opcionales en output (`--comments`) → v0.11.7
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

### IDE — Autocompletado de props en templates

El language server escanea automáticamente los `.wcc` del workspace y ofrece autocompletado de props y events al escribir `<wcc-child :`. No requiere configuración.

Opcionalmente, `wcc build` también genera `dist/wcc-html-data.json` que puede usarse en proyectos sin la extensión WCC:

```json
// .vscode/settings.json (solo si no usás la extensión WCC)
{
  "html.customData": ["./dist/wcc-html-data.json"]
}
```

### Vue — Autocompletado en templates (Volar)

`wcc build` genera `dist/wcc-vue.d.ts` con tipos globales. Agregar a `tsconfig.json`:

```json
{
  "include": ["src/**/*", "dist/wcc-vue.d.ts"]
}
```

### React — Custom Elements

React 19 trata custom elements (tags con hyphen) como `any` en JSX. Los stubs de compound components (`WccCard.Header`) requieren `wccReactPlugin()` activo.

### Angular — CUSTOM_ELEMENTS_SCHEMA

Angular desactiva todo type-checking en custom elements con `CUSTOM_ELEMENTS_SCHEMA`.
