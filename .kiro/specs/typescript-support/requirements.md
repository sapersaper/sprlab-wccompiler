# Requirements Document

## Introduction

This document specifies the TypeScript support feature for wcCompiler v2. TypeScript support allows component authors to write their component source files in TypeScript (`.ts`) with full type annotations, generics, interfaces, type imports, enums, type assertions, `as const`, the `satisfies` operator, and module augmentation. The compiler strips types before regex parsing using esbuild's `transform()` API, enabling type-safe development without affecting the compilation output.

The core spec already mentions esbuild type stripping as a step in the parser. This spec covers the FULL TypeScript support surface including: type-only imports and exports, interface and type alias declarations, generic type parameters on `defineProps` and `defineEmits`, enum declarations, type assertions and casts, decorators (future-proofing), `as const` assertions, the `satisfies` operator, and module augmentation. Critically, this spec also covers the PRE-STRIP extraction of type information from `defineProps<T>()` and `defineEmits<T>()` generics — because after type stripping, the generic type parameters are lost.

## Glossary

- **Parser**: The module that reads a `.ts`/`.js` source file, detects `defineComponent()`, reactive declarations, and macro calls (defined in core spec)
- **Code_Generator**: The module that produces a self-contained `.js` file from the parsed intermediate representation (defined in core spec)
- **Type_Stripper**: The function that removes TypeScript type annotations from source code via `esbuild.transform(source, { loader: 'ts' })`, producing valid JavaScript
- **Generic_Type_Parameter**: A TypeScript type argument enclosed in angle brackets (e.g., `<{ label: string }>`) passed to a function call like `defineProps<T>()`
- **Type_Only_Import**: An import statement using `import type { ... } from '...'` or `import { type Foo } from '...'` syntax that imports only type information with no runtime value
- **Type_Only_Export**: An export statement using `export type { ... }` syntax that exports only type information
- **Props_Generic**: The TypeScript generic type parameter on `defineProps<{ name: type, ... }>()` that declares prop names and their types
- **Emits_Generic**: The TypeScript generic type parameter on `defineEmits<{ (e: 'event', ...): void }>()` that declares event names and their signatures
- **Component_Source**: A `.ts` or `.js` file that contains a `defineComponent()` call and reactive logic (defined in core spec)
- **Pretty_Printer**: The module that serializes a ParseResult IR back to valid source format for round-trip testing (defined in core spec)

## Requirements

### Requirement 1: Type Stripping via esbuild

**User Story:** As a component author, I want to write TypeScript with full type annotations in my component source, so that I get type safety during development without affecting the compiled output.

#### Acceptance Criteria

1. WHEN the Component_Source contains TypeScript type annotations (type parameters, return types, parameter types), THE Type_Stripper SHALL remove all type annotations and produce valid JavaScript
2. WHEN the Component_Source contains interface declarations, THE Type_Stripper SHALL remove them entirely
3. WHEN the Component_Source contains type alias declarations (`type Foo = ...`), THE Type_Stripper SHALL remove them entirely
4. WHEN the Component_Source contains enum declarations, THE Type_Stripper SHALL transform them to runtime JavaScript objects
5. WHEN the Component_Source contains type assertions (`value as Type` or `<Type>value`), THE Type_Stripper SHALL remove the type assertion syntax and preserve the value expression
6. WHEN the Component_Source contains `as const` assertions, THE Type_Stripper SHALL remove the `as const` suffix and preserve the value
7. WHEN the Component_Source contains the `satisfies` operator (`expr satisfies Type`), THE Type_Stripper SHALL remove the `satisfies Type` suffix and preserve the expression
8. WHEN the Component_Source contains generic type parameters on `signal<T>()`, `computed<T>()`, or other function calls, THE Type_Stripper SHALL remove the generic type parameters and preserve the function call

### Requirement 2: Type-Only Import Removal

**User Story:** As a component author, I want to use `import type` statements to import interfaces and types from other modules, so that I get type checking without any runtime import overhead.

#### Acceptance Criteria

1. WHEN the Component_Source contains `import type { ... } from '...'` statements, THE Type_Stripper SHALL remove them entirely
2. WHEN the Component_Source contains `import { type Foo, Bar } from '...'` (inline type imports), THE Type_Stripper SHALL remove the `type Foo` specifier and preserve the `Bar` import
3. WHEN the Component_Source contains `export type { ... }` statements, THE Type_Stripper SHALL remove them entirely
4. WHEN the Component_Source contains `export type { ... } from '...'` re-export statements, THE Type_Stripper SHALL remove them entirely

### Requirement 3: defineProps Generic Extraction (Pre-Strip)

**User Story:** As a component author, I want to declare prop types using `defineProps<{ name: type }>()` with TypeScript generics, so that I get type-safe props without repeating prop names in a runtime object.

#### Acceptance Criteria

1. WHEN the Component_Source contains `defineProps<{ name: type, ... }>()` with a Generic_Type_Parameter, THE Parser SHALL extract prop names from the generic BEFORE type stripping
2. WHEN the Props_Generic contains multiple properties (e.g., `<{ label: string, count: number }>`), THE Parser SHALL extract all property names
3. WHEN the Props_Generic contains optional properties (e.g., `<{ label?: string }>`), THE Parser SHALL extract the property name without the `?` marker
4. WHEN `defineProps` is called with BOTH a generic AND a runtime defaults object (e.g., `defineProps<{ label: string }>({ label: 'default' })`), THE Parser SHALL use the generic for prop names and the runtime object for default values
5. WHEN `defineProps` is called WITHOUT a generic (e.g., `defineProps({ label: 'default' })`), THE Parser SHALL fall back to extracting prop names from the runtime object keys (existing core behavior)
6. THE Parser SHALL store extracted prop names in the ParseResult regardless of whether they came from the generic or the runtime object

