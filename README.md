# wcCompiler

Zero-runtime compiler that transforms `.ts`/`.js` component files into native web components. No framework, no virtual DOM, no runtime — just vanilla JavaScript custom elements with signals-based reactivity.

## Install

```bash
npm install -D @sprlab/wccompiler
```

## Quick Start

**1. Create a component**

```js
// src/wcc-counter.js
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'wcc-counter',
  template: './wcc-counter.html',
  styles: './wcc-counter.css',
})

const count = signal(0)

function increment() {
  count.set(count() + 1)
}
```

```html
<!-- src/wcc-counter.html -->
<div class="counter">
  <span>{{count}}</span>
  <button @click="increment">+</button>
</div>
```

```css
/* src/wcc-counter.css */
.counter { display: flex; gap: 8px; align-items: center; }
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

## Reactivity

### Signals

```js
const count = signal(0)       // create
count()                        // read → 0
count.set(5)                   // write → 5
```

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

```html
<span>{{count}}</span>
<p>Hello, {{name}}! You have {{count}} items.</p>
```

### Event Binding

```html
<button @click="increment">+</button>
<input @input="handleInput">
```

### Conditional Rendering

```html
<div if="status === 'active'">Active</div>
<div else-if="status === 'pending'">Pending</div>
<div else>Inactive</div>
```

### List Rendering

```html
<li each="item in items">{{item.name}}</li>
<li each="(item, index) in items">{{index}}: {{item.name}}</li>
```

### Visibility Toggle

```html
<div show="isVisible">Shown or hidden via CSS display</div>
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
<a :href="url">Link</a>
<button :disabled="isLoading">Submit</button>
<div :class="{ active: isActive, error: hasError }">...</div>
<div :style="{ color: textColor }">...</div>
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

## Lifecycle Hooks

```js
onMount(() => {
  console.log('Component connected to DOM')
})

onDestroy(() => {
  console.log('Component removed from DOM')
})
```

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

Use `.ts` files with full type support:

```ts
import { defineComponent, defineProps, signal, computed, templateBindings } from 'wcc'

const props = defineProps<{ title: string }>({ title: 'Demo' })
const count = signal<number>(0)
const doubled = computed<number>(() => count() * 2)

function increment(): void {
  count.set(count() + 1)
}

templateBindings({ doubled, increment })
```

`templateBindings()` declares which variables are used in the template, eliminating TypeScript "unused variable" warnings.

## CLI

```bash
wcc build    # Compile all .ts/.js files from input/ to output/
wcc dev      # Build + watch + live-reload dev server
```

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
