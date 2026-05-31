# TODO — Phase 5 Refactor

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
