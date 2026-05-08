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

### 2.1 Setup (TWO separate imports)

```js
// vite.config.js — Node.js context (Vite plugin)
import { wccVuePlugin } from '@sprlab/wccompiler/integrations/vue'

export default {
  plugins: [wccVuePlugin()]
}
```

```js
// main.js — Browser context (adapter + directive, ONE line)
import { createApp } from 'vue'
import { wccVue } from '@sprlab/wccompiler/adapters/vue'
import App from './App.vue'

const app = createApp(App)
app.use(wccVue)  // Registers adapter + v-wcc-model directive globally
app.mount('#app')
```

> **IMPORTANT**: Do NOT import `@sprlab/wccompiler/integrations/vue` in browser code.
> It imports `@vitejs/plugin-vue` which causes `createRequire is not a function` errors.
> The integration file is ONLY for `vite.config.js`.

### 2.2 Usage — Single prop (v-model)

For `v-model` to work, the WCC component must declare a prop named `modelValue`:

```js
// wcc-input.wcc
const value = defineModel({ name: 'modelValue', default: '' })
```

```vue
<template>
  <!-- Vue's native v-model on custom elements uses modelValue + update:modelValue -->
  <wcc-input v-model="searchText"></wcc-input>
  <p>You typed: {{ searchText }}</p>
</template>

<script setup>
import { ref } from 'vue'
const searchText = ref('')
</script>
```

### 2.3 Usage — Multiple props (v-wcc-model)

For additional model props beyond the primary `modelValue`, use the `v-wcc-model` directive:

```vue
<template>
  <wcc-form
    v-model="mainValue"
    v-wcc-model:count="countRef"
    v-wcc-model:title="titleRef"
  ></wcc-form>
</template>

<script setup>
import { ref } from 'vue'
import { vWccModel } from '@sprlab/wccompiler/adapters/vue'

const mainValue = ref('')
const countRef = ref(0)
const titleRef = ref('untitled')
</script>
```

### 2.4 Test Cases

| # | Test | Expected |
|---|------|----------|
| 1 | `v-model="ref"` with `modelValue` prop | Bidirectional: Vue ref ↔ WCC prop |
| 2 | User triggers internal change in WCC | Vue ref updates (via `update:modelValue` event) |
| 3 | Vue ref changes programmatically | WCC attribute updates |
| 4 | `v-wcc-model:count="ref"` | Bidirectional: Vue ref ↔ WCC `count` prop |
| 5 | Multiple `v-wcc-model` on same element | Each prop binds independently |
| 6 | Component unmounts | Event listeners cleaned up (no memory leak) |
| 7 | `import '@sprlab/wccompiler/adapters/vue'` in main.js | No `createRequire` error |
| 8 | `v-model:propName` (Vue native on CE) | Does NOT work — this is expected, use `v-wcc-model:propName` instead |

### 2.5 How It Works

1. **v-model** (single prop):
   - Vue sets `modelValue` attribute on the WCC element
   - WCC emits `wcc:model` with `{ prop: 'modelValue', value: x }`
   - Adapter translates to `update:modelValue` CustomEvent
   - Vue's `v-model` picks it up and updates the ref

2. **v-wcc-model:propName** (multi-prop):
   - Directive sets `propName` attribute on mount/update
   - Directive listens for `wcc:model` events where `detail.prop === propName`
   - On match, updates the bound Vue ref

### 2.6 Known Limitations

- `v-model:propName` (with argument) does NOT work on custom elements in Vue — this is a Vue limitation, not a WCC bug
- Use `v-wcc-model:propName` instead for additional props
- The primary prop should be named `modelValue` for `v-model` compatibility

---

## 3. Angular Integration

### 3.1 Setup

```ts
// main.ts — import adapter ONCE (registers document-level listener)
import '@sprlab/wccompiler/adapters/angular'
```

