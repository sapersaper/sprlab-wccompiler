# TODO

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
