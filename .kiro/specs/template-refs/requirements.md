# Requirements Document

## Introduction

This document specifies the `templateRef` template refs feature for wcCompiler v2. Template refs allow component authors to get direct references to DOM elements in their template. The `ref="name"` attribute in the template marks an element, and `templateRef('name')` in the script provides access to that element after mounting. The ref object exposes a `.value` property that holds the DOM element reference. This feature builds on the core spec (signal, computed, effect, defineComponent, template engine base with `{{interpolation}}` and `@event`, CSS scoping, CLI).

## Glossary

- **Parser**: The module that reads a `.ts`/`.js` source file and extracts declarations (defined in core spec)
- **Tree_Walker**: The module that traverses a jsdom DOM tree to discover bindings, events, and directives (defined in core spec)
- **Code_Generator**: The module that produces a self-contained `.js` file from the parsed intermediate representation (defined in core spec)
- **Compiler**: The pipeline orchestrator that coordinates Parser, Tree_Walker, and Code_Generator (defined in core spec)
- **RefDeclaration**: The data structure produced by the Parser representing a `templateRef('name')` call in the component source, containing the variable name and the ref name
- **RefBinding**: The data structure produced by the Tree_Walker representing a `ref="name"` attribute on a template element, containing the ref name and the DOM path to the element
- **Ref_Object**: The object returned by the generated getter property, containing a `.value` property that holds the DOM element reference
- **DOM_Path**: An array of `childNodes[n]` segments from the template root to a specific element (defined in core spec)
- **Component_Source**: A `.ts` or `.js` file that contains a `defineComponent()` call and reactive logic (defined in core spec)

## Requirements

### Requirement 1: Parse templateRef Declarations

**User Story:** As a developer, I want to write `templateRef('name')` in my component script, so that the compiler knows which template elements I need references to.

#### Acceptance Criteria

1. WHEN the component source contains `const varName = templateRef('refName')`, THE Parser SHALL extract a RefDeclaration with the variable name and the ref name
2. WHEN the component source contains multiple `templateRef` calls, THE Parser SHALL extract all RefDeclarations in source order
3. THE Parser SHALL support both single-quoted and double-quoted ref name arguments in `templateRef('name')` and `templateRef("name")`
4. WHEN the `templateRef` call uses `let` or `var` instead of `const`, THE Parser SHALL extract the RefDeclaration with the correct variable name

### Requirement 2: Detect ref Attributes in Template

**User Story:** As a developer, I want to write `ref="name"` on any element in my template, so that the compiler knows which elements should be accessible via refs.

#### Acceptance Criteria

1. WHEN a template element has a `ref` attribute, THE Tree_Walker SHALL record a RefBinding with the ref name and the DOM path to the element
2. WHEN the template contains multiple `ref` attributes, THE Tree_Walker SHALL record all RefBindings in document order
3. WHEN a `ref` attribute is detected, THE Tree_Walker SHALL remove the `ref` attribute from the processed template
4. THE Tree_Walker SHALL detect `ref` attributes at any nesting depth within the template

### Requirement 3: Code Generation — Constructor DOM Reference

**User Story:** As a developer, I want the compiled component to assign DOM element references in the constructor, so that refs are available immediately after construction.

#### Acceptance Criteria

1. WHEN a RefBinding exists, THE Code_Generator SHALL generate an assignment `this._ref_<refName> = __root.<path>` in the constructor, where `<path>` is the DOM path to the element
2. THE Code_Generator SHALL generate DOM reference assignments before `this.appendChild(__root)` moves nodes out of the document fragment

### Requirement 4: Code Generation — Getter Property

**User Story:** As a developer, I want to access my ref via `refVar.value` in my component logic, so that I get the DOM element reference using a consistent access pattern.

#### Acceptance Criteria

1. WHEN a RefDeclaration exists with variable name `varName` and ref name `refName`, THE Code_Generator SHALL generate a getter method `get _<varName>() { return { value: this._ref_<refName> }; }` on the class
2. THE Code_Generator SHALL generate one getter per RefDeclaration

### Requirement 5: Validation — Ref Not Found

**User Story:** As a developer, I want the compiler to report an error when I use `templateRef('name')` without a matching `ref="name"` in the template, so that I can fix mismatched ref names.

#### Acceptance Criteria

1. IF a RefDeclaration references a ref name that has no matching RefBinding in the template, THEN THE Compiler SHALL report an error with code `REF_NOT_FOUND`

### Requirement 6: Validation — Duplicate Ref Names

**User Story:** As a developer, I want the compiler to report an error when I use the same `ref` name on multiple template elements, so that ref names remain unambiguous.

#### Acceptance Criteria

1. IF the template contains multiple elements with the same `ref` attribute value, THEN THE Tree_Walker SHALL report an error with code `DUPLICATE_REF`

### Requirement 7: Validation — Unused Ref Warning

**User Story:** As a developer, I want the compiler to warn me when a `ref="name"` in the template has no matching `templateRef('name')` in the script, so that I can clean up unused refs.

#### Acceptance Criteria

1. WHEN a RefBinding exists with a ref name that has no matching RefDeclaration in the script, THE Compiler SHALL emit a warning (non-fatal) indicating the ref is unused

### Requirement 8: Lifecycle Availability

**User Story:** As a developer, I want refs to be available in `onMount` callbacks and effects, so that I can safely interact with DOM elements after the component is constructed.

#### Acceptance Criteria

1. THE Code_Generator SHALL assign ref DOM references in the constructor (during template cloning), ensuring refs are available before `connectedCallback` executes
2. WHEN a ref is accessed in an `onMount` callback or effect, THE Ref_Object SHALL contain the correct DOM element in its `.value` property

