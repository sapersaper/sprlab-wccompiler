# Requirements Document

## Introduction

This document specifies the `defineProps` feature for wcCompiler v2. `defineProps` allows component authors to declare typed props with optional defaults. Props are received as HTML attributes on the custom element and exposed as reactive signals internally. This feature builds on the core spec (signal, computed, effect, defineComponent, template engine base, CSS scoping, CLI).

## Glossary

- **Parser**: The module that reads a `.ts`/`.js` source file and extracts component declarations (defined in core spec)
- **Code_Generator**: The module that produces a self-contained `.js` file from the parsed intermediate representation (defined in core spec)
- **Props_Declaration**: A `defineProps<{...}>({...})` or `defineProps([...])` call in the Component_Source that declares the component's public props
- **Props_Object**: The variable assigned from `defineProps()` (e.g., `const props = defineProps(...)`) used to access prop values in the script
- **Prop_Signal**: An internal reactive signal (`this._s_propName`) generated for each declared prop, initialized with the default value or `undefined`
- **Observed_Attribute**: An HTML attribute that the custom element watches for changes via the `observedAttributes` static getter
- **Attribute_Changed_Callback**: The `attributeChangedCallback(name, oldVal, newVal)` method generated on the HTMLElement class to react to attribute changes
- **Props_Object_Name**: The variable name used to capture the `defineProps()` return value (e.g., `props` in `const props = defineProps(...)`)
- **Default_Value**: The fallback value for a prop when no attribute is provided, specified in the defaults object argument to `defineProps()`
- **Component_Source**: A `.ts` or `.js` file that contains a `defineComponent()` call and reactive logic (defined in core spec)
- **Tree_Walker**: The module that traverses a jsdom DOM tree to discover bindings (defined in core spec)

## Requirements

### Requirement 1: Props Declaration Parsing (Generic Form)

**User Story:** As a developer, I want to declare typed props with optional defaults using `defineProps<{...}>({...})`, so that the compiler knows which attributes my component accepts and their default values.

#### Acceptance Criteria

1. WHEN the Component_Source contains `const <Props_Object_Name> = defineProps<{...}>({...})`, THE Parser SHALL extract the Props_Object_Name, each prop name, and each default value from the defaults object
2. WHEN the Component_Source contains `const <Props_Object_Name> = defineProps<{...}>()` without a defaults argument, THE Parser SHALL extract the Props_Object_Name and each prop name with `undefined` as the default value
3. WHEN the defaults object omits a prop declared in the generic type, THE Parser SHALL assign `undefined` as the default value for that prop
4. THE Parser SHALL extract prop names from the TypeScript generic type parameter `<{ name: type, ... }>` before type stripping occurs

### Requirement 2: Props Declaration Parsing (Array Form)

**User Story:** As a developer, I want to declare props using a simple array syntax `defineProps(['name1', 'name2'])` for quick prototyping without types, so that I can use props without TypeScript.

#### Acceptance Criteria

1. WHEN the Component_Source contains `const <Props_Object_Name> = defineProps(['prop1', 'prop2', ...])`, THE Parser SHALL extract the Props_Object_Name and each prop name from the array literal
2. WHEN the array form is used, THE Parser SHALL assign `undefined` as the default value for each prop
3. THE Parser SHALL support both single-quoted and double-quoted string literals in the array

### Requirement 3: Props Variable Assignment Validation

**User Story:** As a developer, I want the compiler to enforce that `defineProps()` is always assigned to a variable, so that prop access patterns are consistent and predictable.

#### Acceptance Criteria

1. IF `defineProps()` is called without being assigned to a variable (bare call), THEN THE Parser SHALL report an error with code `PROPS_ASSIGNMENT_REQUIRED`
2. THE Parser SHALL accept `const`, `let`, or `var` as valid variable declaration keywords for the Props_Object_Name assignment

### Requirement 4: Props Conflict Validation

