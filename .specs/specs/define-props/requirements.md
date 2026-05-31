# Define Props — Requisitos

## User Stories

1. Como desarrollador, quiero declarar props con forma genérica `defineProps<{ name: type }>()` para tener type safety.
2. Como desarrollador, quiero declarar props con forma array `defineProps(['name1', 'name2'])` como alternativa simple.
3. Como desarrollador, quiero especificar defaults `defineProps<{...}>({ name: value })` para props opcionales.
4. Como desarrollador, quiero acceder a props via `props.name` en el script.
5. Como desarrollador, quiero que los props se expongan como HTML attributes (camelCase → kebab-case).
6. Como desarrollador, quiero que los props sin asignación a variable funcionen (acceso solo en template).
7. Como desarrollador, quiero errores claros si declaro props duplicados o con conflictos de nombres.

## Restricciones

- Props son read-only (no se puede hacer `props.name = x`)
- Los props se implementan internamente como signals (`this._s_propName`)
- `attributeChangedCallback` sincroniza attrs HTML → prop signals
- Coerción: booleana (presencia attr), numérica (si default es número), string (nullish coalescing)
- Se generan public getters/setters para acceso programático (`el.propName = val`)
- Validación en compile time: duplicados, conflictos con signals/computeds/constants
