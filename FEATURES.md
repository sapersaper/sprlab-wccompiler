# wcCompiler — Feature Reference

Complete list of features supported by the compiler for building native web components.

## Script API

| Feature | Syntax | Description |
|---|---|---|
| `signal()` | `const x = signal(value)` | Reactive state. Read: `x()`, write: `x.set(value)` |
| Constants | `const x = value` | Non-reactive variable (plain assignment, no `signal()`) |
| `computed()` | `const x = computed(() => expr)` | Derived value with caching and auto-invalidation |
| `effect()` | `effect(() => { ... })` | Side effect that re-runs on dependency change (cleanup via return) |
| `watch()` | `watch(signal, (new, old) => { ... })` | Observe a signal with old/new values |
| `watch()` (getter) | `watch(() => expr, (new, old) => { ... })` | Observe a derived expression with old/new values |
| `defineComponent()` | `defineComponent({ tag: 'my-tag' })` | Component metadata (tag name registration) |
| `defineProps()` | `defineProps<{ name: Type }>({ defaults })` | Props with types and optional defaults |
| `defineProps()` (array) | `defineProps(['name1', 'name2'])` | Props without types (simple form) |
| `defineEmits()` | `defineEmits<{ (e: 'name', val: T): void }>()` | Typed event declarations (call signatures) |
| `defineEmits()` (array) | `const emit = defineEmits(['event1', 'event2'])` | Event declarations (simple form) |
| `emit()` | `emit('event', data)` | Dispatch CustomEvent (validated against declarations) |
| `defineExpose()` | `defineExpose({ count, doubled })` | Expose methods/properties for external access via ref |
| `templateRef()` | `const el = templateRef('name')` | DOM element reference (access via `el.value`) |
| `templateRef<T>()` | `templateRef<WccBadge>('badge')` | Typed ref (import type from child .wcc) |
| `onMount()` | `onMount(() => { ... })` | Lifecycle: connectedCallback (supports async) |
| `onDestroy()` | `onDestroy(() => { ... })` | Lifecycle: disconnectedCallback |
| `function` | `function name(params) { ... }` | Component methods (event handlers, logic) |
| TypeScript | `<script lang="ts">` | Full TS support with type stripping via esbuild |
| Macro imports | `import { signal } from 'wcc'` | Optional import for IDE DX (stripped at compile time) |

## Template Directives

| Feature | Syntax | Description |
|---|---|---|
| Interpolation | `{{expr()}}` | Reactive text binding (signals use explicit call) |
| Events | `@click="handler"` | DOM event listener (name, call with args, or arrow) |
| `if` | `if="expr"` | Conditional rendering |
| `else-if` | `else-if="expr"` | Alternative conditional branch |
| `else` | `else` | Default branch |
| `each` | `each="item in list"` | List iteration |
| `each` (index) | `each="(item, i) in list"` | Iteration with index |
| `:key` | `:key="item.id"` | Keyed reconciliation (reuses DOM nodes) |
| `show` | `show="expr"` | Visibility toggle (CSS display, element stays in DOM) |
| `model` | `model="signal"` | Two-way binding (input, textarea, select, checkbox, radio) |
| `:attr` | `:href="expr"` | Attribute binding (removes attr if null/false) |
| `bind:attr` | `bind:href="expr"` | Long form attribute binding |
| `:class` | `:class="{ active: isActive() }"` | Class binding (string or object) |
| `:style` | `:style="{ color: c() }"` | Style binding (string or object) |
| Boolean attrs | `:disabled="expr"` | Property assignment for boolean attributes |
| `ref` | `ref="name"` | Mark element for `templateRef()` |
| Child components | `<wcc-child label="{{name}}">` | Auto-import + reactive prop binding |
| `<slot>` | `<slot>fallback</slot>` | Default slot with fallback content |
| `<slot name>` | `<slot name="header">` | Named slot |
| Scoped slots | `<slot name="x" :prop="source">` | Slot with reactive props |

