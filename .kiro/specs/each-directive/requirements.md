# Requirements Document

## Introduction

This document specifies the `each` list rendering directive for wcCompiler v2. List rendering allows component authors to render a DOM element once per item in an array or numeric range. Elements with `each` are replaced by a comment node anchor (`<!-- each -->`) at compile time, and items are rendered dynamically via an effect that iterates the source, clones the item template, and sets up bindings/events per item. When the source changes, all previously rendered items are removed and re-rendered. This feature builds on the core spec (signal, computed, effect, defineComponent, template engine base) and the if spec (for the `walkBranch` pattern used to process internal bindings within the item template).

## Glossary

- **Tree_Walker**: The module that traverses a jsdom DOM tree to discover bindings, events, and directives (defined in core spec)
- **Code_Generator**: The module that produces a self-contained `.js` file from the parsed intermediate representation (defined in core spec)
- **For_Block**: The internal data structure produced by the Tree_Walker representing a single `each` directive with its anchor path, iteration variables, source expression, key expression, item template, and internal bindings/events
- **Anchor_Node**: A comment node (`<!-- each -->`) that replaces the `each` element in the processed template, serving as a positional reference for inserting rendered items at runtime
- **Item_Template**: The HTML content of the `each` element (with `each` and `:key` attributes removed), stored as a `<template>` element for cloning at runtime
- **Item_Variable**: The iteration variable declared in the `each` expression (e.g., `item` in `item in items`), representing the current element of the source during iteration
- **Index_Variable**: The optional second variable declared in the destructured `each` expression (e.g., `index` in `(item, index) in items`), representing the zero-based position of the current element
- **Source_Expression**: The JavaScript expression on the right side of `in` in the `each` expression, evaluated in the component's reactive context to produce the iterable (array or number)
- **Key_Expression**: The optional `:key` attribute on the `each` element, used to identify items for potential future optimization (currently stored but not used for DOM diffing)
- **Static_Binding**: A text binding inside the item template that references only the Item_Variable or Index_Variable (assigned once per item, not wrapped in an effect)
- **Reactive_Binding**: A text binding inside the item template that references component-level reactive state (wrapped in an `__effect` per item so it updates when the state changes)
- **Numeric_Range**: When the Source_Expression evaluates to a number `N`, the iteration produces values `1` through `N` (inclusive)
- **Component_Source**: A `.ts` or `.js` file that contains a `defineComponent()` call and reactive logic (defined in core spec)

## Requirements

### Requirement 1: each Expression Parsing

**User Story:** As a developer, I want to write `each="item in items"` or `each="(item, index) in items"` on a template element, so that the compiler understands the iteration variable, optional index variable, and source expression.

#### Acceptance Criteria

1. WHEN a `each` attribute has the form `item in source`, THE Tree_Walker SHALL parse it into an Item_Variable (`item`) and a Source_Expression (`source`) with no Index_Variable
2. WHEN a `each` attribute has the form `(item, index) in source`, THE Tree_Walker SHALL parse it into an Item_Variable (`item`), an Index_Variable (`index`), and a Source_Expression (`source`)
3. IF a `each` attribute value does not contain the `in` keyword, THEN THE Tree_Walker SHALL report an error with code `INVALID_V_FOR`
4. IF a `each` attribute value has an empty Item_Variable (e.g., ` in items`), THEN THE Tree_Walker SHALL report an error with code `INVALID_V_FOR`
5. IF a `each` attribute value has an empty Source_Expression (e.g., `item in `), THEN THE Tree_Walker SHALL report an error with code `INVALID_V_FOR`

### Requirement 2: Key Expression Extraction

**User Story:** As a developer, I want to specify a `:key` attribute on my `each` element, so that the compiler can store it for potential future optimization of list updates.

#### Acceptance Criteria

1. WHEN a `each` element has a `:key` attribute, THE Tree_Walker SHALL extract the key expression and store it in the For_Block metadata
2. WHEN a `each` element does not have a `:key` attribute, THE Tree_Walker SHALL set the Key_Expression to `null` in the For_Block metadata
3. WHEN the Item_Template is extracted, THE Tree_Walker SHALL remove the `:key` attribute from the template HTML

