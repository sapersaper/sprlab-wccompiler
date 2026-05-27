# Framework Integrations

Manual QA testing projects for verifying WCC components work correctly in each host framework.

## Structure

```
framework-integrations/
├── wcc/        — Shared .wcc source components + build configs
├── vue/        — Vue 3 + Vite (port 4001)
├── react/      — React 19 + Vite (port 4002)
├── angular/    — Angular 19 standalone (port 4003)
└── README.md
```

## Building WCC Components

```bash
cd framework-integrations/wcc

# Build for all frameworks
node ../../bin/wcc.js build --config wcc.config.vue.js
node ../../bin/wcc.js build --config wcc.config.react.js
node ../../bin/wcc.js build --config wcc.config.angular.js
```

## Running

### Vue (port 4001)

```bash
cd framework-integrations/vue
npm install
npm run dev
```

### React (port 4002)

```bash
cd framework-integrations/react
npm install
npm run dev
```

### Angular (port 4003)

```bash
cd framework-integrations/angular
npm install
npm run start
```

## Feature Coverage

Each test app covers the full feature support matrix:

| Feature | Vue | React 19 | Angular 19 |
|---------|-----|----------|------------|
| Props | `:count="ref"` | `count={state}` | `[attr.count]="val"` |
| Events | `@count-changed` | `oncountchanged` | `(count-changed)` |
| Two-way binding | `v-model:count` | N/A | N/A |
| Default slot (fallback) | ✅ | ✅ | ✅ |
| Default slot (content) | children | children | children |
| Named slots | `<template #name>` | `slot="name"` | `slot="name"` |
| Scoped slots | `<template #name="{ prop }">` | `slot-template-name` | `slot-template-name` |

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
