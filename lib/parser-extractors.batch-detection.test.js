/**
 * Test for Bug #0002: batch() function detection and transformation
 * 
 * Verifies that the compiler correctly detects batch() usage and transforms it.
 */

import { describe, it, expect } from 'vitest';
import { detectBatchUsage } from '../lib/parser-extractors.js';
import { transformMethodBody } from '../lib/codegen.js';

describe('Bug #0002: batch() detection and transformation', () => {
  describe('detectBatchUsage', () => {
    it('should detect batch() with arrow function', () => {
      const source = `batch(() => { count.set(1) })`;
      expect(detectBatchUsage(source)).toBe(true);
    });

    it('should detect batch() with regular function', () => {
      const source = `batch(function() { count.set(1) })`;
      expect(detectBatchUsage(source)).toBe(true);
    });

    it('should detect batch() with spacing variations', () => {
      expect(detectBatchUsage('batch (() => {})')).toBe(true);
      expect(detectBatchUsage('batch  (() => {})')).toBe(true);
      expect(detectBatchUsage('batch\t(() => {})')).toBe(true);
    });

    it('should NOT detect batch when not used', () => {
      const source = `count.set(count() + 1)`;
      expect(detectBatchUsage(source)).toBe(false);
    });

    it('should NOT detect partial matches', () => {
      expect(detectBatchUsage('myBatchFunction()')).toBe(false);
      expect(detectBatchUsage('batched = true')).toBe(false);
      expect(detectBatchUsage('const batch = 5')).toBe(false);
    });

    it('should detect multiple batch calls', () => {
      const source = `
        batch(() => { a.set(1) })
        batch(() => { b.set(2) })
      `;
      expect(detectBatchUsage(source)).toBe(true);
    });
  });

  describe('transformMethodBody - batch transformation', () => {
    it('should transform batch() to __batch()', () => {
      const body = `batch(() => { count.set(1) })`;
      const result = transformMethodBody(body, ['count'], [], null, new Set(), null, [], []);
      
      expect(result).toContain('__batch(');
      expect(result).not.toMatch(/\bbatch\s*\(/);
    });

    it('should preserve batch content while transforming', () => {
      const body = `
batch(() => {
  firstName.set('John')
  lastName.set('Doe')
})
      `.trim();
      
      const result = transformMethodBody(body, ['firstName', 'lastName'], [], null, new Set(), null, [], []);
      
      expect(result).toContain('__batch(');
      expect(result).toContain("this._firstName('John')");
      expect(result).toContain("this._lastName('Doe')");
    });

    it('should handle nested batch calls', () => {
      const body = `
batch(() => {
  a.set(1)
  batch(() => {
    b.set(2)
  })
  c.set(3)
})
      `.trim();
      
      const result = transformMethodBody(body, ['a', 'b', 'c'], [], null, new Set(), null, [], []);
      
      // All batch calls should be transformed
      const batchCount = (result.match(/__batch\(/g) || []).length;
      expect(batchCount).toBe(2);
    });

    it('should work with batch and other signal operations', () => {
      const body = `
const x = count()
batch(() => {
  count.set(x + 1)
  name.set('test')
})
      `.trim();
      
      const result = transformMethodBody(body, ['count', 'name'], [], null, new Set(), null, [], []);
      
      expect(result).toContain('__batch(');
      expect(result).toContain('this._count()');
      expect(result).toContain('this._count(');
      expect(result).toContain("this._name('test')");
    });
  });
});
