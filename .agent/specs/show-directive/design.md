# Show Directive — Diseño

## Sintaxis en Template

```html
<div show="isVisible()">Content</div>
```

## Detección (tree-walker)

- Detecta atributo `show` en elementos
- Extrae la expresión
- Remueve el atributo del DOM
- Registra `ShowBinding`: `{ varName, expression, path }`

## Generación de Código

### Constructor
```js
this.__show0 = __root.childNodes[0];
```

### connectedCallback
```js
__effect(() => {
  this.__show0.style.display = (this._isVisible()) ? '' : 'none';
});
```

## Transformación

- La expresión se transforma con `transformExpr` para reescribir signal/computed/prop references
- Dentro de `each` blocks, usa `transformForExpr` y puede ser estática o reactiva
