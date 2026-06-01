# Watch — Requisitos

## User Stories

1. Como desarrollador, quiero usar `watch(signal, (newVal, oldVal) => { ... })` para reaccionar a cambios de un signal específico con acceso al valor anterior.
2. Como desarrollador, quiero usar `watch(() => expr, (newVal, oldVal) => { ... })` para observar expresiones derivadas.

## Restricciones

- Dos formas: signal directo y getter function
- El callback recibe `(newVal, oldVal)` como parámetros
- Los watchers se ejecutan como effects con tracking de valor previo
- El body del watcher se transforma igual que methods (signal reads/writes)
