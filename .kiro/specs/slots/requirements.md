# Requirements Document

## Introduction

This document specifies the `<slot>` content distribution feature for wcCompiler v2 using **scoped slots in light DOM** — the same approach as v1. Slots allow parent components to inject content into designated areas of a child component's template using a compiler-driven slot resolution mechanism. When a template contains `<slot>` elements, the compiler replaces them with `<span data-slot="...">` placeholders during tree-walking, and generates runtime code in the constructor to read consumer-provided content from `this.childNodes` and inject it into the placeholders. For scoped slots, the compiler generates reactive effects in `connectedCallback` that resolve `{{propName}}` interpolations in the consumer's template content using slot prop values.

This feature uses **light DOM only** — no Shadow DOM. CSS scoping continues to use the tag-name prefix strategy via `scopeCSS()`, identical to components without slots. This feature builds on the core spec (signal, computed, effect, defineComponent, template engine base with `{{interpolation}}` and `@event`, CSS scoping, CLI).

## Glossary

- **Tree_Walker**: The module that traverses a jsdom DOM tree to discover bindings, events, and directives (defined in core spec)
- **Code_Generator**: The module that produces a self-contained `.js` file from the parsed intermediate representation (defined in core spec)
- **SlotBinding**: The data structure produced by the Tree_Walker for each `<slot>` element, recording its varName, name, path, defaultContent, and slotProps
- **SlotProp**: A single `:prop="expr"` attribute on a `<slot>` element, defining data passed to the scoped slot consumer
- **Default_Slot**: An unnamed `<slot></slot>` element that receives any child content not assigned to a named slot
- **Named_Slot**: A `<slot name="..."></slot>` element that receives child content provided via `<template #name>` from the consumer
- **Scoped_Slot**: A named slot with `:prop="expr"` attributes that passes data to the consumer's template, resolved via `{{propName}}` interpolation
- **Fallback_Content**: HTML content placed inside a `<slot>` element that renders when no content is distributed to that slot
- **Light_DOM_Mode**: The rendering strategy where the component appends its template directly to `this` (no Shadow DOM) — used for ALL components, with or without slots
- **Slot_Placeholder**: A `<span data-slot="name">` element that replaces the original `<slot>` during tree-walking, serving as the injection target at runtime

## Requirements

### Requirement 1: Slot Detection and Replacement in Template

**User Story:** As a developer, I want the compiler to detect `<slot>` elements in my template and replace them with placeholder spans, so that slot resolution can happen at runtime in light DOM.

#### Acceptance Criteria

1. WHEN the template contains a `<slot>` element, THE Tree_Walker SHALL replace it with a `<span data-slot="name">` element (where name is the slot name, or "default" for unnamed slots)
2. WHEN the `<slot>` element has a `name` attribute, THE Tree_Walker SHALL use that name as the `data-slot` value on the replacement span
3. WHEN the `<slot>` element has no `name` attribute, THE Tree_Walker SHALL use "default" as the `data-slot` value on the replacement span
4. WHEN the `<slot>` element contains fallback content, THE Tree_Walker SHALL preserve that content as innerHTML of the replacement span
5. THE Tree_Walker SHALL detect `<slot>` elements at any nesting depth within the template
6. THE Tree_Walker SHALL collect `:prop="expr"` attributes from `<slot>` elements and record them as SlotProp entries in the SlotBinding

### Requirement 2: SlotBinding Data Structure

**User Story:** As a developer, I want the Tree_Walker to produce a structured SlotBinding for each slot, so that the Code_Generator has all the information needed to generate slot resolution code.

#### Acceptance Criteria

1. THE Tree_Walker SHALL produce a SlotBinding for each `<slot>` element containing: `varName` (string), `name` (string), `path` (string[]), `defaultContent` (string), and `slotProps` (SlotProp[])
2. THE Tree_Walker SHALL assign a unique `varName` (e.g., `__s0`, `__s1`) to each SlotBinding
3. THE Tree_Walker SHALL record the DOM path from root to the replacement span in the `path` field
4. THE Tree_Walker SHALL record each `:prop="expr"` attribute as a SlotProp with `prop` (the attribute name without `:`) and `source` (the attribute value)

### Requirement 3: Light DOM Rendering (Always)

**User Story:** As a developer, I want all components to use light DOM rendering regardless of slot presence, so that CSS scoping and DOM behavior are consistent.

