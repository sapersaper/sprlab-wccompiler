/**
 * Property-based tests for import-resolver.js
 *
 * Property 1: Named import round-trip
 * For any valid named `.wcc` import statement (with any valid JavaScript identifier
 * and any relative `.wcc` path), parsing the import and emitting the compiled form
 * SHALL preserve the identifier name exactly and produce a path identical to the
 * original except with `.wcc` replaced by `.js`.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 9.1, 9.3, 9.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { extractWccImports } from './import-resolver.js';

// ── Arbitraries ──────────────────────────────────────────────────────

/**
 * Generate a valid PascalCase identifier:
 * - Starts with an uppercase letter (A-Z)
 * - Followed by one or more alphanumeric characters or underscores
 * - Must not be a reserved word (unlikely with PascalCase, but safe)
 */
const pascalCaseIdentifier = fc
  .tuple(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    fc.array(
      fc.oneof(
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
        fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
        fc.constantFrom(...'0123456789'.split('')),
        fc.constant('_')
      ),
      { minLength: 1, maxLength: 20 }
    )
  )
  .map(([first, rest]) => first + rest.join(''));

/**
 * Generate a valid path segment (no slashes, no dots at start, valid filename chars).
 * Segments are lowercase letters, digits, hyphens, and underscores.
 */
const pathSegment = fc
  .tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.array(
      fc.oneof(
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
        fc.constantFrom(...'0123456789'.split('')),
        fc.constant('-'),
        fc.constant('_')
      ),
      { minLength: 0, maxLength: 15 }
    )
  )
  .map(([first, rest]) => first + rest.join(''));

/**
 * Generate a valid relative `.wcc` path:
 * - Starts with './' or '../' (possibly multiple '../' segments)
 * - Contains one or more valid path segments separated by '/'
 * - Ends with '.wcc'
 */
const relativeWccPath = fc
  .tuple(
    fc.oneof(
      fc.constant('./'),
      fc.constant('../'),
      fc.constant('../../'),
      fc.constant('../../../')
    ),
    fc.array(pathSegment, { minLength: 0, maxLength: 3 }),
    pathSegment
  )
  .map(([prefix, middleSegments, fileName]) => {
    const middle = middleSegments.length > 0 ? middleSegments.join('/') + '/' : '';
    return `${prefix}${middle}${fileName}.wcc`;
  });

/**
 * Generate a quote style (single or double).
 */
const quoteStyle = fc.constantFrom("'", '"');

// ── Property Tests ───────────────────────────────────────────────────

