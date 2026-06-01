# If Directive — Diseño

## Sintaxis en Template

```html
<div if="count() > 0">Positive</div>
<div else-if="count() === 0">Zero</div>
<div else>Negative</div>
```

## Procesamiento (`processIfChains`)

1. Detecta elementos con atributo `if`
2. Busca hermanos inmediatos con `else-if` o `else`
3. Valida la cadena (no puede haber `else-if`/`else` sin `if` previo)
4. Extrae el template HTML de cada rama
5. Reemplaza toda la cadena con un comment anchor (`<!--if-->`)
6. Procesa bindings/events dentro de cada rama con `walkBranch()`

## Estructura de Datos

```ts
interface IfBlock {
  varName: string        // e.g. '__if0'
  anchorPath: string[]   // path al comment anchor
  branches: IfBranch[]
}

interface IfBranch {
  condition: string | null  // null para 'else'
  templateHtml: string
  bindings: Binding[]
  events: EventBinding[]
  showBindings: ShowBinding[]
  attrBindings: AttrBinding[]
}
```

## Generación de Código

### Constructor
```js
// Template por rama
this.__if0_t0 = document.createElement('template');
this.__if0_t0.innerHTML = `<div>Positive</div>`;
// Anchor reference
this.__if0_anchor = __root.childNodes[0];
// State
this.__if0_current = null;
this.__if0_active = undefined;
```

### connectedCallback
```js
__effect(() => {
  let branch;
  if (this._count() > 0) branch = 0;
  else if (this._count() === 0) branch = 1;
  else branch = 2;
  
  if (branch !== this.__if0_active) {
    if (this.__if0_current) this.__if0_current.remove();
    const node = this.__if0_t{branch}.content.cloneNode(true).firstChild;
    this.__if0_anchor.parentNode.insertBefore(node, this.__if0_anchor);
    this.__if0_current = node;
    this.__if0_active = branch;
    // Setup bindings/events for the active branch
  }
});
```
