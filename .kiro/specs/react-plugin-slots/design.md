# Design Document: React Plugin Slots

## Overview

The `wccReactPlugin()` is a Vite plugin that transforms idiomatic React JSX patterns into WCC-compatible slot markup at build time. It follows the same philosophy as the existing `wccVuePlugin()`: intercept framework-idiomatic authoring patterns and rewrite them before the framework's own compilation step processes the file.

The plugin uses Babel AST parsing (`@babel/parser` + `@babel/traverse` + `@babel/generator`) to safely transform JSX/TSX files. It classifies props on custom element tags (tags containing a hyphen) into categories — named slot props, render props, event handlers, and pass-through HTML attributes — and rewrites only the slot-related props into child elements with `slot="name"`, `slot-props`, and `{%param%}` token markup.

**Key design goals:**
- Zero runtime overhead — all transformation happens at build time
- AST-based (not regex) for correctness with complex/nested JSX
- Coexists with existing `useWccEvent` and `useWccModel` hooks
- Mirrors the Vue plugin's output format (`slot="name"`, `slot-props="..."`, `{%param%}`)
- Configurable prefix, exclude list, and explicit slot props list

## Architecture

```mermaid
graph TD
    A[Vite Build Pipeline] --> B[wccReactPlugin - enforce: pre]
    B --> C{File is .jsx/.tsx?}
    C -->|No| D[Pass through unchanged]
    C -->|Yes| E[Parse with @babel/parser]
    E --> F[Traverse AST]
    F --> G{JSXElement has hyphenated tag?}
    G -->|No| H[Skip element]
    G -->|Yes| I[Classify props]
    I --> J[Named Slot Props]
    I --> K[Render Props]
    I --> L[Pass-through props]
    J --> M[Generate slot child elements]
    K --> N[Generate scoped slot elements]
    M --> O[Rewrite JSXElement children]
    N --> O
    O --> P[@babel/generator output + source map]
    P --> Q[@vitejs/plugin-react processes file]
```

The plugin sits in the Vite pipeline with `enforce: 'pre'`, ensuring it runs before `@vitejs/plugin-react`. It receives raw JSX/TSX source, transforms it, and passes the result downstream. The output is still valid JSX — it just has slot props replaced with child elements that React will render as normal DOM.

## Components and Interfaces

### 1. Plugin Entry Point (`wccReactPlugin`)

```typescript
interface WccReactPluginOptions {
  prefix?: string;           // Tag prefix filter (default: any hyphenated tag)
  exclude?: string[];        // Prop names to never treat as slots
  slotProps?: string[];      // Explicit list of prop names to treat as named slots
}

function wccReactPlugin(options?: WccReactPluginOptions): import('vite').Plugin
```

Returns a Vite plugin object with:
- `name: 'vite-plugin-wcc-react-slots'`
- `enforce: 'pre'`
- `transform(code, id)` — the main transform hook

### 2. Prop Classifier

Determines how each prop on a custom element should be handled.

```typescript
type PropClassification =
  | { type: 'slot'; name: string; value: JSXExpression }
  | { type: 'renderProp'; slotName: string; params: string[]; body: JSXElement }
  | { type: 'passthrough' }

function classifyProp(
  propName: string,
  propValue: BabelNode,
  options: WccReactPluginOptions
): PropClassification
```

**Classification rules (in priority order):**
1. **Always pass-through:** `children`, `key`, `ref`, `className`, `id`, `style`, `slot`, `is`, `dangerouslySetInnerHTML`
2. **Always pass-through:** Props starting with `on` + uppercase (event handlers)
3. **Always pass-through:** Props starting with `data-` or `aria-`
4. **Always pass-through:** Props in the user's `exclude` list
5. **Render prop:** Starts with `render` + uppercase AND value is ArrowFunctionExpression → scoped slot
6. **Always pass-through:** Props whose values are not JSX expressions or string literals (numbers, booleans, arrays, objects, identifiers)
7. **Named slot prop:** If `slotProps` option is set, only props in that list; otherwise, any remaining prop with a JSX or string literal value

### 3. JSX-to-HTML Serializer

Converts a Babel JSX AST node into an HTML string for use in slot content.

```typescript
function serializeJsxToHtml(node: BabelNode, paramNames?: string[]): string
```

**Responsibilities:**
- Convert JSX attribute names: `className` → `class`, `htmlFor` → `for`
- Handle self-closing HTML elements (void elements like `<br>`, `<img>`, `<input>`)
- Recursively serialize nested elements
- When `paramNames` is provided (scoped slot context): replace `{paramName}` expressions with `{%paramName%}` tokens
- Emit build warnings for dynamic expressions that can't be statically serialized