**User Story:** As a developer, I want the compiler to detect naming conflicts between props and other declarations, so that I avoid ambiguous references in my component.

#### Acceptance Criteria

1. IF a prop name matches another prop name in the same Props_Declaration, THEN THE Parser SHALL report an error with code `DUPLICATE_PROPS` identifying the duplicated prop name
2. IF the Props_Object_Name matches a signal, computed, or constant variable name declared in the same Component_Source, THEN THE Parser SHALL report an error with code `PROPS_OBJECT_CONFLICT` identifying the conflicting name

### Requirement 5: Code Generation for Props

**User Story:** As a developer, I want the compiler to generate the necessary Web Component infrastructure (observedAttributes, attributeChangedCallback, signals) for my declared props, so that they work as reactive HTML attributes.

#### Acceptance Criteria

1. WHEN props are declared, THE Code_Generator SHALL generate a static `observedAttributes` getter returning an array of prop names (kebab-case conversion of camelCase prop names)
2. WHEN props are declared, THE Code_Generator SHALL generate a Prop_Signal initialization (`this._s_<propName> = __signal(<defaultValue>)`) in the constructor for each prop
3. WHEN props are declared, THE Code_Generator SHALL generate an `attributeChangedCallback(name, oldVal, newVal)` method that updates the corresponding Prop_Signal when an observed attribute changes
4. WHEN props are declared, THE Code_Generator SHALL generate a public getter for each prop on the class that reads the Prop_Signal value (`return this._s_<propName>()`)
5. WHEN props are declared, THE Code_Generator SHALL generate a public setter for each prop on the class that writes the Prop_Signal value and updates the HTML attribute

### Requirement 6: Props Access Transformation in Script

**User Story:** As a developer, I want to write `props.name` in my methods, computeds, and effects, and have the compiler transform it to the internal signal read, so that props are reactive without manual unwrapping.

#### Acceptance Criteria

1. WHEN the Component_Source contains `<Props_Object_Name>.<propName>` in a method body, THE Code_Generator SHALL transform it to `this._s_<propName>()`
2. WHEN the Component_Source contains `<Props_Object_Name>.<propName>` in a computed expression, THE Code_Generator SHALL transform it to `this._s_<propName>()`
3. WHEN the Component_Source contains `<Props_Object_Name>.<propName>` in an effect body, THE Code_Generator SHALL transform it to `this._s_<propName>()`
4. THE Code_Generator SHALL exclude the Props_Object_Name from signal, computed, and constant transformation rules (the Props_Object_Name itself is not a signal)

### Requirement 7: Props in Template Bindings

**User Story:** As a developer, I want to use prop names directly in my template interpolations (e.g., `{{label}}`), so that props are accessible in templates without the `props.` prefix.

#### Acceptance Criteria

1. WHEN a template contains `{{propName}}` where `propName` is a declared prop, THE Tree_Walker SHALL classify the binding with type `'prop'`
2. WHEN a binding of type `'prop'` exists, THE Code_Generator SHALL generate an effect that reads the Prop_Signal (`this._s_<propName>()`) and updates the DOM text content
3. THE Code_Generator SHALL treat prop bindings identically to signal bindings in terms of effect generation and DOM update patterns

### Requirement 8: Attribute-to-Signal Synchronization

**User Story:** As a developer, I want changes to HTML attributes on my custom element to automatically update the internal prop signals, so that the component reacts to external attribute changes.

#### Acceptance Criteria

1. WHEN an observed attribute value changes on the custom element, THE Attribute_Changed_Callback SHALL update the corresponding Prop_Signal with the new attribute value
2. WHEN an observed attribute is removed (newVal is `null`), THE Attribute_Changed_Callback SHALL set the corresponding Prop_Signal to the original Default_Value for that prop
3. THE Attribute_Changed_Callback SHALL convert attribute string values to the appropriate type based on the default value type (number defaults trigger `Number()` conversion, boolean defaults trigger boolean conversion, otherwise string)

