# Requirements Document

## Introduction

This document specifies the core infrastructure of wcCompiler v2 — a zero-runtime compiler that transforms `.ts`/`.js` component files into self-contained native Web Components. The core spec covers the complete compilation pipeline: reading TypeScript/JavaScript source files, resolving external template and style references, reactive primitives (signal, computed, effect), template engine base (interpolation and event binding), CSS scoping, inline reactive runtime generation, code generation of HTMLElement classes, CLI commands, configuration loading, and type declarations.

## Glossary

- **Compiler**: The main orchestration module that integrates Parser, Tree_Walker, CSS_Scoper, and Code_Generator into a single `compile(filePath)` pipeline
- **Parser**: The module that reads a `.ts`/`.js` source file, detects `defineComponent()`, `signal()`, `computed()`, `effect()`, and function declarations, and resolves external template/styles paths
- **Tree_Walker**: The module that traverses a jsdom DOM tree to discover `{{interpolation}}` bindings and `@event` bindings, producing path-based metadata
- **CSS_Scoper**: The module that prefixes CSS selectors with the component tag name to achieve style isolation
- **Code_Generator**: The module that produces a self-contained `.js` file containing the inline reactive runtime, scoped CSS injection, HTMLElement class definition, and `customElements.define` registration
- **Reactive_Runtime**: The inline JavaScript code (~40 lines) that implements `__signal`, `__computed`, and `__effect` primitives in the compiled output
- **CLI**: The command-line interface providing `wcc build` and `wcc dev` commands
- **Config_Loader**: The module that reads and validates `wcc.config.js` with port, input, and output settings
- **Dev_Server**: The HTTP server with file watching and polling-based live-reload for development
- **Component_Source**: A `.ts` or `.js` file that contains a `defineComponent()` call and reactive logic
- **Template_File**: An `.html` file referenced by `defineComponent({ template: './path.html' })` containing the component markup
- **Styles_File**: A `.css` file referenced by `defineComponent({ styles: './path.css' })` containing the component styles
- **Signal**: A reactive primitive created via `signal(value)` that holds mutable state; read with `x()`, written with `x.set(value)`
- **Computed**: A derived reactive value created via `computed(() => expr)` that caches its result and auto-invalidates when dependencies change; read with `x()`
- **Effect**: A side-effect function created via `effect(() => { ... })` that auto-tracks signal/computed dependencies and re-runs when they change
- **Interpolation**: A `{{variableName}}` expression in a template that binds a text node to a reactive value
- **Event_Binding**: An `@event="handler"` attribute in a template that binds a DOM event to a function declared in the component script
- **Tag_Name**: The custom element name (e.g., `wcc-counter`) derived from `defineComponent({ tag: '...' })`

## Requirements

### Requirement 1: Component Source Parsing

**User Story:** As a developer, I want to write my component logic in a `.ts` or `.js` file using `defineComponent()`, `signal()`, `computed()`, and `effect()`, so that the compiler can extract all metadata and reactive declarations from a single source file.

#### Acceptance Criteria

1. WHEN a Component_Source file containing a `defineComponent({ tag, template, styles })` call is provided, THE Parser SHALL extract the tag name, template path, and styles path from the object literal
2. WHEN the Parser extracts a template path, THE Parser SHALL resolve the path relative to the Component_Source file location and read the Template_File contents
3. WHEN the Parser extracts a styles path, THE Parser SHALL resolve the path relative to the Component_Source file location and read the Styles_File contents
4. WHEN the Component_Source contains `signal(value)` declarations, THE Parser SHALL extract each variable name and initial value
5. WHEN the Component_Source contains `computed(() => expr)` declarations, THE Parser SHALL extract each variable name and expression body
6. WHEN the Component_Source contains `effect(() => { ... })` declarations, THE Parser SHALL extract each effect body
7. WHEN the Component_Source contains top-level function declarations, THE Parser SHALL extract each function name, parameters, and body
8. WHEN the Component_Source file has a `.ts` extension, THE Parser SHALL strip TypeScript type annotations using esbuild before extracting reactive declarations
9. IF the `defineComponent()` call is missing from the Component_Source, THEN THE Parser SHALL return a descriptive error with code `MISSING_DEFINE_COMPONENT`
10. IF the template path in `defineComponent()` cannot be resolved to an existing file, THEN THE Parser SHALL return a descriptive error with code `TEMPLATE_NOT_FOUND`
11. IF the styles path in `defineComponent()` cannot be resolved to an existing file, THEN THE Parser SHALL return a descriptive error with code `STYLES_NOT_FOUND`
12. WHEN the Component_Source contains `import { ... } from 'wcc'` statements, THE Parser SHALL strip them before processing since they are macro imports for IDE support only

### Requirement 2: Template Engine Base

