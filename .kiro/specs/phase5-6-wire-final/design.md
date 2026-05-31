# Design: wire-final

## Final structure

```
lib/
├── codegen.js                 (4 lines — re-export shim)
├── codegen/
│   ├── index.js               (generateComponent orchestrator)
│   ├── render-context.js      (RenderContext class)
│   ├── item-renderer.js       (renderItemSetup)
│   ├── preamble.js            (generatePreamble)
│   ├── constructor.js         (generateConstructor)
│   ├── connected-callback.js  (generateConnectedCallback)
│   ├── invalidate.js          (generateInvalidate)
│   ├── render-methods.js      (generateRenderMethods)
│   ├── class-methods.js       (generateClassMethods)
│   └── event-generator.js     (generateEventHandler, generateForEventHandler)
├── transform/
│   ├── expr-transformer.js    (transformExpr, transformMethodBody, pathExpr, wrapTernaryExpr)
│   ├── for-transformer.js     (transformForExpr, isStaticForExpr, isStaticForBinding)
│   └── dep-graph.js           (buildDepGraph, extractDeps, generateUpdateOp, ...)
├── compiler.js                (unchanged imports)
├── compiler-browser.js        (unchanged imports)
├── tree-walker.js             (anchorPath→anchorType/anchorIndex)
├── find-anchor.js             (findAnchor runtime helper)
└── ... (resto sin cambios)
```

## No changes needed
Este spec es puramente de verificación. La integración ya funciona.
