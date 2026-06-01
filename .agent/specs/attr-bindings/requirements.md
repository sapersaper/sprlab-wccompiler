# Attr Bindings — Requisitos

## User Stories

1. Como desarrollador, quiero usar `:attr="expr"` para bindear atributos dinámicamente.
2. Como desarrollador, quiero usar `:class="expr"` para clases dinámicas (string, objeto, o array).
3. Como desarrollador, quiero usar `:style="expr"` para estilos dinámicos (string u objeto).
4. Como desarrollador, quiero usar `:disabled="expr"` y otros boolean attributes que se remueven cuando son false/null.
5. Como desarrollador, quiero usar `bind:attr="expr"` como sintaxis alternativa.

## Restricciones

- Sintaxis: `:attr="expr"` o `bind:attr="expr"`
- Boolean attributes: se remueven si el valor es `null`, `undefined`, o `false`
- `:class` soporta: string, objeto `{ className: condition }`, array
- `:style` soporta: string, objeto `{ property: value }`
- Las expresiones se transforman para acceder a signals/computeds/props
