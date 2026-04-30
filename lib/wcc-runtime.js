/**
 * wcc-runtime.js — Optional reactive binding helper for consuming wcc components.
 * This is NOT required. Components are 100% native and work without it.
 * It provides declarative :prop and @event bindings in HTML.
 */
const state = {};
const listeners = [];
const handlers = {};

/**
 * Initialize the runtime with an initial state and bind :prop and @event attributes.
 *
 * @param {Record<string, any>} initialState
 * @returns {void}
 */
export function init(initialState) {
  Object.assign(state, initialState);
  document.querySelectorAll('*').forEach(el => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith(':')) {
        const prop = attr.name.slice(1);
        const key = attr.value;
        listeners.push({ key, update: (val) => { el[prop] = val; } });
        if (key in state) el[prop] = state[key];
      }
      if (attr.name.startsWith('@')) {
        const event = attr.name.slice(1);
        const handlerName = attr.value;
        el.addEventListener(event, (e) => {
          if (handlers[handlerName]) handlers[handlerName](e);
        });
      }
    }
  });
}

/**
 * Set a state value and notify all listeners bound to that key.
 *
 * @param {string} key
 * @param {any} value
 * @returns {void}
 */
export function set(key, value) {
  state[key] = value;
  listeners.filter(l => l.key === key).forEach(l => l.update(state[key]));
}

/**
 * Get the current value for a state key.
 *
 * @param {string} key
 * @returns {any}
 */
export function get(key) {
  return state[key];
}

/**
 * Register a named event handler.
 *
 * @param {string} name
 * @param {Function} fn
 * @returns {void}
 */
export function on(name, fn) {
  handlers[name] = fn;
}
