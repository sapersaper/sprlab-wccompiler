# QA Testing Guide — defineModel

## Overview

`defineModel` adds two-way bindable props to WCC components. This guide covers how to test the feature in isolation and with each framework integration (Vue, Angular, React).

---

## 1. Core Behavior (Framework-agnostic)

### 1.1 Component Declaration

```js
// wcc-input.wcc
<script>
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'wcc-input' })

const value = defineModel({ name: 'value', default: '' })

function onInput(e) {
  value.set(e.target.value)
}
</script>

<template>
<input @input="onInput" :value="value()">
</template>
```

### 1.2 Test Cases

| # | Test | Expected |
|---|------|----------|
| 1 | Set attribute externally: `el.setAttribute('value', 'hello')` | Internal signal updates, NO `wcc:model` event emitted |
| 2 | Set property externally: `el.value = 'hello'` | Internal signal updates, attribute syncs, NO `wcc:model` event |
| 3 | Internal `.set()` call (user types in input) | Signal updates, `wcc:model` event emitted with `{ prop: 'value', value: 'hello', oldValue: '' }` |
| 4 | `wcc:model` event has `bubbles: true` | Event reaches parent/document listeners |
| 5 | `wcc:model` event has `composed: true` | Event crosses shadow DOM boundaries |
| 6 | Multiple defineModel props | Each prop has independent signal, getter/setter, and event emission |

### 1.3 Vanilla JS Usage (No Adapter)

```html
<wcc-input id="myInput"></wcc-input>
<script>
  const el = document.getElementById('myInput')

  // Listen for internal changes
  el.addEventListener('wcc:model', (e) => {
    console.log(`${e.detail.prop} changed: ${e.detail.oldValue} → ${e.detail.value}`)
  })

  // Set externally (no event emitted)
  el.setAttribute('value', 'external')
</script>
```

---

## 2. Vue Integration

### 2.1 Setup

```js
// vite.config.js
import { wccVuePlugin } from '@sprlab/wccompiler/integrations/vue'

export default {
  plugins: [wccVuePlugin()]
}
```

The Vue integration automatically imports the `wcc:model → update:propName` adapter.

### 2.2 Usage

```vue
<template>
  <!-- v-model:propName works out of the box -->
  <wcc-input v-model:value="searchText"></wcc-input>
  <p>You typed: {{ searchText }}</p>
</template>

<script setup>
import { ref } from 'vue'
const searchText = ref('')
</script>
```

### 2.3 Test Cases

| # | Test | Expected |
|---|------|----------|
| 1 | `v-model:value` binds Vue ref to WCC prop | Initial value syncs to component |
| 2 | User types in WCC input | Vue ref updates reactively |
| 3 | Vue ref changes programmatically | WCC component attribute updates |
| 4 | Multiple `v-model:propName` on same component | Each prop binds independently |
| 5 | `v-model:propName` with `.number` modifier | Value coerced to number |

### 2.4 How It Works

1. Vue sets the attribute on the WCC element (parent → child)
2. WCC component emits `wcc:model` on internal write
3. Adapter translates to `update:propName` CustomEvent
4. Vue's `v-model` listens for `update:propName` and updates the ref

---

## 3. Angular Integration

### 3.1 Setup

```ts
// main.ts or app.module.ts
import '@sprlab/wccompiler/integrations/angular'

// In your component or module:
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core'

@Component({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  // ...
})
```

The Angular integration automatically imports the `wcc:model → propNameChange` adapter.

### 3.2 Usage

```html
<!-- Angular banana-in-a-box syntax -->
<wcc-input [(value)]="searchText"></wcc-input>
<p>You typed: {{ searchText }}</p>
```

```ts
@Component({ /* ... */ })
export class AppComponent {
  searchText = ''
}
```

### 3.3 Test Cases

| # | Test | Expected |
|---|------|----------|
| 1 | `[(value)]` binds Angular property to WCC prop | Initial value syncs to component |
| 2 | User types in WCC input | Angular property updates |
| 3 | Angular property changes | WCC component attribute updates |
| 4 | Multiple `[(propName)]` on same component | Each prop binds independently |
| 5 | One-way `[value]` still works (no Change event needed) | Attribute set, no two-way sync |

