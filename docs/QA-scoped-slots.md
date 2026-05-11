# QA Testing Guide — Cross-Framework Scoped Slots

## Overview

WCC scoped slots let a child component expose reactive data to consumer-provided template content. This guide covers how scoped slots work in each framework and why different syntax is needed.

---

## 1. Why `{{prop}}` Can't Be Used in Vue/Angular

The `{{prop}}` interpolation syntax conflicts with host framework template compilers:

| Framework | Problem |
|-----------|---------|
| **Vue** | Vue's template compiler intercepts `{{prop}}` as its own interpolation. It tries to resolve `prop` against the component's scope and either errors or renders the wrong value. |
| **Angular** | Angular's template compiler also uses `{{prop}}` for interpolation binding. It will attempt to evaluate the expression against the component class and fail or produce incorrect output. |
| **React** | JSX doesn't use `{{}}` syntax, so there's no conflict. However, `<template>` elements don't work in JSX (React renders them as inert DOM), so a different delivery mechanism is needed. |

**Solution:** WCC supports an escape syntax `{%prop%}` that no framework recognizes or processes. These tokens pass through compilation untouched and reach the WCC runtime for reactive replacement.

---

## 2. WCC-to-WCC (Unchanged Behavior)

When a WCC component consumes another WCC component, the original `<template>` syntax works as-is. No escape syntax is needed because there's no host framework compiler in the way.

### Usage

```html
<wcc-list>
  <template #item="{ name, age }">
    <span>{{name}} is {{age}} years old</span>
  </template>
</wcc-list>
```

### How It Works

1. WCC reads the `<template>` with `#item` attribute and `"{ name, age }"` props expression
2. Stores the innerHTML as the slot template string
3. The reactive effect replaces `{{name}}` and `{{age}}` with current prop values on each update

### Test Cases

| # | Test | Expected |
|---|------|----------|
| 1 | `<template #item="{ name }">{{name}}</template>` | Token replaced with prop value |
| 2 | `<template #item="{ name, age }">{{name}} {{age}}</template>` | Multiple tokens replaced |
| 3 | Prop value changes reactively | Template re-renders with new values |
| 4 | `{{unknownProp}}` in template | Token remains unreplaced |

---

## 3. Vue Integration (with wccVuePlugin)

Vue developers use familiar `<template #name="{ props }">` syntax. The `wccVuePlugin` pre-transform handles the conversion automatically before Vue's compiler runs.

### What You Write

```vue
<template>
  <wcc-list>
    <template #item="{ name, age }">
      <span>{{name}} is {{age}} years old</span>
    </template>
  </wcc-list>
</template>
```

### What the Plugin Transforms It To

```html
<wcc-list>
  <div slot="item" slot-props="name, age">
    <span>{%name%} is {%age%} years old</span>
  </div>
</wcc-list>
```

### How It Works

1. The plugin detects `<template #item="{ name, age }">` inside a custom element (tag with hyphen)
2. Extracts the prop names from the destructuring expression
3. Replaces `{{propName}}` → `{%propName%}` in the content for each declared prop
4. Outputs `<div slot="item" slot-props="name, age">` with the escaped content
5. Vue compiles the `<div>` as plain HTML — no interpolation processing
6. At runtime, WCC reads `slot="item"` + `slot-props="name, age"` + innerHTML
7. The reactive effect replaces `{%name%}` and `{%age%}` with current values

### Important Notes

- Only `{{prop}}` tokens matching declared prop names are escaped
- Other `{{expr}}` in the template (e.g., Vue component data) are left for Vue to handle
- Non-scoped `<template #name>` (without props) is transformed to `<div slot="name">` without modifying content (existing named slot behavior)
- `<template v-slot:name="{ props }">` syntax is also supported

### Test Cases

| # | Test | Expected |
|---|------|----------|
| 1 | Single prop: `<template #item="{ name }">{{name}}</template>` | Transforms to `<div slot="item" slot-props="name">{%name%}</div>` |
| 2 | Multiple props: `<template #item="{ name, age }">` | Both `{{name}}` and `{{age}}` escaped |
| 3 | Non-declared prop: `{{otherVar}}` in content | Left unchanged for Vue |
| 4 | Non-scoped slot: `<template #footer>` | Transforms to `<div slot="footer">` without escaping |
| 5 | `v-slot:name` syntax | Same transform as `#name` shorthand |
| 6 | Whitespace: `{{ name }}` | Transforms to `{% name %}` |

---

## 4. React Integration (slot-template-name + {%prop%})

