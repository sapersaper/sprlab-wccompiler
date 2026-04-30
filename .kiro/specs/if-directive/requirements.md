# Requirements Document

## Introduction

This document specifies the `if` / `else-if` / `else` conditional rendering feature for wcCompiler v2. Conditional rendering allows component authors to show or hide DOM branches based on reactive expressions. Elements with conditional directives are replaced by comment node anchors at compile time, and the active branch is rendered/destroyed dynamically via an effect that evaluates the conditions. Only one branch is present in the DOM at any given time. This feature builds on the core spec (signal, computed, effect, defineComponent, template engine base with `{{interpolation}}` and `@event`, CSS scoping, CLI).

## Glossary

- **Tree_Walker**: The module that traverses a jsdom DOM tree to discover bindings, events, and directives (defined in core spec)
- **Code_Generator**: The module that produces a self-contained `.js` file from the parsed intermediate representation (defined in core spec)
- **Conditional_Chain**: A sequence of sibling elements starting with a `if` element, optionally followed by one or more `else-if` elements, and optionally terminated by a `else` element
- **Branch**: A single element within a Conditional_Chain, representing one possible DOM subtree to render
- **Anchor_Node**: A comment node (`<!-- if -->`) that replaces the entire Conditional_Chain in the processed template, serving as a positional reference for inserting the active branch at runtime
- **Active_Branch**: The single Branch whose condition evaluates to truthy, or the `else` Branch when all preceding conditions are falsy
- **Branch_Template**: The HTML content of a Branch (with the directive attribute removed), stored as a `<template>` element for cloning at runtime
- **If_Block**: The internal data structure produced by the Tree_Walker representing a complete Conditional_Chain with its anchor path and branch metadata
- **Expression**: A JavaScript expression string provided as the value of `if` or `else-if`, evaluated in the component's reactive context (signals auto-unwrap via `transformExpr`)
- **Component_Source**: A `.ts` or `.js` file that contains a `defineComponent()` call and reactive logic (defined in core spec)

## Requirements

### Requirement 1: Conditional Chain Detection

**User Story:** As a developer, I want to write `if`, `else-if`, and `else` directives on sibling elements in my template, so that the compiler recognizes them as a single conditional rendering unit.

#### Acceptance Criteria

1. WHEN the template contains an element with a `if` attribute, THE Tree_Walker SHALL start a new Conditional_Chain
2. WHEN an element with `else-if` immediately follows (as the next sibling element) an element with `if` or `else-if`, THE Tree_Walker SHALL add it to the current Conditional_Chain
3. WHEN an element with `else` immediately follows (as the next sibling element) an element with `if` or `else-if`, THE Tree_Walker SHALL add it to the current Conditional_Chain and close the chain
4. WHEN a non-conditional element follows a `if` or `else-if` element, THE Tree_Walker SHALL close the current Conditional_Chain without a `else` Branch
5. THE Tree_Walker SHALL support multiple independent Conditional_Chains within the same parent element

### Requirement 2: Anchor Node Replacement

**User Story:** As a developer, I want the compiler to replace conditional elements with a comment node anchor, so that the runtime knows where to insert the active branch in the DOM.

#### Acceptance Criteria

1. WHEN a Conditional_Chain is detected, THE Tree_Walker SHALL replace all elements in the chain with a single Anchor_Node (comment node `<!-- if -->`)
2. THE Tree_Walker SHALL record the DOM path from the template root to the Anchor_Node in the If_Block metadata
3. WHEN the DOM is normalized after chain replacement, THE Tree_Walker SHALL recompute the Anchor_Node path to account for merged text nodes

### Requirement 3: Branch Template Extraction

**User Story:** As a developer, I want the compiler to extract the HTML of each branch so that it can be cloned and inserted at runtime when the condition is met.

#### Acceptance Criteria

1. WHEN a Branch is extracted, THE Tree_Walker SHALL remove the directive attribute (`if`, `else-if`, or `else`) from the Branch_Template HTML
2. WHEN a Branch contains `{{interpolation}}` bindings, THE Tree_Walker SHALL process them and record binding metadata with paths relative to the branch root element
3. WHEN a Branch contains `@event` bindings, THE Tree_Walker SHALL process them and record event metadata with paths relative to the branch root element
4. WHEN a Branch contains `show` directives, THE Tree_Walker SHALL process them and record show binding metadata with paths relative to the branch root element
5. WHEN a Branch contains `:attr` or `bind:attr` bindings, THE Tree_Walker SHALL process them and record attribute binding metadata with paths relative to the branch root element

### Requirement 4: If_Block Data Structure

**User Story:** As a developer, I want the Tree_Walker to produce a structured If_Block for each Conditional_Chain, so that the Code_Generator has all the information needed to generate the runtime logic.

#### Acceptance Criteria

1. THE Tree_Walker SHALL produce an If_Block containing: a unique variable name (e.g., `__if0`), the anchor path, and an array of branches
2. FOR EACH Branch in the If_Block, THE Tree_Walker SHALL record: the branch type (`'if'`, `'else-if'`, or `'else'`), the expression string (or `null` for `else`), the processed template HTML, and arrays of bindings, events, show bindings, and attribute bindings
3. THE Tree_Walker SHALL assign sequential variable names (`__if0`, `__if1`, ...) to If_Blocks in document order

### Requirement 5: Code Generation — Constructor Setup

