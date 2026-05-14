# Reactive Runtime - Technical Deep Dive

## Overview

El runtime reactivo de wcCompiler es un sistema minimalista (~144 líneas) que implementa signals-based reactivity sin dependencias externas.

## Architecture

### Global State

```javascript
let __currentEffect = null;    // Efecto activo actualmente
let __batchDepth = 0;          // Profundidad de batch nesting
const __pendingEffects = new Set();  // Effects pendientes de flush
```

### __signal

```javascript
function __signal(initial) {
  let _value = initial;
  const _subs = new Set();
  return (...args) => {
    if (args.length === 0) {
      // READ: Register current effect as subscriber
      if (__currentEffect) _subs.add(__currentEffect);
      return _value;
    }
    // WRITE: Update value and notify subscribers
    const old = _value;
    _value = args[0];
    if (old !== _value) {
      if (__batchDepth > 0) {
        // In batch mode: queue effects
        for (const fn of _subs) __pendingEffects.add(fn);
      } else {
        // Immediate mode: run effects now
        for (const fn of [..._subs]) fn();
      }
    }
  };
}
```

**Características clave:**
- Mismo function para read y write (args.length check)
- Subscriber tracking automático durante effect execution
- Batch support para agrupar múltiples writes
- Shallow comparison para evitar updates innecesarios

### __computed

```javascript
function __computed(fn) {
  let _cached, _dirty = true;
  const _subs = new Set();
  const recompute = () => {
    _dirty = true;
    if (__batchDepth > 0) {
      for (const fn of _subs) __pendingEffects.add(fn);
    } else {
      for (const fn of [..._subs]) fn();
    }
  };
  return () => {
    if (__currentEffect) _subs.add(__currentEffect);
    if (_dirty) {
      const prev = __currentEffect;
      __currentEffect = recompute;  // Track dependencies
      _cached = fn();
      __currentEffect = prev;
      _dirty = false;
    }
    return _cached;
  };
}
```

**Características clave:**
- Lazy evaluation (solo recalcula cuando se lee)
- Caching del valor computado
- Auto-tracking de dependencies
- Invalidation cascading a subscribers

### __effect

```javascript
function __effect(fn) {
  let _cleanup = null;
  let _active = true;
  const run = () => {
    if (!_active) return;
    try {
      if (typeof _cleanup === 'function') _cleanup();
      const prev = __currentEffect;
      __currentEffect = run;  // Track dependencies
      _cleanup = fn();        // Execute and capture cleanup
      __currentEffect = prev;
    } catch (e) {
      console.error('[wcc] Effect error:', e);
      _active = false;        // Deactivate on error
    }
  };
  run();  // Execute immediately
  return () => {
    _active = false;
    if (typeof _cleanup === 'function') _cleanup();
  };
}
```

**Características clave:**
- Ejecución inmediata al crear
- Cleanup function support
- Dependency tracking automático
- Error handling con auto-deactivation
- Returns disposer function

### __batch

```javascript
function __batch(fn) {
  __batchDepth++;
  try {
    fn();
  } finally {
    __batchDepth--;
    if (__batchDepth === 0) {
      // Flush all pending effects
      const pending = [...__pendingEffects];
      __pendingEffects.clear();
      for (const f of pending) f();
    }
  }
}
```

**Características clave:**
- Nested batch support (depth counter)
- Flush solo cuando el batch externo termina
- Deduplication via Set
- Exception safety con try/finally

### __untrack

```javascript
function __untrack(fn) {
  const prev = __currentEffect;
  __currentEffect = null;  // Disable tracking
  try { return fn(); }
  finally { __currentEffect = prev; }
}
```

**Características clave:**
- Temporarily disables dependency tracking
- Used in watchers to avoid infinite loops
- Preserves previous effect context

## Tree-Shaking Strategy

El codegen incluye solo las funciones que el componente usa:

