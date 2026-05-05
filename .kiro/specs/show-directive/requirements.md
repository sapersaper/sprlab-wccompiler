# Show Directive — Requisitos

## User Stories

1. Como desarrollador, quiero usar `show="expr()"` para mostrar/ocultar un elemento sin removerlo del DOM.
2. Como desarrollador, quiero que la visibilidad se actualice reactivamente cuando cambian signals/computeds/props.

## Restricciones

- `show` controla `element.style.display` ('' o 'none')
- El elemento permanece en el DOM (a diferencia de `if` que lo remueve)
- La expresión se evalúa como truthy/falsy
- Se transforma para acceder a signals/computeds/props
