# Requirements Document

## Introduction

Enable WCC scoped slots to work when WCC components are consumed inside Vue, React, and Angular host applications. Currently, scoped slots use `<template #name="{ prop1, prop2 }">{{prop1}} {{prop2}}</template>` syntax which fails cross-framework because:

1. Vue intercepts `<template #name="props">` as its own scoped slot syntax → compilation error
2. React/JSX does not support `<template>` elements or `#` attributes
3. Angular strips `<template>` from the DOM
4. The `{{prop}}` interpolation syntax is consumed by Vue/Angular template compilers before WCC can process it

Named slots (without props) were already solved cross-framework by:
- Runtime: slot parser detects `slot="name"` on regular elements
- Vue plugin: pre-transforms `<template #name>` → `<div slot="name">` before Vue compiles

The challenge with scoped slots is that the consumer template contains `{{prop}}` interpolation tokens that must survive the host framework's compilation pass and reach the WCC runtime intact for reactive replacement.

## Glossary

- **Scoped_Slot**: A slot declaration in a WCC child component that exposes reactive data (props) to the consumer's template content via `:prop="expr"` bindings on the `<slot>` element.
- **Consumer_Template**: The HTML content provided by the parent/consumer that references scoped slot props using interpolation syntax.
- **Host_Framework**: The framework (Vue, React, or Angular) in which the WCC component is being consumed.
- **Interpolation_Token**: A placeholder in the consumer template that the WCC runtime replaces with the current value of a scoped slot prop (e.g., `{{item}}`).
- **Slot_Template_String**: The raw HTML string stored by the WCC runtime (`this.__slotTpl_<name>`) for reactive replacement of interpolation tokens.
- **Vue_Plugin**: The Vite pre-transform plugin (`wccVuePlugin`) that rewrites WCC-specific syntax before Vue's compiler processes the template.
- **WCC_Runtime**: The generated `connectedCallback` code that resolves slot content, stores templates, and runs reactive effects to replace interpolation tokens.
- **Escape_Syntax**: An alternative interpolation syntax (e.g., `{%prop%}`) that host frameworks do not recognize or process, allowing tokens to pass through to the WCC runtime.
- **String_Attribute_Pattern**: A pattern where the consumer passes the scoped slot template as a string attribute on a regular element (e.g., `slot-template="<span>{{item}}</span>"`).

## Requirements

### Requirement 1: Escape Syntax for Scoped Slot Interpolation

**User Story:** As a developer using WCC components inside Vue/React/Angular, I want to use an interpolation syntax that my host framework ignores, so that scoped slot prop tokens reach the WCC runtime without being consumed or errored by the host compiler.

#### Acceptance Criteria

1. THE WCC_Runtime SHALL support `{%prop%}` as an interpolation token syntax for scoped slot props in addition to the existing `{{prop}}` syntax.
2. WHEN a consumer template contains `{%prop%}` tokens, THE WCC_Runtime SHALL replace them with the current value of the corresponding scoped slot prop reactively.
3. WHEN a consumer template contains `{%prop()%}` tokens (with parentheses for method-style access), THE WCC_Runtime SHALL replace them with the current value of the corresponding scoped slot prop.
4. THE `{%prop%}` syntax SHALL NOT be recognized or processed by Vue's template compiler.
5. THE `{%prop%}` syntax SHALL NOT be recognized or processed by Angular's template compiler.
6. THE `{%prop%}` syntax SHALL pass through JSX as a plain text string in React.
7. THE existing `{{prop}}` syntax SHALL continue to work for WCC-to-WCC scoped slots (no breaking change).

### Requirement 2: Vue Plugin Pre-Transform for Scoped Slots

**User Story:** As a Vue developer using WCC scoped slots, I want the Vue plugin to transform scoped slot syntax into a cross-framework-safe form, so that I can use a familiar authoring syntax that compiles correctly.

#### Acceptance Criteria

1. WHEN a `.vue` file contains `<template #name="{ prop1, prop2 }">content</template>` inside a WCC custom element, THE Vue_Plugin SHALL transform it into a `<div>` element with `slot="name"` and a `slot-props` attribute preserving the destructured prop names.
2. WHEN the consumer template content contains `{{prop}}` interpolation inside a WCC scoped slot template, THE Vue_Plugin SHALL rewrite it to `{%prop%}` before Vue's compiler processes the template.
3. WHEN the consumer template content contains `{{ prop }}` interpolation (with spaces) inside a WCC scoped slot template, THE Vue_Plugin SHALL rewrite it to `{% prop %}` before Vue's compiler processes the template.
4. THE Vue_Plugin transform SHALL only apply to templates nested inside elements whose tag name contains a hyphen (custom elements).
5. WHEN a `<template #name>` without a slot-props expression is found inside a custom element, THE Vue_Plugin SHALL transform it to `<div slot="name">` without modifying interpolation tokens (existing named slot behavior).
6. THE Vue_Plugin SHALL preserve all other content and attributes on the transformed element unchanged.

### Requirement 3: String Attribute Pattern for React and Angular

**User Story:** As a React or Angular developer using WCC scoped slots, I want to pass scoped slot templates as string attributes, so that I can provide slot content without relying on `<template>` elements or framework-specific syntax.

#### Acceptance Criteria

