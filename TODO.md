# TODO — wcCompiler

## DX
- [ ] Source maps — compiled output maps back to original source for debugging
- [ ] Error overlay in dev server — show compilation errors in the browser instead of terminal only

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

### Fase 3 — Intellisense en template (expresiones y directivas)
- [ ] Intellisense dentro de `{{}}` (autocompletado, hover, errores en expresiones del template)
- [ ] Go-to-definition desde el template al script (click en `{{greeting}}` → salta a `const greeting`)
- [ ] Mappings precisos entre posiciones del template y código virtual
- [ ] Autocompletado en valores de directivas (`@click="`, `:class="`, `model="`)

### Fase 4 — Highlighting de directivas (gramática TextMate)
- [ ] `{{expresión}}` — resaltado como interpolación
- [ ] `@click`, `@input`, etc. — resaltado como event binding
- [ ] `:class`, `:style`, `:attr` — resaltado como attribute binding
- [ ] Directivas: `each`, `if`, `else-if`, `else`, `show`, `model`, `ref`
- [ ] `#nombre` — resaltado como named slot
- [ ] Aplicar en `<template>` de `.wcc` y en archivos `.html`

### Fase 5 — Snippets y DX
- [ ] Snippet `wcc` → scaffold completo de componente `.wcc`
- [ ] Snippets para directivas comunes
- [ ] Icono de archivo `.wcc` en el file explorer
