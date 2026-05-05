# Template Refs — Requisitos

## User Stories

1. Como desarrollador, quiero usar `templateRef('name')` en el script para declarar una referencia a un elemento del template.
2. Como desarrollador, quiero usar `ref="name"` en el template para marcar el elemento referenciado.
3. Como desarrollador, quiero acceder al elemento DOM via `refVar.value` en el script.
4. Como desarrollador, quiero errores si `templateRef('name')` no tiene un `ref="name"` correspondiente en el template.

## Restricciones

- Declaración en script: `const myRef = templateRef('name')`
- Marcado en template: `ref="name"`
- Acceso: `myRef.value` → elemento DOM
- Validación: `templateRef` sin matching `ref` en template → error `REF_NOT_FOUND`
- Warning: `ref` en template sin matching `templateRef` en script
