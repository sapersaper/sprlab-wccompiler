import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { reactiveRuntime } from './reactive-runtime.js';

// ── Helper: create a test context with the runtime functions ────────

function createRuntime() {
  const fn = new Function(`${reactiveRuntime}\nreturn { __signal, __computed, __effect };`);
  return fn();
}

// ── Arbitrary value generators ──────────────────────────────────────

const arbitraryValue = fc.oneof(
  fc.integer(),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.string(),
  fc.boolean()
);

// Generator for sequences of distinct values (compared by strict inequality)
function distinctValuesArb(minLength = 1, maxLength = 10) {
  return fc.array(arbitraryValue, { minLength, maxLength }).map((arr) => {
    // Deduplicate by strict equality to ensure each set triggers a notification
    const seen = [];
    const result = [];
    for (const v of arr) {
      if (!seen.some((s) => s === v)) {
        seen.push(v);
        result.push(v);
      }
    }
    return result;
  }).filter((arr) => arr.length >= minLength);
}

// ── Property Tests ──────────────────────────────────────────────────

/**
 * **Validates: Requirements 3.1, 3.4, 3.5**
 *
 * Property 4: Signal Read/Write Consistency
 *
 * For any initial value and any sequence of distinct new values, a __signal
 * created with the initial value SHALL return the initial value on first read,
 * and after each set(newValue) call, SHALL return the new value and SHALL have
 * notified all subscribed effects exactly once per change.
 *
 * Feature: core, Property 4: Signal Read/Write Consistency
 */
describe('reactive-runtime — property: Signal Read/Write Consistency', () => {
  it('reads initial value, then each set returns new value and notifies effects exactly once per change', () => {
    fc.assert(
      fc.property(
        arbitraryValue,
        distinctValuesArb(1, 8),
        (initial, newValues) => {
          const { __signal, __effect } = createRuntime();

          // Filter out values that are the same as initial
          const distinctFromInitial = newValues.filter((v) => v !== initial);
          if (distinctFromInitial.length === 0) return; // skip trivial case

          const sig = __signal(initial);

          // Verify initial read
          expect(sig()).toBe(initial);

          // Track effect executions
          let effectCount = 0;
          __effect(() => {
            sig(); // read to subscribe
            effectCount++;
          });

          // Effect runs immediately once
          expect(effectCount).toBe(1);

          // For each distinct new value, set and verify
          for (const newVal of distinctFromInitial) {
            const prevCount = effectCount;
            sig(newVal);
            expect(sig()).toBe(newVal);
            // Effect should have been notified exactly once
            expect(effectCount).toBe(prevCount + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 3.2, 3.4**
 *
 * Property 5: Computed Derived Value Correctness
 *
 * For any signal with an initial value and any pure transformation function,
 * a __computed wrapping that function SHALL return the correct derived value,
 * and when the source signal changes, the computed SHALL return the updated
 * derived value on next read.
 *
 * Feature: core, Property 5: Computed Derived Value Correctness
 */
describe('reactive-runtime — property: Computed Derived Value Correctness', () => {
  it('computed returns correct derived value initially and after signal changes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: -100, max: 100 }).filter((f) => f !== 0),
        (initial, factor) => {
          const { __signal, __computed } = createRuntime();

          const sig = __signal(initial);
          const derived = __computed(() => sig() * factor);

          // Verify initial derived value
          expect(derived()).toBe(initial * factor);

          // Change signal and verify updated derived value
          const newVal = initial + 1;
          sig(newVal);
          expect(derived()).toBe(newVal * factor);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 3.3, 3.4, 3.5**
 *
 * Property 6: Effect Execution on Dependency Change
 *
 * For any signal with an initial value, an __effect that reads the signal
 * SHALL execute immediately with the initial value, and SHALL re-execute
 * exactly once each time the signal is set to a different value.
 *
 * Feature: core, Property 6: Effect Execution on Dependency Change
 */
describe('reactive-runtime — property: Effect Execution on Dependency Change', () => {
  it('effect executes immediately and re-executes exactly once per distinct value change', () => {
    fc.assert(
      fc.property(
        arbitraryValue,
        distinctValuesArb(1, 10),
        (initial, newValues) => {
          const { __signal, __effect } = createRuntime();

          // Filter out values that are the same as initial
          const distinctFromInitial = newValues.filter((v) => v !== initial);
          if (distinctFromInitial.length === 0) return;

          const sig = __signal(initial);

          let executionCount = 0;
          let lastSeen;

          __effect(() => {
            lastSeen = sig();
            executionCount++;
          });

          // Immediate execution
          expect(executionCount).toBe(1);
          expect(lastSeen).toBe(initial);

          // Each distinct new value triggers exactly one re-execution
          let prevValue = initial;
          for (const newVal of distinctFromInitial) {
            // Skip if same as previous (already filtered for initial, but chain may repeat)
            if (newVal === prevValue) continue;

            const prevCount = executionCount;
            sig(newVal);
            expect(executionCount).toBe(prevCount + 1);
            expect(lastSeen).toBe(newVal);
            prevValue = newVal;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 3.6**
 *
 * Property 7: Signal Same-Value Notification Skip
 *
 * For any value, setting a signal to its current value SHALL NOT trigger
 * re-execution of subscribed effects (idempotence).
 *
 * Feature: core, Property 7: Signal Same-Value Notification Skip
 */
describe('reactive-runtime — property: Signal Same-Value Notification Skip', () => {
  it('setting signal to same value does not re-execute effects', () => {
    fc.assert(
      fc.property(
        arbitraryValue,
        fc.integer({ min: 2, max: 10 }),
        (value, repeatCount) => {
          const { __signal, __effect } = createRuntime();

          const sig = __signal(value);

          let effectCount = 0;
          __effect(() => {
            sig(); // read to subscribe
            effectCount++;
          });

          // Effect runs immediately once
          expect(effectCount).toBe(1);

          // Set to same value multiple times
          for (let i = 0; i < repeatCount; i++) {
            sig(value);
          }

          // Effect should NOT have re-executed
          expect(effectCount).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
