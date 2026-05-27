# Framework Testing

Manual QA testing projects for verifying WCC components work correctly in each host framework.

## Structure

```
framework-testing/
├── vue/        — Vue 3 + Vite test app
├── angular/    — Angular 19 standalone test app
├── react/      — React 19 + Vite test app
└── README.md
```

## Feature Coverage

Each test app covers the full feature support matrix:

| Feature | Vue | Angular | React 19 |
|---------|-----|---------|-----------|
| Props | `:count="ref"` | `[attr.count]="val"` | `count={state}` |
| Events | `@count-changed` | `(count-changed)` | `oncountchanged` |
| Two-way binding | `v-model:count` | `[(count)]` | N/A |
| Default slot | children | children | children |
| Named slots | `<template #name>` | `<div slot-name>` | compound / props |
| Scoped slots | `<template #name="{ prop }">` | `<ng-template slot="name" let-prop>` | render props / compound |

## Running

### Vue

```bash
cd framework-testing/vue
npm install
npm run dev
```

### Angular

```bash
cd framework-testing/angular
npm install
npm run start
```

### React

```bash
cd framework-testing/react
npm install
npm run dev
```

## Event Architecture (v0.11+)

WCC components emit minimal events. Framework adapters handle translation:

- **`_emit(name, detail)`** — dispatches 2 events:
  1. Original name (e.g., `count-changed`) — Vue, Angular, Vanilla
  2. Lowercase (e.g., `countchanged`) — React 19

- **`_modelSet_prop(val)`** — dispatches 2 events:
  1. `wcc:model` — Vanilla, React adapter, Vue plugin, WCC-to-WCC
  2. `propChange` (e.g., `countChange`) — Angular `[(prop)]` zero-config

## Known Issues

### Vue: `<template #name>` compilation error
Vue intercepts `#name` and `v-slot:name` as its own directives. The `wccVuePlugin()` pre-transform rewrites these before Vue's compiler processes them.

### Angular: Slot timing issue
Angular connects custom elements to the DOM (triggering `connectedCallback`) BEFORE projecting children. Workaround: defer slot parsing with `queueMicrotask` in `connectedCallback`.
