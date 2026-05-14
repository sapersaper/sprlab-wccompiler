/**
 * Tests for validateNameCollisions function in parser-extractors.js
 */

import { describe, it, expect } from 'vitest';
import { validateNameCollisions } from './parser-extractors.js';

describe('validateNameCollisions', () => {
  const fileName = 'test-component.wcc';

  describe('No collisions - should pass', () => {
    it('should allow unique names for signals and functions', () => {
      const signalNames = new Set(['count', 'name']);
      const computedNames = new Set(['doubleCount']);
      const propNames = new Set(['label']);
      const methods = [
        { name: 'increment', params: '', body: 'count.set(count() + 1)' },
        { name: 'getFullName', params: '', body: 'return name()' }
      ];

      expect(() => {
        validateNameCollisions(signalNames, computedNames, propNames, methods, fileName);
      }).not.toThrow();
    });

    it('should allow empty sets and methods', () => {
      const signalNames = new Set();
      const computedNames = new Set();
      const propNames = new Set();
      const methods = [];

      expect(() => {
        validateNameCollisions(signalNames, computedNames, propNames, methods, fileName);
      }).not.toThrow();
    });

    it('should allow multiple signals with different names', () => {
      const signalNames = new Set(['count', 'name', 'visible']);
      const computedNames = new Set();
      const propNames = new Set();
      const methods = [];

      expect(() => {
        validateNameCollisions(signalNames, computedNames, propNames, methods, fileName);
      }).not.toThrow();
    });
  });

  describe('Signal vs Function collisions - should fail', () => {
    it('should detect collision between signal and function with same name', () => {
      const signalNames = new Set(['greeting']);
      const computedNames = new Set();
      const propNames = new Set();
      const methods = [
        { name: 'greeting', params: '', body: "return 'Hi'" }
      ];

      expect(() => {
        validateNameCollisions(signalNames, computedNames, propNames, methods, fileName);
      }).toThrow(/Colisión de nombres.*'greeting'.*signal.*function/);
    });

    it('should detect collision when function name matches signal name', () => {
      const signalNames = new Set(['count', 'total']);
      const computedNames = new Set();
      const propNames = new Set();
      const methods = [
        { name: 'count', params: '', body: 'return 42' }
      ];

      expect(() => {
        validateNameCollisions(signalNames, computedNames, propNames, methods, fileName);
      }).toThrow(/Colisión de nombres.*'count'/);
    });

    it('should suggest renaming function in error message', () => {
      const signalNames = new Set(['data']);
      const computedNames = new Set();
      const propNames = new Set();
      const methods = [
        { name: 'data', params: '', body: 'return {}' }
      ];

      expect(() => {
        validateNameCollisions(signalNames, computedNames, propNames, methods, fileName);
      }).toThrow(/getData/);
    });
  });

  describe('Computed vs Function collisions - should fail', () => {
    it('should detect collision between computed and function', () => {
      const signalNames = new Set();
      const computedNames = new Set(['fullName']);
      const propNames = new Set();
      const methods = [
        { name: 'fullName', params: '', body: "return 'John Doe'" }
      ];

      expect(() => {
        validateNameCollisions(signalNames, computedNames, propNames, methods, fileName);
      }).toThrow(/Colisión de nombres.*'fullName'.*computed.*function/);
    });
  });

  describe('Prop vs Function collisions - should fail', () => {
    it('should detect collision between prop and function', () => {
      const signalNames = new Set();
      const computedNames = new Set();
      const propNames = new Set(['title']);
      const methods = [
        { name: 'title', params: '', body: "return 'Mr.'" }
      ];

      expect(() => {
        validateNameCollisions(signalNames, computedNames, propNames, methods, fileName);
      }).toThrow(/Colisión de nombres.*'title'.*prop.*function/);
    });
  });

  describe('Multiple collisions - should report first collision', () => {
    it('should detect the first collision found', () => {
      const signalNames = new Set(['count', 'name']);
      const computedNames = new Set();
      const propNames = new Set();
      const methods = [
        { name: 'count', params: '', body: 'return 0' },
        { name: 'name', params: '', body: "return 'test'" }
      ];

      expect(() => {
        validateNameCollisions(signalNames, computedNames, propNames, methods, fileName);
      }).toThrow(/Colisión de nombres/);
    });
  });

  describe('Error messages - should be helpful', () => {
    it('should include filename in error message', () => {
      const signalNames = new Set(['value']);
      const computedNames = new Set();
      const propNames = new Set();
      const methods = [
        { name: 'value', params: '', body: 'return 1' }
      ];

      try {
        validateNameCollisions(signalNames, computedNames, propNames, methods, 'my-component.wcc');
      } catch (error) {
        expect(error.message).toContain('my-component.wcc');
      }
    });

    it('should suggest solution in error message', () => {
      const signalNames = new Set(['items']);
      const computedNames = new Set();
      const propNames = new Set();
      const methods = [
        { name: 'items', params: '', body: 'return []' }
      ];

      try {
        validateNameCollisions(signalNames, computedNames, propNames, methods, fileName);
      } catch (error) {
        expect(error.message).toMatch(/Solución|Solution/);
        expect(error.message).toMatch(/getItems/);
      }
    });

    it('should mention both conflicting types', () => {
      const signalNames = new Set(['status']);
      const computedNames = new Set();
      const propNames = new Set();
      const methods = [
        { name: 'status', params: '', body: "return 'active'" }
      ];

      try {
        validateNameCollisions(signalNames, computedNames, propNames, methods, fileName);
      } catch (error) {
        expect(error.message).toContain('signal');
        expect(error.message).toContain('function');
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle method with same name as another method (duplicate)', () => {
      const signalNames = new Set();
      const computedNames = new Set();
      const propNames = new Set();
      const methods = [
        { name: 'update', params: '', body: '' },
        { name: 'update', params: '', body: '' }
      ];

      // Note: Current implementation checks for duplicate methods
      // This test verifies that behavior
      expect(() => {
        validateNameCollisions(signalNames, computedNames, propNames, methods, fileName);
      }).toThrow(/Función duplicada.*'update'/);
    });

    it('should not confuse similar names', () => {
      const signalNames = new Set(['count']);
      const computedNames = new Set();
      const propNames = new Set();
      const methods = [
        { name: 'counter', params: '', body: '' },
        { name: 'getCount', params: '', body: '' }
      ];

      expect(() => {
        validateNameCollisions(signalNames, computedNames, propNames, methods, fileName);
      }).not.toThrow();
    });

    it('should handle special characters in names', () => {
      const signalNames = new Set(['$state', '_private']);
      const computedNames = new Set();
      const propNames = new Set();
      const methods = [
        { name: '$action', params: '', body: '' },
        { name: '_method', params: '', body: '' }
      ];

      expect(() => {
        validateNameCollisions(signalNames, computedNames, propNames, methods, fileName);
      }).not.toThrow();
    });
  });
});
