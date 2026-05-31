# Event Handlers — Requisitos

## User Stories

1. Como desarrollador, quiero usar `@click="methodName"` para bindear un método a un evento DOM.
2. Como desarrollador, quiero usar `@click="fn(arg)"` para pasar argumentos al handler.
3. Como desarrollador, quiero usar `@click="() => expr"` para inline arrow functions.
4. Como desarrollador, quiero que los handlers dentro de `each` blocks tengan acceso al item/index.

## Restricciones

- Sintaxis: `@eventName="handler"`
- Tres formas de handler:
  - Nombre simple: `"increment"` → `this._increment.bind(this)`
  - Llamada con args: `"remove(item)"` → `(e) => { this._remove(item); }`
  - Arrow function: `"() => count.set(0)"` → `() => { this._count(0); }`
- Los argumentos se transforman para acceder a signals/computeds/props
- Dentro de each blocks, usa `transformForExpr` para el scope del item
