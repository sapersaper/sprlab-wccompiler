# Slots — Requisitos

## User Stories

1. Como desarrollador, quiero usar `<slot>` para content distribution (slot por defecto).
2. Como desarrollador, quiero usar `<slot name="header">` para named slots.
3. Como desarrollador, quiero usar `<slot :prop="expr">` para scoped slots que exponen datos al consumidor.
4. Como desarrollador, quiero definir fallback content dentro de `<slot>` para cuando no se provee contenido.
5. Como consumidor, quiero pasar contenido al slot por defecto como children del componente.
6. Como consumidor, quiero pasar contenido a named slots con `<template #slotName>`.

## Restricciones

- `<slot>` se reemplaza por `<span data-slot="...">` en el template procesado
- Default slot: recoge childNodes del consumidor
- Named slots: el consumidor usa `<template #name>content</template>`
- Scoped slots: exponen props via `:prop="expr"` y el consumidor accede con `{{prop}}`
- Fallback content se usa si el consumidor no provee contenido
