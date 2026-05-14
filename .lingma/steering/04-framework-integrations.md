# Framework Integrations - Complete Guide

## Overview

wcCompiler components are framework-agnostic Web Components that work in any environment. However, each framework has specific integration patterns for optimal DX (Developer Experience).

## Integration Matrix

| Feature | Vue Plugin | Angular Directive | React 19 Plugin | Vanilla JS |
|---------|-----------|-------------------|-----------------|------------|
| Props | `:prop="value"` | `[prop]="signal()"` | `prop={state}` | `element.prop = value` |
| Events | `@event="handler"` | `(event)="handler"` | `onevent={handler}` | `addEventListener` |
| Two-way binding | `v-model:prop` | `[(prop)]="signal"` | N/A | Manual setup |
| Default slot | Children | Children | Children | `<slot>` content |
| Named slots | `<template #name>` | `[slot-name]` | Compound components | `<slot name="x">` |
| Scoped slots | `<template #name="{ data }">` | `<ng-template>` | Render props | `<slot :prop>` |
| Type safety | Auto-generated `.d.ts` | Auto-generated `.d.ts` | Auto-generated `.d.ts` | N/A |

---

## Vue Integration

### Setup

**vite.config.js**:
```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { wccVuePlugin } from '@sprlab/wccompiler/integrations/vue'

export default defineConfig({
  plugins: [
    vue(),
    wccVuePlugin({ prefix: 'wcc-' }),  // Auto-transforms v-model & slots
  ],
})
```

### Basic Usage

```vue
<template>
  <wcc-counter 
    :count="counterValue" 
    @change="handleCounterChange"
  />
</template>

<script setup>
import { ref } from 'vue'

const counterValue = ref(0)

function handleCounterChange(event) {
  console.log('New count:', event.detail)
  counterValue.value = event.detail
}
</script>
```

### Two-Way Binding with v-model

```vue
<template>
  <!-- Shorthand for :model-value + @model-changed -->
  <wcc-form v-model:name="userName" />
  
  <!-- With modifiers -->
  <wcc-input v-model.trim:text="searchTerm" />
  <wcc-input v-model.number:age="userAge" />
</template>

<script setup>
import { ref } from 'vue'

const userName = ref('John')
const searchTerm = ref('')
const userAge = ref(25)
</script>
```

### Named Slots

```vue
<template>
  <wcc-card>
    <!-- Named slot using # syntax -->
    <template #header>
      <h2>Card Title</h2>
    </template>
    
    <!-- Default slot -->
    <p>Card content goes here</p>
    
    <!-- Named slot with parameters -->
    <template #footer="{ year, company }">
      <small>© {{ year }} {{ company }}</small>
    </template>
  </wcc-card>
</template>
```

### Scoped Slots

```vue
<template>
  <wcc-list :items="itemList">
    <template #item="{ item, index }">
      <div class="list-item">
        <span>{{ index + 1 }}. {{ item.name }}</span>
      </div>
    </template>
  </wcc-list>
</template>

<script setup>
import { ref } from 'vue'

const itemList = ref([
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' },
])
</script>
```

### TypeScript Support

Auto-generated types in `dist/wcc-vue.d.ts`:
```typescript
declare module 'vue' {
  interface GlobalComponents {
    WccCounter: DefineComponent<{
      count?: number
      label?: string
    }, {}, {}, {}, {}, {}, {}, {
      onChange?: (event: CustomEvent<number>) => void
    }>
  }
}
```

---

## Angular Integration

### Setup

**app.module.ts**:
```typescript
import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core'
import { WccSlotsDirective, WccSlotDef } from '@sprlab/wccompiler/adapters/angular'

@NgModule({
  declarations: [AppComponent, WccSlotsDirective, WccSlotDef],
  imports: [BrowserModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],  // Required for Web Components
  bootstrap: [AppComponent]
})
export class AppModule {}
```

### Basic Usage

