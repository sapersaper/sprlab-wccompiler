# Quick Reference Guide

## Essential Commands

### Development
```bash
yarn test                    # Run all tests (431 tests)
yarn typecheck              # TypeScript checking
yarn --cwd example dev      # Start example dev server (localhost:4200)
yarn --cwd example use:local # Link example to local compiler
```

### Building
```bash
yarn build                  # Build compiler package
node bin/wcc.js build       # Compile .wcc files
node bin/wcc.js build --bundle  # Create single bundle.js
node bin/wcc.js build --minify  # Minify output
node bin/wcc.js dev         # Dev server with live-reload
```

---

## Signal API Quick Reference

### Basic Usage
```javascript
// Create signal
const count = signal(0)

// Read value
count()           // Returns: 0

// Write value
count.set(5)      // Sets to 5

// In templates
<span>{{count()}}</span>
<button @click="() => count.set(count() + 1)">+</button>
```

### Computed Values
```javascript
const doubled = computed(() => count() * 2)
doubled()  // Auto-updates when count changes
```

### Effects
```javascript
effect(() => {
  console.log('Count changed:', count())
  return () => cleanup()  // Optional cleanup
})
```

### Watchers
```javascript
watch(count, (newVal, oldVal) => {
  console.log(`${oldVal} → ${newVal}`)
})
```

### Batching
```javascript
batch(() => {
  firstName.set('John')
  lastName.set('Doe')
  // Effects run once after batch completes
})
```

---

## Component API Quick Reference

### Define Component
```javascript
import { defineComponent } from 'wcc'

export default defineComponent({
  tag: 'my-component',
  standalone: false,  // Optional: inline runtime
})
```

### Props
```javascript
// Generic form (TypeScript)
const props = defineProps<{ name: string, age: number }>({ 
  name: 'Default', 
  age: 0 
})

// Array form
defineProps(['name', 'age'])

// Object form (with defaults)
defineProps({ name: 'Default' })

// Access in template
<span>{{name}}</span>  // No assignment needed
<span>{{props.name}}</span>  // With assignment
```

### Emits
```javascript
// Generic form
const emit = defineEmits<{ 
  (e: 'change', value: number): void 
}>()

// Array form
const emit = defineEmits(['change', 'reset'])

// Emit event
emit('change', 42)
```

### Lifecycle Hooks
```javascript
onMount(async () => {
  // connectedCallback - runs when element added to DOM
  console.log('Mounted')
})

onDestroy(() => {
  // disconnectedCallback - runs when removed
  console.log('Destroyed')
})

onAdopt(() => {
  // adoptedCallback - runs when moved between documents
  console.log('Adopted')
})
```

### Template Refs
```javascript
const canvas = templateRef('myCanvas')

onMount(() => {
  const ctx = canvas.value.getContext('2d')
})
```

```html
<canvas ref="myCanvas"></canvas>
```

### Expose Public API
```javascript
defineExpose({ 
  getCount: () => count(),
  reset: () => count.set(0)
})
```

### Two-Way Binding (Model)
```javascript
const value = defineModel({ name: 'value', default: '' })

// Read
value()

// Write (automatically emits events)
value.set('new value')
```

**Events emitted on write**:
- `value-changed` (kebab-case)
- `valueChanged` (camelCase)
- `valueChange` (Angular banana-box)
- `wcc:model` (generic)

---

## Template Directives Quick Reference

