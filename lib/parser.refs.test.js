/**
 * Tests for parser templateRef extraction.
 *
 * Includes:
 * - Property test for templateRef round-trip (Property 1)
 * - Unit tests for parser edge cases
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { extractRefs } from './parser.js';

// ── Helpers ─────────────────────────────────────────────────────────

/** Generate a valid JS identifier */
const identifierArb = fc
  .stringMatching(/^[a-z][a-z]{1,7}$/)
  .filter(s => !['if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else', 'enum', 'eval', 'null', 'this', 'true', 'void', 'with'].includes(s));

/** Generate a valid ref name (alphanumeric) */
const refNameArb = fc.stringMatching(/^[a-z][a-z0-9]{1,8}$/);

const declKeywordArb = fc.constantFrom('const', 'let', 'var');
const quoteArb = fc.constantFrom("'", '"');

// ── Property Test: Parser templateRef Round-Trip (Property 1) ────────────

describe('Feature: template-refs, Property 1: Parser templateRef Round-Trip', () => {
  /**
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   */
  it('extracts all templateRef declarations with correct varName and refName in source order', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(declKeywordArb, identifierArb, refNameArb, quoteArb),
          { minLength: 1, maxLength: 5 }
        ),
        (declarations) => {
          // Deduplicate varNames and refNames to avoid ambiguity
          const seen = new Set();
          const unique = declarations.filter(([, varName, refName]) => {
            const key = `${varName}:${refName}`;
            if (seen.has(key) || seen.has(varName)) return false;
            seen.add(key);
            seen.add(varName);
            return true;
          });
          if (unique.length === 0) return; // skip empty after dedup

          // Build source with templateRef declarations
          const source = unique
            .map(([keyword, varName, refName, quote]) =>
              `${keyword} ${varName} = templateRef(${quote}${refName}${quote})`
            )
            .join('\n');

          const result = extractRefs(source);

          // Correct number extracted
          expect(result).toHaveLength(unique.length);

          // Each has correct varName and refName, in source order
          for (let i = 0; i < unique.length; i++) {
            expect(result[i].varName).toBe(unique[i][1]);
            expect(result[i].refName).toBe(unique[i][2]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Unit Tests: Parser Edge Cases ───────────────────────────────────

describe('extractRefs — unit tests', () => {
  it('extracts single-quoted ref name: templateRef(\'canvas\')', () => {
    const result = extractRefs("const canvas = templateRef('canvas')");
    expect(result).toEqual([{ varName: 'canvas', refName: 'canvas' }]);
  });

  it('extracts double-quoted ref name: templateRef("canvas")', () => {
    const result = extractRefs('const canvas = templateRef("canvas")');
    expect(result).toEqual([{ varName: 'canvas', refName: 'canvas' }]);
  });

  it('extracts let declaration: let canvas = templateRef(\'canvas\')', () => {
    const result = extractRefs("let canvas = templateRef('canvas')");
    expect(result).toEqual([{ varName: 'canvas', refName: 'canvas' }]);
  });

  it('extracts var declaration: var canvas = templateRef(\'canvas\')', () => {
    const result = extractRefs("var canvas = templateRef('canvas')");
    expect(result).toEqual([{ varName: 'canvas', refName: 'canvas' }]);
  });

  it('extracts multiple templateRef calls in same source', () => {
    const source = `
      const canvas = templateRef('canvas')
      const input = templateRef('input')
    `;
    const result = extractRefs(source);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ varName: 'canvas', refName: 'canvas' });
    expect(result[1]).toEqual({ varName: 'input', refName: 'input' });
  });

  it('extracts templateRef with different varName and refName', () => {
    const result = extractRefs("const myCanvas = templateRef('canvas')");
    expect(result).toEqual([{ varName: 'myCanvas', refName: 'canvas' }]);
  });

  it('returns empty array when no templateRef calls present', () => {
    const result = extractRefs("const count = signal(0)");
    expect(result).toEqual([]);
  });
});
