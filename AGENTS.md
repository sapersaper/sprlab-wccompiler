# @sprlab/wccompiler — A wcCompiler

Compilador zero-runtime que transforma single-file components `.wcc` en web components nativos con reactividad basada en signals.

## Build & Test

- `npm test` — Tests unitarios con Vitest
- `npm run typecheck` — `tsc --project jsconfig.json --noEmit`
- E2E: Playwright en `e2e/` (no correr automaticamente)
- `wcc build` — Compila .wcc → .js
- `wcc build --bundle --minify` — Producción
- `wcc dev` — Dev server con live-reload

## Arquitectura

Pipeline de compilación SFC (`.wcc`):
1. `sfc-parser.js` — Extrae `<script>`, `<template>`, `<style>`
2. `import-resolver.js` — Resuelve imports `.wcc`
3. `parser/extractors/` — Extrae señales, props, emits, ciclos de vida, etc.
4. `template-normalizer.js` — PascalCase→kebab, self-closing tags
5. `walker/` — Procesa if/each/dynamic en el DOM
6. `tree-walker.js` — Recorre el DOM recolectando bindings, eventos, slots
7. `transform/dep-graph.js` — Grafo de dependencias para invalidación
8. `codegen/` — Genera el código JS de salida

Todo centralizado via `__invalidate()` con dependency graph. No Shadow DOM — Light DOM con CSS scoped por tag-name prefixing.

## Estructura del proyecto

- `lib/` — Core del compilador
- `lib/parser/` — Extractor de declaraciones JS
- `lib/codegen/` — Generación de código (preamble, constructor, connected-callback, invalidate, render-methods, class-methods, etc.)
- `lib/transform/` — Transformación de expresiones y dependency graph
- `lib/walker/` — Análisis de templates (if, each, dynamic)
- `adapters/` — Adaptadores runtime para Vue/Angular/React
- `integrations/` — Plugins de Vite para Vue/React/Angular
- `test/` — Tests unitarios (Vitest + fast-check para property-based)
- `e2e/` — Tests end-to-end (Playwright)
- `.specs/` — Especificaciones de features
- `vscode-wcc/` — Extensión de VS Code (lenguaje .wcc)
- `framework-integrations/` — Proyectos QA para Vue/React/Angular

## Convenciones de código

- ESM puro — `import`/`export` en todo el código
- Sin TypeScript en el compilador (JSDoc para tipos)
- `vitest.setup.js` configura seed determinístico para fast-check (42)
- Nombres de archivos de test siguen patrón `*.test.js`
- El compilador nunca usa Shadow DOM
- Las señales se leen con `signal()` y se escriben con `signal.set()`

## Directivas de template

Sin prefijo `v-`: `if`, `else-if`, `else`, `each`, `show`, `model`, `:attr`, `@event`, `:class`, `:style`

## Comandos útiles

- `wcc build --config <path>` — Usar config personalizada
- `wcc build --standalone` — Runtime inline en cada componente
- `wcc build --standalone` con `standalone: true` en defineComponent para override por componente

## Stack técnico

- Node 24 (Volta)
- Yarn 4 (nodeLinker: node-modules)
- Vitest v3, jsdom, fast-check
- esbuild (type stripping, minificación, bundling)
- linkedom (parseo HTML server-side)
- Babel (para plugin de React)
