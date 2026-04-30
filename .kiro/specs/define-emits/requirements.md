# Requirements Document

## Introduction

This document specifies the `defineEmits` feature for wcCompiler v2. `defineEmits` allows component authors to declare typed custom events and obtain an `emit` function to dispatch them. Events are dispatched as native `CustomEvent` instances with `bubbles: true` and `composed: true`. This feature builds on the core spec (signal, computed, effect, defineComponent, template engine base, CSS scoping, CLI) and the defineProps spec (for naming conflict validation patterns).

## Glossary

- **Parser**: The module that reads a `.ts`/`.js` source file and extracts component declarations (defined in core spec)
- **Code_Generator**: The module that produces a self-contained `.js` file from the parsed intermediate representation (defined in core spec)
- **Emits_Declaration**: A `defineEmits([...])` or `defineEmits<{...}>()` call in the Component_Source that declares the component's custom events
- **Emits_Object_Name**: The variable name assigned from `defineEmits()` (e.g., `emit` in `const emit = defineEmits(...)`) used to dispatch events in the script
- **Event_Name**: A string identifier for a custom event declared in the Emits_Declaration (e.g., `'change'`, `'update'`)
- **Component_Source**: A `.ts` or `.js` file that contains a `defineComponent()` call and reactive logic (defined in core spec)
- **Custom_Event**: A native browser `CustomEvent` dispatched via `this.dispatchEvent()` with `bubbles: true` and `composed: true`
- **Emit_Function**: The internal method `_emit(name, detail)` generated on the HTMLElement class that dispatches a Custom_Event
- **Props_Object_Name**: The variable name used to capture the `defineProps()` return value (defined in defineProps spec)

## Requirements

### Requirement 1: Emits Declaration Parsing (Array Form)

**User Story:** As a developer, I want to declare custom events using a simple array syntax `defineEmits(['event1', 'event2'])`, so that the compiler knows which events my component can dispatch.

#### Acceptance Criteria

1. WHEN the Component_Source contains `const <Emits_Object_Name> = defineEmits(['event1', 'event2', ...])`, THE Parser SHALL extract the Emits_Object_Name and each Event_Name from the array literal
2. THE Parser SHALL support both single-quoted and double-quoted string literals in the array
3. THE Parser SHALL preserve the order of Event_Names as declared in the array

### Requirement 2: Emits Declaration Parsing (TypeScript Call Signatures Form)

**User Story:** As a developer, I want to declare typed events using TypeScript call signatures `defineEmits<{ (e: 'event', value: type): void }>()`, so that I get type safety for event payloads.

#### Acceptance Criteria

1. WHEN the Component_Source contains `const <Emits_Object_Name> = defineEmits<{ (e: 'event1', ...): void; (e: 'event2', ...): void }>()`, THE Parser SHALL extract the Emits_Object_Name and each Event_Name from the call signature first parameters
2. THE Parser SHALL extract Event_Names from the TypeScript generic type parameter before type stripping occurs
3. THE Parser SHALL support both single-quoted and double-quoted string literals for Event_Names in call signatures

### Requirement 3: Emits Variable Assignment Validation

**User Story:** As a developer, I want the compiler to enforce that `defineEmits()` is always assigned to a variable, so that the emit function reference is consistent and predictable.

#### Acceptance Criteria

1. IF `defineEmits()` is called without being assigned to a variable (bare call), THEN THE Parser SHALL report an error with code `EMITS_ASSIGNMENT_REQUIRED`
2. THE Parser SHALL accept `const`, `let`, or `var` as valid variable declaration keywords for the Emits_Object_Name assignment

### Requirement 4: Emits Conflict Validation

**User Story:** As a developer, I want the compiler to detect naming conflicts between the emit variable and other declarations, so that I avoid ambiguous references in my component.

#### Acceptance Criteria

1. IF an Event_Name matches another Event_Name in the same Emits_Declaration, THEN THE Parser SHALL report an error with code `DUPLICATE_EMITS` identifying the duplicated Event_Name
2. IF the Emits_Object_Name matches a signal, computed, constant variable name, prop name, or Props_Object_Name declared in the same Component_Source, THEN THE Parser SHALL report an error with code `EMITS_OBJECT_CONFLICT` identifying the conflicting name

### Requirement 5: Undeclared Emit Validation

**User Story:** As a developer, I want the compiler to warn me when I emit an event that was not declared, so that I catch typos and missing declarations early.

#### Acceptance Criteria

1. WHEN the Component_Source contains `<Emits_Object_Name>('eventName', ...)` where `eventName` is not in the Emits_Declaration, THE Parser SHALL report an error with code `UNDECLARED_EMIT` identifying the undeclared Event_Name
2. THE Parser SHALL use the captured Emits_Object_Name to build a dynamic regex pattern that detects emit calls in the Component_Source
3. THE Parser SHALL validate all emit calls found in method bodies, effect bodies, and computed expressions

### Requirement 6: Code Generation for Emit Function

**User Story:** As a developer, I want the compiler to generate an internal `_emit` method on the class that dispatches CustomEvents, so that my emit calls work at runtime.

#### Acceptance Criteria

1. WHEN emits are declared, THE Code_Generator SHALL generate an `_emit(name, detail)` method on the HTMLElement class
2. THE Emit_Function SHALL dispatch a `new CustomEvent(name, { detail, bubbles: true, composed: true })` via `this.dispatchEvent()`
3. WHEN the emit call has no payload argument (`emit('event')`), THE Emit_Function SHALL dispatch the CustomEvent with `detail` set to `undefined`

### Requirement 7: Emit Call Transformation in Script

**User Story:** As a developer, I want to write `emit('event', data)` in my methods and effects, and have the compiler transform it to the internal `_emit` call, so that events are dispatched correctly at runtime.

#### Acceptance Criteria

1. WHEN the Component_Source contains `<Emits_Object_Name>('eventName', payload)` in a method body, THE Code_Generator SHALL transform it to `this._emit('eventName', payload)`
2. WHEN the Component_Source contains `<Emits_Object_Name>('eventName', payload)` in an effect body, THE Code_Generator SHALL transform it to `this._emit('eventName', payload)`
3. WHEN the Component_Source contains `<Emits_Object_Name>('eventName')` without a payload, THE Code_Generator SHALL transform it to `this._emit('eventName')`
4. THE Code_Generator SHALL only transform calls that use the captured Emits_Object_Name as the callee — other function calls with the same pattern SHALL NOT be transformed
5. THE Code_Generator SHALL exclude the Emits_Object_Name from signal, computed, and constant transformation rules (the Emits_Object_Name itself is not a signal)

### Requirement 8: Emits Object Name Exclusion from Reactive Transforms

**User Story:** As a developer, I want the compiler to recognize that the emit variable is not a signal or computed, so that it does not incorrectly transform it with reactive access patterns.

#### Acceptance Criteria

1. THE Code_Generator SHALL NOT apply signal read transformation (`this._name()`) to the Emits_Object_Name
2. THE Code_Generator SHALL NOT apply computed read transformation (`this._c_name()`) to the Emits_Object_Name
3. THE Code_Generator SHALL NOT apply constant transformation to the Emits_Object_Name
