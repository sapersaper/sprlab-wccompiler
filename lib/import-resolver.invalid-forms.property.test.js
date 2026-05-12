/**
 * Property-Based Tests for import resolver — invalid import form rejection.
 *
 * Feature: explicit-component-imports
 * Property 11: Invalid import form rejection
 *
 * For any `.wcc` import using named exports (`import { Foo } from './foo.wcc'`)
 * or namespace imports (`import * as Foo from './foo.wcc'`), the compiler SHALL
 * throw an error with a descriptive message.
 *
 * **Validates: Requirements 9.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { extractWccImports } from './import-resolver.js';

// ── Generators ──────────────────────────────────────────────────────

/**
 * Generator for valid JavaScript identifiers (PascalCase style).
 * Starts with an uppercase letter, followed by alphanumeric chars.
 */
const arbIdentifier = fc
  .tuple(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    fc.array(
      fc.constantFrom(
        ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')
      ),
      { minLength: 1, maxLength: 15 }
    )
  )
  .map(([first, rest]) => first + rest.join(''));

/**
 * Generator for valid relative .wcc paths.
 * Produces paths like './foo.wcc', '../bar/baz.wcc', './nested/deep/comp.wcc'
 */
const arbWccPath = fc
  .tuple(
    fc.constantFrom('./', '../', '../../', './nested/', '../shared/', './components/'),
    fc.array(
      fc.constantFrom(
        ...'abcdefghijklmnopqrstuvwxyz-_'.split('')
      ),
      { minLength: 1, maxLength: 15 }
    )
  )
  .map(([prefix, chars]) => `${prefix}${chars.join('')}.wcc`);

/**
 * Generator for a list of named export identifiers (for `import { A, B }` forms).
 * Generates 1-3 identifiers.
 */
const arbNamedExports = fc
  .array(arbIdentifier, { minLength: 1, maxLength: 3 })
  .map((ids) => [...new Set(ids)]) // deduplicate
  .filter((ids) => ids.length >= 1);

/**
 * Generator for quote style (single or double).
 */
const arbQuote = fc.constantFrom("'", '"');

/**
 * Generator for optional semicolons.
 */
const arbSemicolon = fc.constantFrom('', ';');

/**
 * Generator for namespace import statements from .wcc files.
 * Produces: import * as Identifier from './path.wcc'
 */
const arbNamespaceImport = fc
  .tuple(arbIdentifier, arbWccPath, arbQuote, arbSemicolon)
  .map(([id, path, quote, semi]) => `import * as ${id} from ${quote}${path}${quote}${semi}`);

/**
 * Generator for named export import statements from .wcc files.
 * Produces: import { Foo } from './path.wcc'
 * or: import { Foo, Bar } from './path.wcc'
 */
const arbNamedExportImport = fc
  .tuple(arbNamedExports, arbWccPath, arbQuote, arbSemicolon)
  .map(([ids, path, quote, semi]) => `import { ${ids.join(', ')} } from ${quote}${path}${quote}${semi}`);

/**
 * Generator for file names used in error messages.
 */
const arbFileName = fc
  .tuple(
    fc.constantFrom('', 'src/', 'components/', 'lib/'),
    fc.array(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-'.split('')),
      { minLength: 3, maxLength: 12 }
    )
  )
  .map(([prefix, chars]) => `${prefix}${chars.join('')}.wcc`);

// ── Property Tests ──────────────────────────────────────────────────

describe('Feature: explicit-component-imports, Property 11: Invalid import form rejection', () => {
  /**
   * **Validates: Requirements 9.5**
   *
   * For any namespace import from a .wcc file, extractWccImports SHALL throw
   * an error with code 'INVALID_WCC_IMPORT' and a message containing the file name.
   */
  it('namespace imports from .wcc files throw INVALID_WCC_IMPORT error', () => {
    fc.assert(
      fc.property(arbNamespaceImport, arbFileName, (importStatement, fileName) => {
        expect(() => extractWccImports(importStatement, fileName)).toThrowError();

        try {
          extractWccImports(importStatement, fileName);
        } catch (e) {
          expect(e.code).toBe('INVALID_WCC_IMPORT');
          expect(e.message).toContain(fileName);
        }
      }),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 9.5**
   *
   * For any named export import from a .wcc file, extractWccImports SHALL throw
   * an error with code 'INVALID_WCC_IMPORT' and a message containing the file name.
   */
  it('named export imports from .wcc files throw INVALID_WCC_IMPORT error', () => {
    fc.assert(
      fc.property(arbNamedExportImport, arbFileName, (importStatement, fileName) => {
        expect(() => extractWccImports(importStatement, fileName)).toThrowError();

        try {
          extractWccImports(importStatement, fileName);
        } catch (e) {
          expect(e.code).toBe('INVALID_WCC_IMPORT');
          expect(e.message).toContain(fileName);
        }
      }),
      { numRuns: 20 }
    );
  });
});
