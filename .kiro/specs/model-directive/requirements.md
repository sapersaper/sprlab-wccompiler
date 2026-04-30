# Requirements Document

## Introduction

This document specifies the `model` directive for wcCompiler v2. The `model` directive provides two-way data binding between form elements and signals. It binds the element's value (or checked state) to a signal and listens for input events to update the signal from user interaction. This feature builds on the core spec (signal, computed, effect, defineComponent, template engine base with `{{interpolation}}` and `@event`, CSS scoping, CLI).

## Glossary

- **Tree_Walker**: The module that traverses a jsdom DOM tree to discover bindings, events, and directives (defined in core spec)
- **Code_Generator**: The module that produces a self-contained `.js` file from the parsed intermediate representation (defined in core spec)
- **ModelBinding**: The internal data structure produced by the Tree_Walker representing a `model` directive on a form element, containing the signal name, DOM property, event type, and DOM path
- **Signal_Name**: A valid JavaScript identifier referencing a `signal()` declaration in the component source
- **Component_Source**: A `.ts` or `.js` file that contains a `defineComponent()` call and reactive logic (defined in core spec)
- **Form_Element**: An HTML element that accepts user input: `<input>`, `<textarea>`, or `<select>`

## Requirements

### Requirement 1: Model Attribute Detection

**User Story:** As a developer, I want to write `model="signalName"` on form elements in my template, so that the compiler recognizes it as a two-way data binding directive.

#### Acceptance Criteria

1. WHEN the template contains a Form_Element with a `model` attribute, THE Tree_Walker SHALL detect it and record a ModelBinding
2. THE Tree_Walker SHALL extract the Signal_Name string from the `model` attribute value
3. WHEN the `model` attribute is detected, THE Tree_Walker SHALL remove the `model` attribute from the processed template
4. THE Tree_Walker SHALL support multiple `model` directives on different elements within the same template
5. THE Tree_Walker SHALL detect `model` directives at any nesting depth within the template

### Requirement 2: Element Type Detection

**User Story:** As a developer, I want the compiler to automatically determine the correct DOM property and event based on the element type, so that two-way binding works correctly for text inputs, checkboxes, radios, selects, and textareas.

#### Acceptance Criteria

1. WHEN the element is `<input type="checkbox">`, THE Tree_Walker SHALL set the ModelBinding prop to `checked` and event to `change`
2. WHEN the element is `<input type="radio">`, THE Tree_Walker SHALL set the ModelBinding prop to `checked` and event to `change`
3. WHEN the element is `<select>`, THE Tree_Walker SHALL set the ModelBinding prop to `value` and event to `change`
4. WHEN the element is `<textarea>`, THE Tree_Walker SHALL set the ModelBinding prop to `value` and event to `input`
5. WHEN the element is `<input>` with type `text`, `number`, `email`, `password`, `search`, `tel`, `url`, or no type attribute, THE Tree_Walker SHALL set the ModelBinding prop to `value` and event to `input`

### Requirement 3: ModelBinding Data Structure

**User Story:** As a developer, I want the Tree_Walker to produce a structured ModelBinding for each `model` directive, so that the Code_Generator has all the information needed to generate two-way binding logic.

#### Acceptance Criteria

1. THE Tree_Walker SHALL produce a ModelBinding containing: a unique variable name (e.g., `__model0`), the signal name, the DOM property (`value` or `checked`), the event name (`input` or `change`), and the DOM path from the template root to the element
2. THE Tree_Walker SHALL assign sequential variable names (`__model0`, `__model1`, ...) to ModelBindings in document order
3. THE Tree_Walker SHALL record the DOM path as an array of `childNodes[n]` segments from the template root to the target element
4. WHEN the element is `<input type="radio">`, THE Tree_Walker SHALL also record the element's `value` attribute in the ModelBinding as `radioValue`
5. WHEN the element is `<input type="number">`, THE Tree_Walker SHALL record a `coerce` flag set to `true` in the ModelBinding

