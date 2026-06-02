# TODO

## 🚨 Angular adapter — alinear con runtime de scoped slots (Prioridad Máxima)

Spec: `.agent/specs/angular-adapter/`

**Estado:** Diseño completado, pendiente de implementación.

**Problema:** El Angular adapter usa `registerSlotRenderer()` pero el runtime actual
usa `__slotTpl_name` + `__slotMap`. Los scoped slots en each loops no funcionan.

**Fix propuesto:** Reemplazar `registerSlotRenderer` por almacenamiento directo en
`__slotTpl_name` + `queueMicrotask` para re-render.

### Tasks
- [ ] Crear `initScopedSlotNew()` en angular-adapter.js
- [ ] Renderizar template ng-template a HTML string
- [ ] Almacenar en `__slotTpl_name` y re-render each loops
- [ ] Tests: Angular e2e Tests 8-10 pasando

**Problema:** El Angular adapter (`WccSlotsDirective`) usa `registerSlotRenderer()` para scoped slots, pero el WCC runtime actual implementa scoped slots vía `__slotTpl` + `__slotMap` (ver BUG-0012). Hay un mismatch arquitectónico.

**Archivos involucrados:**

| Archivo | Rol |
|---------|-----|
| `framework-integrations/angular/src/wcc-components/angular-adapter.js` | WccSlotsDirective — asume `registerSlotRenderer` |
| `lib/codegen/connected-callback.js` | `queueMicrotask` retry no cubre forBlock slots |
| `lib/codegen/item-renderer.js` | `renderScopedSlots()` usa `__slotTpl`, no renderer |

**Causa:** El adapter se construyó contra una versión anterior del runtime que usaba `registerSlotRenderer`. El runtime actual (BUG-0012) usa `__slotTpl_name` + `__slotMap`. El adapter nunca se actualizó.

**Síntomas:**
- Tests Angular 8-10 (scoped slots) muestran `{{item}}` literal o tokens vacíos
- `connectedCallback` se ejecuta antes de que Angular proyecte hijos → `__slotMap` vacío
- El `queueMicrotask` existe para slots top-level pero no para forBlock slots
- El adapter intenta `registerSlotRenderer` pero el componente WCC no tiene ese método

**Fix propuesto:**
1. Alinear `angular-adapter.js` con el nuevo sistema `__slotTpl` + `__slotMap`
2. Extender `queueMicrotask` retry en `connected-callback.js` para forBlock slots
3. Hacer que el adapter almacene templates en `__slotTpl_name` en vez de usar renderers

**E2E tests afectados:** `framework-integrations/e2e/fixtures/angular.spec.js` (Tests 8-10)

## 🚀 SSR — Static `renderToString` (Task-0021)

Spec: `.agent/specs/ssr/`

### SSR-1: Render básico (props, texto, CSS, atributos)
- [ ] Crear `lib/codegen/ssr.js` con `generateSSR(parseResult)`
- [ ] Generar `renderToString(props, state)` con defaults de `propDefs` y `signals`
- [ ] Interpolación `{{expr}}` + `__esc()` + CSS inline
- [ ] `:attr`, `:class`, `:style` como atributos HTML estáticos

### SSR-2: Directivas (if, each, show)
- [ ] `if/else-if/else` → ternarios
- [ ] `each` → `.map()` con escape
- [ ] `show` → `style="display:none"` inline

### SSR-3: Hidratación + CLI
- [ ] `connectedCallback` adopta DOM servido en vez de clonar template
- [ ] Opción `ssr: true` en `compile()` + flag `--ssr` en CLI
- [ ] Tests: SSR round-trip + hidratación

## 🚨 CSS Scoper — `@scope` con límites automáticos (Prioridad Máxima) ✅

Spec: `.agent/specs/css-scoper/`

### Pipeline de boundaries ✅
- [x] Recolectar boundaries de imports `.wcc` en `preamble.js`
- [x] Pasar boundaries a `scopeCSS()`

### Implementación de `@scope` ✅
- [x] `scopeCSS()` genera `@scope (tag) to (boundaries...)` cuando hay boundaries
- [x] Bug 1 (comentarios) — no aplica con `@scope` wrapping
- [x] Bug 2 (`:is()`, `:where()`) — no aplica con `@scope`; `splitTopLevelCommas()` fijo en legacy
- [x] `:host` / `:host(...)` → `:scope` / `:scope(...)` en @scope mode (Bug 3)
- [x] `:host` / `:host(...)` → `tagName` / `tagName(...)` en legacy mode
- [x] CSS nesting (`&`) funciona naturalmente dentro de `@scope` (Bug 4)
- [x] `@import`/`@charset` extraídos fuera de `@scope`
- [x] `@media`/`@keyframes`/`@supports` pasan tal cual dentro de `@scope`

### Fallback ✅
- [x] Tag-name prefixing preservado cuando no hay boundaries (componentes sin hijos)

### Tests ✅
- [x] 24 tests unitarios en `test/css-scoper.test.js` (@scope, boundaries, :host, @media, @keyframes, nesting, legacy, bug 2 fix)
- [x] 9 componentes de ejemplo en `example/src/13-css-scope/`
- [x] 131 test files, 1301 tests pasando

## 🔧 Mejoras de código (Code Review)

### 1. Unificar walker — eliminar duplicación en `compiler-browser.js` ✅
- [x] Hacer `lib/walker/` browser-compatible (setParseHTML para inyectar parser)
- [x] Eliminar las ~330 líneas duplicadas de walker en `compiler-browser.js` (528→207)
- [x] Usar `extractEmitsObjectNameFromGeneric` en vez del regex inline en `compiler-browser.js`

### 2. Limpiar runtime muerto en `preamble.js` ✅
- [x] Eliminar código muerto: `if (needsEffect)`, `if (needsEffect || needsComputed || needsBatch)`, `needsComputed`, `needsUntrack`, `needsBatch`
- [x] Eliminar import y llamada a `buildInlineRuntime` (siempre vacío)

### 3. Crear `lib/utils.js` — helpers compartidos ✅
- [x] Mover `escapeRegex` de `render-context.js` y `expr-transformer.js` a `lib/utils.js`
- [x] Mover `camelToKebab` de `parser-extractors.js` a `lib/utils.js`
- [x] Actualizar todos los imports (12 archivos)

### 4. Mover `generateUpdateOp` a `lib/codegen/update-op.js` ✅
- [x] Extraer `generateUpdateOp` (252 líneas) de `lib/transform/dep-graph.js`
- [x] `dep-graph.js`: 990 → 738 líneas (solo análisis de dependencias)

### 5. Split `lib/parser/extractors.js` (1076 líneas) ✅
- [x] `extractors/props.js`, `emits.js`, `reactivity.js`, `lifecycle.js`, `refs.js`
- [x] `extractors.js` → 28-line re-export shim

### 6. Estandarizar idioma de mensajes de error ✅
- [x] Español → inglés en validators, config, walker, sfc-parser, parser

### 7. JSDoc + magic numbers + DRY ✅
- [x] Documentar `typeOrder` en `invalidate.js`
- [x] Agregar JSDoc a `buildIfBlock`
- [x] Walker functions already documented from earlier refactor
- [x] DRY already addressed by `renderItemSetup` in Phase 5