**User Story:** As a developer, I want to use `{{variable}}` interpolation and `@event="handler"` bindings in my HTML template, so that my component renders reactive data and responds to user interactions.

#### Acceptance Criteria

1. WHEN a Template_File contains `{{variableName}}` expressions, THE Tree_Walker SHALL discover each interpolation and record the DOM path, variable name, and binding type (signal, computed, or function result)
2. WHEN a Template_File contains `@event="handler"` attributes on elements, THE Tree_Walker SHALL discover each event binding and record the DOM path, event name, and handler function name
3. WHEN an interpolation `{{name}}` is the sole content of a parent element, THE Tree_Walker SHALL bind directly to the parent element text content
4. WHEN an interpolation `{{name}}` is mixed with other text or multiple interpolations exist in the same text node, THE Tree_Walker SHALL split the text node into separate span elements for each binding
5. THE Tree_Walker SHALL remove `@event` attributes from the processed template DOM after recording them
6. IF a `{{variableName}}` references a name not declared as a signal, computed, or function in the Component_Source, THEN THE Compiler SHALL report a warning identifying the undeclared binding

### Requirement 3: Reactive Runtime

**User Story:** As a developer, I want the compiled output to include an inline reactive runtime so that signals, computeds, and effects work without any external dependencies.

#### Acceptance Criteria

1. THE Reactive_Runtime SHALL implement a `__signal(initialValue)` function that returns a getter/setter function with subscriber tracking
2. THE Reactive_Runtime SHALL implement a `__computed(fn)` function that returns a cached getter which auto-invalidates when tracked dependencies change
3. THE Reactive_Runtime SHALL implement an `__effect(fn)` function that executes `fn` immediately and re-executes it whenever tracked dependencies change
4. WHEN a signal value is read inside an effect or computed, THE Reactive_Runtime SHALL automatically track the dependency relationship
5. WHEN a signal value is set to a new value different from the current value, THE Reactive_Runtime SHALL notify all subscribers synchronously
6. WHEN a signal value is set to the same value as the current value, THE Reactive_Runtime SHALL skip notification to subscribers
7. THE Reactive_Runtime SHALL be inlined as a string literal at the top of each compiled component output, requiring zero external imports

### Requirement 4: CSS Scoping

**User Story:** As a developer, I want my component styles to be automatically scoped to my component, so that they do not leak into or conflict with other components on the page.

#### Acceptance Criteria

1. WHEN a Styles_File is provided, THE CSS_Scoper SHALL prefix every CSS selector with the component Tag_Name
2. WHEN a selector contains comma-separated parts, THE CSS_Scoper SHALL prefix each part independently with the Tag_Name
3. WHILE processing `@media` or other nesting at-rules, THE CSS_Scoper SHALL recursively scope selectors inside the at-rule block
4. WHILE processing `@keyframes` at-rules, THE CSS_Scoper SHALL preserve keyframe stop names without prefixing
5. THE CSS_Scoper SHALL preserve statement at-rules (e.g., `@import`, `@charset`) without modification
6. IF the styles content is empty or whitespace-only, THEN THE CSS_Scoper SHALL return an empty string

### Requirement 5: Code Generation

**User Story:** As a developer, I want the compiler to generate a self-contained JavaScript file that defines my Web Component as a native HTMLElement class, so that it works in any browser without build tools at runtime.

#### Acceptance Criteria

1. THE Code_Generator SHALL produce a JavaScript file containing: the inline Reactive_Runtime, scoped CSS injection into `document.head`, a template element, an HTMLElement class definition, and a `customElements.define` registration
2. WHEN signals are declared in the Component_Source, THE Code_Generator SHALL generate `__signal(initialValue)` calls in the constructor for each signal
3. WHEN computeds are declared in the Component_Source, THE Code_Generator SHALL generate `__computed(() => expr)` calls in the constructor for each computed
4. WHEN effects are declared in the Component_Source, THE Code_Generator SHALL generate `__effect(() => { ... })` calls in the `connectedCallback` for each effect
5. WHEN interpolation bindings exist in the template, THE Code_Generator SHALL generate effects that update the corresponding DOM text content when the bound value changes
6. WHEN event bindings exist in the template, THE Code_Generator SHALL generate `addEventListener` calls in the `connectedCallback` that invoke the declared handler functions
7. THE Code_Generator SHALL generate a `connectedCallback` that clones the template, sets up reactive effects, and appends the DOM to the element
8. THE Code_Generator SHALL generate a `customElements.define(tagName, ClassName)` call at the end of the output file
9. WHEN styles are provided, THE Code_Generator SHALL inject a `<style>` element into `document.head` with the scoped CSS content

### Requirement 6: CLI Commands

