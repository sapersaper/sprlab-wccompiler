# Nested Components — Requisitos

## User Stories

1. Como desarrollador, quiero usar child components en mi template con su tag name y que se auto-importen.
2. Como desarrollador, quiero pasar props reactivos a child components con `:prop="expr"` o `{{expr}}` en atributos.
3. Como desarrollador, quiero que los props del child se actualicen reactivamente cuando cambian signals/computeds/props del parent.

## Restricciones

- Los child components se detectan por tag name con hyphen (custom elements)
- Auto-import: busca archivo con el tag name en el mismo directorio (.wcc, .js, .ts)
- Props reactivos: se pasan via `setAttribute` en un effect
- El import generado es relativo (`./${tag}.js`)