| Directive | Syntax | Example |
|-----------|--------|---------|
| Interpolation | `{{expr}}` | `<span>{{count()}}</span>` |
| Event binding | `@event="handler"` | `<button @click="increment">` |
| Conditional | `if="condition"` | `<div if="isLoggedIn()">` |
| Else-if | `else-if="condition"` | `<div else-if="isAdmin()">` |
| Else | `else` | `<div else>` |
| Show/hide | `show="boolean"` | `<div show="isVisible()">` |
| List rendering | `each="item in list"` | `<li each="item in items()">` |
| Key for lists | `:key="id"` | `<li :key="item.id">` |
| Attribute binding | `:attr="value"` | `<a :href="url">` |
| Class binding | `:class="obj"` | `<div :class="{ active: isActive() }">` |
| Style binding | `:style="obj"` | `<div :style="{ color: textColor() }">` |
| Two-way binding | `model="signal"` | `<input model="name" />` |
| Ref | `ref="name"` | `<canvas ref="myCanvas">` |
| Child component | `<PascalCase>` | `<WccBadge :count="count()">` |
| Default slot | `<slot>` | `<slot></slot>` |
| Named slot | `<slot name="x">` | `<slot name="header">` |
| Scoped slot | `<slot :prop="val">` | `<slot :item="item">` |

---

## File Structure Quick Reference

### Source (.wcc)
```html
<script lang="ts">
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'my-component' })

const count = signal(0)
function increment() { count.set(count() + 1) }
</script>

<template>
<div>
  <span>{{count()}}</span>
  <button @click="increment">+</button>
</div>
</template>

<style>
div { display: flex; }
</style>
```

### Generated (.js)
```javascript
// Generated from: my-component.wcc (wcCompiler)

// Runtime (tree-shaken)
function __signal(initial) { ... }

// Styles (scoped)
if (!document.getElementById('__css_MyComponent')) {
  const style = document.createElement('style');
  style.id = '__css_MyComponent';
  style.textContent = `my-component div { display: flex; }`;
  document.head.appendChild(style);
}

// Template
const __t_MyComponent = document.createElement('template');
__t_MyComponent.innerHTML = `<div><span></span><button>+</button></div>`;

// Component class
class MyComponent extends HTMLElement {
  static get observedAttributes() { return []; }
  static __meta = { tag: 'my-component', props: [], events: [] };
  
  constructor() {
    super();
    this._count = __signal(0);
  }
  
  connectedCallback() {
    this.__ac = new AbortController();
    this.__disposers = [];
    
    // Clone template
    const clone = __t_MyComponent.content.cloneNode(true);
    this.appendChild(clone);
    
    // Setup bindings
    this.countDisplay = this.querySelector('span');
    this.button = this.querySelector('button');
    
    // Register effects
    this.__disposers.push(__effect(() => {
      this.countDisplay.textContent = this._count();
    }));
    
    // Setup event listeners
    this.button.addEventListener('click', () => this._increment(), {
      signal: this.__ac.signal
    });
  }
  
  disconnectedCallback() {
    this.__ac.abort();
    this.__disposers.forEach(d => d());
  }
  
  _increment() {
    this._count(this._count() + 1);
  }
}

// Register
if (!customElements.get('my-component')) {
  customElements.define('my-component', MyComponent);
}

export default MyComponent;
```

---

## Error Codes Quick Reference

| Code | Meaning | Fix |
|------|---------|-----|
| `MISSING_DEFINE_COMPONENT` | No `defineComponent()` call | Add `export default defineComponent({ tag: '...' })` |
| `SFC_MISSING_TEMPLATE` | Missing `<template>` block | Add `<template>...</template>` |
| `SFC_MISSING_SCRIPT` | Missing `<script>` block | Add `<script>...</script>` |
| `SFC_DUPLICATE_BLOCK` | Duplicate blocks | Remove duplicate `<script>` or `<template>` |
| `DUPLICATE_PROPS` | Same prop declared twice | Use unique prop names |
| `DUPLICATE_EMITS` | Same event declared twice | Use unique event names |
| `UNDECLARED_EMIT` | Emitting undeclared event | Add event to `defineEmits()` |
| `MODEL_READONLY` | Using model on readonly var | Don't use model on props/computeds |
| `REF_NOT_FOUND` | `templateRef` without matching `ref` | Add `ref="name"` attribute |
| `CONFLICTING_DIRECTIVES` | Incompatible directives | Don't use `if` and `each` on same element |

---

## Common Patterns Quick Reference

