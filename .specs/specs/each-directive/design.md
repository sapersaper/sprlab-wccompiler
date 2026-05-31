# Each Directive — Diseño

## Sintaxis en Template

```html
<li each="item in items" :key="item.id">{{item.name}}</li>
<li each="(item, index) in items">{{index}}: {{item.name}}</li>
```

## Parsing (`parseEachExpression`)

Parsea la expresión `each`:
- `"item in list"` → `{ itemVar: 'item', indexVar: null, source: 'list' }`
- `"(item, index) in list"` → `{ itemVar: 'item', indexVar: 'index', source: 'list' }`

## Procesamiento (`processForBlocks`)

1. Detecta elementos con atributo `each`
2. Parsea la expresión each
3. Extrae `:key` si existe
4. Extrae template HTML del elemento
5. Procesa bindings/events/show/attr/model dentro del template
6. Reemplaza el elemento con un comment anchor
7. Retorna `ForBlock[]`

## Estructura de Datos

```ts
interface ForBlock {
  varName: string
  anchorPath: string[]
  templateHtml: string
  itemVar: string
  indexVar: string | null
  source: string
  keyExpr: string | null
  bindings: Binding[]
  events: EventBinding[]
  showBindings: ShowBinding[]
  attrBindings: AttrBinding[]
  modelBindings: ModelBinding[]
  slots: SlotBinding[]
}
```

## Generación de Código

### Constructor
```js
this.__for0_tpl = document.createElement('template');
this.__for0_tpl.innerHTML = `<li></li>`;
this.__for0_anchor = __root.childNodes[0];
this.__for0_nodes = [];
```

### connectedCallback — Sin key (reconciliación por posición)
```js
__effect(() => {
  const list = this._items();
  const nodes = this.__for0_nodes;
  // Grow/shrink nodes array to match list length
  while (nodes.length < list.length) { /* clone template, insert before anchor */ }
  while (nodes.length > list.length) { /* remove last node */ }
  // Update each node
  list.forEach((item, index) => { /* setup bindings */ });
});
```

### connectedCallback — Con key (keyed diffing)
```js
__effect(() => {
  const list = this._items();
  const keyMap = new Map(this.__for0_nodes.map(n => [n.__key, n]));
  const newNodes = [];
  list.forEach((item, index) => {
    const key = item.id;
    let node = keyMap.get(key);
    if (!node) { /* create new node */ }
    newNodes.push(node);
  });
  // Remove nodes not in new list, reorder existing
});
```

## Transformación de Expresiones

- `transformForExpr`: transforma expresiones dentro del scope del each
- `isStaticForBinding`/`isStaticForExpr`: determina si un binding es estático (solo item/index) o reactivo
- Bindings estáticos se setean una vez; reactivos se wrappean en `__effect`
