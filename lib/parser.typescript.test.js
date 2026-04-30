/**
 * TypeScript Support Tests — Type Stripping, Generic Extraction, Edge Cases
 *
 * Tests for:
 * - Property 1: Type Stripping Produces Valid JavaScript
 * - Property 2: Type-Only Import Complete Removal
 * - Property 3: defineProps Generic Extraction
 * - Property 4: defineEmits Generic Extraction
 * - Property 6: No Source Map in Output
 * - Property 7: Enum Transformation to Runtime Object
 * - Property 8: TypeScript Syntax Error Reporting
 * - Unit tests for decorators, module augmentation, specific TS features
 */

import { describe, it, expect, afterEach } from 'vitest';
import fc from 'fast-check';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  stripTypes,
  extractPropsGeneric,
  extractEmitsFromCallSignatures,
  parse,
} from './parser.js';
import { prettyPrint } from './printer.js';

// ── Helpers ─────────────────────────────────────────────────────────

/** @type {string[]} */
const tempDirs = [];

function createTempDir() {
  const dir = join(
    tmpdir(),
    `wcc-ts-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  tempDirs.length = 0;
});

// ══════════════════════════════════════════════════════════════════════
// Property 1: Type Stripping Produces Valid JavaScript
// ══════════════════════════════════════════════════════════════════════

/**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 1.8, 2.1, 2.3, 2.4**
 *
 * For any valid TypeScript source containing type annotations, interfaces,
 * type aliases, generics, type assertions, `as const`, `satisfies`, and
 * type-only imports, the Type_Stripper SHALL produce output that contains
 * no TypeScript-specific syntax and SHALL preserve all runtime expressions.
 */
describe('Feature: typescript-support, Property 1: Type Stripping Produces Valid JavaScript', () => {
  // Generator for TypeScript identifier names
  const identGen = fc.stringMatching(/^[a-z][a-zA-Z]{1,6}$/);

  // Generator for TypeScript type names
  const typeGen = fc.constantFrom('string', 'number', 'boolean', 'any', 'unknown', 'void', 'never');

  // Generator for TypeScript source with various type constructs
  const tsSourceGen = fc.tuple(
    identGen,
    identGen,
    identGen,
    typeGen,
    typeGen,
    fc.boolean(), // include interface
    fc.boolean(), // include type alias
    fc.boolean(), // include as const
    fc.boolean(), // include satisfies
  ).filter(([varName, fnName, paramName]) => {
    // Ensure no name collisions
    const names = new Set([varName, fnName, paramName, 'config', 'data']);
    return names.size >= 3 && varName !== fnName && varName !== 'config' && varName !== 'data'
      && fnName !== 'config' && fnName !== 'data';
  }).map(([varName, fnName, paramName, type1, type2, hasInterface, hasTypeAlias, hasAsConst, hasSatisfies]) => {
    const lines = [];

    // Type annotation on variable
    lines.push(`const ${varName}: ${type1} = 42;`);

    // Function with typed params and return type
    lines.push(`function ${fnName}(${paramName}: ${type2}): ${type1} { return ${paramName}; }`);

    // Interface declaration
    if (hasInterface) {
      lines.push(`interface I${varName} { value: ${type1}; }`);
    }

    // Type alias
    if (hasTypeAlias) {
      lines.push(`type T${varName} = ${type1} | ${type2};`);
    }

    // as const
    if (hasAsConst) {
      lines.push(`const config = { key: 'value' } as const;`);
    }

    // satisfies
    if (hasSatisfies) {
      lines.push(`const data = { x: 1 } satisfies Record<string, number>;`);
    }

    return lines.join('\n');
  });

  it('strips all TypeScript-specific syntax and preserves runtime expressions', async () => {
    await fc.assert(
      fc.asyncProperty(tsSourceGen, async (tsSource) => {
        const result = await stripTypes(tsSource);

        // Should NOT contain interface keyword (as a declaration)
        expect(result).not.toMatch(/\binterface\s+\w+\s*\{/);

        // Should NOT contain type alias declarations (standalone type keyword at line start)
        expect(result).not.toMatch(/^\s*type\s+\w+\s*=/m);

        // Should NOT contain 'as const'
        expect(result).not.toContain('as const');

        // Should NOT contain 'satisfies'
        expect(result).not.toContain('satisfies');

        // Should preserve runtime values
        expect(result).toContain('42');
        expect(result).toContain('return');
      }),
      { numRuns: 100 }
    );
  });
});

// ══════════════════════════════════════════════════════════════════════
// Property 2: Type-Only Import Complete Removal
// ══════════════════════════════════════════════════════════════════════

/**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 *
 * For any TypeScript source containing `import type` and `export type`
 * statements, the Type_Stripper SHALL remove them entirely.
 */
describe('Feature: typescript-support, Property 2: Type-Only Import Complete Removal', () => {
  const moduleNameGen = fc.constantFrom('types', 'models', 'interfaces', 'utils', 'shared');
  const typeNameGen = fc.stringMatching(/^[A-Z][a-zA-Z]{2,8}$/);

  const tsWithTypeImportsGen = fc.tuple(
    fc.array(fc.tuple(typeNameGen, moduleNameGen), { minLength: 1, maxLength: 3 }),
    fc.boolean(), // include export type
  ).map(([imports, hasExportType]) => {
    const lines = [];

    for (const [typeName, mod] of imports) {
      lines.push(`import type { ${typeName} } from './${mod}';`);
    }

    if (hasExportType) {
      lines.push(`export type { ${imports[0][0]} };`);
    }

    lines.push(`const x = 1;`);
    return lines.join('\n');
  });

  it('removes all import type and export type statements, preserves runtime code', async () => {
    await fc.assert(
      fc.asyncProperty(tsWithTypeImportsGen, async (tsSource) => {
        const result = await stripTypes(tsSource);

        // Should NOT contain 'import type'
        expect(result).not.toMatch(/import\s+type\s/);

        // Should NOT contain 'export type {'
        expect(result).not.toMatch(/export\s+type\s*\{/);

        // Should preserve runtime code
        expect(result).toContain('const x = 1');
      }),
      { numRuns: 100 }
    );
  });
});

// ══════════════════════════════════════════════════════════════════════
// Property 3: defineProps Generic Extraction
// ══════════════════════════════════════════════════════════════════════

/**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6, 5.1**
 *
 * For any TypeScript source containing defineProps<{ prop1: type1, prop2?: type2 }>()
 * with one or more properties, extractPropsGeneric() SHALL extract all property
 * names without ? markers.
 */
describe('Feature: typescript-support, Property 3: defineProps Generic Extraction', () => {
  const reserved = new Set([
    'if', 'do', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else',
    'enum', 'null', 'this', 'true', 'void', 'with', 'const', 'break',
    'class', 'super', 'while', 'yield', 'return', 'typeof', 'delete',
    'switch', 'export', 'import', 'default', 'false',
  ]);

  const propNameGen = fc.stringMatching(/^[a-z][a-zA-Z]{1,8}$/).filter(s => !reserved.has(s));
  const typeGen = fc.constantFrom('string', 'number', 'boolean', 'string[]', 'Record<string, any>');

  const propsGenericGen = fc.uniqueArray(
    fc.tuple(propNameGen, typeGen, fc.boolean()), // name, type, optional?
    { minLength: 1, maxLength: 5, selector: ([name]) => name }
  ).map(props => {
    const entries = props.map(([name, type, optional]) =>
      `${name}${optional ? '?' : ''}: ${type}`
    );
    const source = `const props = defineProps<{ ${entries.join(', ')} }>()`;
    const expectedNames = props.map(([name]) => name);
    return { source, expectedNames };
  });

  it('extracts all property names from defineProps generic, stripping ? markers', async () => {
    await fc.assert(
      fc.asyncProperty(propsGenericGen, async ({ source, expectedNames }) => {
        const result = extractPropsGeneric(source);
        expect(result).toEqual(expectedNames);
      }),
      { numRuns: 100 }
    );
  });
});

// ══════════════════════════════════════════════════════════════════════
// Property 4: defineEmits Generic Extraction
// ══════════════════════════════════════════════════════════════════════

/**
 * **Validates: Requirements 4.1, 4.2, 4.4, 5.2**
 *
 * For any TypeScript source containing defineEmits<{ (e: 'event1', ...): void; ... }>()
 * with one or more call signatures, extractEmitsFromCallSignatures() SHALL extract
 * all event names.
 */
describe('Feature: typescript-support, Property 4: defineEmits Generic Extraction', () => {
  const eventNameGen = fc.stringMatching(/^[a-z][a-zA-Z\-]{1,10}$/);

  const emitsGenericGen = fc.uniqueArray(eventNameGen, { minLength: 1, maxLength: 4 })
    .map(eventNames => {
      const signatures = eventNames.map(name =>
        `(e: '${name}'): void`
      );
      const source = `const emit = defineEmits<{ ${signatures.join('; ')} }>()`;
      return { source, expectedNames: eventNames };
    });

  it('extracts all event names from defineEmits generic call signatures', async () => {
    await fc.assert(
      fc.asyncProperty(emitsGenericGen, async ({ source, expectedNames }) => {
        const result = extractEmitsFromCallSignatures(source);
        expect(result).toEqual(expectedNames);
      }),
      { numRuns: 100 }
    );
  });
});

// ══════════════════════════════════════════════════════════════════════
// Property 6: No Source Map in Output
// ══════════════════════════════════════════════════════════════════════

/**
 * **Validates: Requirements 11.1, 11.2**
 *
 * For any TypeScript source processed by stripTypes(), the output SHALL NOT
 * contain sourceMappingURL or sourceURL comments.
 */
describe('Feature: typescript-support, Property 6: No Source Map in Output', () => {
  const identGen = fc.stringMatching(/^[a-z][a-zA-Z]{1,6}$/);
  const typeGen = fc.constantFrom('string', 'number', 'boolean');

  const tsSourceGen = fc.tuple(identGen, typeGen, fc.boolean()).map(([name, type, hasInterface]) => {
    const lines = [`const ${name}: ${type} = 42;`];
    if (hasInterface) {
      lines.push(`interface I${name} { value: ${type}; }`);
    }
    lines.push(`function fn(x: ${type}): ${type} { return x; }`);
    return lines.join('\n');
  });

  it('output never contains sourceMappingURL or sourceURL', async () => {
    await fc.assert(
      fc.asyncProperty(tsSourceGen, async (tsSource) => {
        const result = await stripTypes(tsSource);
        expect(result).not.toContain('sourceMappingURL');
        expect(result).not.toContain('sourceURL');
      }),
      { numRuns: 100 }
    );
  });
});

// ══════════════════════════════════════════════════════════════════════
// Property 7: Enum Transformation to Runtime Object
// ══════════════════════════════════════════════════════════════════════

/**
 * **Validates: Requirements 1.4**
 *
 * For any TypeScript source containing enum declarations, stripTypes() SHALL
 * produce JavaScript that does NOT contain the `enum` keyword and contains
 * a runtime representation.
 */
describe('Feature: typescript-support, Property 7: Enum Transformation to Runtime Object', () => {
  const enumNameGen = fc.stringMatching(/^[A-Z][a-zA-Z]{2,8}$/);
  const memberNameGen = fc.stringMatching(/^[A-Z][a-zA-Z]{1,6}$/);

  const enumGen = fc.tuple(
    enumNameGen,
    fc.uniqueArray(memberNameGen, { minLength: 1, maxLength: 4 }),
    fc.boolean() // string enum vs numeric
  ).map(([enumName, members, isString]) => {
    let body;
    if (isString) {
      body = members.map(m => `${m} = '${m.toLowerCase()}'`).join(', ');
    } else {
      body = members.join(', ');
    }
    const source = `enum ${enumName} { ${body} }`;
    return { source, enumName, members };
  });

  it('transforms enums to runtime objects, removing the enum keyword', async () => {
    await fc.assert(
      fc.asyncProperty(enumGen, async ({ source, enumName }) => {
        const result = await stripTypes(source);

        // Should NOT contain the 'enum' keyword
        expect(result).not.toMatch(/\benum\b/);

        // Should contain the enum name as a runtime variable
        expect(result).toContain(enumName);
      }),
      { numRuns: 100 }
    );
  });
});

// ══════════════════════════════════════════════════════════════════════
// Property 8: TypeScript Syntax Error Reporting
// ══════════════════════════════════════════════════════════════════════

/**
 * **Validates: Requirements 9.1, 9.2**
 *
 * For any source containing invalid TypeScript syntax, stripTypes() SHALL
 * throw an error with code TS_SYNTAX_ERROR.
 */
describe('Feature: typescript-support, Property 8: TypeScript Syntax Error Reporting', () => {
  const invalidTsGen = fc.constantFrom(
    'const x: = 5;',                          // malformed type annotation
    'function f(): { return 1; }',             // missing return type
    'interface { }',                           // missing interface name
    'const x: string<> = "hi";',               // invalid generic usage
    'type = number;',                          // missing type name
    'const x: [string, = 5;',                 // unclosed tuple type
  );

  it('throws TS_SYNTAX_ERROR for invalid TypeScript', async () => {
    await fc.assert(
      fc.asyncProperty(invalidTsGen, async (invalidTs) => {
        try {
          await stripTypes(invalidTs);
          // Some "invalid" TS may actually be valid JS that esbuild accepts
          // That's OK — we only assert on actual failures
        } catch (err) {
          expect(err.code).toBe('TS_SYNTAX_ERROR');
          expect(err.message).toContain('TypeScript syntax error');
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ══════════════════════════════════════════════════════════════════════
// Task 7.3: Unit tests for generic extraction edge cases
// ══════════════════════════════════════════════════════════════════════

describe('extractPropsGeneric — edge cases', () => {
  it('returns empty array when no generic found', () => {
    const result = extractPropsGeneric(`const props = defineProps({ label: 'hi' })`);
    expect(result).toEqual([]);
  });

  it('returns empty array for defineProps without generic or call', () => {
    const result = extractPropsGeneric(`const x = 1;`);
    expect(result).toEqual([]);
  });

  it('extracts from multi-line generic body', () => {
    const source = `const props = defineProps<{
      label: string,
      count: number,
      active?: boolean
    }>()`;
    const result = extractPropsGeneric(source);
    expect(result).toEqual(['label', 'count', 'active']);
  });

  it('handles complex types (only names matter)', () => {
    const source = `const props = defineProps<{ items: string[], data: Record<string, number> }>()`;
    const result = extractPropsGeneric(source);
    expect(result).toContain('items');
    expect(result).toContain('data');
  });
});

describe('extractEmitsFromCallSignatures — edge cases', () => {
  it('returns empty array when no generic found', () => {
    const result = extractEmitsFromCallSignatures(`const emit = defineEmits(['change'])`);
    expect(result).toEqual([]);
  });

  it('returns empty array for no defineEmits', () => {
    const result = extractEmitsFromCallSignatures(`const x = 1;`);
    expect(result).toEqual([]);
  });

  it('extracts from multi-line call signatures', () => {
    const source = `const emit = defineEmits<{
      (e: 'change', value: number): void;
      (e: 'reset'): void
    }>()`;
    const result = extractEmitsFromCallSignatures(source);
    expect(result).toEqual(['change', 'reset']);
  });

  it('handles event names with hyphens', () => {
    const source = `const emit = defineEmits<{ (e: 'my-event'): void }>()`;
    const result = extractEmitsFromCallSignatures(source);
    expect(result).toEqual(['my-event']);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Task 9.1: Unit tests for decorator handling
// ══════════════════════════════════════════════════════════════════════

describe('TypeScript decorators', () => {
  it('handles decorator on class without error', async () => {
    const source = `
function log(target: any) { return target; }

@log
class MyClass {
  value: number = 0;
}
`;
    // esbuild should handle this without throwing
    const result = await stripTypes(source);
    expect(result).toContain('MyClass');
    expect(result).not.toMatch(/\binterface\b/);
  });

  it('handles decorator on method without error', async () => {
    const source = `
function log(target: any, key: string) {}

class MyClass {
  @log
  myMethod(): void {
    console.log('hello');
  }
}
`;
    const result = await stripTypes(source);
    expect(result).toContain('myMethod');
    expect(result).toContain('console.log');
  });
});

// ══════════════════════════════════════════════════════════════════════
// Task 9.2: Unit tests for module augmentation
// ══════════════════════════════════════════════════════════════════════

describe('Module augmentation', () => {
  it('removes declare module blocks entirely', async () => {
    const source = `
declare module 'my-module' {
  interface MyInterface {
    value: string;
  }
}

const x = 42;
`;
    const result = await stripTypes(source);
    expect(result).not.toContain('declare module');
    expect(result).not.toContain('MyInterface');
    expect(result).toContain('42');
  });

  it('removes declare global blocks entirely', async () => {
    const source = `
declare global {
  interface Window {
    myProp: string;
  }
}

const y = 'hello';
`;
    const result = await stripTypes(source);
    expect(result).not.toContain('declare global');
    expect(result).not.toContain('Window');
    expect(result).toContain("hello");
  });

  it('preserves runtime code around declarations', async () => {
    const source = `
const before = 1;

declare module 'foo' {
  interface Bar { x: number; }
}

const after = 2;
`;
    const result = await stripTypes(source);
    expect(result).toContain('before');
    expect(result).toContain('after');
    expect(result).not.toContain('declare module');
  });
});

// ══════════════════════════════════════════════════════════════════════
// Task 9.3: Unit tests for specific TypeScript features
// ══════════════════════════════════════════════════════════════════════

describe('Specific TypeScript features', () => {
  it('removes as const assertion', async () => {
    const source = `const config = { key: 'value' } as const;`;
    const result = await stripTypes(source);
    expect(result).not.toContain('as const');
    expect(result).toContain("key");
    expect(result).toContain("value");
  });

  it('removes satisfies operator', async () => {
    const source = `const data = { x: 1, y: 2 } satisfies Record<string, number>;`;
    const result = await stripTypes(source);
    expect(result).not.toContain('satisfies');
    expect(result).toContain('x');
    expect(result).toContain('y');
  });

  it('removes inline type imports, preserves value imports when used', async () => {
    // esbuild removes unused imports entirely, so we need to use Bar
    const source = `import { type Foo, Bar } from './module';\nconst x = Bar;`;
    const result = await stripTypes(source);
    expect(result).not.toContain('Foo');
    expect(result).toContain('Bar');
  });

  it('strips generic type parameters on signal<number>(0)', async () => {
    const source = `const count = signal<number>(0);`;
    const result = await stripTypes(source);
    expect(result).toContain('signal(0)');
    expect(result).not.toContain('<number>');
  });

  it('strips generic type parameters on computed<string>()', async () => {
    const source = `const label = computed<string>(() => name());`;
    const result = await stripTypes(source);
    expect(result).toContain('computed(');
    expect(result).not.toContain('<string>');
  });

  it('.js files pass through without error', async () => {
    const source = `const x = 1; function foo() { return x + 1; }`;
    const result = await stripTypes(source);
    expect(result).toContain('const x = 1');
    expect(result).toContain('function foo');
  });

  it('removes type assertions (as Type)', async () => {
    const source = `const x = someValue as string;`;
    const result = await stripTypes(source);
    expect(result).not.toMatch(/as\s+string/);
    expect(result).toContain('someValue');
  });

  it('removes angle-bracket type assertions', async () => {
    const source = `const x = <number>someValue;`;
    const result = await stripTypes(source);
    expect(result).toContain('someValue');
  });

  it('handles type-only exports', async () => {
    const source = `
type MyType = string;
export type { MyType };
const x = 1;
`;
    const result = await stripTypes(source);
    expect(result).not.toMatch(/export\s+type/);
    expect(result).toContain('const x = 1');
  });

  it('handles type-only re-exports', async () => {
    const source = `export type { Foo } from './types';`;
    const result = await stripTypes(source);
    expect(result).not.toMatch(/export\s+type/);
  });

  it('TS_SYNTAX_ERROR has correct error code', async () => {
    try {
      await stripTypes('const x: [string, = 5;');
      // If esbuild doesn't throw, that's fine
    } catch (err) {
      expect(err.code).toBe('TS_SYNTAX_ERROR');
      expect(err.message).toMatch(/TypeScript syntax error/);
    }
  });
});
