# wcCompiler

Zero-runtime compiler that transforms `.wcc` single-file components into native web components. No framework, no virtual DOM, no runtime — just vanilla JavaScript custom elements with signals-based reactivity.

## Install

```bash
npm install -D @sprlab/wccompiler
```

## Quick Start

**1. Create a component**

```html
<!-- src/wcc-counter.wcc -->
<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'wcc-counter',
})

const count = signal(0)

function increment() {
  count.set(count() + 1)
}
</script>

<template>
<div class="counter">
  <span>{{count()}}</span>
  <button @click="increment">+</button>
</div>
</template>

<style>
.counter { display: flex; gap: 8px; align-items: center; }
</style>
```

**2. Build**

```bash
npx wcc build
```

**3. Use**

```html
<script type="module" src="dist/wcc-counter.js"></script>
<wcc-counter></wcc-counter>
```

The compiled output is a single `.js` file with zero dependencies — works in any browser that supports custom elements.

## Single File Component (.wcc)

wcCompiler uses a single-file component format with the `.wcc` extension. Each file contains three blocks:

- `<script>` — Component logic (signals, props, events, lifecycle)
- `<template>` — HTML template with directives
- `<style>` — Scoped CSS

```html
<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'wcc-my-component',
})

const message = signal('Hello')
</script>

<template>
<p>{{message()}}</p>
</template>

<style>
p { color: steelblue; }
</style>
```

Use `<script lang="ts">` for TypeScript support. The CLI discovers and compiles all `.wcc` files in your source directory.

## Reactivity

### Signals

```js
const count = signal(0)       // create
count()                        // read → 0
count.set(5)                   // write → 5
```

> **Note:** `.set()` is the public API for writing signals. The compiled output uses direct invocation (`count(5)`) as an internal optimization — both forms are equivalent, but `.set()` is the recommended way to write signals in your source code.

### Computed

```js
const doubled = computed(() => count() * 2)
doubled()  // auto-updates when count changes
```

### Effects

```js
effect(() => {
  console.log('Count is:', count())  // re-runs on change
})
```

Effects support cleanup — return a function to run before re-execution:

```js
effect(() => {
  const id = setInterval(() => tick.set(tick() + 1), 1000)
  return () => clearInterval(id)  // called before re-run
})
```

### Watch

```js
// Watch a signal directly
watch(count, (newVal, oldVal) => {
  console.log(`Changed from ${oldVal} to ${newVal}`)
})

// Watch a getter function (useful for props or derived values)
watch(() => props.count, (newVal, oldVal) => {
  console.log(`Prop changed: ${oldVal} → ${newVal}`)
})
```

`watch` observes a specific signal or getter and provides both old and new values. The callback does not run on initial mount — only on subsequent changes.

### Constants

```js
const TAX_RATE = 0.21  // non-reactive, no signal() wrapper
```

## Props

```js
const props = defineProps({ label: 'Click', count: 0 })
```

```html
<wcc-counter label="Clicks:" count="5"></wcc-counter>
```

You can also call `defineProps` without assignment — the props are available by name in the template:

```js
defineProps({ label: 'Click' })
```

```html
<span>{{label}}</span>
```

TypeScript generics:

```ts
const props = defineProps<{ label: string, count: number }>({ label: 'Click', count: 0 })
```

Props are reactive — they update when attributes change. Supports boolean and number coercion.

## Custom Events

```js
const emit = defineEmits(['change', 'reset'])

function handleClick() {
  emit('change', count())
}
```

TypeScript call signatures:

```ts
const emit = defineEmits<{ (e: 'change', value: number): void }>()
```

The compiler validates emit calls against declared events at compile time.

## Template Directives

### Text Interpolation

Signals and computeds require `()` to read their value in templates:

```html
<span>{{count()}}</span>
<p>You have {{items().length}} items.</p>
<span>{{doubled()}}</span>
```

Props accessed without assignment use their name directly (no parentheses):

```html
<span>{{label}}</span>
<p>Hello, {{name}}!</p>
```

### Event Binding

```html
<button @click="increment">+</button>
<input @input="handleInput">
```

Event handlers support expressions and inline arguments:

```html
<button @click="removeItem(item)">×</button>
<button @click="() => doSomething()">Do it</button>
```

### Conditional Rendering

```html
<div if="status() === 'active'">Active</div>
<div else-if="status() === 'pending'">Pending</div>
<div else>Inactive</div>
```

### List Rendering

```html
<li each="item in items()">{{item.name}}</li>
<li each="(item, index) in items()">{{index}}: {{item.name}}</li>
```

The source expression calls the signal (`items()`) to read the current array.

### Visibility Toggle

```html
<div show="isVisible()">Shown or hidden via CSS display</div>
```

### Two-Way Binding

```html
<input type="text" model="name">
<input type="number" model="age">
<input type="checkbox" model="agree">
<input type="radio" name="color" value="red" model="color">
<select model="country">...</select>
<textarea model="bio"></textarea>
```

### Attribute Binding

```html
<a :href="url()">Link</a>
<button :disabled="isLoading()">Submit</button>
<div :class="{ active: isActive(), error: hasError() }">...</div>
<div :style="{ color: textColor() }">...</div>
```

### Template Refs

```js
const canvas = templateRef('myCanvas')

onMount(() => {
  const ctx = canvas.value.getContext('2d')
})
```

```html
<canvas ref="myCanvas"></canvas>
```

## Slots

### Named Slots

Component template:
```html
<div class="card">
  <slot name="header">Default Header</slot>
  <slot>Default Body</slot>
  <slot name="footer">Default Footer</slot>
</div>
```

