# Implementation Plan — Nested Components

## Tasks

- [x] 1. Add types
  - [x] 1.1 Add `ChildPropBinding`, `ChildComponentBinding`, `ChildComponentImport` typedefs to `lib/types.js`
  - [x] 1.2 Add `childComponents: ChildComponentBinding[]` and `childImports: ChildComponentImport[]` to ParseResult

- [x] 2. Tree Walker — detect child components
  - [x] 2.1 In `walkTree()`, detect elements whose tag contains a hyphen (custom elements)
  - [x] 2.2 For each custom element, scan attributes for `{{expr}}` patterns
  - [x] 2.3 Record `ChildComponentBinding` with tag, varName, path, propBindings
  - [x] 2.4 Clear the `{{expr}}` from the attribute value in the DOM (effect sets it at runtime)
  - [x] 2.5 Return `childComponents` from walkTree

- [x] 3. Compiler — resolve child source files
  - [x] 3.1 After walkTree, collect unique child tag names from `childComponents`
  - [x] 3.2 For each tag, search the input directory for a `.js`/`.ts` file containing `defineComponent({ tag: 'tag-name' })`
  - [x] 3.3 Compute relative import path from current output file to child output file
  - [x] 3.4 Build `childImports` array and merge into ParseResult
  - [x] 3.5 Warn (not error) when a child component source file is not found

- [x] 4. Code Generator — imports and reactive bindings
  - [x] 4.1 Generate `import './path.js'` for each childImport (after runtime, before CSS)
  - [x] 4.2 Generate DOM ref for each child component instance in constructor
  - [x] 4.3 Generate `__effect` in connectedCallback for each reactive prop binding
  - [x] 4.4 Use `transformExpr` to resolve signal/computed/prop/constant references in binding expressions

- [x] 5. Tests
  - [x] 5.1 Tree walker: detects custom elements, extracts prop bindings, clears interpolations
  - [x] 5.2 Codegen: generates imports, DOM refs, reactive effects
  - [x] 5.3 Integration: end-to-end compile with nested components

- [ ] 6. Update example
  - [x] 6.1 Fix `example/src/nested/wcc-profile.html` to work with the new feature
  - [x] 6.2 Add nested components section to `example/index.html`
  - [x] 6.3 Update FEATURES.md
