# Define Emits — Diseño

## Formas de Declaración

### Forma genérica (call signatures, antes de type strip)
```ts
const emit = defineEmits<{
  (e: 'change', value: number): void
  (e: 'reset'): void
}>()
```
- `extractEmitsFromCallSignatures(source)` → `['change', 'reset']`
- Se ejecuta ANTES de `stripTypes()`

### Forma array (después de type strip)
```js
const emit = defineEmits(['change', 'reset'])
```
- `extractEmits(source)` → `['change', 'reset']`
- Solo se usa si la forma genérica no encontró nada

## Nombre del Objeto Emits

- `extractEmitsObjectName(source)` → detecta `const emit = defineEmits(...)`
- `extractEmitsObjectNameFromGeneric(source)` → detecta `const emit = defineEmits<{...}>()`
- Se usa para transformar `emit(` → `this._emit(` en codegen

## Generación de Código

- `_emit(name, detail)` como método de la clase:
  ```js
  _emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }
  ```
- Solo se genera si hay emits declarados
- Transformación: `emit('change', val)` → `this._emit('change', val)`

## Validaciones

- `validateEmitsAssignment`: defineEmits DEBE asignarse a variable
- `validateDuplicateEmits`: no permite emits repetidos
- `validateEmitsConflicts`: emitsObjectName no puede colisionar con signals/computeds/constants/props
- `validateUndeclaredEmits`: cada `emit('name')` debe estar en la lista declarada