### 3.4 How It Works

1. Angular sets `[value]` attribute on the WCC element (parent → child)
2. WCC component emits `wcc:model` on internal write
3. Adapter translates to `valueChange` CustomEvent
4. Angular's `()` binding listens for `valueChange` and updates the property

---

## 4. React Integration

### 4.1 Setup

```jsx
import { useWccModel } from '@sprlab/wccompiler/integrations/react'
```

No adapter import needed — React uses the `wcc:model` event directly via the hook.

### 4.2 Usage

```jsx
import { useState } from 'react'
import { useWccModel } from '@sprlab/wccompiler/integrations/react'

function App() {
  const [text, setText] = useState('')
  const inputRef = useWccModel('value', text, setText)

  return (
    <div>
      <wcc-input ref={inputRef}></wcc-input>
      <p>You typed: {text}</p>
    </div>
  )
}
```

### 4.3 Test Cases

| # | Test | Expected |
|---|------|----------|
| 1 | `useWccModel` syncs initial state to attribute | Component receives initial value |
| 2 | User types in WCC input | React state updates via `wcc:model` listener |
| 3 | React state changes via `setText()` | WCC component attribute updates |
| 4 | Multiple `useWccModel` hooks for different props | Each prop binds independently |
| 5 | Component unmounts | Event listener is cleaned up (no memory leak) |
| 6 | `null`/`undefined` value | Attribute is removed from element |

### 4.4 How It Works

1. `useWccModel` sets the attribute on the WCC element when React state changes (parent → child)
2. `useWccModel` listens for `wcc:model` events and calls the setter when `detail.prop` matches (child → parent)
3. No adapter needed — the hook handles the `wcc:model` event directly

---

## 5. WCC-to-WCC Binding (No Framework)

### 5.1 Usage

```html
<!-- Parent component template -->
<wcc-child model:value="parentSignal"></wcc-child>
```

### 5.2 Test Cases

| # | Test | Expected |
|---|------|----------|
| 1 | Parent signal changes | Child attribute updates reactively |
| 2 | Child emits `wcc:model` (internal write) | Parent signal updates |
| 3 | Circular update prevention | No infinite loop (parent writes directly to signal, not via _modelSet) |
| 4 | Multiple `model:propName` on same child | Each binding works independently |
| 5 | `model:propName` on non-custom-element | Compile-time error `MODEL_PROP_INVALID_TARGET` |

---

## 6. Compile-Time Error Testing

| Error Code | Trigger | Expected Message |
|---|---|---|
| `MODEL_MISSING_NAME` | `defineModel({ default: '' })` (no `name`) | `defineModel() requires a 'name' property in the options object` |
| `MODEL_NO_ASSIGNMENT` | `defineModel({ name: 'x' })` (not assigned to variable) | `defineModel() must be assigned to a variable` |
| `MODEL_NAME_CONFLICT` | `defineModel({ name: 'count' })` when `count` is already a signal | `defineModel prop 'count' conflicts with existing signal 'count'` |
| `MODEL_PROP_INVALID_TARGET` | `<div model:value="x">` | `model:propName is only valid on custom elements` |
| `MODEL_PROP_UNKNOWN_VAR` | `<my-child model:value="nonExistent">` | `model:propName references undeclared variable 'nonExistent'` |
| `MODEL_PROP_READONLY` | `<my-child model:value="myComputed">` | `model:propName cannot bind to computed 'myComputed' (read-only)` |

---

## 7. Regression Checklist

- [ ] Existing `model="signal"` on `<input>`, `<textarea>`, `<select>` still works
- [ ] Checkbox `model="checked"` still binds to boolean
- [ ] Radio `model="selected"` still compares with `value` attribute
- [ ] Number input `model="count"` still coerces to Number
- [ ] `model="signal"` and `model:propName="signal"` coexist in same template
- [ ] All existing tests in `lib/codegen.model.test.js` pass
- [ ] All existing tests in `lib/compiler.model.test.js` pass
