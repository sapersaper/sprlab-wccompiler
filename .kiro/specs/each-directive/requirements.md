# Each Directive — Requisitos

## User Stories

1. Como desarrollador, quiero usar `each="item in list"` para renderizar una lista de elementos.
2. Como desarrollador, quiero acceder al índice con `each="(item, index) in list"`.
3. Como desarrollador, quiero usar `:key="item.id"` para optimizar re-renders con keyed diffing.
4. Como desarrollador, quiero que la lista se actualice reactivamente cuando el signal source cambia.
5. Como desarrollador, quiero usar bindings, events, show, attr y model dentro de items.

## Restricciones

- Sintaxis: `each="item in list"` o `each="(item, index) in list"`
- El source puede ser un signal, computed, o prop
- `:key` es opcional — sin key se usa reconciliación por posición
- Con `:key` se usa keyed diffing (reutiliza nodos existentes)
- Los bindings dentro de items pueden ser estáticos (solo item/index) o reactivos (refs a component vars)
