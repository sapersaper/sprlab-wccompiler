# Template Refs — Diseño

## Declaración

### Script
```js
const inputRef = templateRef('myInput')
```

### Template
```html
<input ref="myInput" type="text" />
```

## Extracción

### Script (`extractRefs`)
- Patrón: `const/let/var varName = templateRef('refName')`
- Retorna `RefDeclaration[]`: `{ varName, refName }`

### Template (`detectRefs`)
- Detecta atributos `ref="name"` en elementos
- Retorna `RefBinding[]`: `{ refName, path }`
- Remueve el atributo `ref` del DOM

## Validaciones (compiler.js)

- Para cada `templateRef('name')` en script, debe existir `ref="name"` en template → error `REF_NOT_FOUND`
- Para cada `ref="name"` en template sin `templateRef` en script → warning (no error)

## Generación de Código

### Constructor
```js
// Asignar referencia DOM (antes de appendChild que mueve nodos)
this._ref_myInput = __root.childNodes[0].childNodes[1];

// Crear objeto ref con .value
this._inputRef = { value: this._ref_myInput };
```

### Acceso en métodos
```js
// inputRef.value → this._inputRef.value
```

## Transformación

- `refVar.value` → `this._refVar.value` en `transformMethodBody`
