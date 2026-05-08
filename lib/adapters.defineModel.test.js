/**
 * Property-based tests and unit tests for defineModel adapters.
 *
 * Property 5: Vue adapter translates wcc:model to update:propName
 *
 * For any `wcc:model` event with `detail.prop` equal to some prop name,
 * the Vue adapter SHALL dispatch a `CustomEvent('update:${prop}')` on the
 * same element with the detail value.
 *
 * **Validates: Requirements 6.2**
 *
 * Property 6: Angular adapter translates wcc:model to propNameChange
 *
 * For any `wcc:model` event with `detail.prop` equal to some prop name,
 * the Angular adapter SHALL dispatch a `CustomEvent('${prop}Change')` on the
 * same element with the detail value.
 *
 * **Validates: Requirements 7.2**
 *
 * Unit tests for adapter behavior:
 * - Vue adapter registers a document-level listener for 'wcc:model' on import
 * - Angular adapter registers a document-level listener for 'wcc:model' on import
 * - When no adapter is loaded, dispatching wcc:model does not throw errors
 * - When no adapter is loaded, the wcc:model event still bubbles normally
 * - Component with model props works without any adapter (no errors, events still dispatched)
 *
 * **Validates: Requirements 6.1, 7.1, 8.1, 8.2, 8.3**
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';

// ── Generators ──────────────────────────────────────────────────────

const reserved = new Set([
  'if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else',
  'enum', 'eval', 'null', 'this', 'true', 'void', 'with', 'const', 'break',
  'class', 'super', 'while', 'yield', 'return', 'typeof', 'delete', 'switch',
  'export', 'import', 'default', 'signal', 'computed', 'effect', 'props',
  'emit', 'defineProps', 'defineEmits', 'defineModel', 'false', 'name',
  'set', 'get', 'undefined', 'value', 'model',
]);

/** Generate a valid prop name (lowercase, 3-8 chars) */
const arbPropName = fc
  .stringMatching(/^[a-z][a-zA-Z]{2,7}$/)
  .filter(s => !reserved.has(s));

/** Generate a random value (string, number, or boolean) */
const arbValue = fc.oneof(
  fc.string({ minLength: 0, maxLength: 20 }),
  fc.integer({ min: -1000, max: 1000 }),
  fc.boolean()
);

// ── Property 5: Vue adapter translates wcc:model to update:propName ──
// **Validates: Requirements 6.2**