### Requirement 4: Code Generation — Signal to DOM Effect

**User Story:** As a developer, I want the compiled component to reactively update the form element's value when the signal changes, so that the UI reflects the current state.

#### Acceptance Criteria

1. WHEN a ModelBinding exists with prop `value`, THE Code_Generator SHALL generate an `__effect` in `connectedCallback` that sets `element.value = this._<signalName>() ?? ''`
2. WHEN a ModelBinding exists with prop `checked` and the element is a checkbox, THE Code_Generator SHALL generate an `__effect` that sets `element.checked = !!this._<signalName>()`
3. WHEN a ModelBinding exists with prop `checked` and the element is a radio, THE Code_Generator SHALL generate an `__effect` that sets `element.checked = (this._<signalName>() === '<radioValue>')`

### Requirement 5: Code Generation — DOM to Signal Event Listener

**User Story:** As a developer, I want the compiled component to update the signal when the user interacts with the form element, so that the component state stays in sync with user input.

#### Acceptance Criteria

1. WHEN a ModelBinding exists for a text input or textarea, THE Code_Generator SHALL generate an event listener on the `input` event that calls `this._<signalName>(e.target.value)`
2. WHEN a ModelBinding exists for a checkbox, THE Code_Generator SHALL generate an event listener on the `change` event that calls `this._<signalName>(e.target.checked)`
3. WHEN a ModelBinding exists for a radio, THE Code_Generator SHALL generate an event listener on the `change` event that calls `this._<signalName>(e.target.value)`
4. WHEN a ModelBinding exists for a select, THE Code_Generator SHALL generate an event listener on the `change` event that calls `this._<signalName>(e.target.value)`
5. WHEN a ModelBinding has `coerce` set to `true`, THE Code_Generator SHALL wrap the value in `Number()` before passing to the signal setter

### Requirement 6: DOM Element Reference

**User Story:** As a developer, I want the compiled component to reference the correct DOM element for each `model` directive, so that the two-way binding applies to the right element.

#### Acceptance Criteria

1. WHEN a ModelBinding exists, THE Code_Generator SHALL generate a DOM element reference in the constructor using the ModelBinding's path
2. THE generated reference SHALL navigate from the cloned template root (`__root`) through the path segments to reach the target element
3. THE DOM element reference SHALL be assigned before `appendChild` moves nodes from the template root

### Requirement 7: Validation — Invalid Model Element

**User Story:** As a developer, I want the compiler to report a clear error when I use `model` on a non-form element, so that I can fix template mistakes quickly.

#### Acceptance Criteria

1. IF an element with a `model` attribute is not a Form_Element (`<input>`, `<textarea>`, or `<select>`), THEN THE Tree_Walker SHALL report an error with code `INVALID_MODEL_ELEMENT`

### Requirement 8: Validation — Invalid Model Target

**User Story:** As a developer, I want the compiler to report a clear error when the `model` value is not a valid signal name, so that I know the binding target is incorrect.

#### Acceptance Criteria

1. IF the `model` attribute value is empty, THEN THE Tree_Walker SHALL report an error with code `INVALID_MODEL_TARGET`
2. IF the `model` attribute value does not match a valid JavaScript identifier pattern, THEN THE Tree_Walker SHALL report an error with code `INVALID_MODEL_TARGET`

### Requirement 9: Multiple Model Directives

**User Story:** As a developer, I want to use `model` on multiple form elements in the same template, so that I can bind different signals to different inputs.

#### Acceptance Criteria

1. WHEN the template contains multiple elements with `model` attributes, THE Tree_Walker SHALL produce one ModelBinding per element in document order
2. THE Code_Generator SHALL generate one `__effect` (signal → DOM) per ModelBinding in `connectedCallback`
3. THE Code_Generator SHALL generate one event listener (DOM → signal) per ModelBinding in `connectedCallback`
4. THE Code_Generator SHALL generate one DOM element reference per ModelBinding in the constructor
