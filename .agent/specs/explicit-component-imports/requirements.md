# Requirements Document

## Introduction

This feature replaces the current auto-detection of child components (by scanning for hyphenated tags in the template) with an explicit import system. Developers must import child components by name in the script block, and the import identifier becomes the PascalCase tag alias used in the template. This enables tree-shaking by bundlers and gives developers full control over which components are included in the compiled output.

## Glossary

- **Compiler**: The wcCompiler pipeline that transforms `.wcc` single-file components into native web component JavaScript files
- **SFC**: Single-File Component — a `.wcc` file containing `<script>`, `<template>`, and `<style>` blocks
- **Import_Resolver**: The compiler subsystem responsible for extracting named `.wcc` imports from the script block and mapping them to compiled `.js` output paths
- **Template_Resolver**: The compiler subsystem responsible for matching PascalCase tags in the template to imported component identifiers
- **Tag_Alias**: The PascalCase identifier used as the import name, which maps to a custom element tag in the template (e.g., `import Badge from './wcc-badge.wcc'` allows `<Badge />` in the template)
- **Component_Meta**: The `__meta` static property on a compiled component class containing metadata such as the registered custom element tag name
- **Side_Effect_Import**: An import statement without a named binding (e.g., `import './child.wcc'`) used to ensure a component is registered without referencing it in the template
- **Auto_Registration**: The pattern where each compiled component registers itself with `customElements.define` so it can be used directly in HTML via a script tag

## Requirements

### Requirement 1: Named Component Import Extraction

**User Story:** As a developer, I want to import child components by name in my script block, so that I have explicit control over which components are available in my template.

#### Acceptance Criteria

1. WHEN a `.wcc` file contains a named import from a `.wcc` path (e.g., `import WccBadge from './wcc-badge.wcc'`), THE Import_Resolver SHALL extract the import identifier and the source path
2. WHEN a `.wcc` file contains multiple named imports from `.wcc` paths, THE Import_Resolver SHALL extract all import identifiers and source paths
3. THE Import_Resolver SHALL accept any valid JavaScript identifier as the import name regardless of the source file name
4. WHEN the import source path has a `.wcc` extension, THE Import_Resolver SHALL rewrite the extension to `.js` in the compiled output
5. FOR ALL valid named `.wcc` imports, parsing the import then emitting the compiled import SHALL preserve the identifier name and produce a valid `.js` import path (round-trip property)

### Requirement 2: PascalCase Template Tag Resolution

**User Story:** As a developer, I want to use PascalCase tags in my template that resolve to my imported components, so that I can freely alias components without being tied to their registered tag name.

#### Acceptance Criteria

1. WHEN a PascalCase tag (e.g., `<Badge />` or `<WccBadge>...</WccBadge>`) appears in the template, THE Template_Resolver SHALL match it against the set of named `.wcc` imports from the script block
2. WHEN a PascalCase tag matches an imported identifier, THE Template_Resolver SHALL treat it as a child component usage and generate the appropriate registration and prop-binding code
3. THE Template_Resolver SHALL convert PascalCase tags to their corresponding import identifier using exact case matching (e.g., `<MyBadge />` matches `import MyBadge from ...`)
4. WHEN a PascalCase tag is self-closing (e.g., `<Badge />`), THE Template_Resolver SHALL handle it identically to an open/close pair (`<Badge></Badge>`)

### Requirement 3: Compiled Output — Child Registration

**User Story:** As a developer, I want the compiled output to register imported child components with `customElements.define` using the child's own tag metadata, so that the components work correctly at runtime.

#### Acceptance Criteria

1. WHEN a named `.wcc` import is resolved, THE Compiler SHALL emit an ES module import statement in the compiled output with the identifier name and `.js` extension path
2. WHEN a named `.wcc` import is used in the template, THE Compiler SHALL emit a guarded `customElements.define` call using the child component's `__meta.tag` property
3. THE Compiler SHALL guard the `customElements.define` call with `if (!customElements.get(ChildName.__meta.tag))` to prevent duplicate registration errors
4. WHEN multiple components import the same child, each compiled output SHALL independently contain the guarded registration call

### Requirement 4: Self-Registration for HTML Consumption

