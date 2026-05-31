# Requirements: if + `<component :is>` inside nested forEach

## Overview

Currently, using `if/else` to wrap a `<component :is="...">` works at the top level of a
component template, but fails when the same pattern is used inside a nested forEach loop
(forBlock inside another forBlock or inside an if-block branch).

This feature ensures that `if/else` wrapping dynamic components works correctly at any
nesting depth — including inside nested forEach templates.

## Reproduction

### Working (top-level)

```html
<div if="showComponent()">
  <component :is="currentView()"></component>
</div>
<p else>Hidden</p>
```

### Broken (inside nested forEach)

```html
<div each="subItem in items">
  <div if="level3Visible">
    <component :is="subItem.type"></component>
  </div>
  <div else>
    <p>Component hidden</p>
  </div>
</div>
```

The if/else chain is inside the forEach template. When processed by `walkBranch`, the
`processIfChains` step consumes the if/else, and `processDynamicComponents` can no longer
find the `<component>` element in the remaining DOM.

## Requirements

### REQ-1: Tree-walker preserves dynamic components inside if-blocks

When `processIfChains` processes an if/else chain that contains a `<component :is>` element
inside one of its branches, the resulting ifBlock SHALL include the dynamic component data
in `branch.dynamicComponents`.

**Acceptance criteria:**
- Compile `test-deep-nesting.wcc` with `if="level3Visible"` wrapping `<component :is="subItem.type">`
- The compiled output SHALL contain `document.createElement(__tag)`
- The compiled output SHALL contain `<!-- if -->` comment in the forEach template

### REQ-2: Codegen generates if-blocks for nested forEach items

When a forBlock (at any nesting depth) has `ifBlocks`, the codegen SHALL generate the
if-block rendering code inside the forEach item setup, including:
- Branch template creation (one template per branch)
- Condition evaluation per item
- Branch DOM insertion at the if-block anchor
- Dynamic component creation inside branches that contain dynamic components

**Acceptance criteria:**
- Nested forEach items with if-blocks compile to valid JS
- The generated code creates and destroys DOM elements correctly when the condition changes

### REQ-3: if/else wrapping `<component>` works at the same nesting level as the component

The `if`/`else` elements that wrap a `<component>` SHALL work correctly when they are
siblings of the component (not ancestors in a separate container).

**Acceptance criteria:**
- `<div if="cond"><component :is="..."/></div><div else>...</div>` works inside a forEach template
- The component is created/destroyed when the condition toggles
- The `else` branch content is shown when the condition is false

### REQ-4: No regression on existing if/else behavior

All existing tests that use `if/else` (top-level, inside forEach without dynamic components,
inside slots) SHALL continue to pass.

### REQ-5: No regression on show-based visibility

Components that use `show` to toggle visibility SHALL continue to work correctly.

## Edge Cases

- if/else wrapping component at depth 3+ (each → if → component)
- Multiple if-blocks in the same forEach template
- if/else wrapping component inside a dynamic component's slot content
- if/else wrapping component with props and events forwarded
