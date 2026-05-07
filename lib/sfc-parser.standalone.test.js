/**
 * Unit tests and property-based tests for standalone option extraction in SFC Parser.
 *
 * Feature: standalone-mode
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseSFC } from './sfc-parser.js';

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Build a minimal valid SFC with the given defineComponent body options.
 */
function buildSFC(defineComponentBody) {
  return `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ ${defineComponentBody} })

const x = signal(0)
</script>

<template>
  <span>{{x()}}</span>
</template>
`;
}

// ── Unit Tests (Task 1.4) ───────────────────────────────────────────

describe('SFC Parser — standalone option extraction', () => {
  it('extracts standalone: true from defineComponent', () => {
    const source = buildSFC("tag: 'my-comp', standalone: true");
    const descriptor = parseSFC(source, 'my-comp.wcc');
    expect(descriptor.standalone).toBe(true);
  });

  it('extracts standalone: false from defineComponent', () => {
    const source = buildSFC("tag: 'my-comp', standalone: false");
    const descriptor = parseSFC(source, 'my-comp.wcc');
    expect(descriptor.standalone).toBe(false);
  });

  it('returns undefined when standalone is absent', () => {
    const source = buildSFC("tag: 'my-comp'");
    const descriptor = parseSFC(source, 'my-comp.wcc');
    expect(descriptor.standalone).toBeUndefined();
  });

  it('throws INVALID_STANDALONE_OPTION for string value', () => {
    const source = buildSFC("tag: 'my-comp', standalone: 'yes'");
    expect(() => parseSFC(source, 'my-comp.wcc')).toThrow();
    try {
      parseSFC(source, 'my-comp.wcc');
    } catch (e) {
      expect(e.code).toBe('INVALID_STANDALONE_OPTION');
      expect(e.message).toContain('standalone debe ser true o false');
    }
  });

  it('throws INVALID_STANDALONE_OPTION for numeric value', () => {
    const source = buildSFC("tag: 'my-comp', standalone: 1");
    expect(() => parseSFC(source, 'my-comp.wcc')).toThrow();
    try {
      parseSFC(source, 'my-comp.wcc');
    } catch (e) {
      expect(e.code).toBe('INVALID_STANDALONE_OPTION');
    }
  });

  it('throws INVALID_STANDALONE_OPTION for null value', () => {
    const source = buildSFC("tag: 'my-comp', standalone: null");
    expect(() => parseSFC(source, 'my-comp.wcc')).toThrow();
    try {
      parseSFC(source, 'my-comp.wcc');
    } catch (e) {
      expect(e.code).toBe('INVALID_STANDALONE_OPTION');
    }
  });

  it('includes fileName in error message', () => {
    const source = buildSFC("tag: 'my-comp', standalone: 'invalid'");
    try {
      parseSFC(source, 'test-file.wcc');
    } catch (e) {
      expect(e.message).toContain('test-file.wcc');
    }
  });
});

// ── Property-Based Tests ────────────────────────────────────────────

describe('SFC Parser — Property 1: round-trip extraction of standalone boolean', () => {
  /**
   * **Validates: Requirements 1.1, 1.2**
   *
   * For any boolean value of standalone (true or false) included in
   * defineComponent() of a valid SFC, the parser SHALL extract it correctly
   * and return it in the descriptor with the same value.
   */
  it('correctly extracts any boolean standalone value', () => {
    fc.assert(
      fc.property(fc.boolean(), (standaloneValue) => {
        const source = buildSFC(`tag: 'wcc-test', standalone: ${standaloneValue}`);
        const descriptor = parseSFC(source, 'test.wcc');
        return descriptor.standalone === standaloneValue;
      }),
      { numRuns: 100 }
    );
  });
});

describe('SFC Parser — Property 2: rejection of non-boolean standalone values', () => {
  /**
   * **Validates: Requirements 1.4**
   *
   * For any non-boolean value of standalone in defineComponent()
   * (strings, numbers, identifiers, null), the SFC Parser SHALL throw
   * an error with code INVALID_STANDALONE_OPTION.
   */
  it('rejects non-boolean standalone values with INVALID_STANDALONE_OPTION', () => {
    // Generate non-boolean values that are valid JS tokens (not true/false)
    // Filter out characters that would break the defineComponent regex ({, }, (, ))
    const nonBooleanValue = fc.oneof(
      // Numeric values
      fc.integer({ min: 0, max: 100 }).map(n => String(n)),
      // String literals (quoted) — avoid chars that break the regex
      fc.string({ minLength: 1, maxLength: 10 })
        .filter(s => !s.includes("'") && !s.includes('}') && !s.includes('{') &&
                     !s.includes('(') && !s.includes(')') &&
                     !s.includes('\n') && !s.includes('\r'))
        .map(s => `'${s}'`),
      // null/undefined/identifiers that aren't true/false
      fc.constantFrom('null', 'undefined', 'yes', 'no', '"yes"', '"no"')
    );

    fc.assert(
      fc.property(nonBooleanValue, (value) => {
        // Skip values that happen to be 'true' or 'false'
        if (value === 'true' || value === 'false') return true;

        const source = buildSFC(`tag: 'wcc-test', standalone: ${value}`);
        try {
          parseSFC(source, 'test.wcc');
          return false; // Should have thrown
        } catch (e) {
          return e.code === 'INVALID_STANDALONE_OPTION';
        }
      }),
      { numRuns: 100 }
    );
  });
});
