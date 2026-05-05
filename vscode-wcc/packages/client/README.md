# WCC Language Support

Syntax highlighting for wcCompiler Single File Components (`.wcc`).

## Features

- Full syntax highlighting for `.wcc` files
- JavaScript highlighting inside `<script>` blocks
- TypeScript highlighting inside `<script lang="ts">` blocks
- HTML highlighting inside `<template>` blocks
- CSS highlighting inside `<style>` blocks
- Bracket matching and auto-closing
- Code folding for top-level blocks

## File Format

A `.wcc` file contains three blocks:

```html
<script lang="ts">
import { defineComponent, signal, computed } from 'wcc'

export default defineComponent({ tag: 'my-component' })

const count = signal(0)
const doubled = computed(() => count() * 2)
</script>

<template>
  <div>
    <span>{{count}}</span>
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

### Development

1. Open the `vscode-wcc/` folder in VS Code
2. Press `F5` to launch the Extension Development Host
3. Open any `.wcc` file to see syntax highlighting
