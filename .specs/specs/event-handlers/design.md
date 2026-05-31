# Event Handlers — Diseño

## Sintaxis en Template

```html
<button @click="increment">+</button>
<button @click="remove(item)">X</button>
<button @click="() => count.set(0)">Reset</button>
```

## Detección (tree-walker)

- Detecta atributos que empiezan con `@`
- Extrae nombre del evento (sin `@`)
- Registra `EventBinding`: `{ varName, event, handler, path }`
- Remueve el atributo del DOM

## Generación de Código (`generateEventHandler`)

### Nombre simple
```js
// @click="increment"
this.__e0.addEventListener('click', this._increment.bind(this));
```

### Llamada con argumentos
```js
// @click="remove(item)"
this.__e0.addEventListener('click', (e) => { this._remove(item); });
```

### Arrow function
```js
// @click="() => count.set(0)"
this.__e0.addEventListener('click', () => { this._count(0); });
```

## Dentro de Each Blocks (`generateForEventHandler`)

- Usa `transformForExpr` en lugar de `transformMethodBody`
- Las variables item/index se dejan sin transformar
- Las variables del componente (signals, computeds, props) se transforman

## Transformación de Argumentos

- `transformExpr` para argumentos en llamadas con args
- `transformMethodBody` para bodies de arrow functions
- Dentro de each: `transformForExpr` para ambos casos