describe('Feature: explicit-component-imports, Property 1: Named import round-trip', () => {
  it('parsing a named .wcc import preserves the identifier name exactly and produces a .js path', () => {
    fc.assert(
      fc.property(
        pascalCaseIdentifier,
        relativeWccPath,
        quoteStyle,
        (identifier, wccPath, quote) => {
          // Construct a valid named import statement
          const importStatement = `import ${identifier} from ${quote}${wccPath}${quote}`;
          const source = `${importStatement}\n`;

          // Parse the import
          const result = extractWccImports(source, 'test-file.wcc');

          // Should extract exactly one named import
          expect(result.named).toHaveLength(1);
          expect(result.sideEffect).toHaveLength(0);

          const extracted = result.named[0];

          // Identifier is preserved exactly
          expect(extracted.identifier).toBe(identifier);

          // Source path is preserved exactly
          expect(extracted.sourcePath).toBe(wccPath);

          // Compiled path is the same as source but with .wcc → .js
          const expectedCompiledPath = wccPath.replace(/\.wcc$/, '.js');
          expect(extracted.compiledPath).toBe(expectedCompiledPath);

          // The compiled path ends with .js
          expect(extracted.compiledPath).toMatch(/\.js$/);

          // The compiled path does NOT contain .wcc
          expect(extracted.compiledPath).not.toContain('.wcc');

          // The stripped source should not contain the import line
          expect(result.strippedSource.trim()).toBe('');
        }
      ),
      { numRuns: 20 }
    );
  });

  it('parsing multiple named .wcc imports preserves all identifiers and produces .js paths', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(pascalCaseIdentifier, relativeWccPath, quoteStyle),
          { minLength: 2, maxLength: 5 }
        ),
        (imports) => {
          // Ensure unique identifiers to avoid ambiguity
          const uniqueIdentifiers = new Set(imports.map(([id]) => id));
          fc.pre(uniqueIdentifiers.size === imports.length);

          // Construct source with multiple imports
          const source = imports
            .map(([id, path, quote]) => `import ${id} from ${quote}${path}${quote}`)
            .join('\n') + '\n';

          // Parse
          const result = extractWccImports(source, 'multi-import.wcc');

          // Should extract all named imports
          expect(result.named).toHaveLength(imports.length);
          expect(result.sideEffect).toHaveLength(0);

          // Each import should be preserved correctly
          for (let i = 0; i < imports.length; i++) {
            const [expectedId, expectedPath] = imports[i];
            const extracted = result.named[i];

            expect(extracted.identifier).toBe(expectedId);
            expect(extracted.sourcePath).toBe(expectedPath);
            expect(extracted.compiledPath).toBe(expectedPath.replace(/\.wcc$/, '.js'));
          }

          // Stripped source should be empty (only import lines)
          expect(result.strippedSource.trim()).toBe('');
        }
      ),
      { numRuns: 20 }
    );
  });

  it('relative path segments are preserved in the compiled path (only extension changes)', () => {
    fc.assert(
      fc.property(
        pascalCaseIdentifier,
        relativeWccPath,
        (identifier, wccPath) => {
          const source = `import ${identifier} from '${wccPath}'\n`;
          const result = extractWccImports(source, 'test.wcc');

          const extracted = result.named[0];

          // The path prefix (everything before .wcc) is preserved
          const pathWithoutExt = wccPath.slice(0, -4); // remove '.wcc'
          expect(extracted.compiledPath).toBe(pathWithoutExt + '.js');

          // Relative segments are intact
          if (wccPath.startsWith('../')) {
            expect(extracted.compiledPath).toMatch(/^\.\.\//);
          } else if (wccPath.startsWith('./')) {
            expect(extracted.compiledPath).toMatch(/^\.\//);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ── Property 11: Invalid import form rejection ───────────────────────

/**
 * Property 11: Invalid import form rejection
 *
 * For any `.wcc` import using named exports (`import { Foo } from './foo.wcc'`)
 * or namespace imports (`import * as Foo from './foo.wcc'`), the compiler SHALL
 * throw an error with a descriptive message and `.code === 'INVALID_WCC_IMPORT'`.
 *
 * **Validates: Requirements 9.5**
 */

// ── Arbitraries for invalid import forms ─────────────────────────────

/**
 * Generate a valid JavaScript identifier (for use in invalid import forms).
 * Starts with a letter or underscore, followed by alphanumeric or underscore.
 */
const jsIdentifier = fc
  .tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_'.split('')),
    fc.array(
      fc.oneof(
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
        fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
        fc.constantFrom(...'0123456789'.split('')),
        fc.constant('_')
      ),
      { minLength: 0, maxLength: 15 }
    )
  )
  .map(([first, rest]) => first + rest.join(''));

/**
 * Generate a list of 1-3 unique identifiers for named export destructuring.
 */
const namedExportIdentifiers = fc
  .array(jsIdentifier, { minLength: 1, maxLength: 3 })
  .filter((ids) => new Set(ids).size === ids.length);

/**
 * Generate a namespace import statement: `import * as Foo from './path.wcc'`
 */
const namespaceImportStatement = fc
  .tuple(jsIdentifier, relativeWccPath, quoteStyle)
  .map(([id, path, quote]) => `import * as ${id} from ${quote}${path}${quote}`);

/**
 * Generate a named-export import statement: `import { Foo } from './path.wcc'`
 * or `import { Foo, Bar } from './path.wcc'`
 */
const namedExportImportStatement = fc
  .tuple(namedExportIdentifiers, relativeWccPath, quoteStyle)
  .map(([ids, path, quote]) => `import { ${ids.join(', ')} } from ${quote}${path}${quote}`);

/**
 * Generate any invalid .wcc import form (either namespace or named-export).
 */
const invalidWccImportStatement = fc.oneof(
  namespaceImportStatement,
  namedExportImportStatement
);

// ── Property 11 Tests ────────────────────────────────────────────────

describe('Feature: explicit-component-imports, Property 11: Invalid import form rejection', () => {
  it('namespace imports from .wcc files throw INVALID_WCC_IMPORT error', () => {
    fc.assert(
      fc.property(
        jsIdentifier,
        relativeWccPath,
        quoteStyle,
        (identifier, wccPath, quote) => {
          const source = `import * as ${identifier} from ${quote}${wccPath}${quote}\n`;

          expect(() => extractWccImports(source, 'test-file.wcc')).toThrow();

          try {
            extractWccImports(source, 'test-file.wcc');
          } catch (error) {
            // Error must have the correct code
            expect(error.code).toBe('INVALID_WCC_IMPORT');
            // Error message must be descriptive (contains the file name)
            expect(error.message).toContain('test-file.wcc');
            // Error message mentions what forms are valid
            expect(error.message).toContain('default imports');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('named-export imports from .wcc files throw INVALID_WCC_IMPORT error', () => {
    fc.assert(
      fc.property(
        namedExportIdentifiers,
        relativeWccPath,
        quoteStyle,
        (identifiers, wccPath, quote) => {
          const destructured = identifiers.join(', ');
          const source = `import { ${destructured} } from ${quote}${wccPath}${quote}\n`;

          expect(() => extractWccImports(source, 'component.wcc')).toThrow();

          try {
            extractWccImports(source, 'component.wcc');
          } catch (error) {
            // Error must have the correct code
            expect(error.code).toBe('INVALID_WCC_IMPORT');
            // Error message must be descriptive (contains the file name)
            expect(error.message).toContain('component.wcc');
            // Error message mentions what forms are valid
            expect(error.message).toContain('default imports');
            expect(error.message).toContain('side-effect imports');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('any invalid .wcc import form throws INVALID_WCC_IMPORT regardless of path or identifier', () => {
    fc.assert(
      fc.property(
        invalidWccImportStatement,
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => /^[\w./-]+$/.test(s)),
        (importLine, fileName) => {
          const source = `${importLine}\n`;
          const testFileName = `${fileName}.wcc`;

          expect(() => extractWccImports(source, testFileName)).toThrow();

          try {
            extractWccImports(source, testFileName);
          } catch (error) {
            expect(error.code).toBe('INVALID_WCC_IMPORT');
            expect(error.message).toContain(testFileName);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
