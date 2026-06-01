# Volar Language Server — Requisitos

## User Stories

1. Como desarrollador, quiero IntelliSense (autocompletado, hover, go-to-definition) en el bloque `<script>` de archivos .wcc.
2. Como desarrollador, quiero IntelliSense en expresiones del template (`{{expr}}`, `@event="handler"`, `:attr="expr"`, etc.).
3. Como desarrollador, quiero diagnósticos de tipo en expresiones del template.
4. Como desarrollador, quiero IntelliSense HTML en el bloque `<template>`.
5. Como desarrollador, quiero IntelliSense CSS en el bloque `<style>`.
6. Como desarrollador, quiero que props declarados con defineProps sean reconocidos en expresiones del template.
7. Como desarrollador, quiero que variables de iteración (`each`) sean reconocidas en expresiones dentro del loop.

## Restricciones

- Basado en Volar (Language Plugin API)
- Archivos .wcc se registran como `languageId: 'wcc'`
- Genera VirtualCode embebidos para cada bloque (script, template, style, template_expressions)
- Template expressions se mapean al source original para navegación
- Props se declaran como variables en el virtual code para que TS las reconozca
- Variables de each se declaran como `any` / `number` (sin inferencia completa de tipos)
