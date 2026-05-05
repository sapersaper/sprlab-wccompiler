# TODO — wcCompiler

## 🔴 Prioridad máxima

- [x] Soporte para expresiones con argumentos en event handlers — `@click="removeItem(item)"`
- [x] Soporte para `items()` en `each` source (consistencia con el resto del template)
- [x] Inferencia de tipos para variables de iteración en `each` (`item` infiere tipo del array)
- [ ] Mejorar API de `watch` para inferir tipo del target automáticamente
  - Opciones: aceptar la referencia directa `watch(count, ...)` o requerir `watch<number>('count', ...)`
- [ ] Renombrar `templateBindings` → `defineExpose` — exponer métodos/propiedades del componente para acceso externo vía ref

## 🟡 Prioridad media

- [ ] Hover/intellisense sobre variables de iteración dentro del atributo `each` — `each="(item, index) in items()"`
  - Hoy funciona en las expresiones del template (`{{item.name}}`, `:key="item.id"`) pero no dentro del propio `each="..."`
  - Requiere mappings bidireccionales entre la declaración en el `each` y el virtual script

## DX
- [ ] Source maps — compiled output maps back to original source for debugging
- [ ] Error overlay in dev server — show compilation errors in the browser instead of terminal only

## Deprecar formato multi-archivo (3 archivos separados) ✅

Eliminado el soporte para componentes definidos con archivos separados (`.js`/`.ts` + `.html` + `.css`).
Solo queda el formato `.wcc` (Single File Component).

- [x] Convertir `wcc-card` (último componente multi-archivo) a `.wcc`
- [x] Eliminar `lib/parser.js` — parser multi-archivo completo
- [x] Eliminar `lib/printer.js` — pretty-printer para round-trip multi-archivo
- [x] Eliminar `extractDefineComponent()` de `lib/parser-extractors.js`
- [x] Eliminar `resolveChildComponent()` de `lib/compiler.js`
- [x] Simplificar `compile()` en `lib/compiler.js` — solo path SFC
- [x] Simplificar `discoverFiles()` en `bin/wcc.js` — solo `.wcc`
- [x] Actualizar `types/wcc.d.ts` — quitar `template?` y `styles?` de defineComponent
- [x] Eliminar tests obsoletos: `lib/parser.test.js`, `lib/parser.*.test.js`, `lib/parser.roundtrip.test.js`, `lib/printer.js` tests
- [x] Actualizar `lib/compiler-browser.js` si referencia el path multi-archivo

## Ecosystem
- [ ] VS Code plugin — `vscode-wcc/` (ver plan abajo)
- [x] Documentation website — https://sapersaper.github.io/sprlab-wccompiler/
- [x] Playground — https://sapersaper.github.io/sprlab-wccompiler/playground/

## VS Code Plugin — Plan progresivo

### Fase 1 — Extensión base + syntax highlighting para `.wcc` ✅
- [x] Crear estructura de extensión (`vscode-wcc/package.json`)
- [x] Gramática TextMate para `.wcc` (`syntaxes/wcc.tmLanguage.json`)
- [x] Embed JavaScript/TypeScript/HTML/CSS dentro de bloques
- [x] Language configuration (brackets, auto-close, comments)
- [x] Iconos (plugin + archivos `.wcc`)

### Fase 2 — Volar Language Server (intellisense) ✅
- [x] Convertir plugin a monorepo: `packages/client/` + `packages/server/`
- [x] Implementar Volar language plugin que mapea bloques `.wcc` a lenguajes virtuales
- [x] TypeScript intellisense dentro de `<script lang="ts">` (tipos, hover, autocompletado, errores)
- [x] JavaScript intellisense dentro de `<script>`
- [x] CSS intellisense dentro de `<style>`
- [x] HTML intellisense dentro de `<template>`
- [x] Suprimir falsos "declared but never read" para variables usadas en el template

### Fase 3 — Intellisense en template (expresiones y directivas) ✅
- [x] Intellisense dentro de `{{}}` (autocompletado, hover en expresiones del template)
- [x] Go-to-definition desde el template al script (click en `{{greeting}}` → salta a `const greeting`)
- [x] Mappings precisos entre posiciones del template y código virtual
- [x] Autocompletado en valores de directivas (`@click="`, `:class="`, `model="`)
- [x] Diagnósticos de tipo en expresiones del template — signals usan `signal()` explícito en el template (estilo SolidJS)
- [x] Soporte para variables de iteración en `each` (e.g., `item` y `index` en `each="(item, index) in items"`)

### Fase 4 — Highlighting de directivas (gramática TextMate) ✅
- [x] `{{expresión}}` — resaltado como interpolación
- [x] `@click`, `@input`, etc. — resaltado como event binding
- [x] `:class`, `:style`, `:attr` — resaltado como attribute binding
- [x] Directivas: `each`, `if`, `else-if`, `else`, `show`, `model`, `ref`
- [x] `#nombre` — resaltado como named slot

### Fase 5 — Snippets y DX
- [ ] Snippet `wcc` → scaffold completo de componente `.wcc`
- [ ] Snippets para directivas comunes
- [ ] Icono de archivo `.wcc` en el file explorer

### Fase 6 — Mejoras futuras (no requerido)
- [ ] Semantic tokens para colorear props, signals y computeds con colores distintos en el template
- [ ] Opciones adicionales en `defineComponent` — posibilidades:
  - `shadow: true` — usar Shadow DOM en vez de Light DOM
  - `extends: 'button'` — extender un elemento nativo (customized built-in)
  - `formAssociated: true` — participar en formularios nativos
  - `mode: 'open' | 'closed'` — modo del Shadow DOM si shadow está habilitado
