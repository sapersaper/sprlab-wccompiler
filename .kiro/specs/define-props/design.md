# Define Props — Diseño

## Formas de Declaración

### Forma genérica (antes de type strip)
```ts
const props = defineProps<{ label: string, count: number }>({ label: 'Hi', count: 0 })
```
- `extractPropsGeneric(source)` → `['label', 'count']`
- Se ejecuta ANTES de `stripTypes()` porque esbuild elimina generics

### Forma array (después de type strip)
```js
const props = defineProps(['label', 'count'])
```
- `extractPropsArray(source)` → `['label', 'count']`
- Solo se usa si la forma genérica no encontró nada

### Defaults
```js
defineProps({ label: 'Hi', count: 0 })
```
- `extractPropsDefaults(source)` → `{ label: "'Hi'", count: "0" }`
- Usa depth counting para manejar objetos/arrays anidados como defaults
- Si no hay propNames pero sí defaults, los keys del objeto se usan como propNames

### Props sin asignación
- `defineProps<{ label: string }>()` sin `const props = ...` es válido
- Los props se acceden solo en template via `{{label}}`

## Nombre del Objeto Props

- `extractPropsObjectName(source)` → detecta `const props = defineProps...`
- Se usa para transformar `props.x` → `this._s_x()` en codegen

## Generación de Código

- `static get observedAttributes()` → lista de attrs en kebab-case
- Constructor: `this._s_propName = __signal(default)`
- `attributeChangedCallback(name, old, val)`:
  - Mapea attr kebab → prop camelCase
  - Coerción booleana si default es `true`/`false` (presencia del attr = true)
  - Coerción numérica si default es número
  - String con nullish coalescing si default es string
  - Pass-through si default es `undefined`
- Public getters/setters en la clase:
  - `get propName() { return this._s_propName(); }`
  - `set propName(val) { this._s_propName(val); this.setAttribute('attr-name', String(val)); }`

## Validaciones

- `validateDuplicateProps`: no permite props repetidos
- `validatePropsConflicts`: propsObjectName no puede colisionar con signals/computeds/constants
- `validatePropsAssignment`: no-op en modo SFC (bare defineProps es válido)
