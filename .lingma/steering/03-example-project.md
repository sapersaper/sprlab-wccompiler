# Example Project - Complete Guide

## Overview

The example project at `example/` is a comprehensive showcase demonstrating all wcCompiler features in action. It serves as both documentation and testing ground for the compiler.

## Project Structure

```
example/
├── src/                    # Source .wcc components
│   ├── wcc-counter.wcc     # Counter with signals & computeds
│   ├── wcc-form.wcc        # Form with two-way binding
│   ├── wcc-conditional.wcc # Conditional rendering
│   ├── wcc-list.wcc        # List rendering with each
│   ├── wcc-card.wcc        # Slots (default, named, scoped)
│   ├── wcc-lifecycle.wcc   # Lifecycle hooks & refs
│   ├── wcc-typescript.wcc  # TypeScript generics & watch
│   ├── dynamic-component/  # Dynamic component examples
│   │   ├── wcc-tab-panel.wcc
│   │   └── ...
│   └── nested/             # Nested component examples
│       ├── wcc-profile.wcc
│       └── wcc-badge.wcc
├── dist/                   # Compiled output (.js files)
├── index.html              # Main showcase page
├── dynamic-component.html  # Dynamic component demo
├── routing.html            # Routing example
├── wcc.config.js           # Compiler configuration
├── package.json            # Dependencies & scripts
└── jsconfig.json           # IDE configuration
```

## Key Components

### 1. wcc-counter.wcc
**Features**: signal, computed, defineProps, defineEmits, @event

```html
<script lang="ts">
import { defineComponent, defineProps, defineEmits, signal, computed } from 'wcc'

export default defineComponent({ tag: 'wcc-counter' })

const props = defineProps<{ label: string, initial: number }>({ 
  label: 'Count', 
  initial: 0 
})
const emit = defineEmits<{ (e: 'change', value: number): void }>()

const count = signal(props.initial)
const doubled = computed(() => count() * 2)

function increment() {
  count.set(count() + 1)
  emit('change', count())
}

function decrement() {
  count.set(count() - 1)
  emit('change', count())
}
</script>

<template>
<div class="counter">
  <span class="label">{{label}}</span>
  <span class="value">{{count()}}</span>
  <button @click="increment">+</button>
  <button @click="decrement">-</button>
  <span class="doubled">(×2 = {{doubled()}})</span>
</div>
</template>
```

**What it demonstrates**:
- Props with TypeScript generics
- Signals for reactive state
- Computed values that auto-update
- Event emission with typed payloads
- Template interpolation with function calls

---

### 2. wcc-form.wcc
**Features**: model for text, number, checkbox, radio, select, textarea

```html
<script lang="ts">
import { defineComponent, defineModel } from 'wcc'

export default defineComponent({ tag: 'wcc-form' })

const name = defineModel({ name: 'name', default: '' })
const age = defineModel({ name: 'age', default: 0 })
const subscribed = defineModel({ name: 'subscribed', default: false })
const gender = defineModel({ name: 'gender', default: 'male' })
const country = defineModel({ name: 'country', default: '' })
const bio = defineModel({ name: 'bio', default: '' })
</script>

<template>
<form>
  <!-- Text input -->
  <input type="text" model="name" placeholder="Name" />
  
  <!-- Number input -->
  <input type="number" model="age" />
  
  <!-- Checkbox -->
  <input type="checkbox" model="subscribed" />
  
  <!-- Radio buttons -->
  <input type="radio" model="gender" value="male" />
  <input type="radio" model="gender" value="female" />
  
  <!-- Select dropdown -->
  <select model="country">
    <option value="">Select...</option>
    <option value="us">United States</option>
    <option value="uk">United Kingdom</option>
  </select>
  
  <!-- Textarea -->
  <textarea model="bio" placeholder="Bio"></textarea>
</form>
</template>
```

**What it demonstrates**:
- Two-way binding on various input types
- Automatic event emission on value changes
- Default values for models
- Model naming conventions (kebab-case events)

---

### 3. wcc-conditional.wcc
**Features**: if/else-if/else, show, :class, :style

```html
<script lang="ts">
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-conditional' })

const isLoggedIn = signal(false)
const userType = signal('admin') // 'admin' | 'user' | 'guest'
const isVisible = signal(true)
const isActive = signal(true)
const textColor = signal('#ff0000')
</script>

<template>
<div>
  <!-- If/else-if/else -->
  <div if="isLoggedIn()">
    <p>Welcome back!</p>
  </div>
  <div else-if="userType() === 'admin'">
    <p>Admin panel</p>
  </div>
  <div else>
    <p>Please log in</p>
  </div>
  
  <!-- Show directive (CSS display toggle) -->
  <div show="isVisible()">
    This can be toggled
  </div>
  
  <!-- Class binding -->
  <div :class="{ active: isActive(), hidden: !isVisible() }">
    Dynamic classes
  </div>
  
  <!-- Style binding -->
  <div :style="{ color: textColor() }">
    Dynamic styles
  </div>
</div>
</template>
```

