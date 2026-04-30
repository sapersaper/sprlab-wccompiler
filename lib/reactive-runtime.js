/**
 * Template string containing the mini reactive runtime (~40 lines).
 * This gets inlined at the top of each compiled component so the output
 * is fully self-contained with zero imports.
 *
 * Implements:
 * - __signal(initialValue): getter/setter function with subscriber tracking
 * - __computed(fn): cached derived value that auto-invalidates
 * - __effect(fn): runs fn immediately and re-runs when dependencies change
 *
 * Dependency tracking uses a global stack (__currentEffect).
 */
/** @type {string} */
export const reactiveRuntime = `
let __currentEffect = null;

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
      for (const fn of [..._subs]) fn();
    }
  };
}

function __computed(fn) {
  let _cached, _dirty = true;
  const _subs = new Set();
  const recompute = () => {
    _dirty = true;
    for (const fn of [..._subs]) fn();
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
  const run = () => {
    const prev = __currentEffect;
    __currentEffect = run;
    fn();
    __currentEffect = prev;
  };
  run();
}
`;
