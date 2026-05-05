export const presets = {
  blank: {
    label: 'Blank',
    source: `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'wcc-app',
})
</script>

<template>
<div class="app">

</div>
</template>

<style>
.app {
  font-family: sans-serif;
}
</style>`,
  },

  counter: {
    label: 'Counter',
    source: `<script>
import { defineComponent, signal, computed } from 'wcc'

export default defineComponent({
  tag: 'wcc-counter',
})

const count = signal(0)
const doubled = computed(() => count() * 2)

function increment() {
  count.set(count() + 1)
}

function decrement() {
  count.set(count() - 1)
}
</script>

<template>
<div class="counter">
  <span class="value">{{count()}}</span>
  <span class="doubled">(×2 = {{doubled()}})</span>
  <button @click="increment">+</button>
  <button @click="decrement">−</button>
</div>
</template>

<style>
.counter {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: sans-serif;
}
.value {
  font-size: 24px;
  min-width: 40px;
  text-align: center;
}
.doubled { color: #666; font-size: 14px; }
button {
  padding: 4px 12px;
  font-size: 18px;
  cursor: pointer;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #f5f5f5;
}
button:hover { background: #e0e0e0; }
</style>`,
  },

  conditional: {
    label: 'Conditional',
    source: `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'wcc-demo',
})

const status = signal('active')

function cycle() {
  const s = status()
  status.set(s === 'active' ? 'pending' : s === 'pending' ? 'inactive' : 'active')
}
</script>

<template>
<div class="demo">
  <h3>Status: {{status()}}</h3>
  <div if="status() === 'active'" class="active">Welcome!</div>
  <div else-if="status() === 'pending'" class="pending">Pending...</div>
  <div else class="inactive">Inactive</div>
  <button @click="cycle">Cycle</button>
</div>
</template>

<style>
.demo { font-family: sans-serif; }
.active { color: green; }
.pending { color: orange; }
.inactive { color: red; }
button { margin-top: 8px; padding: 4px 12px; cursor: pointer; }
</style>`,
  },

  form: {
    label: 'Form (model)',
    source: `<script>
import { defineComponent, signal, computed } from 'wcc'

export default defineComponent({
  tag: 'wcc-form',
})

const name = signal('')
const age = signal(0)
const summary = computed(() => name() + ' | ' + age() + ' yrs')
</script>

<template>
<div class="form">
  <div class="field">
    <label>Name:</label>
    <input type="text" model="name">
    <span>{{name()}}</span>
  </div>
  <div class="field">
    <label>Age:</label>
    <input type="number" model="age">
    <span>{{age()}}</span>
  </div>
  <p><strong>Summary:</strong> {{summary()}}</p>
</div>
</template>

<style>
.form { font-family: sans-serif; }
.field { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
label { font-weight: bold; min-width: 50px; }
input { padding: 4px 8px; }
</style>`,
  },

  list: {
    label: 'List (each)',
    source: `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'wcc-list',
})

const items = signal([
  { id: 1, name: 'Learn wcCompiler' },
  { id: 2, name: 'Build components' },
  { id: 3, name: 'Ship it' },
])

function removeItem(item) {
  items.set(items().filter(i => i.id !== item.id))
}
</script>

<template>
<ul>
  <li each="(item, index) in items" :key="item.id" :data-id="item.id">
    <span>{{index}}: {{item.name}}</span>
    <button @click="removeItem(item)">×</button>
  </li>
</ul>
</template>

<style>
ul { font-family: sans-serif; padding: 0; list-style: none; }
li { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
button { cursor: pointer; color: red; border: none; background: none; font-size: 16px; }
</style>`,
  },

  slots: {
    label: 'Slots',
    source: `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'wcc-card',
})

const likes = signal(0)

function like() {
  likes.set(likes() + 1)
}
</script>

<template>
<div class="card">
  <div class="header">
    <slot name="header">Default Header</slot>
  </div>
  <div class="body">
    <slot>Default body content</slot>
  </div>
  <div class="footer">
    <button @click="like">👍</button>
    <slot name="stats" :likes="likes">{{likes}} likes</slot>
  </div>
</div>
</template>

<style>
.card {
  font-family: sans-serif;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  max-width: 350px;
}
.header { padding: 12px; background: #f5f5f5; font-weight: bold; }
.body { padding: 12px; }
.footer { padding: 8px 12px; display: flex; align-items: center; gap: 8px; border-top: 1px solid #eee; }
button { cursor: pointer; }
</style>`,
  },
};