### Requirement 4: defineEmits Generic Extraction (Pre-Strip)

**User Story:** As a component author, I want to declare event types using `defineEmits<{ (e: 'event', ...): void }>()` with TypeScript generics, so that I get type-safe events without repeating event names at runtime.

#### Acceptance Criteria

1. WHEN the Component_Source contains `defineEmits<{ (e: 'eventName', ...): void }>()` with a Generic_Type_Parameter, THE Parser SHALL extract event names from the generic BEFORE type stripping
2. WHEN the Emits_Generic contains multiple call signatures (e.g., `<{ (e: 'change', value: number): void; (e: 'reset'): void }>`), THE Parser SHALL extract all event names
3. WHEN `defineEmits` is called WITHOUT a generic (e.g., `defineEmits()`), THE Parser SHALL produce an empty events list (existing core behavior)
4. THE Parser SHALL store extracted event names in the ParseResult regardless of whether they came from the generic or runtime declaration

### Requirement 5: Parser Ordering — Extract Before Strip

**User Story:** As a compiler developer, I want the parser to extract generic type information BEFORE stripping types, so that type-level prop and event declarations are not lost.

#### Acceptance Criteria

1. THE Parser SHALL extract Props_Generic type information from the raw TypeScript source BEFORE calling the Type_Stripper
2. THE Parser SHALL extract Emits_Generic type information from the raw TypeScript source BEFORE calling the Type_Stripper
3. AFTER extracting generic type information, THE Parser SHALL call the Type_Stripper to produce JavaScript, then continue with regex-based extraction of `defineComponent`, `signal`, `computed`, `effect`, and `function` declarations on the stripped output

### Requirement 6: File Extension Handling

**User Story:** As a component author, I want to use `.ts` file extensions for my components, so that my editor provides full TypeScript IntelliSense and type checking.

#### Acceptance Criteria

1. THE Parser SHALL accept both `.ts` and `.js` files as input without requiring any configuration flag
2. WHEN a `.js` file is provided, THE Type_Stripper SHALL still be applied (esbuild handles plain JS transparently)
3. THE Config loader SHALL use glob patterns that include both `*.ts` and `*.js` files (e.g., `input/**/*.{ts,js}`)
4. THE Config loader SHALL exclude `*.test.*` and `*.d.ts` files from compilation globs

### Requirement 7: Decorator Syntax (Future-Proofing)

**User Story:** As a component author, I want to use TypeScript decorators in my source without causing compilation errors, so that the compiler is forward-compatible with decorator-based patterns.

#### Acceptance Criteria

1. WHEN the Component_Source contains decorator syntax (`@decorator` on classes, methods, or properties), THE Type_Stripper SHALL remove or preserve them according to esbuild's default behavior without causing a compilation error
2. IF the Type_Stripper encounters an unsupported decorator syntax, THEN THE Parser SHALL report a descriptive error with the esbuild error message

### Requirement 8: Module Augmentation

**User Story:** As a component author, I want to use `declare module` blocks to augment module types, so that I can extend type definitions without affecting runtime behavior.

#### Acceptance Criteria

1. WHEN the Component_Source contains `declare module '...' { ... }` blocks, THE Type_Stripper SHALL remove them entirely
2. WHEN the Component_Source contains `declare global { ... }` blocks, THE Type_Stripper SHALL remove them entirely

### Requirement 9: Error Handling

**User Story:** As a component author, I want clear error messages when my TypeScript has syntax errors, so that I can fix issues quickly.

#### Acceptance Criteria

1. IF the Type_Stripper encounters a TypeScript syntax error, THEN THE Parser SHALL report an error with code `TS_SYNTAX_ERROR` containing the esbuild error message and the source file path
2. IF the Type_Stripper encounters an unsupported TypeScript feature, THEN THE Parser SHALL report an error with code `TS_UNSUPPORTED_FEATURE` containing a descriptive message

### Requirement 10: Pretty-Printer Round-Trip

**User Story:** As a compiler developer, I want the pretty-printer to handle TypeScript-originated ParseResults correctly, so that round-trip testing verifies parsing correctness for TypeScript sources.

#### Acceptance Criteria

1. FOR ALL valid TypeScript Component_Source inputs, parsing (which includes type stripping) then printing then parsing the printed output SHALL produce an equivalent intermediate representation
2. THE Pretty_Printer SHALL emit JavaScript (post-strip) format, since type information is not preserved in the ParseResult IR
3. WHEN the ParseResult contains prop names extracted from a Props_Generic, THE Pretty_Printer SHALL emit them as a `defineProps({ name: undefined, ... })` call (runtime object format, since the generic is lost after stripping)

### Requirement 11: No Source Map Generation

**User Story:** As a compiler developer, I want the type stripping step to NOT generate source maps, so that the zero-runtime philosophy is maintained and output remains simple to debug directly.

#### Acceptance Criteria

1. THE Type_Stripper SHALL call esbuild with source map generation disabled
2. THE compiled output SHALL NOT contain any source map references or `//# sourceMappingURL` comments

</content>
</invoke>