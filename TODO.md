# TODO — wcCompiler

## DX
- [ ] Source maps — compiled output maps back to original source for debugging
- [ ] Error overlay in dev server — show compilation errors in the browser instead of terminal only

## Ecosystem
- [ ] VS Code plugin — `vscode-wcc/` (ver plan abajo)
- [x] Documentation website — https://sapersaper.github.io/sprlab-wccompiler/
- [x] Playground — https://sapersaper.github.io/sprlab-wccompiler/playground/

## VS Code Plugin — Plan progresivo

### Fase 1 — Extensión base + syntax highlighting para `.wcc`
- [ ] Crear estructura de extensión (`vscode-wcc/package.json`)
- [ ] Gramática TextMate para `.wcc` (`syntaxes/wcc.tmLanguage.json`)
- [ ] Embed JavaScript dentro de `<script>`
- [ ] Embed TypeScript dentro de `<script lang="ts">`
- [ ] Embed HTML dentro de `<template>`
- [ ] Embed CSS dentro de `<style>`
- [ ] Language configuration (brackets, auto-close, comments)
- [ ] Generar `.vsix` instalable

### Fase 2 — Highlighting de directivas (en `.wcc` y `.html`)
- [ ] `{{expresión}}` — resaltado como interpolación
- [ ] `@click`, `@input`, etc. — resaltado como event binding
- [ ] `:class`, `:style`, `:attr` — resaltado como attribute binding
- [ ] Directivas: `each`, `if`, `else-if`, `else`, `show`, `model`, `ref`
- [ ] `#nombre` — resaltado como named slot
- [ ] Aplicar en `<template>` de `.wcc` y en archivos `.html`

### Fase 3 — Snippets e iconos
- [ ] Snippet `wcc` → scaffold completo de componente `.wcc`
- [ ] Snippets para directivas comunes
- [ ] Icono personalizado para `.wcc` en el explorador
