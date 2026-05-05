# Define Expose — Requisitos

## User Stories

1. Como desarrollador, quiero usar `defineExpose({ count, doubled })` para exponer métodos y propiedades del componente para acceso externo vía ref.
2. Como desarrollador, quiero que las propiedades expuestas sean accesibles desde el elemento DOM directamente.

## Restricciones

- `defineExpose()` recibe un objeto con las propiedades/métodos a exponer
- Las propiedades expuestas se asignan directamente al elemento (accesibles via `el.propName`)
- Actualmente: `defineExpose` está registrado en `REACTIVE_CALLS` (no se trata como constante) y tiene type declaration, pero el codegen no genera código específico para expose
- El import se stripea como macro import
