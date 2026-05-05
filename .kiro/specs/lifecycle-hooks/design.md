# Lifecycle Hooks — Diseño

## Declaración

### onMount (sync)
```js
onMount(() => {
  console.log('mounted')
})
```

### onMount (async)
```js
onMount(async () => {
  const data = await fetch('/api')
  items.set(await data.json())
})
```

### onDestroy
```js
onDestroy(() => {
  clearInterval(timer)
})
```

## Extracción (`extractLifecycleHooks`)

- Detecta `onMount(` y `onDestroy(` con regex
- Detecta `async` en el callback
- Usa brace depth tracking para capturar bodies multi-línea
- Dedenta el body extraído
- Soporta múltiples llamadas de cada tipo
- Solo extrae top-level calls (no anidados)
- Retorna `{ onMountHooks: LifecycleHook[], onDestroyHooks: LifecycleHook[] }`
- `LifecycleHook`: `{ body: string, async: boolean }`

## Generación de Código

### onMount → connectedCallback
```js
connectedCallback() {
  // ... effects, bindings ...
  
  // Sync:
  { transformedBody }
  
  // Async (wrapped in IIFE):
  (async () => { transformedBody })();
}
```

### onDestroy → disconnectedCallback
```js
disconnectedCallback() {
  // Sync:
  { transformedBody }
  
  // Async:
  (async () => { transformedBody })();
}
```

## Transformación del Body

- Se usa `transformMethodBody` para reescribir signal reads/writes
- Los hooks se filtran del source antes de extraer signals/functions (evita falsos positivos)
