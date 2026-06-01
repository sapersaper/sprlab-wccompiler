# Lifecycle Hooks — Requisitos

## User Stories

1. Como desarrollador, quiero usar `onMount(() => { ... })` para ejecutar código cuando el componente se conecta al DOM.
2. Como desarrollador, quiero usar `onMount(async () => { ... })` para ejecutar código asíncrono al montar.
3. Como desarrollador, quiero usar `onDestroy(() => { ... })` para ejecutar cleanup cuando el componente se desconecta del DOM.
4. Como desarrollador, quiero poder declarar múltiples `onMount`/`onDestroy` en un mismo componente.

## Restricciones

- `onMount` se ejecuta en `connectedCallback`
- `onDestroy` se ejecuta en `disconnectedCallback`
- Los callbacks async se wrappean en IIFE: `(async () => { ... })()`
- Se soportan múltiples hooks del mismo tipo
- El body se transforma con `transformMethodBody` (signal reads/writes)
