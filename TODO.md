# TODO — Phase 5 Refactor

## 🔴 Máxima prioridad: Zero Runtime

### 0. Eliminar `__effect` — migrar `each` dentro de `if` a `__invalidate` ✅ COMPLETADO

- [x] Generar `__renderEach_N` methods para forBlocks anidados dentro de if-blocks
- [x] Registrar en depGraph con `_renderIndex`
- [x] Llamar `__renderEach_N` desde `__invalidate` en vez de `__effect`
- [x] Eliminar `__effect` de `_setup` method
- [x] Eliminar `needsEffect` de `preamble.js` (volver a `false` fijo)
- [x] Eliminar get trap del Proxy en `constructor.js`
- [x] Eliminar `__disposers` de `connected-callback.js`
- [x] Eliminar `hasNestedForInIf`
- [x] Verificar que `__wcc-signals.js` NO se genera
- [x] 131 unit + 207 e2e tests pasando

---

## ✅ Completado

- [x] `lib/codegen/` — 10 módulos (index, render-context, constructor, connected-callback, invalidate, render-methods, item-renderer, event-generator, preamble, class-methods)
- [x] `lib/transform/` — 3 módulos (expr-transformer, for-transformer, dep-graph)
- [x] `lib/parser/` — 3 módulos (extractors, validators, sfc-descriptor)
- [x] `lib/walker/` — 4 módulos (tree-walker, if-processor, each-processor, dynamic-processor)
- [x] `lib/find-anchor.js` — runtime anchor resolution
- [x] `lib/codegen.js` — 4-line re-export shim (era 3335 líneas)
- [x] `lib/parser-extractors.js` — re-export shim
- [x] `lib/tree-walker.js` — 4-line re-export shim
- [x] `example/src/12-edge-cases/test-recursive.wcc`
- [x] 131 unit + 207 e2e tests

## 🔵 Limpieza final

- [ ] Eliminar `lib/codegen-v01611-base.js` (archivo legacy)
- [ ] Mergear `phase5-6-wire-final` a `main`

---

## 🔧 Mejoras de código (Code Review)

### 1. Unificar walker — eliminar duplicación en `compiler-browser.js`
- [ ] Hacer `lib/walker/` browser-compatible (reemplazar `parseHTML` de linkedom con factory)
- [ ] Eliminar las ~330 líneas duplicadas de walker en `compiler-browser.js` (walkTree, walkBranch, processIfChains, buildIfBlock, processForBlocks, detectRefs)
- [ ] Usar `extractEmitsObjectNameFromGeneric` en vez del regex inline en `compiler-browser.js:422`

### 2. Limpiar runtime muerto y `__effect` residual
- [ ] `preamble.js`: eliminar `needsComputed`, `needsUntrack`, `needsBatch` (siempre `false`)
- [ ] `preamble.js`: simplificar `buildInlineRuntime` — solo recibe `needsEffect`
- [ ] `render-methods.js`: eliminar o documentar las 2 llamadas a `__effect()` que quedan (model bindings + nested for-loops en if-branches)

### 3. Crear `lib/utils.js` — helpers compartidos
- [ ] Mover `escapeRegex` de `render-context.js` y `expr-transformer.js` a `lib/utils.js`
- [ ] Mover `camelToKebab` de `parser-extractors.js` a `lib/utils.js`
- [ ] Extraer `hasNestedForInIf` (triplicado en constructor, preamble, connected-callback) a `lib/utils.js`
- [ ] Actualizar todos los imports

### 4. Mover `generateUpdateOp` a `lib/codegen/update-op.js`
- [ ] Extraer `generateUpdateOp` (240 líneas) de `lib/transform/dep-graph.js`
- [ ] `dep-graph.js` queda como módulo puro de análisis de dependencias

### 5. Split `lib/parser/extractors.js` (1076 líneas)
- [ ] `lib/parser/extractors/signals.js` — extractSignals, extractComputeds, extractEffects
- [ ] `lib/parser/extractors/props.js` — extractProps*
- [ ] `lib/parser/extractors/emits.js` — extractEmits*
- [ ] `lib/parser/extractors/lifecycle.js` — extractLifecycleHooks, extractFunctions
- [ ] `lib/parser/extractors/models.js` — extractModels, extractRefs, extractExpose, detectBatchUsage

### 6. Limpieza miscelánea
- [ ] Eliminar `lib/codegen-v01611-base.js` (2180 líneas, código muerto)
- [ ] Estandarizar idioma de mensajes de error (español → inglés)

### 7. Mover tests a `test/`
- [ ] Crear `test/` con estructura espejo de `lib/`
- [ ] Mover ~50 archivos `*.test.js` fuera de `lib/`
- [ ] Actualizar `vitest.config.js` includes

### 8. JSDoc + magic numbers + DRY
- [ ] Documentar `typeOrder` en `invalidate.js:47` (qué implica cada prioridad)
- [ ] Agregar JSDoc a `walkBranch`, `buildIfBlock`, `recomputeAnchorPath`, `isChainPredecessor`
- [ ] Reducir duplicación entre keyed/non-keyed for-loops en `render-methods.js` (~100 líneas) extrayendo helpers de bindings/events/attr
- [ ] Definir API boundary: documentar qué exports son públicos vs internos en cada shim

---

## Estructura final

```
lib/
├── compiler.js
├── compiler-browser.js
├── sfc-parser.js
├── template-normalizer.js
├── css-scoper.js
├── import-resolver.js
├── config.js
├── types.js
├── wcc-runtime.js
├── dev-server.js
├── reactive-runtime.js
├── parser.js
├── find-anchor.js
├── codegen.js              ← 4-line shim
├── tree-walker.js           ← 4-line shim
├── parser-extractors.js     ← re-export shim
│
├── codegen/
│   ├── index.js
│   ├── render-context.js
│   ├── constructor.js
│   ├── connected-callback.js
│   ├── invalidate.js
│   ├── render-methods.js
│   ├── item-renderer.js
│   ├── event-generator.js
│   ├── preamble.js
│   └── class-methods.js
│
├── transform/
│   ├── expr-transformer.js
│   ├── for-transformer.js
│   └── dep-graph.js
│
├── parser/
│   ├── extractors.js
│   ├── validators.js
│   └── sfc-descriptor.js
│
└── walker/
    ├── tree-walker.js
    ├── if-processor.js
    ├── each-processor.js
    └── dynamic-processor.js
```