```typescript
@Component({
  selector: 'app-root',
  template: `
    <wcc-counter 
      [count]="counterValue()" 
      (change)="handleCounterChange($event)"
    />
  `
})
export class AppComponent {
  counterValue = signal(0)
  
  handleCounterChange(event: CustomEvent) {
    console.log('New count:', event.detail)
    this.counterValue.set(event.detail)
  }
}
```

### Two-Way Binding with Banana-in-a-Box

```typescript
@Component({
  template: `
    <!-- [(prop)] syntax for two-way binding -->
    <wcc-form [(name)]="userName" />
    <wcc-input [(text)]="searchTerm" />
  `
})
export class FormComponent {
  userName = signal('John')
  searchTerm = signal('')
}
```

### Named Slots

```typescript
@Component({
  template: `
    <wcc-card>
      <!-- Named slot using slot-name attribute -->
      <div slot-name="header">
        <h2>Card Title</h2>
      </div>
      
      <!-- Default slot -->
      <p>Card content</p>
      
      <!-- Named slot -->
      <div slot-name="footer">
        <small>Footer content</small>
      </div>
    </wcc-card>
  `
})
export class CardComponent {}
```

### Scoped Slots with ng-template

```typescript
@Component({
  template: `
    <wcc-list [items]="itemList()">
      <!-- Scoped slot using ng-template -->
      <ng-template slot="item" let-item="item" let-index="index">
        <div class="list-item">
          <span>{{ index + 1 }}. {{ item.name }}</span>
        </div>
      </ng-template>
    </wcc-list>
  `
})
export class ListComponent {
  itemList = signal([
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' },
  ])
}
```

### TypeScript Support

Auto-generated types in `dist/wcc-angular.d.ts`:
```typescript
declare module '@angular/core' {
  interface NgElementConfig {
    'wcc-counter': {
      properties: {
        count?: number
        label?: string
      }
      events: {
        change: CustomEvent<number>
      }
    }
  }
}
```

---

## React 19 Integration

### Setup

**vite.config.js**:
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { wccReactPlugin } from '@sprlab/wccompiler/integrations/react'

export default defineConfig({
  plugins: [
    react(),
    wccReactPlugin({ prefix: 'wcc-' }),  // Transforms props to attributes
  ],
})
```

### Basic Usage

```jsx
import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)
  
  return (
    <wcc-counter 
      count={count} 
      onchange={(e) => setCount(e.detail)}
    />
  )
}
```

### Props as State

```jsx
function FormExample() {
  const [name, setName] = useState('John')
  const [age, setAge] = useState(25)
  
  return (
    <wcc-form 
      name={name}
      age={age}
      onnamechanged={(e) => setName(e.detail)}
      onagechanged={(e) => setAge(e.detail)}
    />
  )
}
```

### Compound Components (Named Slots)

The React plugin transforms named slots into compound component pattern:

```jsx
import { WccCard } from '@sprlab/wccompiler/adapters/react'

function CardExample() {
  return (
    <WccCard>
      <WccCard.Header>
        <h2>Card Title</h2>
      </WccCard.Header>
      
      <p>Card content</p>
      
      <WccCard.Footer>
        <small>Footer text</small>
      </WccCard.Footer>
    </WccCard>
  )
}
```

### Render Props (Scoped Slots)

```jsx
import { WccList } from '@sprlab/wccompiler/adapters/react'

function ListExample() {
  const items = [
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' },
  ]
  
  return (
    <WccList items={items}>
      <WccList.Item>
        {(item, index) => (
          <div className="list-item">
            <span>{index + 1}. {item.name}</span>
          </div>
        )}
      </WccList.Item>
    </WccList>
  )
}
```

### TypeScript Support

Auto-generated types in `dist/wcc-react.d.ts`:
```typescript
declare namespace JSX {
  interface IntrinsicElements {
    'wcc-counter': {
      count?: number
      label?: string
      onchange?: (event: CustomEvent<number>) => void
    }
  }
}
```

---

## Vanilla JavaScript Integration

### Basic Setup

No configuration needed! Just import the compiled `.js` files:

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module" src="./dist/wcc-counter.js"></script>
</head>
<body>
  <wcc-counter></wcc-counter>
</body>
</html>
```

### Setting Props

