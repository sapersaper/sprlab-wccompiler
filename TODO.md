# TODO

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

### 5. Split `lib/parser/extractors.js` (1076 líneas)
- [ ] `signals.js`, `props.js`, `emits.js`, `lifecycle.js`, `models.js`

### 6. Estandarizar idioma de mensajes de error
- [ ] Español → inglés en validators

### 7. JSDoc + magic numbers + DRY
- [ ] Documentar `typeOrder` en `invalidate.js`
- [ ] Agregar JSDoc a `walkBranch`, `buildIfBlock`, `recomputeAnchorPath`, `isChainPredecessor`
- [ ] Reducir duplicación keyed/non-keyed for-loops en `render-methods.js`
