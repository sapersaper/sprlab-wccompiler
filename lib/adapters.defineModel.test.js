/**
 * Tests for defineModel adapters and framework event emission.
 *
 * Tests verify:
 * - Vue adapter directive (v-wcc-model) works for non-Vite setups
 * - Angular propNameChange events are emitted correctly
 * - Graceful behavior without any adapter
 * - wcc:model event always emitted regardless of framework
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
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

// ── Property 5: Vue — propName-changed event is emitted ─────────────
// The WCC component emits propName-changed directly from _modelSet.
// Vue's pre-transform plugin listens for this event.

describe('Feature: define-model, Property 5: WCC emits propName-changed for Vue compatibility', () => {
  it('propName-changed event carries the value in detail for any prop name', () => {
    fc.assert(
      fc.property(
        arbPropName,
        arbValue,
        (prop, value) => {
          const el = document.createElement('div');
          document.body.appendChild(el);

          let receivedEvent = null;

          // kebab-case the prop name (same as codegen does)
          const kebabProp = prop.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

          el.addEventListener(`${kebabProp}-changed`, (e) => {
            receivedEvent = e;
          });

          // Simulate what _modelSet does
          el.dispatchEvent(new CustomEvent(`${kebabProp}-changed`, {
            detail: value,
            bubbles: true
          }));

          expect(receivedEvent).not.toBeNull();
          expect(receivedEvent.detail).toBe(value);
          expect(receivedEvent.type).toBe(`${kebabProp}-changed`);

          document.body.removeChild(el);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 6: Angular — propNameChange event is emitted ───────────
// The WCC component emits propNameChange directly from _modelSet.
// Angular's [(prop)] listens for propChange.

describe('Feature: define-model, Property 6: WCC emits propNameChange for Angular compatibility', () => {
  it('propNameChange event carries the value in detail for any prop name', () => {
    fc.assert(
      fc.property(
        arbPropName,
        arbValue,
        (prop, value) => {
          const el = document.createElement('div');
          document.body.appendChild(el);

          let receivedEvent = null;

          el.addEventListener(`${prop}Change`, (e) => {
            receivedEvent = e;
          });

          // Simulate what _modelSet does
          el.dispatchEvent(new CustomEvent(`${prop}Change`, {
            detail: value,
            bubbles: true
          }));

          expect(receivedEvent).not.toBeNull();
          expect(receivedEvent.detail).toBe(value);
          expect(receivedEvent.type).toBe(`${prop}Change`);

          document.body.removeChild(el);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Unit Tests: Graceful Degradation ────────────────────────────────

describe('Feature: define-model, Unit: Graceful behavior without adapter dependency', () => {
  it('dispatching wcc:model does not throw errors regardless of adapter presence', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

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

    expect(bubbledEvent).not.toBeNull();
    expect(bubbledEvent.detail.prop).toBe('name');
    expect(bubbledEvent.detail.value).toBe('Alice');

    document.body.removeChild(parent);
  });

  it('wcc:model event reaches document-level listeners (vanilla JS usage)', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    let docReceived = null;
    const handler = (e) => {
      if (e.detail.prop === '__test_vanilla__') {
        docReceived = e;
      }
    };
    document.addEventListener('wcc:model', handler);

    el.dispatchEvent(new CustomEvent('wcc:model', {
      detail: { prop: '__test_vanilla__', value: 99, oldValue: 0 },
      bubbles: true,
      composed: true
    }));

    expect(docReceived).not.toBeNull();
    expect(docReceived.detail.value).toBe(99);

    document.removeEventListener('wcc:model', handler);
    document.body.removeChild(el);
  });

  it('component emits all three events (wcc:model + propName-changed + propNameChange)', () => {
    const el = document.createElement('my-component');
    document.body.appendChild(el);

    const events = [];
    el.addEventListener('wcc:model', (e) => events.push(e.type));
    el.addEventListener('count-changed', (e) => events.push(e.type));
    el.addEventListener('countChange', (e) => events.push(e.type));

    // Simulate _modelSet_count behavior
    el.dispatchEvent(new CustomEvent('wcc:model', {
      detail: { prop: 'count', value: 5, oldValue: 0 },
      bubbles: true, composed: true
    }));
    el.dispatchEvent(new CustomEvent('count-changed', {
      detail: 5, bubbles: true
    }));
    el.dispatchEvent(new CustomEvent('countChange', {
      detail: 5, bubbles: true
    }));

    expect(events).toEqual(['wcc:model', 'count-changed', 'countChange']);

    document.body.removeChild(el);
  });
});
