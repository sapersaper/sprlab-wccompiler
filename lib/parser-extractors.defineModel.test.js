/**
 * Property-based tests for extractModels() in parser-extractors.js
 *
 * Property 1 (parser portion): Model signal generation preserves declaration semantics
 * - Generate random valid defineModel() source strings with 1–5 declarations
 * - Assert extractModels() returns the correct number of ModelDef objects with matching fields
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { extractModels } from './parser-extractors.js';

// ── Generators ──────────────────────────────────────────────────────

const reserved = new Set([
  'if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else',
  'enum', 'eval', 'null', 'this', 'true', 'void', 'with', 'const', 'break',
  'class', 'super', 'while', 'yield', 'return', 'typeof', 'delete', 'switch',
  'export', 'import', 'default', 'signal', 'computed', 'effect', 'props',
  'emit', 'defineProps', 'defineEmits', 'defineModel', 'false', 'name',
  'set', 'get', 'undefined',
]);

/** Generate a valid JS identifier for variable names */
const arbVarName = fc
  .stringMatching(/^[a-z][a-zA-Z]{2,8}$/)
  .filter(s => !reserved.has(s));

/** Generate a valid prop name (kebab-free, simple identifiers) */
const arbPropName = fc
  .stringMatching(/^[a-z][a-zA-Z]{2,10}$/)
  .filter(s => !reserved.has(s));

/** Generate a declaration keyword */
const arbDeclKeyword = fc.constantFrom('const', 'let', 'var');

/** Generate a default value expression */
const arbDefaultValue = fc.oneof(
  // String defaults (single-quoted)
  fc.stringMatching(/^[a-zA-Z0-9 ]{0,8}$/).map(s => ({ expr: `'${s}'`, type: 'string' })),
  // Number defaults
  fc.integer({ min: -1000, max: 1000 }).map(n => ({ expr: String(n), type: 'number' })),
  // Boolean defaults
  fc.boolean().map(b => ({ expr: String(b), type: 'boolean' })),
  // undefined (no default specified)
  fc.constant({ expr: null, type: 'undefined' })
);

/**
 * Generate a single defineModel declaration descriptor.
 */
const arbModelDecl = fc.record({
  varName: arbVarName,
  propName: arbPropName,
  keyword: arbDeclKeyword,
  defaultValue: arbDefaultValue,
  required: fc.boolean(),
});

/**
 * Generate 1–5 unique defineModel declarations (unique by both varName and propName).
 */
const arbModelDecls = fc
  .uniqueArray(arbModelDecl, {
    minLength: 1,
    maxLength: 5,
    comparator: (a, b) => a.varName === b.varName || a.propName === b.propName,
  });

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Build a source string from a list of model declarations.
 */
function buildSource(decls) {
  return decls.map(decl => {
    const parts = [`name: '${decl.propName}'`];

    if (decl.defaultValue.expr !== null) {
      parts.push(`default: ${decl.defaultValue.expr}`);
    }

    if (decl.required) {
      parts.push('required: true');
    }

    return `${decl.keyword} ${decl.varName} = defineModel({ ${parts.join(', ')} })`;
  }).join('\n');
}

// ── Property-Based Tests ────────────────────────────────────────────

// ── Unit / Edge-Case Tests ──────────────────────────────────────────

