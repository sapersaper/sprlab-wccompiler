# Signals — Diseño

## Reactive Runtime (inlined)

El runtime se inlinea al inicio de cada componente compilado (~60 líneas):

### `__signal(initial)`
- Retorna una función getter/setter
- Sin args → lee valor (registra suscriptor si hay `__currentEffect`)
- Con 1 arg → escribe valor, notifica suscriptores (o encola si batching)
- Comparación por identidad (`old !== _value`)

### `__computed(fn)`
- Retorna una función getter (read-only)
- Lazy: solo recalcula si `_dirty === true`
- Se marca dirty cuando una dependencia cambia
- Registra suscriptores propios para propagación

### `__effect(fn)`
- Ejecuta `fn` inmediatamente
- Re-ejecuta cuando cualquier dependencia (signal/computed leído dentro) cambia
- Soporta cleanup: si `fn` retorna una función, se llama antes de re-ejecutar

### `__batch(fn)`
- Incrementa `__batchDepth`
- Ejecuta `fn`
- Al decrementar a 0, flush `__pendingEffects`
- Soporta batches anidados

## Extracción del Script

### Signals (`extractSignals`)
- Patrón: `const/let/var name = signal(value)`
- Usa depth counting para extraer el argumento completo (maneja arrays, objetos, expresiones)

### Computeds (`extractComputeds`)
- Patrón: `const/let/var name = computed(() => expr)`
- Usa depth counting para capturar expresiones con paréntesis

### Effects (`extractEffects`)
- Patrón: `effect(() => { body })`
- Usa brace depth tracking para capturar bodies multi-línea
- Dedenta el body extraído

### Constants (`extractConstants`)
- Patrón: `const/let/var name = value` (root-level, no reactive calls)
- Excluye: signal, computed, effect, watch, defineProps, defineEmits, defineComponent, templateRef, defineExpose, onMount, onDestroy

## Transformación en Codegen

- `signal(x)` → `this._name = __signal(x)` en constructor
- `computed(() => expr)` → `this._c_name = __computed(() => transformedExpr)` en constructor
- `effect(() => { body })` → `__effect(() => { transformedBody })` en connectedCallback
- `const x = value` → `this._const_x = value` en constructor
- Lectura `name()` → `this._name()` / `this._c_name()`
- Escritura `name.set(v)` → `this._name(v)`
