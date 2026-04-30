# Requirements Document

## Introduction

This document specifies the `show` directive for wcCompiler v2. The `show` directive toggles element visibility via `display: none` without removing the element from the DOM. Unlike `if` which adds/removes elements, `show` simply toggles the CSS display property based on a reactive expression. This feature builds on the core spec (signal, computed, effect, defineComponent, template engine base with `{{interpolation}}` and `@event`, CSS scoping, CLI).

## Glossary

- **Tree_Walker**: The module that traverses a jsdom DOM tree to discover bindings, events, and directives (defined in core spec)
- **Code_Generator**: The module that produces a self-contained `.js` file from the parsed intermediate representation (defined in core spec)
- **ShowBinding**: The internal data structure produced by the Tree_Walker representing a `show` directive on an element, containing the expression and DOM path
- **Expression**: A JavaScript expression string provided as the value of `show`, evaluated in the component's reactive context (signals auto-unwrap via `transformExpr`)
- **Component_Source**: A `.ts` or `.js` file that contains a `defineComponent()` call and reactive logic (defined in core spec)

## Requirements

### Requirement 1: Show Attribute Detection

**User Story:** As a developer, I want to write `show="expression"` on any element in my template, so that the compiler recognizes it as a visibility toggle directive.

#### Acceptance Criteria

1. WHEN the template contains an element with a `show` attribute, THE Tree_Walker SHALL detect it and record a ShowBinding
2. THE Tree_Walker SHALL extract the expression string from the `show` attribute value
3. WHEN the `show` attribute is detected, THE Tree_Walker SHALL remove the `show` attribute from the processed template
4. THE Tree_Walker SHALL support multiple `show` directives on different elements within the same template
5. THE Tree_Walker SHALL detect `show` directives at any nesting depth within the template

### Requirement 2: ShowBinding Data Structure

**User Story:** As a developer, I want the Tree_Walker to produce a structured ShowBinding for each `show` directive, so that the Code_Generator has all the information needed to generate the visibility toggle logic.

#### Acceptance Criteria

1. THE Tree_Walker SHALL produce a ShowBinding containing: a unique variable name (e.g., `__show0`), the expression string, and the DOM path from the template root to the element
2. THE Tree_Walker SHALL assign sequential variable names (`__show0`, `__show1`, ...) to ShowBindings in document order
3. THE Tree_Walker SHALL record the DOM path as an array of `childNodes[n]` segments from the template root to the target element

### Requirement 3: Code Generation — Reactive Effect

**User Story:** As a developer, I want the compiled component to reactively toggle element visibility based on the `show` expression, so that the UI updates automatically when reactive state changes.

#### Acceptance Criteria

1. WHEN a ShowBinding exists, THE Code_Generator SHALL generate an `__effect` in `connectedCallback` that evaluates the show expression
2. THE generated effect SHALL set `element.style.display = ''` when the expression evaluates to truthy
3. THE generated effect SHALL set `element.style.display = 'none'` when the expression evaluates to falsy
4. THE generated effect SHALL use `transformExpr` to rewrite signal and computed references in the show expression (e.g., `isVisible` becomes `this._isVisible()`)

### Requirement 4: Expression Auto-Unwrap

**User Story:** As a developer, I want to write bare signal names in `show` expressions (e.g., `show="isVisible"`), and have the compiler transform them to signal reads, so that I don't need to manually call signals in templates.

#### Acceptance Criteria

1. WHEN a `show` expression references a signal name, THE Code_Generator SHALL transform it to `this._<signalName>()` using `transformExpr`
2. WHEN a `show` expression references a computed name, THE Code_Generator SHALL transform it to `this._c_<computedName>()` using `transformExpr`
3. WHEN a `show` expression references a prop name, THE Code_Generator SHALL transform it to `this._s_<propName>()` using `transformExpr`

### Requirement 5: DOM Element Reference

**User Story:** As a developer, I want the compiled component to reference the correct DOM element for each `show` directive, so that the visibility toggle applies to the right element.

#### Acceptance Criteria

1. WHEN a ShowBinding exists, THE Code_Generator SHALL generate a DOM element reference in the constructor using the ShowBinding's path
2. THE generated reference SHALL navigate from the cloned template root (`__root`) through the path segments to reach the target element
3. THE DOM element reference SHALL be assigned before `appendChild` moves nodes from the template root

### Requirement 6: Validation — Conflicting Directives

**User Story:** As a developer, I want the compiler to report a clear error when I use `show` and `if` on the same element, so that I can fix template mistakes quickly.

#### Acceptance Criteria

1. IF an element has both `show` and `if` attributes, THEN THE Tree_Walker SHALL report an error with code `CONFLICTING_DIRECTIVES`

### Requirement 7: Multiple Show Directives

**User Story:** As a developer, I want to use `show` on multiple elements in the same template, so that I can control visibility of different parts of my component independently.

#### Acceptance Criteria

1. WHEN the template contains multiple elements with `show` attributes, THE Tree_Walker SHALL produce one ShowBinding per element in document order
2. THE Code_Generator SHALL generate one `__effect` per ShowBinding in `connectedCallback`
3. THE Code_Generator SHALL generate one DOM element reference per ShowBinding in the constructor