describe('extractModels() — unit/edge-case tests', () => {
  describe('single prop extraction', () => {
    it('extracts a single defineModel with string default', () => {
      const source = `const value = defineModel({ name: 'value', default: '' })`;
      const result = extractModels(source);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        varName: 'value',
        name: 'value',
        default: "''",
        required: false,
      });
    });

    it('extracts a single defineModel with numeric default', () => {
      const source = `const count = defineModel({ name: 'count', default: 42 })`;
      const result = extractModels(source);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        varName: 'count',
        name: 'count',
        default: '42',
        required: false,
      });
    });

    it('extracts a single defineModel with boolean default', () => {
      const source = `const active = defineModel({ name: 'active', default: false })`;
      const result = extractModels(source);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        varName: 'active',
        name: 'active',
        default: 'false',
        required: false,
      });
    });
  });

  describe('multiple props extraction', () => {
    it('extracts multiple defineModel calls in order', () => {
      const source = [
        `const title = defineModel({ name: 'title', default: '' })`,
        `const count = defineModel({ name: 'count', default: 0 })`,
        `const visible = defineModel({ name: 'visible', default: true })`,
      ].join('\n');
      const result = extractModels(source);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('title');
      expect(result[0].varName).toBe('title');
      expect(result[1].name).toBe('count');
      expect(result[1].varName).toBe('count');
      expect(result[2].name).toBe('visible');
      expect(result[2].varName).toBe('visible');
    });

    it('handles different declaration keywords (const, let, var)', () => {
      const source = [
        `const a = defineModel({ name: 'alpha', default: 1 })`,
        `let b = defineModel({ name: 'beta', default: 2 })`,
        `var c = defineModel({ name: 'gamma', default: 3 })`,
      ].join('\n');
      const result = extractModels(source);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ varName: 'a', name: 'alpha', default: '1' });
      expect(result[1]).toMatchObject({ varName: 'b', name: 'beta', default: '2' });
      expect(result[2]).toMatchObject({ varName: 'c', name: 'gamma', default: '3' });
    });
  });

  describe('with/without defaults', () => {
    it('returns "undefined" as default when no default property is specified', () => {
      const source = `const value = defineModel({ name: 'value' })`;
      const result = extractModels(source);

      expect(result).toHaveLength(1);
      expect(result[0].default).toBe('undefined');
    });

    it('extracts complex default values (object/array expressions)', () => {
      const source = `const items = defineModel({ name: 'items', default: [1, 2, 3] })`;
      const result = extractModels(source);

      expect(result).toHaveLength(1);
      expect(result[0].default).toBe('[1, 2, 3]');
    });
  });

  describe('required: true', () => {
    it('extracts required: true when specified', () => {
      const source = `const value = defineModel({ name: 'value', required: true })`;
      const result = extractModels(source);

      expect(result).toHaveLength(1);
      expect(result[0].required).toBe(true);
    });

    it('defaults required to false when not specified', () => {
      const source = `const value = defineModel({ name: 'value', default: '' })`;
      const result = extractModels(source);

      expect(result).toHaveLength(1);
      expect(result[0].required).toBe(false);
    });

    it('extracts required: true alongside a default value', () => {
      const source = `const value = defineModel({ name: 'value', default: 'hello', required: true })`;
      const result = extractModels(source);

      expect(result).toHaveLength(1);
      expect(result[0].required).toBe(true);
      expect(result[0].default).toBe("'hello'");
    });
  });

  describe('non-defineModel calls are ignored', () => {
    it('ignores regular function calls that are not defineModel', () => {
      const source = [
        `const x = defineSignal({ name: 'x' })`,
        `const y = defineProps({ name: 'y' })`,
        `const z = someOtherFunction({ name: 'z' })`,
      ].join('\n');
      const result = extractModels(source);

      expect(result).toHaveLength(0);
    });

    it('ignores defineModel-like identifiers that are not exact matches', () => {
      const source = [
        `const a = defineModelExtra({ name: 'a', default: 1 })`,
        `const b = myDefineModel({ name: 'b', default: 2 })`,
      ].join('\n');
      const result = extractModels(source);

      // defineModelExtra starts with defineModel so the regex may match it
      // but myDefineModel should not match
      // The regex matches `defineModel(` so defineModelExtra({ would not match
      // because the regex expects `defineModel\(\s*\{`
      expect(result).toHaveLength(0);
    });

    it('only extracts defineModel calls among mixed code', () => {
      const source = [
        `const sig = signal(0)`,
        `const value = defineModel({ name: 'value', default: '' })`,
        `const comp = computed(() => sig() * 2)`,
        `const count = defineModel({ name: 'count', default: 0 })`,
        `function handleClick() { console.log('click') }`,
      ].join('\n');
      const result = extractModels(source);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('value');
      expect(result[1].name).toBe('count');
    });
  });

  describe('defineModel() without variable assignment', () => {
    it('does not extract defineModel() called without assignment (validation is in compiler)', () => {
      const source = `defineModel({ name: 'value', default: '' })`;
      const result = extractModels(source);

      // The parser only extracts assigned calls; the compiler validates unassigned ones
      expect(result).toHaveLength(0);
    });

    it('does not extract defineModel() used as expression statement', () => {
      const source = [
        `defineModel({ name: 'orphan', default: 0 })`,
        `const valid = defineModel({ name: 'valid', default: 1 })`,
      ].join('\n');
      const result = extractModels(source);

      // Only the assigned one is extracted
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('valid');
    });
  });
});

// ── Property-Based Tests ────────────────────────────────────────────

describe('Feature: define-model, Property 1: Model signal generation preserves declaration semantics (parser portion)', () => {
  /**
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   *
   * For any valid set of defineModel declarations (1–5 props with unique names and valid defaults),
   * extractModels() SHALL return the correct number of ModelDef objects with matching fields.
   */
  it('extractModels returns correct count and matching fields for random valid declarations', () => {
    fc.assert(
      fc.property(arbModelDecls, (decls) => {
        const source = buildSource(decls);
        const result = extractModels(source);

        // Correct count of extracted models
        expect(result).toHaveLength(decls.length);

        // Each extracted model matches the declaration
        for (let i = 0; i < decls.length; i++) {
          const decl = decls[i];
          const model = result[i];

          // varName matches
          expect(model.varName).toBe(decl.varName);

          // prop name matches
          expect(model.name).toBe(decl.propName);

          // default value matches
          if (decl.defaultValue.expr !== null) {
            expect(model.default).toBe(decl.defaultValue.expr);
          } else {
            expect(model.default).toBe('undefined');
          }

          // required flag matches
          expect(model.required).toBe(decl.required);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.4**
   *
   * Multiple defineModel() calls in a single source are all extracted in order.
   */
  it('preserves declaration order across multiple defineModel calls', () => {
    fc.assert(
      fc.property(arbModelDecls, (decls) => {
        const source = buildSource(decls);
        const result = extractModels(source);

        // Order is preserved
        const extractedVarNames = result.map(m => m.varName);
        const declaredVarNames = decls.map(d => d.varName);
        expect(extractedVarNames).toEqual(declaredVarNames);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.1, 1.2**
   *
   * All declaration keywords (const, let, var) are recognized.
   */
  it('recognizes all declaration keywords (const, let, var)', () => {
    fc.assert(
      fc.property(
        arbPropName,
        arbVarName,
        arbDeclKeyword,
        (propName, varName, keyword) => {
          const source = `${keyword} ${varName} = defineModel({ name: '${propName}', default: 0 })`;
          const result = extractModels(source);

          expect(result).toHaveLength(1);
          expect(result[0].varName).toBe(varName);
          expect(result[0].name).toBe(propName);
        }
      ),
      { numRuns: 100 }
    );
  });
});