### Requirement 3: Anchor Node Replacement

**User Story:** As a developer, I want the compiler to replace the `each` element with a comment node anchor, so that the runtime knows where to insert rendered items in the DOM.

#### Acceptance Criteria

1. WHEN a `each` element is detected, THE Tree_Walker SHALL replace it with a single Anchor_Node (comment node `<!-- each -->`)
2. THE Tree_Walker SHALL record the DOM path from the template root to the Anchor_Node in the For_Block metadata
3. WHEN the DOM is normalized after element replacement, THE Tree_Walker SHALL recompute the Anchor_Node path to account for merged text nodes

### Requirement 4: Item Template Extraction

**User Story:** As a developer, I want the compiler to extract the HTML of the `each` element so that it can be cloned once per item at runtime.

#### Acceptance Criteria

1. WHEN the Item_Template is extracted, THE Tree_Walker SHALL remove the `each` attribute from the template HTML
2. WHEN the Item_Template contains `{{interpolation}}` bindings, THE Tree_Walker SHALL process them via `walkBranch` and record binding metadata with paths relative to the item root element
3. WHEN the Item_Template contains `@event` bindings, THE Tree_Walker SHALL process them via `walkBranch` and record event metadata with paths relative to the item root element
4. WHEN the Item_Template contains `show` directives, THE Tree_Walker SHALL process them via `walkBranch` and record show binding metadata with paths relative to the item root element
5. WHEN the Item_Template contains `:attr` or `bind:attr` bindings, THE Tree_Walker SHALL process them via `walkBranch` and record attribute binding metadata with paths relative to the item root element

### Requirement 5: For_Block Data Structure

**User Story:** As a developer, I want the Tree_Walker to produce a structured For_Block for each `each` directive, so that the Code_Generator has all the information needed to generate the iteration logic.

#### Acceptance Criteria

1. THE Tree_Walker SHALL produce a For_Block containing: a unique variable name (e.g., `__for0`), the Item_Variable, the Index_Variable (or `null`), the Source_Expression, the Key_Expression (or `null`), the processed Item_Template HTML, the anchor path, and arrays of bindings, events, show bindings, and attribute bindings
2. THE Tree_Walker SHALL assign sequential variable names (`__for0`, `__for1`, ...) to For_Blocks in document order
3. THE Tree_Walker SHALL detect `each` elements at any nesting depth within the template

### Requirement 6: Code Generation — Constructor Setup

**User Story:** As a developer, I want the compiled component to set up the item template element, anchor reference, and nodes tracking array in the constructor, so that list rendering is efficient at runtime.

#### Acceptance Criteria

1. WHEN a For_Block exists, THE Code_Generator SHALL generate a `<template>` element creation (`document.createElement('template')`) in the constructor
2. WHEN a For_Block exists, THE Code_Generator SHALL set the `innerHTML` of the template element to the processed Item_Template HTML
3. WHEN a For_Block exists, THE Code_Generator SHALL store a reference to the Anchor_Node from the cloned template root in the constructor
4. WHEN a For_Block exists, THE Code_Generator SHALL initialize an empty nodes array (e.g., `__for0_nodes = []`) for tracking rendered item nodes

### Requirement 7: Code Generation — Reactive Effect

**User Story:** As a developer, I want the compiled component to reactively iterate the source and render items in the DOM, so that the list updates automatically when the source signal changes.

#### Acceptance Criteria

1. WHEN a For_Block exists, THE Code_Generator SHALL generate an `__effect` in `connectedCallback` that evaluates the Source_Expression
2. THE generated effect SHALL use `transformForExpr` to rewrite component-level signal and computed references in the Source_Expression while leaving Item_Variable and Index_Variable references untransformed
3. WHEN the effect executes, THE generated code SHALL remove all previously rendered item nodes from the DOM and clear the nodes array
4. WHEN the Source_Expression evaluates to an array, THE generated code SHALL iterate the array, cloning the Item_Template once per element and inserting each clone before the Anchor_Node
5. WHEN the Source_Expression evaluates to a number `N`, THE generated code SHALL iterate values `1` through `N`, cloning the Item_Template once per value and inserting each clone before the Anchor_Node
6. WHEN the Source_Expression evaluates to a falsy value, THE generated code SHALL treat it as an empty array (render nothing)