**What it demonstrates**:
- Conditional rendering with if/else-if/else chains
- Visibility toggling without DOM removal (show)
- Object-based class binding
- Inline style binding with reactive values

---

### 4. wcc-list.wcc
**Features**: each directive, :key, events in loops, attr binding

```html
<script lang="ts">
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-list' })

const items = signal([
  { id: 1, text: 'Item 1' },
  { id: 2, text: 'Item 2' },
  { id: 3, text: 'Item 3' },
])

function addItem() {
  const newId = items().length + 1
  items.set([...items(), { id: newId, text: `Item ${newId}` }])
}

function removeItem(id: number) {
  items.set(items().filter(item => item.id !== id))
}
</script>

<template>
<div>
  <button @click="addItem">Add Item</button>
  
  <ul>
    <li each="item in items()" :key="item.id">
      <span>{{item.text}}</span>
      <button @click="removeItem(item.id)">×</button>
    </li>
  </ul>
</div>
</template>
```

**What it demonstrates**:
- List rendering with each directive
- Keyed lists for efficient updates
- Event handlers inside loops with parameters
- Array manipulation with signal updates

---

### 5. wcc-card.wcc
**Features**: Default, named, and scoped slots

```html
<script lang="ts">
import { defineComponent } from 'wcc'

export default defineComponent({ tag: 'wcc-card' })
</script>

<template>
<div class="card">
  <!-- Named slot: header -->
  <header>
    <slot name="header">Default Header</slot>
  </header>
  
  <!-- Default slot -->
  <main>
    <slot></slot>
  </main>
  
  <!-- Scoped slot with props -->
  <footer>
    <slot name="footer" :year="2024" :company="'Acme Corp'">
      Default Footer
    </slot>
  </footer>
</div>
</template>
```

**Usage in parent**:
```html
<wcc-card>
  <template #header>
    <h2>Custom Header</h2>
  </template>
  
  <p>This is the card content</p>
  
  <template #footer="{ year, company }">
    © {{year}} {{company}}
  </template>
</wcc-card>
```

**What it demonstrates**:
- Content projection via slots
- Named slots for specific regions
- Scoped slots with data passing
- Default fallback content

---

### 6. wcc-profile.wcc + wcc-badge.wcc
**Features**: Nested components, reactive props, child-parent communication

**wcc-badge.wcc** (child):
```html
<script lang="ts">
import { defineComponent, defineProps } from 'wcc'

export default defineComponent({ tag: 'wcc-badge' })

const props = defineProps<{ count: number }>({ count: 0 })
</script>

<template>
<span class="badge">{{count()}}</span>
</template>
```

**wcc-profile.wcc** (parent):
```html
<script lang="ts">
import { defineComponent, signal } from 'wcc'
import WccBadge from './wcc-badge.wcc'

export default defineComponent({ tag: 'wcc-profile' })

const notificationCount = signal(5)

function clearNotifications() {
  notificationCount.set(0)
}
</script>

<template>
<div>
  <WccBadge :count="notificationCount()" />
  <button @click="clearNotifications">Clear</button>
</div>
</template>
```

**What it demonstrates**:
- Component composition
- Reactive prop passing (`:count="notificationCount()"`)
- Child re-renders when parent signal changes
- Import resolution and compilation order

---

### 7. wcc-lifecycle.wcc
**Features**: onMount, onDestroy, templateRef

```html
<script lang="ts">
import { defineComponent, signal, onMount, onDestroy, templateRef } from 'wcc'

export default defineComponent({ tag: 'wcc-lifecycle' })

const canvas = templateRef('myCanvas')
const mounted = signal(false)

onMount(async () => {
  console.log('Component mounted')
  mounted.set(true)
  
  // Access DOM element
  const ctx = canvas.value.getContext('2d')
  ctx.fillRect(0, 0, 100, 100)
})

onDestroy(() => {
  console.log('Component destroyed')
  // Cleanup resources
})
</script>

<template>
<div>
  <canvas ref="myCanvas" width="200" height="200"></canvas>
  <p if="mounted()">Canvas initialized!</p>
</div>
</template>
```

**What it demonstrates**:
- Lifecycle hooks (mount, destroy, adopt)
- Async lifecycle support
- DOM refs for accessing elements
- Cleanup on component destruction

