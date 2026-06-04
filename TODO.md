# TODO — v0.25.0

## ✅ Completado en v0.25.0

### Codegen fixes (WCC compiler)
- [x] **Boolean coercion**: `visible="false"` tratado como `true` → fix en `class-methods.js`
- [x] **renderIf guard**: `__renderIf_0()` antes de `connectedCallback` → fix en `invalidate.js`
- [x] **props reference**: `props.initialCount` en constructor → fix en `constructor.js`
- [x] **double dot syntax**: `..classList` por `[]` truthy → fix en `update-op.js`
- [x] **Clean emits**: `_emit` solo kebab, `_modelSet` solo `wcc:model` + kebab
- [x] **Signal-prop sync**: `attributeChangedCallback` sincroniza señales dependientes
- [x] **Default slot cloneNode → appendChild**: preserva property bindings de frameworks

### Plugins / Adapters
- [x] **Vue**: inline `wccPreTransform` eliminado, se usa `wccVuePlugin` from `vue-plugin.js`
- [x] **React**: `wccReactEvents()` integrado en `wccReactPlugin()` (unified wrapper)
- [x] **React**: BUG-0017 — evento `onValueChanged` bridge vía `wccReactEvents` plugin
- [x] **React**: BUG-0018 — slot serialization con arrow functions
- [x] **Angular**: `provideWccBridge()` — runtime bridge (TemplateRef → slot + event camelCase)
- [x] **Angular**: event bridge (kebab → camelCase para `(countChange)` binding)
- [x] **Angular**: limpieza de archivos muertos (`angular-adapter` directives, `angular-plugin.mjs`)

### Tests
- [x] Vue: 45/45 ✅
- [x] React: 34/34 ✅
- [x] Angular: 37/37 ✅
- [x] Root E2E: 238/238 ✅
- [x] Unit: 1360/1360 ✅

## 🧪 Pendientes — Próximos

### Task-0033: Plugins/adaptadores específicos por framework
- [ ] **Vue**: `v-model.number`/`.trim` modifiers, múltiples v-model, v-model en `wcc-input`
- [ ] **React**: Compound components sintaxis
- [ ] **Angular**: `[(banana-box)]`, `wccEvent`/`wccEvents` directives (si se necesitan)

### Task-0030: Anidamiento Framework→WCC→Framework
- [ ] Vue: `<VueBadge>` dentro de `wcc-card` slot
- [ ] React: `<Badge>` dentro de `renderItem`/slot de `wcc-card`
- [ ] Angular: `<app-badge>` dentro de `<ng-template slot>`

### Task-0031: Loops, condicionales e interacciones framework+WCC
- [ ] Reactividad multi-nivel: estado framework → WCC prop → WCC evento → framework

### Task-0032: Casos borde
- [ ] Destroy/reconnect: toggle elimina y recrea el WCC
- [ ] CSS scoping: estilos WCC no afectan al framework, viceversa