## Consumer Slot API

| Feature | Syntax | Description |
|---|---|---|
| Named slot | `<template #name>content</template>` | Provide content for a named slot |
| Scoped slot | `<template #name="{ prop }">{{prop}}</template>` | Receive reactive data from slot |
| Default slot | Plain child elements | Content for the default slot |

## CSS

| Feature | Description |
|---|---|
| Tag-name scoping | Prefixes all selectors with the component tag name |
| @media | At-rules with recursive inner scoping |
| @keyframes | Preserved without inner prefixing |
| Light DOM | CSS injected into `document.head` (no Shadow DOM) |

## CLI

| Command | Description |
|---|---|
| `wcc build` | Compile all `.wcc` → `.js` + copy `wcc-runtime.js` |
| `wcc dev` | Build + watch + SSE live-reload dev server |
| `wcc.config.js` | Config: `{ port: 4100, input: 'src', output: 'dist' }` |
| `wcc-runtime.js` | Optional declarative binding helper for host pages |

## Output Characteristics

- Zero runtime dependencies (shared `__wcc-signals.js` loaded once, imported by all components)
- Self-contained `.js` file per component (plus shared runtime)
- Source comment at top of each file (`// Generated from: filename.wcc`)
- Tree-shaken runtime imports (only imports what the component uses)
- Native `HTMLElement` class with Custom Elements API
- Idempotent `connectedCallback` (safe for re-mount / DOM moves)
- `disconnectedCallback` with `AbortController.abort()` for listener cleanup
- CSS deduplication via id guard (safe for multiple imports)
- Public getters/setters for props (programmatic access)
- `CustomEvent` dispatch with `{ bubbles: true, composed: true }`

## Compiler Validations

| Error Code | Condition |
|---|---|
| `MISSING_DEFINE_COMPONENT` | No `defineComponent()` or missing `tag` field |
| `SFC_MISSING_TEMPLATE` | Missing `<template>` block |
| `SFC_MISSING_SCRIPT` | Missing `<script>` block |
| `SFC_DUPLICATE_BLOCK` | Duplicate `<script>`, `<template>`, or `<style>` |
| `SFC_UNEXPECTED_CONTENT` | Content outside recognized blocks |
| `SFC_INLINE_PATHS_FORBIDDEN` | `template:`/`styles:` inside `defineComponent()` in SFC mode |
| `DUPLICATE_PROPS` | Duplicate prop names |
| `PROPS_OBJECT_CONFLICT` | Props variable collides with signal/computed/constant |
| `DUPLICATE_EMITS` | Duplicate emit names |
| `EMITS_OBJECT_CONFLICT` | Emits variable collides with existing declaration |
| `UNDECLARED_EMIT` | `emit()` with event not in `defineEmits` |
| `EMITS_ASSIGNMENT_REQUIRED` | `defineEmits()` without variable assignment |
| `MODEL_READONLY` | `model` on prop, computed, or constant |
| `MODEL_UNKNOWN_VAR` | `model` on undeclared variable |
| `INVALID_MODEL_ELEMENT` | `model` on non-form element |
| `INVALID_MODEL_TARGET` | `model` with invalid identifier |
| `CONFLICTING_DIRECTIVES` | `if`+`else` same element, `show`+`if`, or `each`+`if` |
| `ORPHAN_ELSE` | `else`/`else-if` without preceding `if` |
| `INVALID_V_ELSE` | `else` with an expression value |
| `INVALID_V_FOR` | Invalid `each` expression syntax |
| `DUPLICATE_REF` | Duplicate ref name in template |
| `REF_NOT_FOUND` | `templateRef('x')` without matching `ref="x"` |
| `TS_SYNTAX_ERROR` | TypeScript syntax error during type stripping |
| `INVALID_CONFIG` | Invalid `wcc.config.js` values |
