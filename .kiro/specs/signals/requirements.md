# Signals — Requisitos

## User Stories

1. Como desarrollador, quiero declarar estado reactivo con `signal(value)` para que los cambios se propaguen automáticamente al DOM.
2. Como desarrollador, quiero declarar valores derivados con `computed(() => expr)` que se recalculan automáticamente cuando sus dependencias cambian.
3. Como desarrollador, quiero declarar side effects con `effect(() => { ... })` que se re-ejecutan cuando sus dependencias cambian.
4. Como desarrollador, quiero declarar constantes con `const x = value` que se preservan en el componente sin reactividad.
5. Como desarrollador, quiero que `signal.set(value)` actualice el valor y notifique a los suscriptores.
6. Como desarrollador, quiero que `__batch(fn)` agrupe múltiples escrituras y flush effects una sola vez al final.

## Restricciones

- Los signals se leen con `name()` y se escriben con `name.set(value)`
- Los computeds son read-only
- Los effects se ejecutan inmediatamente al crearse y se re-ejecutan cuando cambian dependencias
- El tracking de dependencias es automático (global stack `__currentEffect`)
- El runtime reactivo se inlinea en cada componente (zero imports)