---

### 8. wcc-typescript.wcc
**Features**: TypeScript generics, watch, effect

```html
<script lang="ts">
import { defineComponent, signal, watch, effect } from 'wcc'

export default defineComponent({ tag: 'wcc-typescript' })

const count = signal(0)
const previousCount = signal(0)

// Watch with old/new values
watch(count, (newVal, oldVal) => {
  console.log(`Count changed: ${oldVal} → ${newVal}`)
  previousCount.set(oldVal)
})

// Effect with cleanup
effect(() => {
  console.log(`Current count: ${count()}`)
  return () => {
    console.log('Cleanup for this effect')
  }
})
</script>

<template>
<div>
  <p>Current: {{count()}}</p>
  <p>Previous: {{previousCount()}}</p>
</div>
</template>
```

**What it demonstrates**:
- TypeScript type safety
- Watch with old/new value tracking
- Effects with automatic cleanup
- Type inference for signals

---

## Running the Example

### Prerequisites
```bash
cd example
yarn install
```

### Use Local Compiler
```bash
yarn use:local
```
This links the example to the local compiler version instead of npm package.

### Development Server
```bash
yarn dev
```
- Starts server at `http://localhost:4200`
- Auto-compiles `.wcc` files on change
- SSE live-reload (no page refresh needed)
- Error overlay for compilation errors

### Static Build
```bash
yarn build
```
Compiles all `.wcc` files to `.js` in `dist/` folder.

### Bundle Mode
```bash
yarn build:bundle
```
Creates single `bundle.js` file (IIFE format) that works from `file://` protocol.

---

## Testing Components

### Manual Testing Checklist

For each component, verify:
- ✅ Initial render is correct
- ✅ Interactive elements respond to clicks/inputs
- ✅ UI updates immediately (no delays)
- ✅ No console errors
- ✅ State persists across interactions
- ✅ Props flow correctly from parent to child

### Automated Testing

Components are tested via:
- Unit tests in `lib/*.test.js`
- E2E tests in `e2e/` with Playwright
- Property-based tests with fast-check

---

## Configuration

### wcc.config.js
```javascript
export default {
  port: 4200,           // Dev server port
  input: 'src',         // Source directory
  output: 'dist',       // Output directory
  standalone: false,    // Shared runtime (not inline)
}
```

### Standalone Mode Override
Individual components can override global config:
```javascript
export default defineComponent({
  tag: 'wcc-widget',
  standalone: true,  // Inline runtime in this component
})
```

---

## Common Patterns Demonstrated

### 1. Signal Pattern
```javascript
const state = signal(initialValue)
state()        // Read
state.set(x)   // Write
```

### 2. Computed Pattern
```javascript
const derived = computed(() => expensiveCalculation())
derived()      // Auto-updates when dependencies change
```

### 3. Event Pattern
```javascript
const emit = defineEmits(['change'])
emit('change', payload)
```

### 4. Model Pattern
```javascript
const value = defineModel({ name: 'value', default: '' })
value()        // Read current value
value.set(x)   // Write (emits events automatically)
```

### 5. Lifecycle Pattern
```javascript
onMount(async () => {
  // Setup code
})

onDestroy(() => {
  // Cleanup code
})
```

---

## Troubleshooting

### Issue: Changes not reflected
**Solution**: Check if you're using `()` for signals/computeds in templates:
```html
<!-- Wrong -->
<span>{{count}}</span>

<!-- Correct -->
<span>{{count()}}</span>
```

### Issue: Props not updating
**Solution**: Ensure you're passing reactive expressions:
```html
<!-- Wrong: static value -->
<WccBadge count="5" />

<!-- Correct: reactive binding -->
<WccBadge :count="count()" />
```

### Issue: Events not firing
**Solution**: Verify event name matches declaration:
```javascript
// Declaration
const emit = defineEmits(['change'])

// Usage
emit('change', value)  // Must match exactly
```

---

## Performance Tips

1. **Use keyed lists**: Always add `:key` to `each` blocks
2. **Batch multiple writes**: Use `batch()` for multiple signal updates
3. **Avoid unnecessary effects**: Only use effects for side effects
4. **Leverage computed caching**: Computed values only recalculate when dependencies change
5. **Minimize DOM updates**: Use `show` instead of `if` for frequently toggled elements

---

## Next Steps

After exploring the example:
1. Review generated code in `dist/` to understand compilation output
2. Modify components and observe live-reload
3. Add new components following the patterns
4. Experiment with framework integrations (Vue, Angular, React)
5. Check test coverage in `lib/*.test.js`
