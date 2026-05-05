---
inclusion: auto
description: Project context and architecture overview for wcCompiler
---

# wcCompiler v2 — Project Context

## What is this project?

A zero-runtime compiler that transforms `.ts`/`.js` component files into 100% native Web Components. No framework dependencies in the output — just vanilla JavaScript using Custom Elements API.

## Key Design Decisions

### Entry Point: `.ts`/`.js` (not `.html`)

Components are authored as TypeScript/JavaScript files. The template and styles are referenced externally or inlined. This gives full IDE IntelliSense, type checking, and refactoring support without custom extensions.

### API: Signals-based (industry standard)

| Function | Purpose | Read | Write |
|---|---|---|---|
| `signal(value)` | Reactive state | `count()` | `count.set(value)` |
| `computed(() => expr)` | Derived value | `doubled()` | (read-only) |
| `effect(() => { ... })` | Side effect (auto-tracking) | — | — |
| `defineComponent({...})` | Component metadata (tag, template, styles) | — | — |
| `defineProps<T>(defaults?)` | Typed props declaration with optional defaults | `props.name` | (read-only) |
| `defineEmits<T>()` | Typed events declaration | — | `emit('event', data)` |
| `onMount(() => {...})` | Lifecycle: connected | — | — |
| `onDestroy(() => {...})` | Lifecycle: disconnected | — | — |
| `templateRef('name')` | Template element reference | — | — |

### Component Structure

```ts
// src/wcc-counter.ts — entry point
import { defineComponent, defineProps, defineEmits, signal, computed, effect, onMount, onDestroy, templateRef } from 'wcc'

export default defineComponent({
  tag: 'wcc-counter',
  template: './wcc-counter.html',
  styles: './wcc-counter.css',
})

const props = defineProps<{ label: string, initial: number }>({
  label: 'Count',
  initial: 0
})
const emit = defineEmits<{ (e: 'change', value: number): void }>()

const count = signal(props.initial)
const doubled = computed(() => count() * 2)

effect(() => {
  console.log('count changed:', count())
})

onMount(() => {
  console.log('mounted')
})

function increment() {
  count.set(count() + 1)
  emit('change', count())
}
```

```html
<!-- src/wcc-counter.html — template -->
<div class="counter">
  <span>{{label}}</span>
  <span>{{count}}</span>
  <button @click="increment">+</button>
</div>
```

```css
/* src/wcc-counter.css — styles */
.counter { display: flex; gap: 8px; }
```

### Template Syntax

- `{{variable}}` — text interpolation (auto-unwraps signals)
- `@event="handler"` — DOM event binding
- `if` / `else-if` / `else` — conditional rendering (no prefix)
- `each="item in list"` — list rendering (no prefix, avoids collision with HTML `for`)
- `show="expr"` — visibility toggle (no prefix)
- `model="variable"` — two-way binding (no prefix)
- `:attr="expr"` — attribute binding
- `:class="expr"` — class binding
- `:style="expr"` — style binding
- `ref="name"` — template element reference
- `<slot>` — content distribution

### Compiler Pipeline

```
.ts/.js source
     │
     ├── Read defineComponent() → resolve template path, styles path
     │
     ├── Read .html template → tree-walker (bindings, events, directives)
     │
     ├── Read .css styles → css-scoper (prefix selectors with tag name)
     │
     ├── Analyze script → parser (detect signal, computed, defineProps, etc.)
     │
     └── codegen → self-contained .js Web Component (zero imports)
```

### Output Characteristics

- Zero runtime dependencies
- Self-contained `.js` file per component
- Inline reactive runtime (~40 lines: __signal, __computed, __effect)
- Scoped CSS injected into document.head
- Native HTMLElement class with Custom Elements API

### Tech Stack

- Node.js 24+
- TypeScript 6+ (for type checking)
- esbuild (for TS type stripping)
- jsdom (for template DOM parsing)
- vitest (testing)
- fast-check (property-based testing)
- Yarn 4 with PnP

### Spec Organization

Specs are organized as:
1. **Core spec** — base compiler pipeline, signal/computed/effect, defineComponent, template engine base, CSS scoping, CLI
2. **Feature specs** — one per feature, built on top of core (defineProps, defineEmits, if/else-if/else, each, show, model, :attr/:class/:style, slots, templateRef, onMount/onDestroy, TypeScript)

### Reference: v1 Source Files

The following files from the v1 project (`../` relative to this v2 directory) can be used as reference:
- `lib/reactive-runtime.js` — inline reactive runtime (reuse as-is)
- `lib/css-scoper.js` — CSS selector prefixing (reuse as-is)
- `lib/tree-walker.js` — template DOM walking (reuse as-is)
- `lib/config.js` — wcc.config.js loading (minor changes: glob *.ts instead of *.html)
- `lib/dev-server.js` — HTTP server with live-reload (reuse as-is)
- `lib/wcc-runtime.js` — optional consumer helper (reuse as-is)
- `lib/codegen.js` — code generation (partial rewrite: new transform patterns)
- `lib/parser.js` — script analysis (partial rewrite: reads .ts directly, new API names)
- `lib/compiler.js` — pipeline orchestration (partial rewrite: new entry point resolution)
