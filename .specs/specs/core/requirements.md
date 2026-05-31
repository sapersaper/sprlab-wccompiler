# Core — Requisitos

## User Stories

1. Como desarrollador, quiero escribir componentes en formato SFC (.wcc) con bloques `<script>`, `<template>` y `<style>` para tener todo en un solo archivo.
2. Como desarrollador, quiero declarar el tag name del componente con `defineComponent({ tag: 'my-tag' })` para registrar el custom element.
3. Como desarrollador, quiero que el CSS se scope automáticamente al tag del componente para evitar colisiones de estilos.
4. Como desarrollador, quiero que el compilador produzca un archivo JS autocontenido sin dependencias externas (zero-runtime).
5. Como desarrollador, quiero que el bloque `<style>` sea opcional.
6. Como desarrollador, quiero que el compilador rechace archivos SFC malformados con errores claros.
7. Como desarrollador, quiero poder compilar componentes en el browser (sin Node.js) para uso en playgrounds/editores online.

## Restricciones

- El formato de entrada es `.wcc` (Single File Component)
- El output es un único archivo `.js` por componente
- No se permiten `template:` ni `styles:` dentro de `defineComponent()` en modo SFC
- Los bloques `<script>` y `<template>` son obligatorios; `<style>` es opcional
- No puede haber contenido fuera de los bloques reconocidos
- No se permiten bloques duplicados
- El browser compiler usa DOMParser nativo en lugar de jsdom
