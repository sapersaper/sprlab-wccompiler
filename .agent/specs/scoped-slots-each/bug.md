# Bug: Scoped slots dentro de `each` no se resuelven

## Versión
v0.24.3

## Descripción
Los scoped slots funcionan correctamente a nivel de componente (wcc-card),
pero cuando un `<slot name="x">` está dentro de un bloque `each`, el contenido
provisto por el consumidor no se renderiza. En su lugar, se muestra el contenido
default (`{{item}}` literal).

## Reproducción

### Componente fuente (`wcc-list.wcc`)
```html
<template>
<ul>
  <li each="(item, index) in items()">
    <slot name="item" :item="item" :index="index">{{item}}</slot>
  </li>
</ul>
</template>
```

### Consumidor (Vue)
```html
<wcc-list>
  <template #item="{ item, index }">
    <strong>{{ index }}</strong>: {{ item }}
  </template>
</wcc-list>
```

### Output actual
```
{{item}}
{{item}}
{{item}}
```
(3 items, todos con el texto literal `{{item}}`)

### Output esperado
```
0: Apple
1: Banana
2: Cherry
```

## Causa raíz
El compilador genera `__renderEach_0()` que itera los items y clona el template,
pero **no hay lógica de slot resolution** dentro de cada iteración:

```js
// Output compilado actual — FALTA slot resolution
__renderEach_0() {
  __iter.forEach((item, index) => {
    const clone = this.__for0_tpl.content.cloneNode(true);
    const node = clone.firstChild;
    this.__for0_anchor.parentNode.insertBefore(node, ...);
    // ❌ No verifica si el consumidor proveyó slot content
    // ❌ No reemplaza {%item%} con el valor real
  });
}
```

Mientras que `wcc-card` (slots fuera de each) sí tiene slot resolution
(~33 referencias a slot en el output compilado).

## Archivos afectados

| Archivo | Rol |
|---------|-----|
| `lib/codegen/item-renderer.js` | Genera el cuerpo de `__renderEach_N` |
| `lib/codegen/render-methods.js` | Orquesta render methods |
| `lib/codegen/connected-callback.js` | Slot resolution (solo para slots de componente) |
| `lib/codegen/update-op.js` | Update operations (no afectado) |

## Posible solución

En `item-renderer.js`, dentro del forEach, agregar:

1. Buscar si el consumidor proveyó slot content para este nombre de slot
2. Si existe, usar ese contenido en vez del default template
3. Reemplazar tokens `{%prop%}` con los valores reales del item

```js
// Ejemplo conceptual
__iter.forEach((item, index) => {
  const __slotContent = this.__slotMap?.item;
  if (__slotContent) {
    const html = __slotContent.content
      .replace('{%item%}', item)
      .replace('{%index%}', index);
    // insertar html procesado
  } else {
    // usar default template
  }
});
```
