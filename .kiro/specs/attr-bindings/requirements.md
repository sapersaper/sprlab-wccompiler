# Requirements Document

## Introduction

This document specifies the attribute bindings feature (`:attr`, `:class`, `:style`) for wcCompiler v2. Attribute bindings allow dynamic binding of HTML attributes, classes, and styles to reactive expressions using a `:` prefix on the attribute name (or the longer `bind:attr` form). The Tree Walker detects these bindings, extracts the attribute name and expression, and records an AttrBinding with the element's DOM path. The Code Generator produces `__effect` calls in `connectedCallback` that reactively update the element's attributes, classes, or styles. This feature builds on the core spec (signal, computed, effect, defineComponent, template engine base with `{{interpolation}}` and `@event`, CSS scoping, CLI).

## Glossary

- **Tree_Walker**: The module that traverses a jsdom DOM tree to discover bindings, events, and directives (defined in core spec)
- **Code_Generator**: The module that produces a self-contained `.js` file from the parsed intermediate representation (defined in core spec)
- **AttrBinding**: The internal data structure produced by the Tree_Walker representing a dynamic attribute binding on an element, containing the attribute name, expression, binding kind, and DOM path
- **Binding_Kind**: A classification of the AttrBinding that determines the code generation strategy: `'attr'` for regular attributes, `'class'` for class bindings, `'style'` for style bindings, `'bool'` for boolean attributes
- **Boolean_Attribute**: An HTML attribute that represents a boolean state and uses property assignment instead of `setAttribute` (e.g., `disabled`, `checked`, `hidden`, `readonly`, `required`, `selected`, `multiple`, `autofocus`, `autoplay`, `controls`, `loop`, `muted`, `open`, `novalidate`)
- **Expression**: A JavaScript expression string provided as the value of the binding, evaluated in the component's reactive context (signals auto-unwrap via `transformExpr`)
- **Object_Expression**: A JavaScript object literal expression (e.g., `{ active: isActive, 'text-bold': isBold }`) used with `:class` or `:style` to bind multiple values
- **String_Expression**: A JavaScript expression that evaluates to a string, used with `:class` or `:style` for direct assignment
- **Component_Source**: A `.ts` or `.js` file that contains a `defineComponent()` call and reactive logic (defined in core spec)

## Requirements

### Requirement 1: Attribute Binding Detection

**User Story:** As a developer, I want to write `:attr="expression"` or `bind:attr="expression"` on any element in my template, so that the compiler recognizes it as a dynamic attribute binding.

#### Acceptance Criteria

1. WHEN the template contains an element with an attribute starting with `:`, THE Tree_Walker SHALL detect it and record an AttrBinding
2. WHEN the template contains an element with an attribute starting with `bind:`, THE Tree_Walker SHALL detect it and record an AttrBinding
3. THE Tree_Walker SHALL extract the attribute name by removing the `:` prefix (or `bind:` prefix) from the attribute name
4. THE Tree_Walker SHALL extract the expression string from the attribute value
5. WHEN the binding attribute is detected, THE Tree_Walker SHALL remove the binding attribute from the processed template
6. THE Tree_Walker SHALL support multiple attribute bindings on the same element
7. THE Tree_Walker SHALL detect attribute bindings at any nesting depth within the template

### Requirement 2: Binding Kind Classification

**User Story:** As a developer, I want the compiler to distinguish between regular attributes, class bindings, style bindings, and boolean attributes, so that each type generates the appropriate DOM manipulation code.

#### Acceptance Criteria

1. WHEN the extracted attribute name is `class`, THE Tree_Walker SHALL assign Binding_Kind `'class'` to the AttrBinding
2. WHEN the extracted attribute name is `style`, THE Tree_Walker SHALL assign Binding_Kind `'style'` to the AttrBinding
3. WHEN the extracted attribute name is a Boolean_Attribute (`disabled`, `checked`, `hidden`, `readonly`, `required`, `selected`, `multiple`, `autofocus`, `autoplay`, `controls`, `loop`, `muted`, `open`, `novalidate`), THE Tree_Walker SHALL assign Binding_Kind `'bool'` to the AttrBinding
4. WHEN the extracted attribute name is not `class`, `style`, or a Boolean_Attribute, THE Tree_Walker SHALL assign Binding_Kind `'attr'` to the AttrBinding

### Requirement 3: AttrBinding Data Structure

**User Story:** As a developer, I want the Tree_Walker to produce a structured AttrBinding for each attribute binding, so that the Code_Generator has all the information needed to generate the reactive attribute update logic.

#### Acceptance Criteria

1. THE Tree_Walker SHALL produce an AttrBinding containing: a unique variable name (e.g., `__attr0`), the attribute name, the expression string, the Binding_Kind, and the DOM path from the template root to the element
2. THE Tree_Walker SHALL assign sequential variable names (`__attr0`, `__attr1`, ...) to AttrBindings in document order
3. THE Tree_Walker SHALL record the DOM path as an array of `childNodes[n]` segments from the template root to the target element

### Requirement 4: Code Generation — Regular Attribute Binding

**User Story:** As a developer, I want `:href="url"` to reactively set the `href` attribute on the element, so that the attribute updates when the expression value changes.

#### Acceptance Criteria

