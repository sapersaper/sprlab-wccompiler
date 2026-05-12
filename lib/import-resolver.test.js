import { describe, it, expect } from 'vitest';
import { extractWccImports } from './import-resolver.js';

describe('extractWccImports', () => {
  describe('named default imports', () => {
    it('extracts a single named import', () => {
      const source = `import WccBadge from './wcc-badge.wcc';`;
      const result = extractWccImports(source, 'test.wcc');

      expect(result.named).toEqual([
        { identifier: 'WccBadge', sourcePath: './wcc-badge.wcc', compiledPath: './wcc-badge.js' },
      ]);
      expect(result.sideEffect).toEqual([]);
      expect(result.strippedSource).toBe('');
    });

    it('extracts multiple named imports', () => {
      const source = [
        `import WccBadge from './wcc-badge.wcc';`,
        `import MyButton from './my-button.wcc';`,
      ].join('\n');
      const result = extractWccImports(source, 'test.wcc');

      expect(result.named).toEqual([
        { identifier: 'WccBadge', sourcePath: './wcc-badge.wcc', compiledPath: './wcc-badge.js' },
        { identifier: 'MyButton', sourcePath: './my-button.wcc', compiledPath: './my-button.js' },
      ]);
      expect(result.sideEffect).toEqual([]);
    });

    it('accepts any valid JS identifier as the import name', () => {
      const source = `import Foo from './bar.wcc';`;
      const result = extractWccImports(source, 'test.wcc');

      expect(result.named[0].identifier).toBe('Foo');
      expect(result.named[0].sourcePath).toBe('./bar.wcc');
    });
  });

  describe('side-effect imports', () => {
    it('extracts a side-effect import', () => {
      const source = `import './child.wcc';`;
      const result = extractWccImports(source, 'test.wcc');

      expect(result.named).toEqual([]);
      expect(result.sideEffect).toEqual([
        { sourcePath: './child.wcc', compiledPath: './child.js' },
      ]);
      expect(result.strippedSource).toBe('');
    });

    it('extracts side-effect import with double quotes', () => {
      const source = `import "./utils.wcc";`;
      const result = extractWccImports(source, 'test.wcc');

      expect(result.sideEffect).toEqual([
        { sourcePath: './utils.wcc', compiledPath: './utils.js' },
      ]);
    });
  });

  describe('mixed named + side-effect imports', () => {
    it('extracts both named and side-effect imports from the same source', () => {
      const source = [
        `import WccBadge from './wcc-badge.wcc';`,
        `import './wcc-utils.wcc';`,
        `import MyButton from '../shared/my-button.wcc';`,
      ].join('\n');
      const result = extractWccImports(source, 'test.wcc');

      expect(result.named).toEqual([
        { identifier: 'WccBadge', sourcePath: './wcc-badge.wcc', compiledPath: './wcc-badge.js' },
        { identifier: 'MyButton', sourcePath: '../shared/my-button.wcc', compiledPath: '../shared/my-button.js' },
      ]);
      expect(result.sideEffect).toEqual([
        { sourcePath: './wcc-utils.wcc', compiledPath: './wcc-utils.js' },
      ]);
    });
  });

  describe('path preservation', () => {
    it('preserves ../ segments in the compiled path', () => {
      const source = `import WccButton from '../shared/wcc-button.wcc';`;
      const result = extractWccImports(source, 'test.wcc');

      expect(result.named[0].sourcePath).toBe('../shared/wcc-button.wcc');
      expect(result.named[0].compiledPath).toBe('../shared/wcc-button.js');
    });

    it('preserves deeply nested relative paths', () => {
      const source = `import Deep from '../../components/nested/deep-comp.wcc';`;
      const result = extractWccImports(source, 'test.wcc');

      expect(result.named[0].sourcePath).toBe('../../components/nested/deep-comp.wcc');
      expect(result.named[0].compiledPath).toBe('../../components/nested/deep-comp.js');
    });

    it('preserves ./ prefix in paths', () => {
      const source = `import './local.wcc';`;
      const result = extractWccImports(source, 'test.wcc');

      expect(result.sideEffect[0].sourcePath).toBe('./local.wcc');
      expect(result.sideEffect[0].compiledPath).toBe('./local.js');
    });
  });

  describe('invalid import forms', () => {
    it('throws on namespace import from .wcc file', () => {
      const source = `import * as Foo from './foo.wcc';`;

      expect(() => extractWccImports(source, 'my-comp.wcc')).toThrow();
      try {
        extractWccImports(source, 'my-comp.wcc');
      } catch (err) {
        expect(err.code).toBe('INVALID_WCC_IMPORT');
        expect(err.message).toContain('my-comp.wcc');
        expect(err.message).toContain('default imports');
      }
    });

    it('throws on named export import from .wcc file', () => {
      const source = `import { Foo } from './foo.wcc';`;

      expect(() => extractWccImports(source, 'my-comp.wcc')).toThrow();
      try {
        extractWccImports(source, 'my-comp.wcc');
      } catch (err) {
        expect(err.code).toBe('INVALID_WCC_IMPORT');
        expect(err.message).toContain('my-comp.wcc');
        expect(err.message).toContain('default imports');
      }
    });

    it('throws on named export import with multiple specifiers', () => {
      const source = `import { Foo, Bar } from './foo.wcc';`;

      expect(() => extractWccImports(source, 'test.wcc')).toThrow();
      try {
        extractWccImports(source, 'test.wcc');
      } catch (err) {
        expect(err.code).toBe('INVALID_WCC_IMPORT');
      }
    });

    it('throws on named export import with alias', () => {
      const source = `import { Foo as Bar } from './foo.wcc';`;

      expect(() => extractWccImports(source, 'test.wcc')).toThrow();
      try {
        extractWccImports(source, 'test.wcc');
      } catch (err) {
        expect(err.code).toBe('INVALID_WCC_IMPORT');
      }
    });
  });

  describe('strippedSource', () => {
    it('removes .wcc import lines and preserves other code', () => {
      const source = [
        `import WccBadge from './wcc-badge.wcc';`,
        `import { signal } from './_wcc-runtime.js';`,
        `const count = signal(0);`,
      ].join('\n');
      const result = extractWccImports(source, 'test.wcc');

      expect(result.strippedSource).toBe(
        [`import { signal } from './_wcc-runtime.js';`, `const count = signal(0);`].join('\n')
      );
    });

    it('preserves non-.wcc imports untouched', () => {
      const source = [
        `import { html } from 'lit';`,
        `import WccChild from './child.wcc';`,
        `console.log('hello');`,
      ].join('\n');
      const result = extractWccImports(source, 'test.wcc');

      expect(result.strippedSource).toBe(
        [`import { html } from 'lit';`, `console.log('hello');`].join('\n')
      );
    });
  });
});