### Counter Pattern
```javascript
const count = signal(0)
const doubled = computed(() => count() * 2)

function increment() { count.set(count() + 1) }
function decrement() { count.set(count() - 1) }
function reset() { count.set(0) }
```

```html
<div>
  <span>{{count()}}</span>
  <span>(×2 = {{doubled()}})</span>
  <button @click="decrement">-</button>
  <button @click="increment">+</button>
  <button @click="reset">Reset</button>
</div>
```

### Form Pattern
```javascript
const name = defineModel({ name: 'name', default: '' })
const email = defineModel({ name: 'email', default: '' })
const subscribed = defineModel({ name: 'subscribed', default: false })

function submit() {
  console.log({ name: name(), email: email(), subscribed: subscribed() })
}
```

```html
<form @submit.prevent="submit">
  <input type="text" model="name" placeholder="Name" />
  <input type="email" model="email" placeholder="Email" />
  <input type="checkbox" model="subscribed" />
  <button type="submit">Submit</button>
</form>
```

### List Pattern
```javascript
const items = signal([
  { id: 1, text: 'Item 1' },
  { id: 2, text: 'Item 2' },
])

function addItem() {
  const newId = items().length + 1
  items.set([...items(), { id: newId, text: `Item ${newId}` }])
}

function removeItem(id) {
  items.set(items().filter(item => item.id !== id))
}
```

```html
<div>
  <button @click="addItem">Add</button>
  <ul>
    <li each="item in items()" :key="item.id">
      <span>{{item.text}}</span>
      <button @click="removeItem(item.id)">×</button>
    </li>
  </ul>
</div>
```

### Conditional Pattern
```javascript
const isLoggedIn = signal(false)
const userType = signal('guest')
const isVisible = signal(true)
```

```html
<div>
  <!-- If/else chain -->
  <div if="isLoggedIn()">Welcome!</div>
  <div else-if="userType() === 'admin'">Admin panel</div>
  <div else>Please log in</div>
  
  <!-- Show/hide -->
  <div show="isVisible()">Toggle me</div>
  
  <!-- Dynamic classes -->
  <div :class="{ active: isLoggedIn(), hidden: !isVisible() }">
    Content
  </div>
</div>
```

### Parent-Child Communication
```javascript
// Parent (wcc-parent.wcc)
import WccChild from './wcc-child.wcc'

const parentValue = signal(0)

function handleChildChange(event) {
  parentValue.set(event.detail)
}
```

```html
<WccChild 
  :value="parentValue()" 
  @change="handleChildChange" 
/>
```

```javascript
// Child (wcc-child.wcc)
const props = defineProps<{ value: number }>({ value: 0 })
const emit = defineEmits<{ (e: 'change', value: number): void }>()

function updateValue() {
  emit('change', props.value + 1)
}
```

```html
<div>
  <span>{{value}}</span>
  <button @click="updateValue">Increment</button>
</div>
```

---

## Framework Integration Quick Reference

### Vue
```vue
<template>
  <wcc-counter 
    :count="count" 
    @change="handleChange"
    v-model:name="userName"
  >
    <template #header>Custom Header</template>
  </wcc-counter>
</template>
```

### Angular
```typescript
@Component({
  template: `
    <wcc-counter 
      [count]="count()" 
      (change)="handleChange($event)"
      [(name)]="userName"
    >
      <div slot-name="header">Custom Header</div>
    </wcc-counter>
  `
})
```

### React
```jsx
<WccCounter 
  count={count} 
  onchange={handleChange}
>
  <WccCounter.Header>Custom Header</WccCounter.Header>
</WccCounter>
```

### Vanilla JS
```javascript
const counter = document.querySelector('wcc-counter')
counter.count = 5
counter.addEventListener('change', (e) => {
  console.log(e.detail)
})
```

---

## Debugging Quick Reference

### Check Generated Code
```bash
# Compile single file
node bin/wcc.js build --input src/component.wcc --output /tmp/test

# View output
cat /tmp/test/component.js
```

