# wcCompiler v2 — Feature Reference

Complete list of features supported by the compiler for building native web components.

## Script API

| Feature | Syntax | Description |
|---|---|---|
| `signal()` | `const x = signal(value)` | Reactive variable. Read via `x()`, write via `x.set(value)` |
| Constants | `const x = value` | Non-reactive variable (no `signal()` wrapper) |
| `computed()` | `const x = computed(() => expr)` | Derived value with caching and auto-invalidation |
| `effect()` | `effect(() => { ... })` | Side effect that re-runs when dependencies change |
| `defineComponent()` | `defineComponent({ tag, template, styles })` | Component metadata with external file references |
| `defineProps()` | `const props = defineProps({ key: default })` | External component props with defaults |
| `defineProps()` (TS) | `defineProps<{ key: Type }>()` | Props with TypeScript generics |
| `defineEmits()` | `const emit = defineEmits(['event'])` | Custom event declarations |
| `defineEmits()` (TS) | `defineEmits<{ (e: 'event'): void }>()` | Emits with TypeScript call signatures |
| `function` | `function name(params) { ... }` | Component methods (event handlers, logic) |
| `emit()` | `emit('event', data)` | Dispatch CustomEvent (validated against `defineEmits`) |
| `templateRef()` | `const el = templateRef('name')` | DOM element reference from template |
| `onMount()` | `onMount(() => { ... })` | Lifecycle hook: connectedCallback |
| `onMount()` (async) | `onMount(async () => { await ... })` | Async lifecycle hook (wrapped in IIFE) |
| `onDestroy()` | `onDestroy(() => { ... })` | Lifecycle hook: disconnectedCallback |
| `templateBindings()` | `templateBindings({ count, doubled })` | Declare which variables/functions are used in the template (eliminates TS unused warnings) |
| TypeScript | `.ts` file extension | TS support with type stripping via esbuild |
| Macro imports | `import { signal } from 'wcc'` | Optional ES import for IDE DX (stripped at compile time) |

## Template Directives

| Feature | Syntax | Description |
|---|---|---|
| Interpolation | `{{variable}}` | Reactive text binding |
| Events | `@click="handler"` | DOM event listener |
| `if` | `if="expr"` | Conditional rendering |
| `else-if` | `else-if="expr"` | Alternative conditional branch |
| `else` | `else` | Default branch |
| `each` | `each="item in list"` | List iteration |
| `each` (index) | `each="(item, i) in list"` | Iteration with index |
| `:key` | `:key="item.id"` | Key expression for each |
| `show` | `show="expr"` | Visibility toggle (CSS display) |
| `model` | `model="signal"` | Two-way binding (input, textarea, select, checkbox, radio) |
| `:attr` | `:href="url"` | Generic attribute binding |
| `bind:attr` | `bind:href="url"` | Long form attribute binding |
| `:class` | `:class="expr"` | Class binding (string or object) |
| `:style` | `:style="expr"` | Style binding (string or object) |
| Boolean attrs | `:disabled="expr"` | Property assignment for boolean attributes |
| `ref` | `ref="name"` | Mark element for `templateRef()` |
| Child components | `<wcc-badge label="{{role}}">` | Auto-import + reactive prop binding to child custom elements |
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
| Light DOM always | CSS injected into `document.head` (no Shadow DOM) |

## CLI

| Command | Description |
|---|---|
| `wcc build` | Compile all `.ts`/`.js` → `.js` + copy `wcc-runtime.js` |
| `wcc dev` | Build + watch + live-reload dev server |
| `wcc.config.js` | Port, input dir, output dir |
| `wcc-runtime.js` | Optional declarative binding helper for host pages |

## Compiler Validations

| Error Code | Condition |
|---|---|
| `MISSING_DEFINE_COMPONENT` | Source file has no `defineComponent()` |
| `TEMPLATE_NOT_FOUND` | Template file path doesn't resolve |
| `STYLES_NOT_FOUND` | Styles file path doesn't resolve |
| `DUPLICATE_PROPS` | Duplicate props in `defineProps` |
| `DUPLICATE_EMITS` | Duplicate emits in `defineEmits` |
| `UNDECLARED_EMIT` | `emit()` references event not in `defineEmits` |
| `EMITS_ASSIGNMENT_REQUIRED` | `defineEmits` without variable assignment |
| `EMITS_OBJECT_CONFLICT` | Emits variable name conflicts with existing declaration |
| `PROPS_ASSIGNMENT_REQUIRED` | `defineProps` without variable assignment |
| `PROPS_OBJECT_CONFLICT` | Props variable name conflicts with existing declaration |
| `MODEL_READONLY` | `model` on prop, computed, or constant |
| `MODEL_UNKNOWN_VAR` | `model` on undeclared variable |
| `INVALID_MODEL_ELEMENT` | `model` on non-form element |
| `INVALID_MODEL_TARGET` | `model` with invalid identifier |
| `CONFLICTING_DIRECTIVES` | `if` + `else` on same element, `show` + `if`, or `each` + `if` |
| `ORPHAN_ELSE` | `else` / `else-if` without preceding `if` |
| `INVALID_V_ELSE` | `else` with an expression value |
| `INVALID_V_FOR` | Invalid `each` expression syntax |
| `DUPLICATE_REF` | Two refs with the same name in template |
| `REF_NOT_FOUND` | `templateRef('x')` without matching `ref="x"` in template |
| `TS_SYNTAX_ERROR` | TypeScript syntax error during type stripping |
