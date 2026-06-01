# Requirements Document

## Introduction

Create a `wccReactPlugin()` Vite plugin that transforms idiomatic React patterns (JSX props and render props) into the WCC slot system at build time. Currently, React developers must use `slot-template-*` string attributes with `{%prop%}` tokens to use WCC scoped slots — this is functional but not idiomatic React.

The plugin follows the same philosophy as the existing `wccVuePlugin()`: intercept framework-idiomatic authoring patterns and transform them into WCC-compatible slot markup before the framework's own compilation step processes the file.

**What the developer writes (idiomatic React):**
```jsx
<wcc-card header={<strong>Custom Header</strong>} renderStats={(likes) => <span>{likes} likes!</span>}>
  <p>Body content</p>
</wcc-card>
```

**What the plugin transforms it to (WCC-compatible output):**
```jsx
<wcc-card>
  <div slot="header"><strong>Custom Header</strong></div>
  <p>Body content</p>
  <div slot="stats" slot-props="likes" dangerouslySetInnerHTML={{__html: `🔥 {%likes%} likes!`}}></div>
</wcc-card>
```

The plugin is additive — it does not replace the existing `useWccEvent` and `useWccModel` hooks exported from `integrations/react.js`.

## Glossary

- **React_Plugin**: The Vite plugin (`wccReactPlugin`) that pre-transforms JSX/TSX files to convert idiomatic React slot patterns into WCC slot markup before `@vitejs/plugin-react` processes the file.
- **Named_Slot_Prop**: A JSX prop on a WCC custom element whose name matches a slot name and whose value is JSX or a string literal, transformed into a child element with `slot="name"`.
- **Render_Prop**: A JSX prop on a WCC custom element prefixed with `render` followed by a capitalized name (e.g., `renderStats`), whose value is an arrow function, transformed into a scoped slot element with `slot-props` and `{%param%}` tokens.
- **Slot_Name_Derivation**: The process of converting a render prop name to a slot name by stripping the `render` prefix and lowercasing the first character (e.g., `renderStats` → `stats`, `renderItemRow` → `itemRow`).
- **Scoped_Slot_Template**: The HTML string produced from a render prop's arrow function body, where parameter references are replaced with `{%param%}` interpolation tokens.
- **AST_Transform**: A Babel-based (or SWC-based) Abstract Syntax Tree transformation that parses JSX/TSX and rewrites specific node patterns.
- **Custom_Element_Tag**: An HTML tag name containing a hyphen (e.g., `wcc-card`, `my-component`), used to identify which JSX elements should be processed by the plugin.
- **WCC_Runtime**: The generated `connectedCallback` code that resolves slot content, stores templates, and runs reactive effects to replace interpolation tokens.

## Requirements

### Requirement 1: Vite Plugin Structure and Integration

**User Story:** As a React developer using WCC components, I want to add a single Vite plugin to my config, so that idiomatic React slot patterns are automatically transformed at build time.

#### Acceptance Criteria

1. THE React_Plugin SHALL be exported as a named export `wccReactPlugin` from `integrations/react.js`.
2. WHEN `wccReactPlugin()` is added to a Vite config `plugins` array, THE React_Plugin SHALL return a valid Vite plugin object with `name` and `enforce: 'pre'` properties.
3. THE React_Plugin SHALL run before `@vitejs/plugin-react` in the Vite plugin pipeline by using `enforce: 'pre'`.
4. THE React_Plugin SHALL only process files with `.jsx` or `.tsx` extensions.
5. WHEN a `.jsx` or `.tsx` file contains no WCC custom element tags, THE React_Plugin SHALL return the file unchanged.
6. THE React_Plugin SHALL coexist with the existing `useWccEvent` and `useWccModel` exports without modification to those functions.

### Requirement 2: Named Slot Props (JSX Expression)

**User Story:** As a React developer, I want to pass JSX expressions as props to WCC components and have them rendered as named slots, so that I can use familiar React patterns for slot content.

#### Acceptance Criteria