**User Story:** As a developer, I want `wcc build` and `wcc dev` commands so that I can compile my components for production or develop with live-reload.

#### Acceptance Criteria

1. WHEN `wcc build` is executed, THE CLI SHALL discover all `*.ts` and `*.js` files in the configured input directory, excluding files matching `*.test.*` and `*.d.ts`
2. WHEN `wcc build` is executed, THE CLI SHALL compile each discovered Component_Source file and write the output `.js` file to the configured output directory
3. WHEN `wcc dev` is executed, THE CLI SHALL perform an initial build, start the Dev_Server, and watch the input directory for file changes
4. WHEN a file change is detected during `wcc dev`, THE CLI SHALL recompile the changed file and trigger a live-reload in connected browsers
5. IF a compilation error occurs during `wcc build`, THEN THE CLI SHALL print the error message to stderr and exit with a non-zero exit code
6. IF a compilation error occurs during `wcc dev`, THEN THE CLI SHALL print the error message to stderr and continue watching for further changes

### Requirement 7: Configuration

**User Story:** As a developer, I want to configure the compiler via a `wcc.config.js` file so that I can customize the port, input directory, and output directory for my project.

#### Acceptance Criteria

1. WHEN a `wcc.config.js` file exists in the project root, THE Config_Loader SHALL read and apply its `port`, `input`, and `output` properties
2. WHEN `wcc.config.js` does not exist in the project root, THE Config_Loader SHALL use default values: port `4100`, input `src`, output `dist`
3. IF the `port` property is not a finite number, THEN THE Config_Loader SHALL throw an error describing the invalid value
4. IF the `input` property is not a non-empty string, THEN THE Config_Loader SHALL throw an error describing the invalid value
5. IF the `output` property is not a non-empty string, THEN THE Config_Loader SHALL throw an error describing the invalid value

### Requirement 8: Dev Server

**User Story:** As a developer, I want a development server with live-reload so that I can see my component changes reflected in the browser immediately.

#### Acceptance Criteria

1. WHEN the Dev_Server is started, THE Dev_Server SHALL serve static files from the project root directory with correct MIME types
2. WHEN an HTML file is served, THE Dev_Server SHALL inject a polling-based live-reload script before the closing `</body>` tag
3. WHEN the output directory changes, THE Dev_Server SHALL update an internal timestamp so that polling clients detect the change and reload
4. WHEN a client requests the `/__poll` endpoint, THE Dev_Server SHALL respond with a JSON object containing the current change timestamp
5. IF a requested file does not exist, THEN THE Dev_Server SHALL respond with HTTP status 404

### Requirement 9: Type Declarations

**User Story:** As a developer, I want TypeScript type declarations for the `wcc` module so that I get full IntelliSense and type checking when authoring components.

#### Acceptance Criteria

1. THE Compiler SHALL provide a `types/wcc.d.ts` file declaring the `wcc` module with type signatures for `signal`, `computed`, `effect`, and `defineComponent`
2. THE type declaration for `signal` SHALL declare that `signal<T>(value: T)` returns an object with a call signature `() => T` for reading and a `set(value: T) => void` method for writing
3. THE type declaration for `computed` SHALL declare that `computed<T>(fn: () => T)` returns a call signature `() => T` (read-only)
4. THE type declaration for `effect` SHALL declare that `effect(fn: () => void)` returns `void`
5. THE type declaration for `defineComponent` SHALL declare that it accepts an object with `tag: string`, `template: string`, and optional `styles: string` properties

### Requirement 10: Compiler Pipeline Orchestration

**User Story:** As a developer, I want a single `compile(filePath)` function that orchestrates the entire pipeline from source file to output JavaScript, so that each module is integrated correctly.

#### Acceptance Criteria

1. WHEN `compile(filePath)` is called with a valid Component_Source path, THE Compiler SHALL execute the pipeline in order: parse source → resolve and read template → resolve and read styles → walk template DOM → scope CSS → generate output
2. WHEN the pipeline completes successfully, THE Compiler SHALL return the generated JavaScript string
3. IF any step in the pipeline produces an error, THEN THE Compiler SHALL propagate the error with a descriptive message and error code identifying the failing step

### Requirement 11: Parser Pretty-Printer (Round-Trip)

**User Story:** As a developer of the compiler, I want a pretty-printer that can serialize the parsed intermediate representation back into a valid Component_Source format, so that I can verify parsing correctness via round-trip testing.

#### Acceptance Criteria

1. THE Pretty_Printer SHALL format a parsed intermediate representation back into a valid `.ts`/`.js` source string containing `defineComponent()`, signal declarations, computed declarations, effect declarations, and function declarations
2. FOR ALL valid Component_Source inputs, parsing then printing then parsing SHALL produce an equivalent intermediate representation (round-trip property)
