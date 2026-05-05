# Volar Language Server — Diseño

## Ubicación

Todo el código del language server está en `./vscode-wcc/`:
- `vscode-wcc/packages/server/src/languagePlugin.ts` — Plugin principal
- `vscode-wcc/packages/server/src/templateExpressionParser.ts` — Extractor de expresiones
- `vscode-wcc/packages/server/src/wccParser.ts` — Parser de bloques SFC
- `vscode-wcc/packages/client/` — Extension client (activación, configuración)

## Arquitectura

Plugin de lenguaje para Volar que habilita IntelliSense en archivos `.wcc`.

### Componentes

1. **`wccLanguagePlugin`** — LanguagePlugin que identifica archivos .wcc y crea/actualiza VirtualCode
2. **`WccCode`** — VirtualCode root que parsea el SFC y genera embedded codes
3. **`wccParser`** — Parsea bloques `<script>`, `<template>`, `<style>` con offsets
4. **`templateExpressionParser`** — Extrae expresiones de template con offsets

## VirtualCode Generados

### `script_0`
- languageId: 'typescript' o 'javascript' (según `lang` attr)
- Mapeo 1:1 del contenido del bloque script
- Incluye suffix con usage references para suprimir "declared but never read"
- Capabilities: full (completion, format, navigation, semantic, structure, verification)

### `template_0`
- languageId: 'html'
- Mapeo 1:1 del contenido del bloque template
- Capabilities: full

### `template_expressions_0`
- languageId: 'typescript' o 'javascript'
- Contenido: script block (sin mapping) + `declare const` para props y each vars + expresiones con mapping
- Cada expresión se mapea al offset original en el .wcc
- Expresiones que empiezan con `{` se wrappean en `()` para que TS las interprete como object literals
- Capabilities: completion, navigation, semantic, verification (no format, no structure)

### `style_0`
- languageId: 'css'
- Mapeo 1:1 del contenido del bloque style
- Capabilities: full

## Template Expression Parser

Extrae expresiones de:
- `{{expr}}` — text interpolation
- `@event="handler"` — event handlers
- `:attr="expr"` / `bind:attr="expr"` — attribute bindings
- `show="expr"` — show directive
- `if="expr"` / `else-if="expr"` — conditionals
- `each="(item, index) in source"` — source expression
- `model="name"` — model target

## TypeScript Integration

- `extraFileExtensions`: registra `.wcc` con `scriptKind: Deferred`
- `getServiceScript`: retorna `script_0` como service script principal
- `getExtraServiceScripts`: retorna `template_expressions_0` como script adicional
- Props se declaran como `declare const propName: type` en el virtual code
- Each variables: `declare const itemVar: any` y `declare const indexVar: number`
