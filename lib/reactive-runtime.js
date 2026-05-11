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
 * - __untrack(fn): run fn without tracking dependencies
 *
 * Dependency tracking uses a global stack (__currentEffect).
 * Batching uses a depth counter — nested batches are supported.
 */

/** Shared globals (always included) */
const runtimeGlobals = `
let __currentEffect = null;
let __batchDepth = 0;
const __pendingEffects = new Set();
`;

/** __signal — always included */
const runtimeSignal = `
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
`;

/** __computed — only if component uses computed() */
const runtimeComputed = `
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
`;

/** __effect — only if component uses effects/bindings/show/model/attr/if/for/watchers/slots */
const runtimeEffect = `
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
`;

/** __batch — only if component uses batch() */
const runtimeBatch = `
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
`;

/** __untrack — only if component uses watchers */
const runtimeUntrack = `
function __untrack(fn) {
  const prev = __currentEffect;
  __currentEffect = null;
  try { return fn(); }
  finally { __currentEffect = prev; }
}
`;

/**
 * Full runtime (for backward compatibility and shared mode export).
 * @type {string}
 */
export const reactiveRuntime = runtimeGlobals + runtimeSignal + runtimeComputed + runtimeEffect + runtimeBatch + runtimeUntrack;

/**
 * Build a tree-shaken inline runtime containing only the functions this component needs.
 *
 * @param {{ needsComputed: boolean, needsEffect: boolean, needsBatch: boolean, needsUntrack: boolean }} usage
 * @returns {string}
 */
export function buildInlineRuntime(usage) {
  let code = runtimeGlobals + runtimeSignal;
  if (usage.needsComputed) code += runtimeComputed;
  if (usage.needsEffect) code += runtimeEffect;
  if (usage.needsBatch) code += runtimeBatch;
  if (usage.needsUntrack) code += runtimeUntrack;
  return code;
}