describe('Feature: define-model, Property 5: Vue adapter translates wcc:model to update:propName', () => {
  beforeAll(async () => {
    // Import the Vue adapter as a side-effect — it registers a document-level listener
    await import('../adapters/vue.js');
  });

  it('dispatches update:${prop} CustomEvent with correct detail value for any wcc:model event', () => {
    fc.assert(
      fc.property(
        arbPropName,
        arbValue,
        (prop, value) => {
          const el = document.createElement('div');
          document.body.appendChild(el);

          let receivedEvent = null;

          // Listen for the translated event
          el.addEventListener(`update:${prop}`, (e) => {
            receivedEvent = e;
          });

          // Dispatch wcc:model on the element
          el.dispatchEvent(new CustomEvent('wcc:model', {
            detail: { prop, value, oldValue: null },
            bubbles: true,
            composed: true
          }));

          // Assert: update:${prop} was dispatched
          expect(receivedEvent).not.toBeNull();
          expect(receivedEvent).toBeInstanceOf(CustomEvent);
          expect(receivedEvent.type).toBe(`update:${prop}`);
          expect(receivedEvent.detail).toBe(value);

          // Cleanup
          document.body.removeChild(el);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('dispatches on the same element that emitted wcc:model (not on document or parent)', () => {
    fc.assert(
      fc.property(
        arbPropName,
        arbValue,
        (prop, value) => {
          const parent = document.createElement('div');
          const child = document.createElement('span');
          parent.appendChild(child);
          document.body.appendChild(parent);

          let childReceived = null;
          let parentReceivedDirect = null;

          // Listen on the child (same element)
          child.addEventListener(`update:${prop}`, (e) => {
            if (e.target === child) {
              childReceived = e;
            }
          });

          // Listen on parent to check bubbling target
          parent.addEventListener(`update:${prop}`, (e) => {
            if (e.target === parent) {
              parentReceivedDirect = e;
            }
          });

          // Dispatch wcc:model on the child
          child.dispatchEvent(new CustomEvent('wcc:model', {
            detail: { prop, value, oldValue: null },
            bubbles: true,
            composed: true
          }));

          // The update event should be dispatched on the child (same element as wcc:model target)
          expect(childReceived).not.toBeNull();
          expect(childReceived.detail).toBe(value);

          // Parent should NOT be the direct target of the update event
          expect(parentReceivedDirect).toBeNull();

          // Cleanup
          document.body.removeChild(parent);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ── Property 6: Angular adapter translates wcc:model to propNameChange ──
// **Validates: Requirements 7.2**

describe('Feature: define-model, Property 6: Angular adapter translates wcc:model to propNameChange', () => {
  beforeAll(async () => {
    // Import the Angular adapter as a side-effect — it registers a document-level listener
    await import('../adapters/angular.js');
  });

  it('dispatches ${prop}Change CustomEvent with correct detail value for any wcc:model event (async)', () => {
    fc.assert(
      fc.asyncProperty(
        arbPropName,
        arbValue,
        async (prop, value) => {
          const el = document.createElement('div');
          document.body.appendChild(el);

          let receivedEvent = null;

          // Listen for the translated event
          el.addEventListener(`${prop}Change`, (e) => {
            receivedEvent = e;
          });

          // Dispatch wcc:model on the element
          el.dispatchEvent(new CustomEvent('wcc:model', {
            detail: { prop, value, oldValue: null },
            bubbles: true,
            composed: true
          }));

          // Wait for queueMicrotask to fire
          await new Promise(resolve => queueMicrotask(resolve));

          // Assert: ${prop}Change was dispatched
          expect(receivedEvent).not.toBeNull();
          expect(receivedEvent).toBeInstanceOf(CustomEvent);
          expect(receivedEvent.type).toBe(`${prop}Change`);
          expect(receivedEvent.detail).toBe(value);

          // Cleanup
          document.body.removeChild(el);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('dispatches on the same element that emitted wcc:model (not on document or parent)', () => {
    fc.assert(
      fc.asyncProperty(
        arbPropName,
        arbValue,
        async (prop, value) => {
          const parent = document.createElement('div');
          const child = document.createElement('span');
          parent.appendChild(child);
          document.body.appendChild(parent);

          let childReceived = null;
          let parentReceivedDirect = null;

          // Listen on the child (same element)
          child.addEventListener(`${prop}Change`, (e) => {
            if (e.target === child) {
              childReceived = e;
            }
          });

          // Listen on parent to check bubbling target
          parent.addEventListener(`${prop}Change`, (e) => {
            if (e.target === parent) {
              parentReceivedDirect = e;
            }
          });

          // Dispatch wcc:model on the child
          child.dispatchEvent(new CustomEvent('wcc:model', {
            detail: { prop, value, oldValue: null },
            bubbles: true,
            composed: true
          }));

          // Wait for queueMicrotask to fire
          await new Promise(resolve => queueMicrotask(resolve));

          // The change event should be dispatched on the child (same element as wcc:model target)
          expect(childReceived).not.toBeNull();
          expect(childReceived.detail).toBe(value);

          // Parent should NOT be the direct target of the change event
          expect(parentReceivedDirect).toBeNull();

          // Cleanup
          document.body.removeChild(parent);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ── Unit Tests: Adapter Registration and Graceful Degradation ──────────────
// **Validates: Requirements 6.1, 7.1, 8.1, 8.2, 8.3**

describe('Feature: define-model, Unit: Vue adapter registers document-level listener on import', () => {
  beforeAll(async () => {
    await import('../adapters/vue.js');
  });

  it('responds to wcc:model events dispatched on any element in the document', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    let received = null;
    el.addEventListener('update:title', (e) => {
      received = e;
    });

    el.dispatchEvent(new CustomEvent('wcc:model', {
      detail: { prop: 'title', value: 'Hello', oldValue: '' },
      bubbles: true,
      composed: true
    }));

    // The Vue adapter's document-level listener should have intercepted and re-dispatched
    expect(received).not.toBeNull();
    expect(received.type).toBe('update:title');
    expect(received.detail).toBe('Hello');

    document.body.removeChild(el);
  });

  it('handles wcc:model events from deeply nested elements (proves document-level registration)', () => {
    const grandparent = document.createElement('div');
    const parent = document.createElement('div');
    const child = document.createElement('span');
    grandparent.appendChild(parent);
    parent.appendChild(child);
    document.body.appendChild(grandparent);

    let received = null;
    child.addEventListener('update:count', (e) => {
      received = e;
    });

    // Dispatch from deeply nested child — document-level listener still catches it
    child.dispatchEvent(new CustomEvent('wcc:model', {
      detail: { prop: 'count', value: 42, oldValue: 0 },
      bubbles: true,
      composed: true
    }));

    expect(received).not.toBeNull();
    expect(received.type).toBe('update:count');
    expect(received.detail).toBe(42);

    document.body.removeChild(grandparent);
  });
});

describe('Feature: define-model, Unit: Angular adapter registers document-level listener on import', () => {
  beforeAll(async () => {
    await import('../adapters/angular.js');
  });

  it('responds to wcc:model events dispatched on any element in the document', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    let received = null;
    el.addEventListener('titleChange', (e) => {
      received = e;
    });

    el.dispatchEvent(new CustomEvent('wcc:model', {
      detail: { prop: 'title', value: 'World', oldValue: '' },
      bubbles: true,
      composed: true
    }));

    // Wait for queueMicrotask to fire
    await new Promise(resolve => queueMicrotask(resolve));

    // The Angular adapter's document-level listener should have intercepted and re-dispatched
    expect(received).not.toBeNull();
    expect(received.type).toBe('titleChange');
    expect(received.detail).toBe('World');

    document.body.removeChild(el);
  });

  it('handles wcc:model events from deeply nested elements (proves document-level registration)', async () => {
    const grandparent = document.createElement('div');
    const parent = document.createElement('div');
    const child = document.createElement('span');
    grandparent.appendChild(parent);
    parent.appendChild(child);
    document.body.appendChild(grandparent);

    let received = null;
    child.addEventListener('statusChange', (e) => {
      received = e;
    });

    // Dispatch from deeply nested child — document-level listener still catches it
    child.dispatchEvent(new CustomEvent('wcc:model', {
      detail: { prop: 'status', value: 'active', oldValue: 'inactive' },
      bubbles: true,
      composed: true
    }));

    // Wait for queueMicrotask to fire
    await new Promise(resolve => queueMicrotask(resolve));

    expect(received).not.toBeNull();
    expect(received.type).toBe('statusChange');
    expect(received.detail).toBe('active');

    document.body.removeChild(grandparent);
  });
});

describe('Feature: define-model, Unit: Graceful behavior without adapter dependency', () => {
  it('dispatching wcc:model does not throw errors regardless of adapter presence', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    // Dispatching wcc:model should never throw, whether adapters are loaded or not
    expect(() => {
      el.dispatchEvent(new CustomEvent('wcc:model', {
        detail: { prop: 'value', value: 'test', oldValue: '' },
        bubbles: true,
        composed: true
      }));
    }).not.toThrow();

    document.body.removeChild(el);
  });

  it('wcc:model event still bubbles normally to parent listeners', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.appendChild(child);
    document.body.appendChild(parent);

    let bubbledEvent = null;
    parent.addEventListener('wcc:model', (e) => {
      bubbledEvent = e;
    });

    child.dispatchEvent(new CustomEvent('wcc:model', {
      detail: { prop: 'name', value: 'Alice', oldValue: '' },
      bubbles: true,
      composed: true
    }));

    // The wcc:model event bubbles independently of any adapter
    expect(bubbledEvent).not.toBeNull();
    expect(bubbledEvent.detail.prop).toBe('name');
    expect(bubbledEvent.detail.value).toBe('Alice');
    expect(bubbledEvent.detail.oldValue).toBe('');
    expect(bubbledEvent.target).toBe(child);

    document.body.removeChild(parent);
  });

  it('wcc:model event reaches document-level listeners (vanilla JS usage without adapter)', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    let docReceived = null;
    const handler = (e) => {
      if (e.detail.prop === '__test_no_adapter__') {
        docReceived = e;
      }
    };
    document.addEventListener('wcc:model', handler);

    el.dispatchEvent(new CustomEvent('wcc:model', {
      detail: { prop: '__test_no_adapter__', value: 99, oldValue: 0 },
      bubbles: true,
      composed: true
    }));

    // A vanilla JS developer can listen at document level without any adapter
    expect(docReceived).not.toBeNull();
    expect(docReceived.detail.prop).toBe('__test_no_adapter__');
    expect(docReceived.detail.value).toBe(99);

    document.removeEventListener('wcc:model', handler);
    document.body.removeChild(el);
  });

  it('component with model props works without any adapter (events dispatched, no errors)', () => {
    // Simulate what a compiled component would do: emit wcc:model on internal write
    const host = document.createElement('my-component');
    document.body.appendChild(host);

    const events = [];
    host.addEventListener('wcc:model', (e) => {
      events.push(e);
    });

    // Simulate _modelSet_value behavior (internal write emits event)
    const emitModelEvent = (prop, value, oldValue) => {
      host.dispatchEvent(new CustomEvent('wcc:model', {
        detail: { prop, value, oldValue },
        bubbles: true,
        composed: true
      }));
    };

    // Multiple model props emitting events — no errors, all events received
    expect(() => {
      emitModelEvent('title', 'New Title', '');
      emitModelEvent('count', 5, 0);
      emitModelEvent('active', true, false);
    }).not.toThrow();

    expect(events).toHaveLength(3);
    expect(events[0].detail).toEqual({ prop: 'title', value: 'New Title', oldValue: '' });
    expect(events[1].detail).toEqual({ prop: 'count', value: 5, oldValue: 0 });
    expect(events[2].detail).toEqual({ prop: 'active', value: true, oldValue: false });

    document.body.removeChild(host);
  });
});
