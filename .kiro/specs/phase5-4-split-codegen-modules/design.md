# Design: split-codegen-modules

## Module boundaries

```
lib/codegen/
├── index.js              ← generateComponent (orchestrator, ~80 lines)
├── event-generator.js    ← generateEventHandler, generateForEventHandler
├── preamble.js           ← generatePreamble (source, runtime, CSS, template, findAnchor)
├── constructor.js        ← generateConstructor (Proxy, batch, watchers)
├── connected-callback.js ← generateConnectedCallback (DOM setup, slots, events)
├── invalidate.js         ← generateInvalidate (__invalidate switch/case)
├── render-methods.js     ← generateRenderMethods (__renderIf/Each/Dynamic, setup methods)
├── class-methods.js      ← generateClassMethods (methods, models, expose, refs, emit)
└── render-context.js     ← RenderContext (already exists from spec 5-2)
```

## Dependency graph

```
index.js
  ├── preamble.js          (no deps besides codegen helpers)
  ├── constructor.js       (no deps)
  ├── connected-callback.js (imports from event-generator, helper utils)
  ├── invalidate.js        (imports dep-graph)
  ├── render-methods.js    (imports dep-graph, expr-transformer, for-transformer, event-generator)
  ├── class-methods.js     (imports expr-transformer)
  └── event-generator.js   (imports expr-transformer, for-transformer)
```

## generateComponent (index.js)

```js
import { generatePreamble } from './preamble.js';
import { generateConstructor } from './constructor.js';
import { generateConnectedCallback } from './connected-callback.js';
import { generateInvalidate } from './invalidate.js';
import { generateRenderMethods } from './render-methods.js';
import { generateClassMethods } from './class-methods.js';
import { RenderContext } from './render-context.js';

export function generateComponent(parseResult, options = {}) {
  const lines = [];
  const ctx = RenderContext.fromParseResult(parseResult);

  generatePreamble(lines, parseResult, options);
  lines.push(`class ${parseResult.className} extends HTMLElement {`);
  generateConstructor(lines, parseResult, ctx);
  generateConnectedCallback(lines, parseResult, ctx);
  generateRenderMethods(lines, parseResult, ctx);
  generateInvalidate(lines, parseResult, ctx);
  generateClassMethods(lines, parseResult, ctx);
  lines.push('}');
  // ... customElements.define, export ...
  return lines.join('\n');
}
```

## Re-exports for backward compatibility

The old `lib/codegen.js` module exported many functions. Maintain compatibility by
re-exporting from `lib/codegen.js` → `lib/codegen/index.js` or via package.json exports.

Actually, the simplest approach: replace `lib/codegen.js` with a re-export file:
```js
export { generateComponent } from './codegen/index.js';
export { transformExpr, transformMethodBody, pathExpr, wrapTernaryExpr } from './transform/expr-transformer.js';
export { transformForExpr, isStaticForBinding, isStaticForExpr } from './transform/for-transformer.js';
export { extractDeps, refsComputedOrMethod, extractComputedDeps, topologicalSortComputeds, buildDepGraph } from './transform/dep-graph.js';
```
