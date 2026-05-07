/**
 * Template string containing the mini reactive runtime.
 * This gets inlined at the top of each compiled component so the output
 * is fully self-contained with zero imports.
 *
 * Implements:
 * - __signal(initialValue): getter/setter function with subscriber tracking
 * - __computed(fn): cached derived value that auto-invalidates
 * - __effect(fn): runs fn immediately and re-runs when dependencies change
 * - __batch(fn): batch multiple signal writes, flush effects once at the end
 *
 * Dependency tracking uses a global stack (__currentEffect).
 * Batching uses a depth counter — nested batches are supported.
 */
/** @type {string} */
export const reactiveRuntime = `
let __currentEffect = null;
let __batchDepth = 0;
const __pendingEffects = new Set();

function __signal(initial) {
  let _value = initial;
  const _subs = new Set();
  return (...args) => {
    if (args.length === 0) {
      if (__currentEffect) _subs.add(__currentEffect);
      return _value;
    }
    const old = _value;
    _value = args[0];
    if (old !== _value) {
      if (__batchDepth > 0) {
        for (const fn of _subs) __pendingEffects.add(fn);
      } else {
        for (const fn of [..._subs]) fn();
      }
    }
  };
}

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
      __currentEffect = recompute;
      _cached = fn();
      __currentEffect = prev;
      _dirty = false;
    }
    return _cached;
  };
}

function __effect(fn) {
  let _cleanup = null;
  let _active = true;
  const run = () => {
    if (!_active) return;
    try {
      if (typeof _cleanup === 'function') _cleanup();
      const prev = __currentEffect;
      __currentEffect = run;
      _cleanup = fn();
      __currentEffect = prev;
    } catch (e) {
      console.error('[wcc] Effect error:', e);
      _active = false;
    }
  };
  run();
  return () => { _active = false; if (typeof _cleanup === 'function') _cleanup(); };
}

function __batch(fn) {
  __batchDepth++;
  try {
    fn();
  } finally {
    __batchDepth--;
    if (__batchDepth === 0) {
      const pending = [...__pendingEffects];
      __pendingEffects.clear();
      for (const f of pending) f();
    }
  }
}

function __untrack(fn) {
  const prev = __currentEffect;
  __currentEffect = null;
  try { return fn(); }
  finally { __currentEffect = prev; }
}
`;
