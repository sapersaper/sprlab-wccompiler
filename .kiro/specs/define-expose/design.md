# Define Expose — Diseño

## Declaración

```ts
defineExpose({ doubled, handleUpdate, watchLog })
```

## Estado Actual

- Declarado en `types/wcc.d.ts`: `export function defineExpose(bindings: Record<string, any>): void`
- Registrado en `REACTIVE_CALLS` en `parser-extractors.js` para que no se trate como constante
- El import se stripea como macro import (`import { ... } from 'wcc'`)
- **No tiene implementación en codegen** — las propiedades expuestas no se generan en el output actualmente

## Diseño Esperado (cuando se implemente)

- Extraer el objeto pasado a `defineExpose()`
- En codegen, asignar cada propiedad al `this` del elemento:
  - Signals: `Object.defineProperty(this, 'name', { get: () => this._name() })`
  - Computeds: `Object.defineProperty(this, 'name', { get: () => this._c_name() })`
  - Methods: `this.name = this._name.bind(this)`