### Requirement 8: Code Generation — Static Bindings

**User Story:** As a developer, I want text bindings that reference only the item or index variable to be assigned once (not wrapped in an effect), so that rendering is efficient for item-local data.

#### Acceptance Criteria

1. WHEN a text binding inside the Item_Template references only the Item_Variable or a property of the Item_Variable (e.g., `item.name`), THE Code_Generator SHALL classify it as a Static_Binding
2. WHEN a text binding inside the Item_Template references only the Index_Variable, THE Code_Generator SHALL classify it as a Static_Binding
3. WHEN a Static_Binding is generated, THE Code_Generator SHALL assign the value to the DOM node's `textContent` directly (without wrapping in `__effect`)

### Requirement 9: Code Generation — Reactive Bindings

**User Story:** As a developer, I want text bindings that reference component-level reactive state to be wrapped in effects, so that they update when the component state changes.

#### Acceptance Criteria

1. WHEN a text binding inside the Item_Template references a component signal, computed, or prop, THE Code_Generator SHALL classify it as a Reactive_Binding
2. WHEN a Reactive_Binding is generated, THE Code_Generator SHALL wrap the DOM assignment in an `__effect` call so it re-executes when the referenced reactive state changes
3. THE Code_Generator SHALL use `transformForExpr` to rewrite component-level references while preserving Item_Variable and Index_Variable references in Reactive_Binding expressions

### Requirement 10: Code Generation — Event Bindings

**User Story:** As a developer, I want event handlers inside `each` items to be bound to the component instance, so that methods work correctly when triggered from list items.

#### Acceptance Criteria

1. WHEN the Item_Template contains `@event` bindings, THE Code_Generator SHALL generate `addEventListener` calls per item with the handler bound to the component instance (`this._handler.bind(this)`)

### Requirement 11: Code Generation — Show and Attribute Bindings

**User Story:** As a developer, I want `show` and `:attr` bindings inside `each` items to work correctly, distinguishing between static (item-only) and reactive (component-level) expressions.

#### Acceptance Criteria

1. WHEN a `show` expression inside the Item_Template references only the Item_Variable or Index_Variable, THE Code_Generator SHALL assign the display style directly (static)
2. WHEN a `show` expression inside the Item_Template references component-level reactive state, THE Code_Generator SHALL wrap the display style assignment in an `__effect`
3. WHEN an `:attr` expression inside the Item_Template references only the Item_Variable or Index_Variable, THE Code_Generator SHALL assign the attribute directly (static)
4. WHEN an `:attr` expression inside the Item_Template references component-level reactive state, THE Code_Generator SHALL wrap the attribute assignment in an `__effect`

### Requirement 12: Validation — Conflicting Directives

**User Story:** As a developer, I want the compiler to report a clear error when I use `each` and `if` on the same element, so that I can fix template mistakes quickly.

#### Acceptance Criteria

1. IF an element has both `each` and `if` attributes, THEN THE Tree_Walker SHALL report an error with code `CONFLICTING_DIRECTIVES`

### Requirement 13: Expression Auto-Unwrap

**User Story:** As a developer, I want to write bare signal names in the `each` source expression (e.g., `each="item in items"` where `items` is a signal), and have the compiler transform them to signal reads, so that I don't need to manually call signals in templates.

#### Acceptance Criteria

1. WHEN the Source_Expression references a signal name, THE Code_Generator SHALL transform it to `this._<signalName>()` using `transformForExpr`
2. WHEN the Source_Expression references a computed name, THE Code_Generator SHALL transform it to `this._c_<computedName>()` using `transformForExpr`
3. WHEN the Source_Expression references a prop name, THE Code_Generator SHALL transform it to `this._s_<propName>()` using `transformForExpr`
4. THE Code_Generator SHALL NOT transform references to the Item_Variable or Index_Variable in any expression within the item scope