```javascript
// File: lib/codegen.js (lines 907-922)
const needsEffect = effects.length > 0 || bindings.length > 0 || ...;
const needsComputed = computeds.length > 0;
const needsUntrack = watchers.length > 0;

// Standalone mode: inline only needed functions
lines.push(buildInlineRuntime({ 
  needsComputed, 
  needsEffect, 
  needsBatch: false, 
  needsUntrack 
}).trim());

// Shared mode: tree-shake imports
const usedRuntime = new Set(['__signal']);
if (needsComputed) usedRuntime.add('__computed');
if (needsEffect) usedRuntime.add('__effect');
if (needsUntrack) usedRuntime.add('__untrack');
lines.push(`import { ${[...usedRuntime].join(', ')} } from '${runtimeImportPath}';`);
```

## Reactivity Flow Example

```javascript
// 1. Component initialization
const count = __signal(0);           // Create signal
const doubled = __computed(() => count() * 2);  // Create computed

// 2. Effect creation
__effect(() => {
  console.log(count());              // Reads count, registers as subscriber
});

// 3. Signal write
count.set(5);                        // Updates value, triggers effect
// Output: 5

// 4. Batched writes
__batch(() => {
  firstName.set('John');
  lastName.set('Doe');
});
// Effects run once after batch completes
```

## Dependency Tracking Stack

El tracking funciona con un stack global:

```
Before effect():
  __currentEffect = null

During effect():
  __currentEffect = run (the effect function)
  → signal.read() adds run to _subs
  → computed.read() adds run to _subs

After effect():
  __currentEffect = null (restored)
```

## Component Integration

En el codegen, las señales se transforman así:

```javascript
// Source (.wcc)
const count = signal(0);
function increment() {
  count.set(count() + 1);
}

// Generated (.js)
constructor() {
  this._count = __signal(0);
}

_increment() {
  this._count(this._count() + 1);  // Write/read via function call
}
```

## Cleanup Strategy

```javascript
connectedCallback() {
  this.__ac = new AbortController();  // For event listeners
  this.__disposers = [];              // For effects
  
  // Effects register themselves
  this.__disposers.push(__effect(() => {
    this.countDisplay.textContent = this._count();
  }));
  
  // Event listeners use AbortController signal
  this.button.addEventListener('click', handler, { 
    signal: this.__ac.signal 
  });
}

disconnectedCallback() {
  this.__ac.abort();                  // Removes all event listeners
  this.__disposers.forEach(d => d()); // Runs all effect disposers
}
```

## Performance Characteristics

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Signal read | O(1) | Just returns value |
| Signal write | O(n) | n = number of subscribers |
| Computed read (cached) | O(1) | Returns cached value |
| Computed read (dirty) | O(m) | m = dependency chain depth |
| Effect creation | O(1) | Plus dependency tracking |
| Batch flush | O(n) | n = unique pending effects |

## Comparison with Other Frameworks

| Feature | wcCompiler | Solid.js | Preact Signals | Vue 3 |
|---------|-----------|----------|----------------|-------|
| Syntax | `signal()` | `createSignal()` | `signal()` | `ref()` |
| Read | `count()` | `count()` | `count.value` | `count.value` |
| Write | `count.set(x)` | `setCount(x)` | `count.value = x` | `count.value = x` |
| Computed | `computed(fn)` | `createMemo(fn)` | `computed(fn)` | `computed(fn)` |
| Effects | `effect(fn)` | `createEffect(fn)` | `effect(fn)` | `watchEffect(fn)` |
| Batching | `batch(fn)` | `batch(fn)` | `batch(fn)` | Automatic |
| Size | ~144 lines | ~1KB | ~800B | ~2KB (reactivity only) |

## Key Design Decisions

1. **Function-based API**: Signals are functions, not objects → easier to transform
2. **Single function for read/write**: Distinguishes by args.length → less code
3. **Manual `.set()` in source**: More explicit, better for IDE support
4. **No proxy-based reactivity**: Simpler, more predictable, smaller bundle
5. **Global effect stack**: No context objects needed → simpler implementation
6. **Set-based deduplication**: Automatic dedup in batches → prevents redundant updates