```javascript
const counter = document.querySelector('wcc-counter')

// Set props directly
counter.label = 'My Counter'
counter.count = 10

// Or use attributes (for string values)
counter.setAttribute('label', 'My Counter')
```

### Listening to Events

```javascript
const counter = document.querySelector('wcc-counter')

counter.addEventListener('change', (event) => {
  console.log('New count:', event.detail)
})
```

### Two-Way Binding Helper

Use the runtime helper for declarative bindings:

```html
<wcc-counter :count="count" @change="handleChange"></wcc-counter>

<script type="module">
  import { init, on, set, get } from './dist/wcc-runtime.js'
  
  // Register event handler
  on('handleChange', (e) => {
    set('count', e.detail)
  })
  
  // Initialize state
  init({ count: 0 })
</script>
```

### Dynamic Component Creation

```javascript
// Create element programmatically
const counter = document.createElement('wcc-counter')
counter.label = 'Dynamic Counter'
counter.count = 5

// Listen to events
counter.addEventListener('change', (e) => {
  console.log('Changed to:', e.detail)
})

// Add to DOM
document.body.appendChild(counter)
```

---

## Cross-Framework Patterns

### Pattern 1: Event Communication

All frameworks receive events as `CustomEvent` with data in `detail`:

```javascript
// WCC Component emits
emit('change', newValue)

// Vue receives
@change="(e) => console.log(e.detail)"

// Angular receives
(change)="console.log($event.detail)"

// React receives
onchange={(e) => console.log(e.detail)}

// Vanilla receives
element.addEventListener('change', (e) => console.log(e.detail))
```

### Pattern 2: Prop Passing

Props flow down as attributes/properties:

```html
<!-- Vue -->
<wcc-counter :count="value" />

<!-- Angular -->
<wcc-counter [count]="value()" />

<!-- React -->
<wcc-counter count={value} />

<!-- Vanilla -->
<script>
  element.count = value
</script>
```

### Pattern 3: Slot Content Projection

Content projection works consistently across frameworks:

```html
<!-- Vue -->
<wcc-card>
  <template #header><h2>Title</h2></template>
  <p>Content</p>
</wcc-card>

<!-- Angular -->
<wcc-card>
  <div slot-name="header"><h2>Title</h2></div>
  <p>Content</p>
</wcc-card>

<!-- React -->
<WccCard>
  <WccCard.Header><h2>Title</h2></WccCard.Header>
  <p>Content</p>
</WccCard>

<!-- Vanilla -->
<wcc-card>
  <div slot="header"><h2>Title</h2></div>
  <p>Content</p>
</wcc-card>
```

---

## Integration Architecture

### How Plugins Work

#### Vue Plugin
1. **Transforms** `v-model:prop` → `:prop` + `@prop-changed`
2. **Converts** `<template #name>` → `<div slot="name">`
3. **Handles** scoped slot syntax → slot props
4. **Generates** TypeScript definitions for IDE support

#### Angular Directive
1. **Intercepts** slot content via `WccSlotsDirective`
2. **Projects** content into appropriate `<slot>` elements
3. **Manages** scoped slot context with `let-*` syntax
4. **Provides** type information for template checking

#### React Plugin
1. **Converts** React props → Web Component attributes
2. **Transforms** event handlers (`onChange` → `onchange`)
3. **Implements** compound component pattern for slots
4. **Creates** render prop functions for scoped slots

### Runtime vs Compile-Time

| Aspect | Runtime | Compile-Time |
|--------|---------|--------------|
| Prop passing | Browser handles | Plugin transforms syntax |
| Event listening | Native CustomEvent | Plugin converts handler names |
| Slot projection | Native `<slot>` | Plugin creates wrapper elements |
| Type checking | N/A | Plugin generates `.d.ts` files |
| Dev experience | Standard WC API | Framework-native syntax |

---

## Best Practices by Framework

### Vue
✅ Use `v-model:` for two-way binding  
✅ Leverage TypeScript for auto-completion  
✅ Use `<template #name>` for named slots  
✅ Prefer reactive refs for prop values  