### 4. Slot Element Generator

Creates the replacement JSX child elements for slot props.

```typescript
// Named slot: header={<strong>Title</strong>}
// → <div slot="header"><strong>Title</strong></div>
function generateNamedSlotElement(slotName: string, content: BabelNode): JSXElement

// String slot: footer="Simple text"
// → <span slot="footer">Simple text</span>
function generateStringSlotElement(slotName: string, text: string): JSXElement

// Render prop: renderStats={(likes) => <span>{likes} likes!</span>}
// → <div slot="stats" slot-props="likes" dangerouslySetInnerHTML={{__html: `<span>{%likes%} likes!</span>`}}></div>
function generateScopedSlotElement(slotName: string, params: string[], body: BabelNode): JSXElement
```

### 5. Slot Name Derivation

```typescript
// renderStats → stats
// renderItemRow → itemRow
function deriveSlotName(renderPropName: string): string {
  const withoutPrefix = renderPropName.slice(6) // strip "render"
  return withoutPrefix[0].toLowerCase() + withoutPrefix.slice(1)
}
```

## Data Models

### AST Node Types (from @babel/types)

The plugin operates on these Babel AST node types:

| Node Type | Role |
|-----------|------|
| `JSXElement` | A JSX element like `<wcc-card>...</wcc-card>` |
| `JSXOpeningElement` | The opening tag with attributes |
| `JSXAttribute` | A single prop: `name={value}` |
| `JSXExpressionContainer` | Wraps `{expression}` in JSX |
| `JSXText` | Text content between elements |
| `ArrowFunctionExpression` | Render prop value: `(params) => body` |
| `StringLiteral` | String prop value: `"text"` |

### Plugin Options Schema

```typescript
{
  prefix?: string          // e.g., "wcc-" — only process tags starting with this
  exclude?: string[]       // e.g., ["header", "footer"] — never transform these props
  slotProps?: string[]     // e.g., ["header", "footer", "sidebar"] — only transform these
}
```

### Transform Output Shape

The `transform` hook returns:
```typescript
{
  code: string    // Transformed JSX/TSX source
  map: SourceMap  // Source map from @babel/generator
}
```

### JSX Attribute Name Mapping (for HTML serialization)

| JSX Attribute | HTML Attribute |
|---------------|---------------|
| `className` | `class` |
| `htmlFor` | `for` |
| `tabIndex` | `tabindex` |
| `readOnly` | `readonly` |
| `maxLength` | `maxlength` |
| `autoFocus` | `autofocus` |
| `autoComplete` | `autocomplete` |

### HTML Void Elements (self-closing, no end tag)

