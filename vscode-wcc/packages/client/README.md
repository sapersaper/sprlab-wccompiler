# WCC Language Support

Syntax highlighting, IntelliSense, and snippets for wcCompiler Single File Components (`.wcc`).

## Features

- Full syntax highlighting for `.wcc` files
- JavaScript/TypeScript IntelliSense inside `<script>` blocks
- HTML IntelliSense inside `<template>` blocks
- CSS IntelliSense inside `<style>` blocks
- Type checking in template expressions (`{{expr}}`, `@event`, `:attr`)
- Go-to-definition from template to script
- Bracket matching and auto-closing
- Code folding for top-level blocks
- Snippets for components and directives

## Snippets

| Prefix | Description |
|---|---|
| `wcc` | Full component scaffold (signal, function, template, style) |
| `wccmin` | Minimal component (no style) |
| `each` | `each="(item, index) in items()"` |
| `eachkey` | each with `:key` |
| `wif` | `if="condition()"` |
| `wshow` | `show="condition()"` |
| `wmodel` | `model="signal"` |
| `dprops` | defineProps with TypeScript generics |
| `demits` | defineEmits with call signatures |
| `sig` | signal declaration |
| `comp` | computed declaration |
| `wat` | watch |
| `mount` | onMount lifecycle hook |
| `destroy` | onDestroy lifecycle hook |
| `dexpose` | defineExpose |
| `tref` | templateRef |

## File Format

A `.wcc` file contains three blocks:

```html
<script lang="ts">
import { defineComponent, signal, computed } from 'wcc'

export default defineComponent({ tag: 'my-component' })

const count = signal(0)
const doubled = computed(() => count() * 2)

function increment() {
  count.set(count() + 1)
}
</script>

<template>
<div>
  <span>{{count()}}</span>
  <button @click="increment">+1</button>
</div>
</template>

<style>
div { display: flex; gap: 8px; }
</style>
```

## Installation

### From VSIX

```bash
code --install-extension wcc-language-0.1.0.vsix
```

### From Marketplace

Search for "wcCompiler" in the VS Code Extensions panel.

### Development

1. Open the `vscode-wcc/` folder in VS Code
2. Press `F5` to launch the Extension Development Host
3. Open any `.wcc` file to see syntax highlighting and IntelliSense