```ts
// In your component or module:
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
  selector: 'app-root',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<wcc-input [(value)]="text"></wcc-input>`
})
export class AppComponent {
  text = '';
}
```

### 3.2 Usage — [(prop)] two-way binding

```html
<!-- Angular template -->
<wcc-input [(value)]="text"></wcc-input>
<wcc-counter [(count)]="myCount"></wcc-counter>
```

Angular's `[(prop)]` expands to `[prop]="value" (propChange)="value = $event.detail"`.
The adapter translates `wcc:model` → `propChange` with `queueMicrotask` to avoid timing issues.

### 3.3 Usage — ngModel (requires ControlValueAccessor)

For `ngModel` or Reactive Forms, you need a `ControlValueAccessor` directive.
See the implementation guide in `@sprlab/wccompiler/adapters/angular` (commented TypeScript code).

```ts
// Copy WccValueAccessor from adapters/angular.js into your project as .ts
// Then use:
<wcc-input wccModel [(ngModel)]="text"></wcc-input>
```

### 3.4 Test Cases

| # | Test | Expected |
|---|------|----------|
| 1 | `[(value)]="text"` binds Angular property to WCC prop | Bidirectional |
| 2 | User triggers internal change in WCC | Angular property updates (via `valueChange` event) |
| 3 | Angular property changes | WCC attribute updates |
| 4 | Multiple `[(prop)]` on same element | Each prop binds independently |
| 5 | No NG0600 error during render | `queueMicrotask` defers the event |
| 6 | One-way `[value]` still works | Attribute set, no two-way sync |
| 7 | `ngModel` with WccValueAccessor | Works with FormsModule |
| 8 | Without adapter imported | `wcc:model` still emits, but no `propChange` translation |

### 3.5 How It Works

1. Angular sets `[prop]` attribute on the WCC element
2. WCC emits `wcc:model` with `{ prop, value, oldValue }`
3. Adapter defers via `queueMicrotask` (avoids NG0600)
4. Adapter dispatches `propChange` CustomEvent on the element
5. Angular's `(propChange)` binding picks it up

### 3.6 Known Limitations

- `[(ngModel)]` requires a `ControlValueAccessor` — the adapter alone is not enough
- The `queueMicrotask` defer means the update is asynchronous (one microtask later)
- Angular content projection timing may still affect slots (separate issue)

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

### 4.3 Multiple props

```jsx
function App() {
  const [value, setValue] = useState('')
  const [count, setCount] = useState(0)

  const ref1 = useWccModel('value', value, setValue)
  // For multiple props on same element, use useWccEvent on a shared ref:
  const sharedRef = useRef(null)
  useWccModel('value', value, setValue, sharedRef)
  useWccModel('count', count, setCount, sharedRef)

  return <wcc-form ref={sharedRef}></wcc-form>
}
```

### 4.4 Test Cases

| # | Test | Expected |
|---|------|----------|
| 1 | `useWccModel` syncs initial state to attribute | Component receives initial value |
| 2 | User triggers internal change in WCC | React state updates via `wcc:model` listener |
| 3 | React state changes via `setText()` | WCC component attribute updates |
| 4 | Multiple `useWccModel` hooks for different props | Each prop binds independently |
| 5 | Component unmounts | Event listener is cleaned up (no memory leak) |
| 6 | `null`/`undefined` value | Attribute is removed from element |

### 4.5 How It Works

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
| 3 | Circular update prevention | No infinite loop |
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

## 7. Convention: modelValue for v-model

For Vue's native `v-model` to work on a WCC custom element, the component MUST declare a model prop named `modelValue`:

```js
const value = defineModel({ name: 'modelValue', default: '' })
```

This is because Vue's `v-model` on custom elements is hardcoded to:
- Set attribute `model-value`
- Listen for `update:modelValue` event

The adapter translates `wcc:model { prop: 'modelValue' }` → `update:modelValue`, completing the circuit.

For additional props, use `v-wcc-model:propName` (Vue) or `[(propName)]` (Angular).

---

## 8. Regression Checklist

- [ ] Existing `model="signal"` on `<input>`, `<textarea>`, `<select>` still works
- [ ] Checkbox `model="checked"` still binds to boolean
- [ ] Radio `model="selected"` still compares with `value` attribute
- [ ] Number input `model="count"` still coerces to Number
- [ ] `model="signal"` and `model:propName="signal"` coexist in same template
- [ ] All existing tests in `lib/codegen.model.test.js` pass
- [ ] All existing tests in `lib/compiler.model.test.js` pass
- [ ] No `createRequire` error when importing adapter in browser
- [ ] No NG0600 error in Angular during render cycle
