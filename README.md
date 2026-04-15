# wcCompiler

Zero-runtime compiler that transforms `.html` files with Vue-like syntax into 100% native web components. No dependencies in the output — just vanilla JavaScript.

## Install

```bash
npm install -D @sprlab/wccompiler
```

## Usage

### 1. Create a component

```html
<!-- src/wcc-counter.html -->
<template>
  <div class="counter">
    <span>{{label}}</span>
    <span>{{count}}</span>
    <button @click="increment">+</button>
  </div>
</template>

<style>
  .counter { display: flex; gap: 8px; }
</style>

<script>
  defineProps(['label'])
  const count = 0

  function increment() {
    const count = count + 1
  }
</script>
```

### 2. Build

```bash
npx wcc build
```

### 3. Use

```html
<script type="module" src="dist/wcc-counter.js"></script>
<wcc-counter label="Clicks:"></wcc-counter>
```

## Commands

- `wcc build` — Compile all `.html` files from input to output
- `wcc dev` — Build + watch + dev server with live-reload

## Configuration

Create `wcc.config.js` in your project root:

```js
export default {
  port: 4100,    // dev server port
  input: 'src',  // source directory
  output: 'dist' // output directory
};
```

All options are optional — defaults shown above.

## Features

- `{{var}}` text interpolation
- `defineProps([...])` for external props
- `const x = value` for reactive internal state
- `computed(() => expr)` for derived values
- `watch('prop', (new, old) => {...})` for side effects
- `@event="handler"` for DOM events
- `emit('name', data)` for custom events
- `<slot>`, `<slot name="x">`, scoped slots with slotProps
- `<style>` with automatic scoped CSS
- Zero runtime — output is pure vanilla JS

## Optional Runtime Helper

An optional `wcc-runtime.js` is copied to your output directory for declarative bindings:

```html
<wcc-counter :label="myLabel" @on-click="handler"></wcc-counter>

<script type="module">
  import './dist/wcc-counter.js';
  import { init, set, get, on } from './dist/wcc-runtime.js';

  on('handler', (e) => console.log(e.detail));
  init({ myLabel: 'Clicks:' });
</script>
```

## License

MIT
