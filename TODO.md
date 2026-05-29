# TODO — Phase 5 Refactor (continuación)

## 🔴 Máxima prioridad: completar estructura de directorios

### 1. `lib/parser/` — Split de `parser-extractors.js` (1313 líneas)

Crear 3 archivos:
```
lib/parser/
├── extractors.js        ← funciones de extracción puras (extractSignals, extractComputeds, extractProps, etc.)
├── validators.js        ← funciones de validación (validatePropsAssignment, validateNameCollisions, etc.)
└── sfc-descriptor.js    ← buildParseResult desde compiler.js (construye el ParseResult)
```

- `lib/parser-extractors.js` → re-export shim (backward compat)
- Extraer `buildParseResult` de `compiler.js` → `lib/parser/sfc-descriptor.js`

### 2. `lib/walker/` — Split de `tree-walker.js` (1086 líneas)

Crear 4 archivos:
```
lib/walker/
├── tree-walker.js       ← walkTree, walkBranch (solo walking)
├── if-processor.js      ← processIfChains, buildIfBlock
├── each-processor.js    ← processForBlocks, parseEachExpression
└── dynamic-processor.js ← processDynamicComponents, detectRefs
```

- `lib/tree-walker.js` → re-export shim (backward compat)
- Mover `recomputeAnchorPath` a utilities si todavía se usa

### 3. Limpieza final

- [ ] Eliminar `lib/codegen-v01611-base.js` (archivo legacy)
- [ ] Verificar que `lib/codegen.js` shim de 4 líneas re-exporta todo
- [ ] `npm test` — 131 unit + 207 e2e pasando
- [ ] Mergear `phase5-6-wire-final` a `main`

---

## ✅ Ya completado (Phase 5-1 a 5-6)

- [x] `lib/find-anchor.js` — runtime anchor resolution
- [x] `lib/codegen/render-context.js` — contexto recursivo
- [x] `lib/transform/` — expr-transformer, for-transformer, dep-graph
- [x] `lib/codegen/` — index, constructor, connected-callback, invalidate, render-methods, item-renderer, event-generator, preamble, class-methods
- [x] `example/src/12-edge-cases/test-recursive.wcc` — componente recursivo
- [x] 131 unit + 207 e2e tests
