# If Directive — Requisitos

## User Stories

1. Como desarrollador, quiero usar `if="expr"` en un elemento para renderizarlo condicionalmente.
2. Como desarrollador, quiero usar `else-if="expr"` para agregar ramas alternativas.
3. Como desarrollador, quiero usar `else` para una rama por defecto.
4. Como desarrollador, quiero que las ramas se actualicen reactivamente cuando cambian signals/computeds/props.

## Restricciones

- `else-if` y `else` deben ser hermanos inmediatos del `if` (sin nodos intermedios)
- Las ramas se reemplazan por un comment anchor en el DOM
- Cada rama tiene su propio template HTML
- Solo una rama se renderiza a la vez
- Las expresiones se transforman para acceder a signals/computeds/props