Consumer:
```html
<wcc-card>
  <template #header><strong>Custom Header</strong></template>
  <p>Custom body content</p>
  <template #footer>Custom footer</template>
</wcc-card>
```

### Scoped Slots

Component template (passes reactive data to consumer):
```html
<slot name="stats" :likes="likes">Likes: {{likes}}</slot>
```

Consumer (receives data via template props):
```html
<wcc-card>
  <template #stats="{ likes }">🔥 {{likes}} likes!</template>
</wcc-card>
```

## Nested Components

Components can use other components in their templates. Import the child `.wcc` file and use its tag in the template:

```html
<script>
import { defineComponent, signal } from 'wcc'
import './wcc-badge.wcc'

export default defineComponent({ tag: 'wcc-profile' })

const count = signal(0)

function increment() {
  count.set(count() + 1)
}
</script>

<template>
<div class="profile">
  <wcc-badge :count="count()" @click="increment"></wcc-badge>
</div>
</template>
```

- **Manual import**: `import './wcc-child.wcc'` — the compiler registers the child component
- **Auto-detect**: If a custom element tag in the template matches a `.wcc` file in the same directory, it's auto-imported
- **Reactive props**: Use `:prop="expr"` to pass reactive data down — updates automatically when the expression changes
- **Event listening**: Use `@event="handler"` to listen to custom events emitted by the child

## Lifecycle Hooks

```js
onMount(() => {
  console.log('Component connected to DOM')
})

onMount(async () => {
  const data = await fetch('/api/items').then(r => r.json())
  items.set(data)
})

onDestroy(() => {
  console.log('Component removed from DOM')
})
```

Async callbacks are wrapped in an IIFE — `connectedCallback` itself stays synchronous.

## CSS Scoping

Styles are automatically scoped to the component using tag-name prefixing:

```css
/* Input */
.counter { display: flex; }

/* Output */
wcc-counter .counter { display: flex; }
```

`@media` rules are recursively scoped. `@keyframes` are preserved without prefixing.

## TypeScript

Use `<script lang="ts">` in your `.wcc` file for full type support:

```html
<script lang="ts">
import { defineComponent, defineProps, defineEmits, signal, computed, watch, defineExpose } from 'wcc'

export default defineComponent({
  tag: 'wcc-typescript',
})

const props = defineProps<{ title: string, count: number }>({ title: 'Demo', count: 0 })
const emit = defineEmits<{ (e: 'update', value: number): void }>()

const doubled = computed<number>(() => props.count * 2)
const watchLog = signal<string>('(no changes yet)')

watch(() => props.count, (newVal, oldVal) => {
  watchLog.set(`count changed: ${oldVal} → ${newVal}`)
})

function handleUpdate(): void {
  emit('update', doubled())
}

defineExpose({ doubled, handleUpdate, watchLog })
</script>

<template>
<div class="demo">
  <span>{{title}}: {{count}}</span>
  <span>Doubled: {{doubled()}}</span>
  <span>Watch: {{watchLog()}}</span>
  <button @click="handleUpdate">Update</button>
</div>
</template>

<style>
.demo { font-family: sans-serif; }
</style>
```

`defineExpose()` exposes methods and properties for external access via ref.

The language server automatically generates a typed interface (PascalCase of the tag name) that can be imported by consumers:

```ts
// In the parent component:
import type { WccTypescript } from './wcc-typescript.wcc'
const child = templateRef<WccTypescript>('myRef')
child.value!.handleUpdate() // ✅ typed
```

## CLI

```bash
wcc build    # Compile all .wcc files from input/ to output/
wcc dev      # Build + watch + live-reload dev server
```

The CLI discovers all `.wcc` files in your source directory and compiles each into a standalone `.js` file.

### Configuration

Create `wcc.config.js` in your project root:

```js
export default {
  port: 4100,    // dev server port
  input: 'src',  // source directory
  output: 'dist' // output directory
}
```

All options are optional — defaults shown above.

### Standalone Mode

Controls whether the reactive runtime is inlined in each component or imported from a shared module.

```js
// wcc.config.js
export default {
  standalone: true  // inline runtime in every component (default: false)
}
```

- `standalone: false` (default) — Components import the runtime from a shared `__wcc-signals.js` file. Smaller per-component size when using multiple components.
- `standalone: true` — Each component includes the full reactive runtime inline. Zero external dependencies per component.

**Output difference:**

```
Default (false):   component.js → imports __wcc-signals.js
Standalone (true): component.js → runtime inlined, zero imports
```

**When to use standalone:**
- Publishing components as npm packages
- Embedding widgets in third-party sites
- CDN distribution (`<script src="component.js">`)
- Micro-frontends where you don't control the host

**When NOT to use standalone:**
- Apps with multiple components (runtime would be duplicated in each)
- Internal projects where you control the build

#### Per-Component Override

Override the global setting for individual components:

```html
<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'wcc-widget',
  standalone: true,  // this component is self-contained regardless of global config
})
</script>
```

Component-level `standalone` always takes precedence over the global config. This lets you have a project with shared runtime but mark specific components as fully self-contained for distribution.

## Editor Support

The **wcCompiler (.wcc) Language Support** extension is available on the VS Code Marketplace. It provides syntax highlighting, completions, and diagnostics for `.wcc` files.

## Runtime Helper

An optional `wcc-runtime.js` is copied to your output directory for declarative host-page bindings:

```html
<wcc-counter :count="count" @change="handleChange"></wcc-counter>

<script type="module">
  import './dist/wcc-counter.js'
  import { init, on, set, get } from './dist/wcc-runtime.js'

  on('handleChange', (e) => set('count', e.detail))
  init({ count: 0 })
</script>
```

## License

MIT
