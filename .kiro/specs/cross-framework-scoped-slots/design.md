# Design Document — Cross-Framework Scoped Slots

## Overview

This feature extends WCC's scoped slot system to work when components are consumed inside Vue, React, and Angular. The core challenge is that `{{prop}}` interpolation tokens are intercepted by host framework compilers before reaching the WCC runtime.

The solution has three parts:
1. **Escape syntax** (`{%prop%}`) — tokens that frameworks don't recognize
2. **Vue plugin enhancement** — auto-transforms `{{prop}}` → `{%prop%}` inside scoped slot templates
3. **String attribute pattern** (`slot-template-name`) — alternative delivery for React/Angular

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Authoring (per framework)                                │
├─────────────────────────────────────────────────────────┤
│ WCC-to-WCC: <template #item="{ item }">{{item}}</template>  │
│ Vue:        <template #item="{ item }">{{item}}</template>  │
│             (plugin transforms → <div slot="item">{%item%}</div>) │
│ React:      <div slot-template-item="<span>{%item%}</span>" /> │
│ Angular:    <div slot-template-item="<span>{%item%}</span>" /> │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ WCC Runtime (connectedCallback)                          │
├─────────────────────────────────────────────────────────┤
│ 1. Detect <template #name="props"> (WCC-to-WCC)         │
│ 2. Detect <div slot="name"> with content (named/scoped) │
│ 3. Detect slot-template-name attribute (React/Angular)   │
│ 4. Store template string in this.__slotTpl_<name>        │
│ 5. __effect: replace {{prop}} AND {%prop%} reactively    │
└─────────────────────────────────────────────────────────┘
```

## Components and Changes

### 1. Codegen — Combined Regex Pattern

Current regex (only matches `{{prop}}`):
```js
__html = __html.replace(new RegExp('\\{\\{\\s*' + k + '(\\(\\))?\\s*\\}\\}', 'g'), v ?? '');
```

New regex (matches both `{{prop}}` and `{%prop%}`):
```js
__html = __html.replace(new RegExp('(?:\\{\\{|\\{%)\\s*' + k + '(\\(\\))?\\s*(?:\\}\\}|%\\})', 'g'), v ?? '');
```

### 2. Codegen — Slot Parser (slot-template-name attribute)

Add detection of `slot-template-<name>` attributes in the `connectedCallback` slot resolution loop:

```js
// After checking slot="name" on regular elements:
} else if (child.nodeType === 1) {
  // Check for slot-template-<name> attributes
  for (const attr of Array.from(child.attributes)) {
    if (attr.name.startsWith('slot-template-')) {
      const slotName = attr.name.slice('slot-template-'.length);
      if (!__slotMap[slotName]) { // element-based takes priority
        __slotMap[slotName] = { content: attr.value, propsExpr: '' };
      }
      child.removeAttribute(attr.name);
    }
  }
}
```

### 3. Vue Plugin — Scoped Slot Transform

Extend the existing pre-transform to handle scoped slots:

```js
// <template #name="{ prop1, prop2 }">content with {{prop1}}</template>
// → <div slot="name" slot-props="prop1, prop2">content with {%prop1%}</div>

// Step 1: Match <template #name="{ destructured }">
// Step 2: Extract prop names from destructuring
// Step 3: Replace {{propName}} → {%propName%} ONLY for declared props
// Step 4: Output <div slot="name">transformed content</div>
```

### 4. Slot Props Attribute

When the Vue plugin transforms a scoped slot, it adds `slot-props="prop1, prop2"` to the element. The WCC runtime uses this to know which props to resolve (same as `propsExpr` from `<template #name="{ props }">`).

The runtime reads `slot-props` attribute and stores it alongside the template content:
```js
} else if (child.nodeType === 1 && child.getAttribute('slot')) {
  const slotName = child.getAttribute('slot');
  const propsExpr = child.getAttribute('slot-props') || '';
  child.removeAttribute('slot');
  child.removeAttribute('slot-props');
  __slotMap[slotName] = { content: child.innerHTML, propsExpr };
}
```

## Data Flow

### Vue (with plugin)

1. Dev writes: `<template #item="{ name, age }">{{name}} is {{age}}</template>`
2. Plugin transforms to: `<div slot="item" slot-props="name, age">{%name%} is {%age%}</div>`
3. Vue compiles the `<div>` as plain HTML (no interpolation processing)
4. At runtime, WCC reads `slot="item"` + `slot-props="name, age"` + innerHTML `{%name%} is {%age%}`
5. WCC `__effect` replaces `{%name%}` and `{%age%}` with current values

### React/Angular (slot-template attribute)

1. Dev writes: `<div slot-template-item="<span>{%name%} is {%age%}</span>"></div>`
2. Framework renders the `<div>` with the attribute as-is
3. WCC reads `slot-template-item` attribute value as the template string
4. WCC `__effect` replaces `{%name%}` and `{%age%}` with current values

### WCC-to-WCC (unchanged)

1. Dev writes: `<template #item="{ name, age }">{{name}} is {{age}}</template>`
2. WCC reads `<template>` with `#item` attribute, stores innerHTML + propsExpr
3. WCC `__effect` replaces `{{name}}` and `{{age}}` with current values

## Error Handling

- If `{%prop%}` references a prop not exposed by the slot → token remains unreplaced (visible as `{%unknownProp%}`)
- If `slot-template-name` has malformed HTML → innerHTML is set as-is (browser handles parsing)
- If both `slot="name"` element and `slot-template-name` attribute exist → element-based wins

## Testing Strategy

- Unit tests for the combined regex (both syntaxes, mixed, with whitespace)
- Unit tests for `slot-template-name` attribute detection in codegen output
- Integration test: compile a component with scoped slots, verify output handles both syntaxes
- Vue plugin test: verify `{{prop}}` → `{%prop%}` transform inside scoped slot templates
- Property test: for any prop name and value, both `{{prop}}` and `{%prop%}` are replaced correctly
