---
inclusion: auto
description: Project context and architecture overview for wcCompiler
---

# @sprlab/wccompiler — wcCompiler v2

## What is this?

Zero-runtime compiler que transforma single-file components `.wcc` en Web Components nativos con reactividad basada en signals. No framework dependencies in the output — just vanilla JavaScript using Custom Elements API. No Shadow DOM — Light DOM con CSS scoped via tag-name prefixing o `@scope` nativo.

## Stack

- Node 24 (Volta), Yarn 4 (nodeLinker: node-modules)
- Vitest v3, jsdom, fast-check (property-based testing)
- esbuild (type stripping, minificación, bundling)
- linkedom (parseo HTML server-side)
- Babel (plugin de React)
- @vitest/coverage-v8 (coverage, thresholds: 85/80/88/85)

## Signals API

| Function | Purpose | Read | Write |
|----------|---------|------|-------|
| `signal(value)` | Reactive state | `count()` | `count.set(value)` |
| `computed(() => expr)` | Derived value | `doubled()` | (read-only) |
| `defineComponent({...})` | Component metadata | — | — |
| `defineProps<T>(defaults?)` | Typed props | `props.name` | (read-only) |
| `defineEmits<T>()` | Typed events | — | `emit('event', data)` |
| `onMount(() => {...})` | Lifecycle: connected | — | — |
| `onDestroy(() => {...})` | Lifecycle: disconnected | — | — |
| `templateRef('name')` | Template ref | — | — |

## Template Syntax (directives sin prefijo `v-`)

- `{{expr}}` — text interpolation (signals requieren `()`)
- `@event="handler"` — DOM event binding
- `if` / `else-if` / `else` — conditional rendering
- `each="item in list"` — list rendering
- `show="expr"` — visibility toggle
- `model="variable"` — two-way binding
- `:attr="expr"` — attribute binding
- `:class="expr"` / `:style="expr"` — class/style binding
- `ref="name"` — template element reference
- `<slot>` / `<slot name="x" :prop="val">` — content distribution + scoped slots

## Compiler Pipeline

`.wcc` SFC → 1. sfc-parser → 2. import-resolver → 3. parser/extractors/ (señales, props, emits, ciclos de vida) → 4. template-normalizer → 5. walker/ (if, each, dynamic) → 6. tree-walker (bindings, eventos, slots) → 7. transform/dep-graph → 8. codegen/ → `.js`

## Output Characteristics

- Zero runtime dependencies
- Self-contained `.js` file per component
- Inline reactive runtime (signals, computed, batch)
- Scoped CSS via `@scope` nativo o tag-name prefixing
- Native HTMLElement class with Custom Elements API
- Event system: `_emit(name, detail)` dispatches kebab + lowercase (React 19 compat)

## Tests

- `npm test` — Vitest (1300+ tests)
- `npm run test:coverage` — Vitest + coverage
- `test/lib/` — Unit tests mirror de lib/
- `test/features/` — Integration tests full pipeline
- `e2e/` — Playwright (opcional, no automático)
- CI: GitHub Actions (`yarn test:coverage` en cada PR)

## SSR

- `wcc build --ssr` genera `.js` + `.ssr.js`
- `renderToString(props, state)` → HTML estático, zero deps
- Hydration: `connectedCallback` adopta DOM servido
- Cubre: props, signals, computed, each, if, show, CSS, XSS (`__esc`)

## CSS Scoping

- `@scope (tag) to (child1, child2)` — aislamiento real entre componentes
- Tag-name prefixing (fallback) — cuando no hay hijos
- Fixes: `:host` → `:scope`, `:is()` commas, `@import` fuera de `@scope`

## Framework Integrations (`framework-integrations/`)

Proyectos de QA manual para verificar componentes WCC en cada framework.

```
wcc/           3 .wcc fuente (counter, card, list)
vue/           Vue 3.5 + Vite (port 4001)
react/         React 19 + Vite (port 4002)
angular/       Angular 19 standalone (port 4003)
```

### Build pipeline
1. `wcc/` compila `.wcc` → `.js` via `wcc build --config <framework>.js`
2. Output va a cada framework en `src/wcc-components/`
3. Cada framework tiene su propio dev server

### Feature matrix

| Feature | Vue | React | Angular |
|---------|:---:|:-----:|:-------:|
| Props | `:count="ref"` | `count={state}` | `[count]="val"` |
| Events | `@count-changed` | `oncountchanged` | `(count-changed)` |
| Two-way | `v-model:count` (plugin) | ❌ | `[(count)]` (adapter) |
| Slots named | `<template #name>` | `slot="name"` | `ng-template[slot]` |
| Scoped slots | `#name="{ item }"` | `renderItem={fn}` | `let-item` |

### Integrations (Vite plugins)

- `integrations/vue.js` — wccVuePlugin: v-model, scoped slots, isCustomElement
- `integrations/react.js` — wccReactPlugin: JSX→HTML slot transform
- `integrations/angular.js` + `angular-plugin.js` — guía + banana-box transform

### Known issues

- **Scoped slots dentro de each** — BUG-0012: no se resuelven, pendiente de fix
- Vue: `<template #name>` necesita pre-transform del plugin
- Angular: Slot timing — workaround con `queueMicrotask` en connectedCallback
- Angular: `main.ts` importa de `wcc-components_back` que no existe
- React 19: usa `oncountchanged` (lowercase)
- **Config:** `integrations: ['vue']` (plural array), NO `integration: 'vue'` (singular string)

## Spec Organization (.agent/specs/)

- `core/` — base compiler pipeline, signals, defineComponent, template engine, CSS scoping, CLI
- `feature specs/` — defineProps, defineEmits, if/else, each, show, model, :attr, slots, templateRef, lifecycle, TypeScript, scoped slots, etc.
- `ssr/` — Static renderToString design
- `css-scoper/` — @scope implementation
- `scoped-slots-each/` — BUG-0012

## VSCode Extension (vscode-wcc) — IMPORTANT

La extension de lenguaje WCC provee IntelliSense para `.wcc` via Volar.

**CRITICAL — Packaging .vsix:** NEVER use `--no-dependencies`. El language server requiere todas sus dependencias incluidas (TypeScript, @volar/*, vscode-languageserver). Sin ellas el server crashea silenciosamente.

```bash
cd vscode-wcc
npm run build
npx @vscode/vsce package   # ← NO --no-dependencies flag!
```

**Location:** `vscode-wcc/` — v0.1.9
**Install:** Cmd+Shift+P → "Extensions: Install from VSIX..." → select the `.vsix`

## Archivos clave

- `lib/codegen/ssr.js` — Generación de renderToString
- `lib/codegen/connected-callback.js` — Hydration SSR + slot resolution
- `lib/codegen/item-renderer.js` — Render de each loops
- `lib/css-scoper.js` — @scope wrapping + legacy prefixing
- `bin/wcc.js` — CLI (build/dev/--ssr/--minify/--bundle)