```
area, base, br, col, embed, hr, img, input, link, meta, param, source, track, wbr
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: File extension filtering

*For any* file ID that does not end with `.jsx` or `.tsx`, the plugin's `transform` function SHALL return `null` (no transformation).

**Validates: Requirements 1.4**

### Property 2: No-op for files without custom elements

*For any* valid JSX/TSX file that contains no elements with hyphenated tag names, the plugin's `transform` function SHALL return `null` (no transformation).

**Validates: Requirements 1.5**

### Property 3: Named slot prop produces div child

*For any* custom element tag and any prop whose name passes classification as a named slot prop and whose value is a JSX expression, the transformed output SHALL contain a `<div slot="propName">` child element wrapping the original JSX expression content.

**Validates: Requirements 2.1**

### Property 4: String slot prop produces span child

*For any* custom element tag and any prop whose name passes classification as a named slot prop and whose value is a string literal, the transformed output SHALL contain a `<span slot="propName">` child element containing the string text.

**Validates: Requirements 2.2**

### Property 5: Children ordering invariant

*For any* custom element with both existing children and slot props, the existing children SHALL appear before the generated slot elements in the transformed output.

**Validates: Requirements 2.3, 2.4**

### Property 6: Event handler props pass through

*For any* prop name matching the pattern `/^on[A-Z]/` on a custom element, the prop SHALL remain as an attribute on the element and SHALL NOT be transformed into a slot child, regardless of its value type.

**Validates: Requirements 2.6, 5.4**

### Property 7: Reserved props pass through

*For any* prop name in the set {`children`, `key`, `ref`, `className`, `id`, `style`, `slot`, `is`, `dangerouslySetInnerHTML`} on a custom element, the prop SHALL remain as an attribute and SHALL NOT be transformed into a slot child.

**Validates: Requirements 5.3**

### Property 8: data-/aria- props pass through

*For any* prop name starting with `data-` or `aria-` on a custom element, the prop SHALL remain as an attribute and SHALL NOT be transformed into a slot child.

**Validates: Requirements 5.5**

### Property 9: Non-JSX value props pass through

*For any* prop on a custom element whose value is not a JSX expression, string literal, or arrow function (e.g., numeric literals, boolean literals, identifiers, array/object expressions), the prop SHALL remain as an attribute and SHALL NOT be transformed into a slot child.

**Validates: Requirements 5.6**

### Property 10: Render prop produces scoped slot element

*For any* prop on a custom element whose name matches `/^render[A-Z]/` and whose value is an arrow function expression, the transformed output SHALL contain a `<div>` child element with `slot` attribute (derived name), `slot-props` attribute (parameter names), and `dangerouslySetInnerHTML={{__html: ...}}` containing the serialized template.

**Validates: Requirements 3.1, 3.5**

### Property 11: Slot name derivation

*For any* render prop name matching `/^render[A-Z]/`, the derived slot name SHALL equal the prop name with the `render` prefix stripped and the first remaining character lowercased (e.g., `renderStats` → `stats`, `renderItemRow` → `itemRow`).

**Validates: Requirements 3.2**

### Property 12: Parameter extraction to slot-props

*For any* render prop arrow function with N parameters (N ≥ 1), the generated `slot-props` attribute SHALL contain all N parameter names in order, comma-separated.

**Validates: Requirements 3.3, 3.6**

### Property 13: Parameter reference replacement

*For any* render prop arrow function with parameters `[p1, p2, ..., pN]`, every occurrence of `{pi}` in text content or attribute values within the JSX body SHALL be replaced with `{%pi%}` in the output template string, and no other content SHALL be altered.

**Validates: Requirements 3.4, 3.7, 10.1, 10.2**

### Property 14: No replacement in tag/attribute names

*For any* render prop where a parameter name coincidentally appears as part of an HTML tag name or attribute name, those occurrences SHALL NOT be replaced with `{%param%}` tokens.

**Validates: Requirements 10.3**

### Property 15: Non-slot props preserved on element

*For any* custom element with a mix of slot props and non-slot props (event handlers, reserved props, data-/aria- attributes, non-JSX values), all non-slot props SHALL remain as attributes on the element in the transformed output.

**Validates: Requirements 4.4, 9.3**

### Property 16: Source map returned

*For any* file that is transformed (returns non-null), the result SHALL include both a `code` string and a `map` object.

**Validates: Requirements 4.6**

### Property 17: Default processes all hyphenated tags

*For any* JSX element whose tag name contains a hyphen, when the plugin is configured with no `prefix` option, the element SHALL be processed for slot prop transformation.

**Validates: Requirements 4.2, 7.1**

### Property 18: Prefix filtering

*For any* prefix string P and any JSX element tag name T, when the plugin is configured with `{ prefix: P }`, the element SHALL be processed for slot transformation if and only if T starts with P.

**Validates: Requirements 7.2**

### Property 19: Exclude list

*For any* exclude list E and any prop name N on a custom element, when the plugin is configured with `{ exclude: E }`, the prop SHALL NOT be transformed into a slot if N is in E.

**Validates: Requirements 7.3**

### Property 20: Explicit slotProps list

*For any* slotProps list S and any prop name N with a JSX/string value on a custom element, when the plugin is configured with `{ slotProps: S }`, the prop SHALL be transformed into a slot if and only if N is in S (overriding default heuristic classification).

**Validates: Requirements 7.4**

### Property 21: Hook calls not modified

*For any* JSX/TSX file containing `useWccEvent` or `useWccModel` function calls alongside custom elements with slot props, the hook call expressions SHALL remain unchanged in the transformed output.

**Validates: Requirements 9.1, 9.2**

### Property 22: JSX attribute name mapping

*For any* JSX element within a slot prop value that uses React-specific attribute names (`className`, `htmlFor`, `tabIndex`, etc.), the serialized HTML output SHALL use the corresponding standard HTML attribute names (`class`, `for`, `tabindex`, etc.).

**Validates: Requirements 6.1**

### Property 23: Void elements serialized without closing tag

*For any* void HTML element (`br`, `img`, `input`, `hr`, etc.) within a slot prop value, the serialized HTML output SHALL NOT include a closing tag.

**Validates: Requirements 6.2**

### Property 24: Nested elements serialized recursively

*For any* nested JSX structure within a slot prop value (elements containing child elements), the serialized HTML output SHALL preserve the complete nesting structure with all elements properly opened and closed.

**Validates: Requirements 6.3**

### Property 25: Semantic equivalence of render prop output

*For any* render prop arrow function and any set of concrete parameter values, substituting those values into the `{%param%}` template string SHALL produce HTML that is semantically equivalent to serializing the JSX that the original arrow function would produce when called with those values.

**Validates: Requirements 10.4**

## Error Handling

### Parse Errors

When `@babel/parser` encounters a syntax error in a `.jsx`/`.tsx` file:
- The plugin returns `null` (file passes through unchanged)
- A warning is logged via Vite's `this.warn()` with the file path and error message
- The build does NOT fail — other plugins can still process the file

### Invalid Render Prop Values

When a prop matching `/^render[A-Z]/` has a value that is not an `ArrowFunctionExpression`:
- The prop is left unchanged (not transformed)
- A warning is emitted: `[wcc-react] ${filePath}:${line} — render prop "${propName}" must be an arrow function, skipping`

### Unsupported Expressions in Render Prop Bodies

When a render prop's arrow function body contains expressions that cannot be serialized to static HTML:
- Function calls referencing non-parameters
- Conditional expressions (`? :`) referencing non-parameter variables
- Spread expressions

The plugin:
- Emits a warning: `[wcc-react] ${filePath}:${line} — render prop "${propName}" contains dynamic expression that cannot be statically serialized`
- Falls back to leaving the prop unchanged (no transformation)

### Dynamic Expressions in Named Slot Props

When a named slot prop's JSX value contains dynamic expressions (variable references, function calls) that cannot be evaluated at build time:
- A warning is emitted: `[wcc-react] ${filePath}:${line} — slot prop "${propName}" contains dynamic expression; slot content must be static`
- The prop is left unchanged

### Warning Format

All warnings follow the pattern:
```
[wcc-react] <filePath>:<lineNumber> — <message>
```

## Testing Strategy

### Property-Based Testing

This feature is well-suited for property-based testing because:
- The core logic is pure transformation (JSX AST in → JSX AST out)
- There are clear universal properties that should hold across all valid inputs
- The input space is large (arbitrary prop names, JSX structures, parameter names)
- The transformations are deterministic

**Library:** `fast-check` (already a devDependency in the project)

**Configuration:**
- Minimum 100 iterations per property test
- Each property test tagged with: `Feature: react-plugin-slots, Property {N}: {title}`

**Generators needed:**
- Valid JSX prop names (alphabetic, camelCase)
- Render prop names (`render` + uppercase + suffix)
- Arrow function parameter names (valid JS identifiers)
- Simple JSX structures (elements with text, attributes, nesting)
- Custom element tag names (word + hyphen + word)
- File IDs with various extensions

### Unit Tests (Example-Based)

Unit tests cover specific examples, edge cases, and integration points:

1. **Plugin structure** — verify export, name, enforce, transform function
2. **Nested custom elements in slot values** — verify no recursive transformation (Req 4.3)
3. **TypeScript annotations** — verify TSX with generics/type annotations parses correctly (Req 4.5)
4. **Static expression evaluation** — verify string concatenation in slot content (Req 6.4)
5. **Dynamic expression warnings** — verify warnings for function calls in slot content (Req 6.5)
6. **Invalid render prop values** — verify warning for non-arrow-function render props (Req 8.1)
7. **Unsupported render prop bodies** — verify warning for complex expressions (Req 8.2)
8. **Syntax error handling** — verify graceful pass-through on malformed JSX (Req 8.3)
9. **Warning format** — verify file path and line number in messages (Req 8.4)
10. **Coexistence with hooks** — verify useWccEvent/useWccModel calls preserved (Req 9.1, 9.2)

### Test File Organization

```
lib/
  integrations.react-slots.test.js       # Property tests + unit tests for the plugin
```

### Dependencies to Add

The plugin requires these Babel packages (as dependencies, since they're needed at build time):

```json
{
  "@babel/parser": "^7.24.0",
  "@babel/traverse": "^7.24.0",
  "@babel/generator": "^7.24.0",
  "@babel/types": "^7.24.0"
}
```

These are added to `dependencies` in package.json (not devDependencies) because the plugin runs as part of the consumer's Vite build.
