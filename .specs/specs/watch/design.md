# Watch — Diseño

## Formas de Declaración

### Form 1 — Signal directo
```js
watch(count, (newVal, oldVal) => {
  console.log(`changed from ${oldVal} to ${newVal}`)
})
```
- `kind: 'signal'`, `target: 'count'`

### Form 2 — Getter function
```js
watch(() => count() * 2, (newVal, oldVal) => {
  console.log(`doubled changed from ${oldVal} to ${newVal}`)
})
```
- `kind: 'getter'`, `target: 'count() * 2'`

## Extracción (`extractWatchers`)

- Usa brace depth tracking para capturar bodies multi-línea
- Retorna `WatcherDef[]`: `{ kind, target, newParam, oldParam, body }`
- Dedenta el body extraído

## Generación de Código

### Signal directo
```js
// En constructor:
this.__prev_count = undefined;

// En connectedCallback:
__effect(() => {
  const __new = this._count();
  const __old = this.__prev_count;
  if (__old !== undefined || this.__prev_count !== undefined) {
    // transformed body with newVal → __new, oldVal → __old
  }
  this.__prev_count = __new;
});
```

### Getter function
```js
// En constructor:
this.__prev_watch0 = undefined;

// En connectedCallback:
__effect(() => {
  const __new = transformedExpr;
  const __old = this.__prev_watch0;
  if (__old !== undefined || this.__prev_watch0 !== undefined) {
    // transformed body
  }
  this.__prev_watch0 = __new;
});
```

## Transformación del Body

- Se usa `transformMethodBody` para reescribir signal reads/writes
- Los parámetros `newParam`/`oldParam` se reemplazan por `__new`/`__old`
