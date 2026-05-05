# TypeScript Support — Requisitos

## User Stories

1. Como desarrollador, quiero usar `<script lang="ts">` en archivos .wcc para escribir TypeScript.
2. Como desarrollador, quiero usar generics en defineProps y defineEmits para type safety.
3. Como desarrollador, quiero usar interfaces y type annotations en mi código.
4. Como desarrollador, quiero que el compilador stripee los types y produzca JS válido.
5. Como desarrollador, quiero errores claros si hay syntax errors en el TypeScript.

## Restricciones

- TypeScript se detecta por `lang="ts"` en el bloque `<script>`
- Type stripping se hace con esbuild (`loader: 'ts'`, `target: 'esnext'`)
- Los generics de defineProps/defineEmits se extraen ANTES del type strip
- Errores de sintaxis TS producen error con code `TS_SYNTAX_ERROR`
- El output final es siempre JavaScript (no TypeScript)