1. WHEN a child element of a WCC component has a `slot-template-<name>` attribute, THE WCC_Runtime SHALL store the attribute value as the scoped slot template string for the slot named `<name>`.
2. WHEN a child element has `slot-template-<name>` attribute, THE WCC_Runtime SHALL use the attribute value for reactive interpolation replacement, identical to template-based scoped slots.
3. THE `slot-template-<name>` attribute value SHALL support `{%prop%}` interpolation tokens.
4. THE `slot-template-<name>` attribute value SHALL support `{{prop}}` interpolation tokens.
5. IF both a `<template #name>` (or `<div slot="name">`) and a `slot-template-<name>` attribute are provided for the same slot, THEN THE WCC_Runtime SHALL prefer the element-based template over the attribute-based template.
6. WHEN no scoped slot template is provided (neither element-based nor attribute-based), THE WCC_Runtime SHALL use the slot's fallback content if defined.

### Requirement 4: Runtime Regex Update for Escape Syntax

**User Story:** As a WCC component author, I want the runtime interpolation replacement to handle both `{{prop}}` and `{%prop%}` syntaxes, so that my scoped slots work regardless of which syntax the consumer uses.

#### Acceptance Criteria

1. THE WCC_Runtime regex for scoped slot prop replacement SHALL match `{%\s*propName(\(\))?\s*%}` patterns in addition to the existing `{{\s*propName(\(\))?\s*}}` pattern.
2. WHEN a consumer template mixes `{{prop1}}` and `{%prop2%}` tokens, THE WCC_Runtime SHALL replace both correctly in a single reactive pass.
3. THE regex replacement SHALL be global (replace all occurrences of a prop token in the template string).
4. THE regex replacement SHALL handle optional whitespace inside the delimiters (e.g., `{% item %}` and `{%item%}` are equivalent).
5. WHEN a prop value is `null` or `undefined`, THE WCC_Runtime SHALL replace the token with an empty string.

### Requirement 5: Codegen Updates for Escape Syntax Support

**User Story:** As a WCC compiler maintainer, I want the code generator to emit runtime code that handles both interpolation syntaxes, so that the compiled output supports cross-framework consumption.

#### Acceptance Criteria

1. WHEN a component has scoped slots, THE Codegen SHALL emit a regex pattern that matches both `{{propName}}` and `{%propName%}` token formats.
2. THE generated regex SHALL use a single combined pattern (not two separate replacements) for efficiency.
3. THE generated code SHALL preserve the existing reactive effect structure (`__effect` wrapping the replacement logic).
4. WHEN the scoped slot has multiple props, THE generated code SHALL iterate all props and replace tokens for each prop in sequence.
5. THE generated code SHALL be functionally equivalent for both syntax forms (same reactive behavior, same null handling).

### Requirement 6: Slot Parser Update for Attribute-Based Templates

**User Story:** As a WCC runtime developer, I want the slot resolution code in `connectedCallback` to detect `slot-template-<name>` attributes on child elements, so that React and Angular consumers can provide scoped slot content.

#### Acceptance Criteria

1. WHEN iterating child nodes in `connectedCallback`, THE slot parser SHALL check each element node for attributes matching the pattern `slot-template-<name>`.
2. WHEN a `slot-template-<name>` attribute is found, THE slot parser SHALL store its value as the template string for the named scoped slot.
3. WHEN a `slot-template-<name>` attribute is found on an element that also has a `slot="name"` attribute, THE slot parser SHALL use the element content (from `slot="name"`) as the template and ignore the `slot-template-<name>` attribute.
4. THE slot parser SHALL remove the `slot-template-<name>` attribute from the element after reading it (cleanup).
5. WHEN multiple elements provide `slot-template-<name>` for the same slot name, THE slot parser SHALL use the first one encountered.

### Requirement 7: Cross-Framework Compatibility Verification

**User Story:** As a developer, I want confidence that scoped slots work correctly in Vue, React, and Angular, so that I can use WCC components in any framework without worrying about interpolation conflicts.

#### Acceptance Criteria

1. WHEN a WCC component with scoped slots is used inside a Vue 3 application with `wccVuePlugin`, THE scoped slot props SHALL render correctly and update reactively.
2. WHEN a WCC component with scoped slots is used inside a React application using `slot-template-<name>` attributes with `{%prop%}` syntax, THE scoped slot props SHALL render correctly and update reactively.
3. WHEN a WCC component with scoped slots is used inside an Angular application using `slot-template-<name>` attributes with `{%prop%}` syntax, THE scoped slot props SHALL render correctly and update reactively.
4. WHEN a WCC component with scoped slots is used inside another WCC component using `<template #name="{ prop }">{{prop}}</template>`, THE scoped slot props SHALL continue to render correctly (backward compatibility).
5. WHEN the host framework re-renders its own template (e.g., Vue reactivity trigger), THE WCC scoped slot content SHALL remain intact and not be destroyed or duplicated.

### Requirement 8: Documentation of Cross-Framework Scoped Slot Usage

**User Story:** As a developer consuming WCC components, I want clear documentation on how to use scoped slots in my framework, so that I can quickly adopt the correct pattern.

#### Acceptance Criteria

1. THE documentation SHALL include a Vue example showing the authoring syntax and how the plugin transforms it.
2. THE documentation SHALL include a React/JSX example showing the `slot-template-<name>` attribute pattern with `{%prop%}` syntax.
3. THE documentation SHALL include an Angular example showing the `slot-template-<name>` attribute pattern with `{%prop%}` syntax.
4. THE documentation SHALL include a WCC-to-WCC example showing the original `<template #name="{ prop }">{{prop}}</template>` syntax still works.
5. THE documentation SHALL explain why `{{prop}}` cannot be used directly in Vue and Angular templates.