**User Story:** As a developer, I want each compiled component to auto-register itself, so that I can use it directly in HTML with a `<script type="module">` tag without additional setup.

#### Acceptance Criteria

1. THE Compiler SHALL emit a guarded `customElements.define` call at the end of each compiled component file for the component itself
2. THE Compiler SHALL guard the self-registration with `if (!customElements.get('tag-name'))` to prevent duplicate registration when the same component is imported by a parent
3. WHEN a compiled component is loaded directly via `<script type="module" src="dist/wcc-badge.js">`, THE component SHALL register itself and be usable in the HTML document

### Requirement 5: Removal of Auto-Detection

**User Story:** As a developer, I want the compiler to stop auto-detecting child components by tag name, so that only explicitly imported components are included in the bundle.

#### Acceptance Criteria

1. THE Compiler SHALL NOT scan the template for hyphenated tag names to auto-discover child components
2. THE Compiler SHALL NOT resolve child component source files by searching the filesystem based on tag name
3. WHEN a hyphenated tag name appears in the template without a corresponding import, THE Compiler SHALL treat it as a plain HTML custom element (no import or registration generated)
4. WHEN migrating from auto-detection to explicit imports, THE Compiler SHALL produce equivalent runtime behavior for components that are explicitly imported

### Requirement 6: Error on Unresolved PascalCase Tag

**User Story:** As a developer, I want the compiler to throw an error when I use a PascalCase tag that has no matching import, so that I catch typos and missing imports at compile time.

#### Acceptance Criteria

1. WHEN a PascalCase tag is used in the template and no matching named `.wcc` import exists in the script block, THE Compiler SHALL throw a compilation error
2. THE Compiler SHALL include the unresolved tag name in the error message
3. THE Compiler SHALL include the source file path in the error message
4. IF a PascalCase tag appears inside a conditional branch (`if`/`else-if`/`else`) or an `each` block, THE Compiler SHALL still validate it against the import list

### Requirement 7: Tree-Shaking Support

**User Story:** As a developer, I want unused components to be excluded from my production bundle, so that my application loads only the code it needs.

#### Acceptance Criteria

1. THE Compiler SHALL emit standard ES module import statements for child components so that bundlers can perform static analysis
2. WHEN a component is imported in the script block but never referenced in the template, THE Compiler SHALL still emit the import (the bundler decides whether to tree-shake it)
3. WHEN a component is never imported by any file in the project, a bundler performing tree-shaking SHALL be able to exclude it from the final bundle
4. FOR ALL compiled outputs, THE Compiler SHALL produce only static `import` declarations (no dynamic `import()`) for child component references

### Requirement 8: Side-Effect Import Support

**User Story:** As a developer, I want to use side-effect imports (`import './child.wcc'`) to ensure a component is registered without using it in my template, so that I can support scenarios like programmatic element creation.

#### Acceptance Criteria

1. WHEN a `.wcc` file contains a side-effect import (e.g., `import './child.wcc'`), THE Import_Resolver SHALL include it in the compiled output with the `.js` extension
2. THE Compiler SHALL NOT require a side-effect import to have a corresponding PascalCase tag in the template
3. WHEN a side-effect import is present, THE Compiler SHALL emit it as `import './child.js'` in the compiled output without any `customElements.define` call (the child self-registers)
4. THE Compiler SHALL support both named imports and side-effect imports in the same file

### Requirement 9: Import Parsing and Pretty-Printing

**User Story:** As a developer, I want the compiler to correctly parse all valid `.wcc` import forms and produce correct compiled import statements, so that the output is always syntactically valid.

#### Acceptance Criteria

1. THE Import_Resolver SHALL parse named default imports (`import Foo from './foo.wcc'`)
2. THE Import_Resolver SHALL parse side-effect imports (`import './foo.wcc'`)
3. THE Import_Resolver SHALL preserve relative path segments (e.g., `../shared/wcc-button.wcc` becomes `../shared/wcc-button.js`)
4. FOR ALL valid `.wcc` import statements, parsing then emitting the compiled form SHALL produce a syntactically valid ES module import (round-trip property)
5. THE Import_Resolver SHALL reject named exports or namespace imports from `.wcc` files (e.g., `import { Foo } from './foo.wcc'` or `import * as Foo from './foo.wcc'`) with a descriptive error