React/JSX doesn't support `<template>` elements, so scoped slot content is passed as a string attribute on a regular element.

### Usage

```jsx
function App() {
  return (
    <wcc-list>
      <div slot-template-item="<span>{%name%} is {%age%} years old</span>"></div>
    </wcc-list>
  )
}
```

### How It Works

1. React renders the `<div>` with the `slot-template-item` attribute as-is (JSX treats it as a plain attribute)
2. WCC's `connectedCallback` detects the `slot-template-item` attribute
3. Stores the attribute value as the template string for the `item` slot
4. Removes the attribute from the element (cleanup)
5. The reactive effect replaces `{%name%}` and `{%age%}` with current prop values

### Important Notes

- The attribute value is raw HTML — it becomes the slot's innerHTML
- Use `{%prop%}` syntax (not `{{prop}}`) since the template is a string attribute
- The `<div>` carrier element is just a delivery mechanism; it doesn't affect layout
- If both `slot="item"` element content and `slot-template-item` attribute exist, element-based wins

### Test Cases

| # | Test | Expected |
|---|------|----------|
| 1 | `slot-template-item="<span>{%name%}</span>"` | Token replaced with prop value |
| 2 | Multiple tokens in attribute value | All tokens replaced |
| 3 | Prop value changes reactively | Slot content re-renders |
| 4 | Attribute removed after reading | No leftover `slot-template-*` attributes in DOM |

---

## 5. Angular Integration (slot-template-name + {%prop%})

Angular also uses `{{}}` for interpolation, so the same `slot-template-name` attribute pattern is used.

### Usage

```html
<!-- Angular component template -->
<wcc-list>
  <div slot-template-item="<span>{%name%} is {%age%} years old</span>"></div>
</wcc-list>
```

### How It Works

1. Angular renders the `<div>` with the `slot-template-item` attribute as-is (Angular doesn't process `{%...%}`)
2. WCC's `connectedCallback` detects the `slot-template-item` attribute
3. Stores the attribute value as the template string for the `item` slot
4. Removes the attribute from the element (cleanup)
5. The reactive effect replaces `{%name%}` and `{%age%}` with current prop values

### Important Notes

- Identical pattern to React — the `slot-template-name` attribute works the same way
- Angular's `{{}}` interpolation is NOT used inside the attribute value
- `{%prop%}` tokens are invisible to Angular's template compiler
- If the WCC component re-renders its scoped slot, Angular won't interfere with the content

### Test Cases

| # | Test | Expected |
|---|------|----------|
| 1 | `slot-template-item="<span>{%name%}</span>"` | Token replaced with prop value |
| 2 | Multiple tokens in attribute value | All tokens replaced |
| 3 | Prop value changes reactively | Slot content re-renders |
| 4 | Angular re-renders parent template | WCC scoped slot content remains intact |

---

## 6. Syntax Reference

| Syntax | Where to Use | Example |
|--------|-------------|---------|
| `{{prop}}` | WCC-to-WCC only | `<template #item="{ name }">{{name}}</template>` |
| `{%prop%}` | Vue (auto by plugin), React, Angular | `{%name%}` in slot content or attribute |
| `<template #name="{ props }">` | WCC-to-WCC, Vue (with plugin) | Scoped slot declaration |
| `slot-template-name="..."` | React, Angular | `<div slot-template-item="<span>{%name%}</span>">` |
| `slot-props="prop1, prop2"` | Generated by Vue plugin | `<div slot="item" slot-props="name, age">` |

---

## 7. Priority Rules

When multiple slot sources exist for the same slot name:

1. **Element-based** (`<template #name>` or `<div slot="name">`) takes priority
2. **Attribute-based** (`slot-template-name`) is used as fallback
3. **Slot fallback content** (defined in the child component) is used if neither is provided

---

## 8. Regression Checklist

- [ ] Existing `<template #name="{ prop }">{{prop}}</template>` WCC-to-WCC still works
- [ ] Named slots (non-scoped) still work in all frameworks
- [ ] `{%prop%}` tokens are replaced reactively
- [ ] Mixed `{{prop1}}` and `{%prop2%}` in same template both resolve
- [ ] `slot-template-name` attribute is removed after reading
- [ ] Element-based slot takes priority over attribute-based
- [ ] Vue plugin only escapes declared prop names (not arbitrary `{{expr}}`)
- [ ] Whitespace inside delimiters is handled: `{% prop %}` and `{%prop%}` are equivalent
- [ ] Null/undefined prop values render as empty string
