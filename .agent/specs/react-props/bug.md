# BUG-0015: React props string no llegan al custom element

## Versión
v0.24.3

## Causa raíz

React 19 pasa props a custom elements como **propiedades** (`el.label = 'Static Label'`),
no como atributos HTML (`el.setAttribute('label', 'Static Label')`).

El `attributeChangedCallback` de WCC solo escucha cambios de **atributos**,
por lo que nunca se dispara. La prop queda con su valor por defecto.

## Evidencia

```html
<!-- JSX -->
<wcc-counter label="Static Label" count={10}>
```

Atributos HTML en el DOM:
```json
{"id": "test1", "count": "10"}
```
→ `label` no aparece. Pero `el.label === 'Static Label'` (propiedad JS).

## Output actual
```
<span>Clicks</span>  <!-- default, no toma "Static Label" -->
```

## Output esperado
```
<span>Static Label</span>
```

## Fix

En `connectedCallback`, después de clonar el template y antes de `__invalidate('*')`,
leer las props desde las propiedades del elemento (no solo desde atributos):

```js
// Para cada prop definida en defineProps:
if (this[p.name] !== undefined && this[p.name] !== null) {
    this._state[p.name] = this[p.name];
}
```

O de forma más general: iterar `propDefs` en `connectedCallback` y sincronizar
propiedades con el estado.

**Archivo:** `lib/codegen/connected-callback.js`