❌ Don't mix `v-model` with manual event listeners  
❌ Avoid direct DOM manipulation  

### Angular
✅ Use `[(prop)]` for two-way binding  
✅ Import `CUSTOM_ELEMENTS_SCHEMA`  
✅ Use `slot-name` for named slots  
✅ Leverage signals for reactive state  

❌ Don't forget schema declaration  
❌ Avoid mixing template-driven and reactive forms  

### React
✅ Use controlled components with state  
✅ Implement compound component pattern  
✅ Use camelCase for event handlers (`onchange`)  
✅ Leverage TypeScript for prop types  

❌ Don't use uncontrolled Web Components  
❌ Avoid mixing React refs with Web Component refs  

### Vanilla JS
✅ Use runtime helper for complex bindings  
✅ Clean up event listeners on removal  
✅ Use properties for non-string values  
✅ Leverage native browser APIs  

❌ Don't forget to remove event listeners  
❌ Avoid setting attributes for objects/arrays  

---

## Troubleshooting Integration Issues

### Issue: Props not updating in Vue
**Solution**: Ensure you're using reactive references:
```vue
<!-- Wrong -->
<wcc-counter :count="5" />

<!-- Correct -->
<wcc-counter :count="countRef" />
```

### Issue: Events not firing in Angular
**Solution**: Check event name casing:
```typescript
// WCC emits kebab-case
emit('count-changed', value)

// Angular listens with same casing
(count-changed)="handler($event)"
```

### Issue: Slots not rendering in React
**Solution**: Use compound components:
```jsx
// Wrong
<wcc-card>
  <div slot="header">Title</div>
</wcc-card>

// Correct
<WccCard>
  <WccCard.Header>Title</WccCard.Header>
</WccCard>
```

### Issue: TypeScript errors in IDE
**Solution**: Ensure type definitions are generated:
```bash
yarn build  # Generates .d.ts files
```

Then import in your project:
```typescript
/// <reference types="@sprlab/wccompiler/dist/wcc-vue" />
```

---

## Performance Considerations

### All Frameworks
- Web Components have minimal overhead
- Reactivity is handled by wcCompiler's signal system
- No Virtual DOM diffing needed

### Vue-Specific
- Plugin adds ~1KB to bundle
- Transformations happen at compile-time (no runtime cost)

### Angular-Specific
- Directive adds ~2KB to bundle
- Change detection integrates with Angular's zone

### React-Specific
- Plugin adds ~1.5KB to bundle
- Props conversion happens in render (minimal cost)

---

## Migration Guide

### From Vue SFC to WCC
```vue
<!-- Before: Vue Component -->
<template>
  <div>{{ count }}</div>
  <button @click="increment">+</button>
</template>

<script setup>
import { ref, computed } from 'vue'
const count = ref(0)
const doubled = computed(() => count.value * 2)
function increment() { count.value++ }
</script>

<!-- After: WCC Component -->
<script lang="ts">
import { defineComponent, signal, computed } from 'wcc'
export default defineComponent({ tag: 'my-counter' })
const count = signal(0)
const doubled = computed(() => count() * 2)
function increment() { count.set(count() + 1) }
</script>

<template>
<div>{{count()}}</div>
<button @click="increment">+</button>
</template>
```

### From React Component to WCC
```jsx
// Before: React Component
function Counter({ initial }) {
  const [count, setCount] = useState(initial)
  return (
    <div>
      <span>{count}</span>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  )
}

// After: WCC Component
<script>
import { defineComponent, defineProps, signal } from 'wcc'
export default defineComponent({ tag: 'my-counter' })
const props = defineProps({ initial: 0 })
const count = signal(props.initial)
function increment() { count.set(count() + 1) }
</script>

<template>
<div>
  <span>{{count()}}</span>
  <button @click="increment">+</button>
</div>
</template>
```

---

## Next Steps

1. Review framework-specific examples in `example/` folder
2. Test integrations with your existing projects
3. Generate TypeScript definitions for better IDE support
4. Explore advanced patterns (dynamic components, lazy loading)
5. Contribute improvements to integration plugins