### Add Console Logs
```javascript
// In component script
console.log('Signal value:', count())

// In template (via effect)
effect(() => {
  console.log('Rendered with count:', count())
})
```

### Inspect in Browser
```javascript
// Get component instance
const el = document.querySelector('wcc-counter')
console.log(el._count())  // Access signal
console.log(el.tagName)   // Component tag

// Listen to all events
el.addEventListener('wcc:model', (e) => {
  console.log('Model event:', e.type, e.detail)
})
```

### Common Issues

**Issue**: Signal not updating in template  
**Fix**: Use `()` to call signal: `{{count()}}` not `{{count}}`

**Issue**: Props not reactive  
**Fix**: Pass reactive expression: `:count="count()"` not `count="5"`

**Issue**: Events not firing  
**Fix**: Declare event in `defineEmits()` and use exact name

**Issue**: Styles not scoped  
**Fix**: Ensure component has unique tag name

---

## Performance Tips

✅ **Do**:
- Use `:key` in lists for efficient updates
- Batch multiple signal writes: `batch(() => { ... })`
- Use `computed` for expensive calculations
- Use `show` instead of `if` for frequent toggles
- Keep components small and focused

❌ **Don't**:
- Create signals in loops
- Use effects for derived state (use `computed`)
- Nest too many levels of components
- Forget to clean up in `onDestroy`
- Use large inline styles (use CSS classes)

---

## Testing Quick Reference

### Unit Test
```javascript
import { describe, it, expect } from 'vitest'
import { compileSFC } from './compiler.js'

describe('my feature', () => {
  it('should work correctly', async () => {
    const source = `...`
    const result = await compileSFC(source)
    expect(result.code).toContain('expected output')
  })
})
```

### Property-Based Test
```javascript
import fc from 'fast-check'

it('should handle any valid identifier', () => {
  fc.assert(
    fc.property(fc.stringMatching(/[a-zA-Z_]\w*/), (name) => {
      // Test with random valid identifiers
    })
  )
})
```

### E2E Test (Playwright)
```javascript
import { test, expect } from '@playwright/test'

test('component works', async ({ page }) => {
  await page.goto('http://localhost:4200')
  const el = page.locator('wcc-counter')
  await expect(el).toHaveText('0')
})
```

---

## Git Workflow Quick Reference

### Bug Fix Branch
```bash
git checkout -b fix/BUG-XXX-description
# Make changes
git add .
git commit -m "fix(module): description (#BUG-XXX)"
git push origin fix/BUG-XXX-description
# Create PR
```

### Commit Message Convention
```
type(scope): description (#ticket)

Types: feat, fix, docs, style, refactor, test, chore
Scopes: parser, codegen, runtime, cli, integrations

Examples:
fix(codegen): handle arrow functions in templates (#BUG-001)
feat(parser): support nested generic types (#FEAT-042)
docs(readme): update installation instructions
```

---

## Useful Links

- **Project root**: `c:\projects\sprlab-wccompiler`
- **Example project**: `c:\projects\sprlab-wccompiler\example`
- **Dev server**: http://localhost:4200
- **Bug tracking**: `.lingma/bug-fixing/`
- **Documentation**: `.lingma/steering/`
- **Tests**: `lib/*.test.js`
- **Specs**: `.kiro/specs/`

---

## Keyboard Shortcuts (VS Code)

- `Ctrl+Shift+P`: Command palette
- `Ctrl+P`: Quick open file
- `Ctrl+Shift+F`: Search across files
- `F5`: Start debugging
- `Ctrl+``: Toggle terminal
- `Ctrl+B`: Toggle sidebar

---

## Emergency Contacts

- **QA Team**: Report bugs via issue tracker
- **Tech Lead**: Review complex fixes
- **Release Manager**: Coordinate releases
- **Documentation**: Update `.lingma/steering/` docs

---

*Last updated: 2026-05-14*