1. WHEN a JSX prop on a Custom_Element_Tag has a value that is a JSX expression (e.g., `header={<strong>Title</strong>}`), THE React_Plugin SHALL transform it into a child `<div>` element with `slot="propName"` containing the JSX expression as children.
2. WHEN a JSX prop on a Custom_Element_Tag has a value that is a string literal (e.g., `footer="Simple text"`), THE React_Plugin SHALL transform it into a child `<span>` element with `slot="propName"` containing the string as text content.
3. THE React_Plugin SHALL preserve existing children of the Custom_Element_Tag in their original position relative to the generated slot elements.
4. THE React_Plugin SHALL place generated named slot elements after the existing children of the Custom_Element_Tag.
5. WHEN a prop name matches a known HTML attribute (e.g., `className`, `id`, `style`, `ref`, `key`), THE React_Plugin SHALL NOT treat it as a named slot prop.
6. WHEN a prop name starts with `on` followed by an uppercase letter (e.g., `onClick`, `onChange`), THE React_Plugin SHALL NOT treat it as a named slot prop.

### Requirement 3: Scoped Slot Render Props

**User Story:** As a React developer, I want to pass render prop functions (prefixed with `render`) to WCC components and have them transformed into scoped slots, so that I can use reactive slot data with familiar React patterns.

#### Acceptance Criteria

1. WHEN a JSX prop on a Custom_Element_Tag starts with `render` followed by an uppercase letter and its value is an arrow function (e.g., `renderStats={(likes) => <span>{likes}</span>}`), THE React_Plugin SHALL transform it into a scoped slot element.
2. THE React_Plugin SHALL derive the slot name by stripping the `render` prefix and lowercasing the first character of the remaining name (e.g., `renderStats` → `stats`, `renderItemRow` → `itemRow`).
3. THE React_Plugin SHALL extract the arrow function parameter names and set them as the `slot-props` attribute value (comma-separated for multiple parameters).
4. THE React_Plugin SHALL convert the arrow function body's JSX into an HTML string where references to the function parameters are replaced with `{%param%}` interpolation tokens.
5. THE generated scoped slot element SHALL use `dangerouslySetInnerHTML={{__html: \`...\`}}` to inject the template string containing `{%param%}` tokens.
6. WHEN the arrow function has multiple parameters (e.g., `(item, index) => ...`), THE React_Plugin SHALL list all parameters in the `slot-props` attribute and replace each parameter reference with its corresponding `{%param%}` token.
7. WHEN the arrow function body contains JSX expressions that reference the parameters within curly braces (e.g., `{likes}`), THE React_Plugin SHALL replace them with `{%likes%}` tokens in the output HTML string.

### Requirement 4: AST Parsing and Transformation

**User Story:** As a plugin maintainer, I want the transformation to use proper AST parsing rather than regex, so that the plugin handles complex JSX structures correctly and avoids false positives.

#### Acceptance Criteria

1. THE React_Plugin SHALL use Babel (with `@babel/parser` and `@babel/traverse`) or an equivalent AST parser to parse JSX/TSX files.
2. THE React_Plugin SHALL only transform JSX elements whose tag name contains a hyphen (Custom_Element_Tag detection).
3. WHEN a JSX element is nested inside another Custom_Element_Tag's slot prop value, THE React_Plugin SHALL serialize it as HTML without further slot transformation.
4. THE React_Plugin SHALL preserve all non-slot props on the Custom_Element_Tag unchanged (e.g., `className`, `id`, event handlers, data attributes).
5. THE React_Plugin SHALL handle TypeScript type annotations in `.tsx` files without errors.
6. THE React_Plugin SHALL preserve source maps for accurate debugging by returning a `map` alongside the transformed code.

### Requirement 5: Prop Classification

**User Story:** As a React developer, I want the plugin to correctly distinguish between slot props, event handlers, and regular HTML/React attributes, so that only intended props are transformed into slots.

#### Acceptance Criteria

1. THE React_Plugin SHALL classify a prop as a Named_Slot_Prop when its value is a JSX expression or string literal AND its name does not match any exclusion rule.
2. THE React_Plugin SHALL classify a prop as a Render_Prop when its name starts with `render` followed by an uppercase letter AND its value is an arrow function expression.
3. THE React_Plugin SHALL NOT transform props whose names are in the set: `children`, `key`, `ref`, `className`, `id`, `style`, `slot`, `is`, `dangerouslySetInnerHTML`.
4. THE React_Plugin SHALL NOT transform props whose names start with `on` followed by an uppercase letter (React event handlers).
5. THE React_Plugin SHALL NOT transform props whose names start with `data-` or `aria-` (HTML data and accessibility attributes).
6. THE React_Plugin SHALL NOT transform props whose values are non-JSX expressions (e.g., `count={42}`, `disabled={true}`, `items={array}`).

### Requirement 6: HTML Serialization of JSX

**User Story:** As a plugin maintainer, I want JSX expressions in slot props to be correctly serialized to HTML strings, so that the WCC runtime can parse and render them.

