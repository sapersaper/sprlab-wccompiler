# Requirements Document — Nested Components

## Introduction

This document specifies the nested component feature for wcCompiler. When a component's template contains custom elements (tags with hyphens like `<wcc-badge>`), the compiler detects them, resolves their source files, generates import statements in the output, and creates reactive prop bindings for attributes containing `{{interpolation}}` expressions.

## Requirements

### Requirement 1: Child Component Detection

**User Story:** As a developer, I want the compiler to detect custom elements in my template, so that it knows which child components my component depends on.

#### Acceptance Criteria

1. THE Tree_Walker SHALL detect elements whose tag name contains a hyphen (custom elements per HTML spec)
2. THE Tree_Walker SHALL record each unique child component tag name found in the template
3. THE Tree_Walker SHALL extract attributes with `{{interpolation}}` patterns as reactive prop bindings
4. THE Tree_Walker SHALL extract static attributes (no interpolation) as static prop values
5. THE Tree_Walker SHALL record the DOM path to each child component instance for runtime reference

### Requirement 2: Source File Resolution

**User Story:** As a developer, I want the compiler to automatically find the source file for each child component, so that I don't have to manually import them.

#### Acceptance Criteria

1. THE Compiler SHALL search the input directory (recursively) for a `.js` or `.ts` file whose `defineComponent({ tag })` matches the child tag name
2. THE Compiler SHALL compute the relative import path from the current component's output location to the child component's output location
3. WHEN a child component source file cannot be found, THE Compiler SHALL emit a warning (not an error) — the component may be registered externally

### Requirement 3: Import Generation

**User Story:** As a developer, I want the compiled output to include import statements for child components, so that dependencies are resolved automatically.

#### Acceptance Criteria

1. THE Code_Generator SHALL generate `import './relative-path.js'` at the top of the output (after the reactive runtime, before the class)
2. THE Code_Generator SHALL generate one import per unique child component tag name
3. THE Code_Generator SHALL NOT duplicate imports when the same child component appears multiple times in the template

### Requirement 4: Reactive Prop Binding

**User Story:** As a developer, I want to pass reactive data to child components via attributes with `{{interpolation}}`, so that child components update when my data changes.

#### Acceptance Criteria

1. WHEN an attribute value contains `{{varName}}`, THE Code_Generator SHALL generate a reactive `__effect` that calls `setAttribute` on the child element when the variable changes
2. WHEN an attribute value is a plain string (no interpolation), THE attribute SHALL remain as-is in the template HTML (static, no effect needed)
3. THE reactive binding SHALL support signals, computeds, props, and constants as source variables
4. THE `{{interpolation}}` pattern in child component attributes SHALL be removed from the template HTML and replaced with an empty string (the effect sets the value at runtime)