**User Story:** As a developer, I want the compiled component to set up template elements and anchor references in the constructor, so that branch rendering is efficient at runtime.

#### Acceptance Criteria

1. WHEN an If_Block exists, THE Code_Generator SHALL generate a `<template>` element creation (`document.createElement('template')`) for each Branch in the constructor
2. WHEN an If_Block exists, THE Code_Generator SHALL set the `innerHTML` of each Branch_Template element to the processed branch HTML
3. WHEN an If_Block exists, THE Code_Generator SHALL store a reference to the Anchor_Node from the cloned template root in the constructor
4. WHEN an If_Block exists, THE Code_Generator SHALL initialize tracking state (`_current = null`, `_active = undefined`) for the active branch in the constructor

### Requirement 6: Code Generation — Reactive Effect

**User Story:** As a developer, I want the compiled component to reactively evaluate conditions and swap branches in the DOM, so that the UI updates automatically when reactive state changes.

#### Acceptance Criteria

1. WHEN an If_Block exists, THE Code_Generator SHALL generate an `__effect` in `connectedCallback` that evaluates each branch condition in order
2. THE generated effect SHALL use `transformExpr` to rewrite signal and computed references in branch expressions (e.g., `status` becomes `this._status()`)
3. WHEN the active branch index changes, THE generated effect SHALL remove the previously rendered branch node from the DOM
4. WHEN a new branch becomes active, THE generated effect SHALL clone the corresponding Branch_Template, insert the cloned node before the Anchor_Node, and store a reference to the inserted node
5. WHEN no condition is truthy and no `else` Branch exists, THE generated effect SHALL render nothing (remove any existing branch node)
6. WHEN the active branch index has not changed, THE generated effect SHALL skip DOM manipulation (early return optimization)

### Requirement 7: Code Generation — Branch Setup Method

**User Story:** As a developer, I want bindings and events inside conditional branches to be set up when the branch is rendered, so that interpolations and event handlers work correctly within conditional content.

#### Acceptance Criteria

1. WHEN any Branch in an If_Block contains bindings or events, THE Code_Generator SHALL generate a setup method (e.g., `__if0_setup(node, branch)`) on the class
2. THE setup method SHALL use the branch index to determine which bindings and events to initialize
3. WHEN a Branch has text bindings, THE setup method SHALL create `__effect` calls that update the bound DOM nodes with the current reactive values
4. WHEN a Branch has event bindings, THE setup method SHALL call `addEventListener` on the appropriate DOM nodes with the handler bound to the component instance
5. WHEN a Branch has show bindings, THE setup method SHALL create `__effect` calls that toggle the element's `display` style
6. WHEN a Branch has attribute bindings, THE setup method SHALL create `__effect` calls that update the element's attributes reactively

### Requirement 8: Validation — Conflicting Directives

**User Story:** As a developer, I want the compiler to report clear errors when I use conflicting directives on the same element, so that I can fix template mistakes quickly.

#### Acceptance Criteria

1. IF an element has both `if` and `else` attributes, THEN THE Tree_Walker SHALL report an error with code `CONFLICTING_DIRECTIVES`
2. IF an element has both `if` and `else-if` attributes, THEN THE Tree_Walker SHALL report an error with code `CONFLICTING_DIRECTIVES`
3. IF an element has both `show` and `if` attributes, THEN THE Tree_Walker SHALL report an error with code `CONFLICTING_DIRECTIVES`

### Requirement 9: Validation — Orphan Else

**User Story:** As a developer, I want the compiler to report an error when `else` or `else-if` appears without a preceding `if`, so that I know my conditional chain is malformed.

#### Acceptance Criteria

1. IF an element with `else-if` does not immediately follow an element with `if` or `else-if` at the same sibling level, THEN THE Tree_Walker SHALL report an error with code `ORPHAN_ELSE`
2. IF an element with `else` does not immediately follow an element with `if` or `else-if` at the same sibling level, THEN THE Tree_Walker SHALL report an error with code `ORPHAN_ELSE`

### Requirement 10: Validation — Invalid else Expression

**User Story:** As a developer, I want the compiler to report an error when `else` has an expression value, so that I don't accidentally write `else="condition"` instead of `else-if="condition"`.

#### Acceptance Criteria

1. IF an element has a `else` attribute with a non-empty value, THEN THE Tree_Walker SHALL report an error with code `INVALID_V_ELSE`

### Requirement 11: Nested Conditional Chains

**User Story:** As a developer, I want to use `if` chains inside other elements (not just at the top level of the template), so that I can conditionally render content at any depth.

#### Acceptance Criteria

1. WHEN a Conditional_Chain appears inside a non-conditional element, THE Tree_Walker SHALL detect and process it with the correct parent path context
2. THE Tree_Walker SHALL support Conditional_Chains at any nesting depth within the template

### Requirement 12: Expression Auto-Unwrap

**User Story:** As a developer, I want to write bare signal names in `if` expressions (e.g., `if="status === 'active'"`), and have the compiler transform them to signal reads, so that I don't need to manually call signals in templates.

#### Acceptance Criteria

1. WHEN a `if` expression references a signal name, THE Code_Generator SHALL transform it to `this._<signalName>()` using `transformExpr`
2. WHEN a `if` expression references a computed name, THE Code_Generator SHALL transform it to `this._c_<computedName>()` using `transformExpr`
3. WHEN a `else-if` expression references signal or computed names, THE Code_Generator SHALL apply the same transformation rules as `if`