#### Acceptance Criteria

1. WHEN serializing JSX to HTML for a named slot, THE React_Plugin SHALL convert JSX element names to their HTML equivalents (e.g., `className` → `class`, `htmlFor` → `for`).
2. WHEN serializing JSX to HTML, THE React_Plugin SHALL handle self-closing elements correctly (e.g., `<br />` → `<br>`).
3. WHEN serializing JSX to HTML, THE React_Plugin SHALL handle nested JSX elements recursively.
4. WHEN serializing JSX that contains string interpolation expressions not referencing render prop parameters, THE React_Plugin SHALL evaluate them as static values at build time where possible.
5. IF a JSX expression in a named slot prop contains dynamic expressions that cannot be statically evaluated, THEN THE React_Plugin SHALL emit a build warning indicating the slot content must be static.

### Requirement 7: Plugin Configuration Options

**User Story:** As a React developer with custom WCC component prefixes, I want to configure which element tags the plugin processes, so that it works with my project's naming conventions.

#### Acceptance Criteria

1. WHEN `wccReactPlugin()` is called without arguments, THE React_Plugin SHALL process all JSX elements whose tag name contains a hyphen.
2. WHEN `wccReactPlugin({ prefix: 'my-' })` is called with a custom prefix, THE React_Plugin SHALL only process JSX elements whose tag name starts with the specified prefix.
3. WHEN `wccReactPlugin({ exclude: ['header', 'footer'] })` is called with an exclude list, THE React_Plugin SHALL NOT transform props whose names are in the exclude list into slots.
4. WHEN `wccReactPlugin({ slotProps: ['header', 'footer', 'sidebar'] })` is called with an explicit slot props list, THE React_Plugin SHALL only transform props whose names are in the list into named slots (overriding default heuristic classification).

### Requirement 8: Error Handling and Diagnostics

**User Story:** As a React developer, I want clear error messages when the plugin encounters unsupported patterns, so that I can fix my code quickly.

#### Acceptance Criteria

1. IF a render prop's value is not an arrow function expression, THEN THE React_Plugin SHALL emit a build warning with the file path, line number, and a message explaining that render props must be arrow functions.
2. IF a render prop's arrow function body contains expressions that cannot be serialized to a static HTML template (e.g., function calls, conditional expressions referencing non-parameter variables), THEN THE React_Plugin SHALL emit a build warning identifying the unsupported expression.
3. IF the AST parser encounters a syntax error in a `.jsx` or `.tsx` file, THEN THE React_Plugin SHALL pass through the file unchanged and log a warning rather than failing the build.
4. THE React_Plugin SHALL include the source file path and line number in all warning messages.

### Requirement 9: Compatibility with Existing React Integration

**User Story:** As a React developer already using `useWccEvent` and `useWccModel`, I want the new plugin to work alongside my existing code without conflicts, so that I can adopt slot props incrementally.

#### Acceptance Criteria

1. THE React_Plugin SHALL NOT modify or interfere with `useWccEvent` hook usage in the same file.
2. THE React_Plugin SHALL NOT modify or interfere with `useWccModel` hook usage in the same file.
3. WHEN a WCC custom element uses both a `ref` prop (for hooks) and slot props in the same JSX element, THE React_Plugin SHALL preserve the `ref` prop and only transform the slot props.
4. THE React_Plugin SHALL NOT require changes to the WCC runtime or codegen — it produces output compatible with the existing `slot="name"`, `slot-props`, and `{%prop%}` token system.

### Requirement 10: Round-Trip Correctness for Scoped Slot Serialization

**User Story:** As a plugin maintainer, I want confidence that the render prop to scoped slot template transformation preserves semantic equivalence, so that the rendered output matches what the developer intended.

#### Acceptance Criteria

1. FOR ALL render prop arrow functions with a single parameter, THE React_Plugin output SHALL produce a template string where every occurrence of the parameter identifier in text content is replaced with `{%param%}` and no other content is altered.
2. FOR ALL render prop arrow functions with multiple parameters, THE React_Plugin output SHALL produce a template string where each parameter identifier is independently replaced with its corresponding `{%param%}` token.
3. THE React_Plugin SHALL NOT replace parameter name occurrences that appear inside HTML attribute names or tag names (only text content and attribute values).
4. WHEN the WCC_Runtime processes the generated template with actual prop values, THE rendered HTML SHALL be semantically equivalent to what the original render prop function would have produced with the same values.