1. WHEN an AttrBinding with Binding_Kind `'attr'` exists, THE Code_Generator SHALL generate an `__effect` in `connectedCallback` that evaluates the expression and calls `element.setAttribute(name, value)` when the value is truthy or empty string
2. WHEN the expression evaluates to a falsy value (except empty string), THE generated effect SHALL call `element.removeAttribute(name)`
3. THE generated effect SHALL use `transformExpr` to rewrite signal and computed references in the expression

### Requirement 5: Code Generation — Boolean Attribute Binding

**User Story:** As a developer, I want `:disabled="isLoading"` to reactively set the `disabled` property on the element, so that boolean attributes use property assignment for correct DOM behavior.

#### Acceptance Criteria

1. WHEN an AttrBinding with Binding_Kind `'bool'` exists, THE Code_Generator SHALL generate an `__effect` in `connectedCallback` that evaluates the expression and sets the element property directly (e.g., `element.disabled = !!value`)
2. THE generated effect SHALL coerce the expression value to boolean using `!!`
3. THE generated effect SHALL use `transformExpr` to rewrite signal and computed references in the expression

### Requirement 6: Code Generation — Class Binding (Object Expression)

**User Story:** As a developer, I want `:class="{ active: isActive, 'text-bold': isBold }"` to reactively add or remove CSS classes based on the object keys, so that I can conditionally apply multiple classes.

#### Acceptance Criteria

1. WHEN an AttrBinding with Binding_Kind `'class'` exists and the expression starts with `{`, THE Code_Generator SHALL generate an `__effect` that evaluates the object expression and iterates its entries
2. FOR EACH key-value pair in the object, THE generated effect SHALL call `element.classList.add(key)` when the value is truthy
3. FOR EACH key-value pair in the object, THE generated effect SHALL call `element.classList.remove(key)` when the value is falsy
4. THE generated effect SHALL use `transformExpr` to rewrite signal and computed references within the object values

### Requirement 7: Code Generation — Class Binding (String Expression)

**User Story:** As a developer, I want `:class="className"` to reactively set the entire className of the element, so that I can bind a dynamic class string.

#### Acceptance Criteria

1. WHEN an AttrBinding with Binding_Kind `'class'` exists and the expression does not start with `{`, THE Code_Generator SHALL generate an `__effect` that sets `element.className = value`
2. THE generated effect SHALL use `transformExpr` to rewrite signal and computed references in the expression

### Requirement 8: Code Generation — Style Binding (Object Expression)

**User Story:** As a developer, I want `:style="{ color: textColor, fontSize: size + 'px' }"` to reactively set individual style properties, so that I can bind multiple style values.

#### Acceptance Criteria

1. WHEN an AttrBinding with Binding_Kind `'style'` exists and the expression starts with `{`, THE Code_Generator SHALL generate an `__effect` that evaluates the object expression and iterates its entries
2. FOR EACH key-value pair in the object, THE generated effect SHALL set `element.style[key] = value`
3. THE generated effect SHALL use `transformExpr` to rewrite signal and computed references within the object values

### Requirement 9: Code Generation — Style Binding (String Expression)

**User Story:** As a developer, I want `:style="styleString"` to reactively set the entire inline style of the element, so that I can bind a dynamic style string.

#### Acceptance Criteria

1. WHEN an AttrBinding with Binding_Kind `'style'` exists and the expression does not start with `{`, THE Code_Generator SHALL generate an `__effect` that sets `element.style.cssText = value`
2. THE generated effect SHALL use `transformExpr` to rewrite signal and computed references in the expression

### Requirement 10: Expression Auto-Unwrap

**User Story:** As a developer, I want to write bare signal names in binding expressions (e.g., `:href="url"`), and have the compiler transform them to signal reads, so that I don't need to manually call signals in templates.

#### Acceptance Criteria

1. WHEN a binding expression references a signal name, THE Code_Generator SHALL transform it to `this._<signalName>()` using `transformExpr`
2. WHEN a binding expression references a computed name, THE Code_Generator SHALL transform it to `this._c_<computedName>()` using `transformExpr`
3. WHEN a binding expression references a prop name, THE Code_Generator SHALL transform it to `this._s_<propName>()` using `transformExpr`

### Requirement 11: DOM Element Reference

**User Story:** As a developer, I want the compiled component to reference the correct DOM element for each attribute binding, so that the reactive update applies to the right element.

#### Acceptance Criteria

1. WHEN an AttrBinding exists, THE Code_Generator SHALL generate a DOM element reference in the constructor using the AttrBinding's path
2. THE generated reference SHALL navigate from the cloned template root (`__root`) through the path segments to reach the target element
3. THE DOM element reference SHALL be assigned before `appendChild` moves nodes from the template root
4. WHEN multiple AttrBindings target the same element, THE Code_Generator SHALL reuse the same DOM element reference

### Requirement 12: Multiple Attribute Bindings

**User Story:** As a developer, I want to use multiple attribute bindings on the same element and across different elements, so that I can control various attributes independently.

#### Acceptance Criteria

1. WHEN the template contains multiple elements with attribute bindings, THE Tree_Walker SHALL produce one AttrBinding per binding attribute in document order
2. THE Code_Generator SHALL generate one `__effect` per AttrBinding in `connectedCallback`
3. THE Code_Generator SHALL generate DOM element references for all AttrBindings in the constructor