#### Acceptance Criteria

1. WHEN slots are present, THE Code_Generator SHALL generate `this.innerHTML = ''; this.appendChild(__root)` (same as components without slots)
2. THE Code_Generator SHALL NOT generate `this.attachShadow` or `this.shadowRoot` for any component
3. WHEN styles are provided, THE Code_Generator SHALL always inject scoped CSS into `document.head` using `scopeCSS()`, regardless of slot presence

### Requirement 4: Slot Resolution in Constructor

**User Story:** As a developer, I want the compiled component to read my child content and inject it into the correct slot placeholders, so that content distribution works at runtime.

#### Acceptance Criteria

1. WHEN slots are present, THE Code_Generator SHALL generate code to read `this.childNodes` BEFORE clearing innerHTML and appending the template
2. THE Code_Generator SHALL generate code to build a `__slotMap` from `<template #name>` children, mapping slot names to their innerHTML content
3. THE Code_Generator SHALL generate code to collect non-template child nodes into `__defaultSlotNodes` for the default slot
4. FOR each named slot without slotProps, THE Code_Generator SHALL generate code to inject `__slotMap[name].content` into the slot placeholder's innerHTML
5. FOR each scoped slot (named slot with slotProps), THE Code_Generator SHALL generate code to store the template content for reactive resolution in connectedCallback
6. FOR the default slot, THE Code_Generator SHALL generate code to clone and append `__defaultSlotNodes` into the default slot placeholder

### Requirement 5: Scoped Slot Props Resolution

**User Story:** As a developer, I want to pass reactive data from my component to the slot consumer via `:prop="expr"` on `<slot>`, so that the consumer can use `{{propName}}` in their template content.

#### Acceptance Criteria

1. WHEN a slot has `:prop="expr"` attributes, THE Code_Generator SHALL generate a reactive `__effect` in connectedCallback that resolves `{{propName}}` placeholders in the consumer's template content
2. THE effect SHALL build a props object mapping each prop name to its resolved value (using the component's signal/computed/prop references)
3. THE effect SHALL replace `{{propName}}` patterns in the stored template content with the resolved values
4. THE effect SHALL update the slot placeholder's innerHTML with the resolved content
5. WHEN the source expression references a reactive variable (signal, computed, prop), THE effect SHALL re-run when that variable changes

### Requirement 6: Consumer API

**User Story:** As a developer consuming a component with slots, I want to use `<template #name>` for named slots and `<template #name="{ prop }">` for scoped slots, so that I can provide content to specific slots.

#### Acceptance Criteria

1. THE consumer SHALL use `<template #slotName>content</template>` to provide content for a named slot
2. THE consumer SHALL use `<template #slotName="{ prop1, prop2 }">content with {{prop1}}</template>` to receive scoped slot props
3. THE consumer SHALL place plain child elements (not `<template #...>`) to provide content for the default slot
4. WHEN no content is provided for a slot, THE component SHALL display the fallback content from the original `<slot>` element

### Requirement 7: Compatibility with Other Directives

**User Story:** As a developer, I want slots to work alongside other template directives (interpolation, events, if, each, show, attr bindings), so that I can build complex components with content distribution.

#### Acceptance Criteria

1. WHEN a template contains both `<slot>` elements and `{{interpolation}}` bindings, THE Tree_Walker SHALL process both correctly
2. WHEN a template contains both `<slot>` elements and `@event` bindings, THE Tree_Walker SHALL process both correctly
3. WHEN a template contains both `<slot>` elements and conditional directives (`if`/`else-if`/`else`), THE Tree_Walker SHALL process both correctly
4. WHEN a template contains `<slot>` elements alongside `show`, `:attr`, or `each` directives, THE Tree_Walker SHALL process both correctly

### Requirement 8: Multiple Slots Support

**User Story:** As a developer, I want to use multiple named slots, scoped slots, and a default slot in the same template, so that I can distribute different content to different areas of my component.

#### Acceptance Criteria

1. THE Tree_Walker SHALL support templates with multiple `<slot>` elements (named, scoped, and default)
2. THE Code_Generator SHALL generate correct slot resolution code for any combination of named, scoped, and default slots
3. EACH slot SHALL be independently resolvable — named slots from `__slotMap`, scoped slots via reactive effects, default slot from `__defaultSlotNodes`
