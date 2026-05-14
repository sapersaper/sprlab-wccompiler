# wcCompiler - Steering Guide

## 🎯 Visión General

**wcCompiler** es un compilador zero-runtime que transforma componentes single-file `.wcc` en Web Components nativos del navegador. Sin framework, sin Virtual DOM, sin runtime pesado — solo JavaScript vanilla con reactividad basada en signals.

### Filosofía de Diseño
1. **Zero-runtime** - Output sin dependencias externas
2. **Native Web Components** - API estándar Custom Elements
3. **Signals-based** - Sistema reactivo minimalista
4. **Cross-framework** - Funciona en cualquier framework

---

## 📋 Información del Proyecto

### Versión Actual
- **Package**: `@sprlab/wccompiler` v0.13.0
- **License**: MIT
- **Dependencies**: Babel, esbuild, linkedom

### Repositorio
- **Path**: `c:\projects\sprlab-wccompiler`

### Comandos Principales
```bash
yarn test              # 431 tests con vitest + fast-check
yarn typecheck         # Verificación TypeScript
yarn --cwd example dev # Servidor de desarrollo en localhost:4200
```

---

## 🏗️ Arquitectura del Compilador

### Pipeline de Compilación

```
.wcc file 
  ↓ [SFC Parser]
{ script, template, style, lang, tag }
  ↓ [Parser Extractors]
signals, computeds, props, emits, etc.
  ↓ [Tree Walker (jsdom)]
bindings, events, directives, child components
  ↓ [Code Generator]
self-contained .js + HTMLElement class
```

### Archivos Clave del Compilador

| Archivo | Responsabilidad | Líneas |
|---------|----------------|--------|
| `bin/wcc.js` | CLI (build, dev, bundle) | 413 |
| `lib/compiler.js` | Orquesta el pipeline completo | 480 |
| `lib/sfc-parser.js` | Extrae bloques del .wcc | 334 |
| `lib/parser-extractors.js` | Extrae señales, props, emits, etc. | 1170 |
| `lib/tree-walker.js` | Recorre DOM para bindings | - |
| `lib/codegen.js` | Genera código JS final | 2075 |
| `lib/reactive-runtime.js` | Runtime reactivo inline | 144 |
| `lib/config.js` | Loader de configuración | 72 |
| `lib/dev-server.js` | Servidor con SSE live-reload | 194 |
| `lib/css-scoper.js` | Prefija selectores CSS | - |

---

## 🔧 API del Componente (.wcc)

### Formato Single-File Component

```html
<script lang="ts">
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'wcc-counter' })

const count = signal(0)

function increment() {
  count.set(count() + 1)
}
</script>

<template>
  <span>{{count()}}</span>
  <button @click="increment">+</button>
</template>

<style>
  .counter { display: flex; gap: 8px; }
</style>
```

### Reactive API

#### Signals
```javascript
const count = signal(0)
count()           // Leer → 0
count.set(5)      // Escribir → 5
```

#### Computed
```javascript
const doubled = computed(() => count() * 2)
doubled()         // Recalcula automáticamente
```

#### Effects
```javascript
effect(() => {
  console.log(count())
  return () => cleanup()  // Cleanup opcional
})
```

#### Watch
```javascript
watch(count, (newVal, oldVal) => {
  console.log(`Changed: ${oldVal} → ${newVal}`)
})

watch(() => props.count, (newVal, oldVal) => { ... })
```

#### Batch
```javascript
batch(() => {
  firstName.set('John')
  lastName.set('Doe')
})
```

### Component API

#### Props
```javascript
// Forma genérica (TypeScript)
const props = defineProps<{ label: string, count: number }>({ 
  label: 'Click', 
  count: 0 
})

// Forma array
defineProps(['label', 'count'])

// Sin asignación (accesible directo en template)
defineProps({ label: 'Click' })
```

#### Emits
```javascript
// Forma genérica
const emit = defineEmits<{ 
  (e: 'change', value: number): void 
}>()

// Forma array
const emit = defineEmits(['change', 'reset'])

// Uso
emit('change', count())
```

#### Lifecycle
```javascript
onMount(() => {
  // connectedCallback (soporta async)
})

onDestroy(() => {
  // disconnectedCallback
})

onAdopt(() => {
  // adoptedCallback
})
```

#### Refs
```javascript
const canvas = templateRef('myCanvas')
onMount(() => {
  const ctx = canvas.value.getContext('2d')
})
```

```html
<canvas ref="myCanvas"></canvas>
```

#### Expose
```javascript
defineExpose({ doubled, handleUpdate, count })
```

#### Model (Two-Way Binding)
```javascript
const count = defineModel({ name: 'count', default: 0 })

// Leer
count()

// Escribir (emite eventos automáticamente)
count.set(5)
```

**Eventos emitidos en write:**
- `count-changed` — Kebab-case (Vue, addEventListener)
- `countChanged` — camelCase (Angular binding)
- `countChange` — Angular banana-box `[(count)]`
- `wcc:model` — Genérico (vanilla JS, WCC-to-WCC)

---

## 📝 Template Directives

| Directiva | Sintaxis | Descripción |
|-----------|----------|-------------|
| Interpolación | `{{expr()}}` | Binding de texto reactivo |
| Events | `@click="handler"` | Event listeners |
| if/else-if/else | `if="expr"` | Renderizado condicional |
| each | `each="item in list"` | Listas con :key opcional |
| show | `show="expr"` | Toggle visibilidad (CSS display) |
| model | `model="signal"` | Two-way binding en inputs |
| :attr | `:href="url"` | Attribute binding |
| :class | `:class="{ active: isActive() }"` | Class binding (string u object) |
| :style | `:style="{ color: textColor() }"` | Style binding |
| ref | `ref="name"` | Marcado para templateRef() |
| Child components | `<WccBadge :count="count()">` | Auto-import + props reactivos |
| Slots | `<slot name="header">` | Default, named, scoped slots |

### Expresiones en Templates

**Signals y computeds** requieren `()` para leer:
```html
<span>{{count()}}</span>
<span>{{doubled()}}</span>
```

**Props sin asignación** usan el nombre directo:
```html
<span>{{label}}</span>
```

### Event Handlers

```html
<button @click="increment">+</button>
<button @click="removeItem(item)">×</button>
<button @click="() => doSomething()">Do it</button>
```

---

## 🎨 CSS Scoping

Los estilos se scopen automáticamente con prefijo de tag-name:

```css
/* Input */
.counter { display: flex; }

/* Output */
wcc-counter .counter { display: flex; }
```

- `@media` rules: Recursivamente scoped
- `@keyframes`: Preservados sin prefijo
- Light DOM: CSS injectado en `document.head`
- Deduplicación: ID guard para múltiples imports

---

## 🔌 Integraciones con Frameworks

### Feature Support Matrix

| Feature | Vue (plugin) | Angular (directive) | React 19 (plugin) |
|---------|--------------|--------------------|--------------------|
| Props | `:count="ref"` | `[count]="signal()"` | `count={state}` |
| Events | `@count-changed="handler"` | `(count-changed)="handler"` | `oncountchanged={handler}` |
| Two-way | `v-model:count="ref"` | `[(count)]="signal"` | N/A |
| Default slot | ✅ children | ✅ children | ✅ children |
| Named slots | `<template #name>` | `<div slot-name>` | `<WccCard.Header>` |
| Scoped slots | `<template #name="{ prop }">` | `<ng-template slot>` | `<WccList.Item>` |

### Vue
- **Plugin**: `wccVuePlugin` en vite.config.js
- **Features**: v-model:prop, modifiers (.trim, .number), scoped slots
- **Types**: Auto-generated `dist/wcc-vue.d.ts`

### Angular
- **Directive**: `WccSlotsDirective`, `WccSlotDef`
- **Features**: Named slots con `slot-name`, scoped slots con `ng-template`
- **Config**: `CUSTOM_ELEMENTS_SCHEMA` requerido

### React
- **Plugin**: `wccReactPlugin({ prefix: 'wcc-' })`
- **Features**: Compound components, render props, props-as-slots
- **Types**: Auto-generated `dist/wcc-react.d.ts`

### Vanilla JS
- Zero configuration needed
- Runtime helper: `wcc-runtime.js` para bindings declarativos

```html
<wcc-counter :count="count" @change="handleChange"></wcc-counter>
<script type="module">
  import { init, on, set, get } from './dist/wcc-runtime.js'
  on('handleChange', (e) => set('count', e.detail))
  init({ count: 0 })
</script>
```

---

## 🛠️ CLI

### Comandos

```bash
wcc build              # Compilar todos .wcc → .js
wcc build --bundle     # Crear bundle.js (IIFE, funciona desde file://)
wcc build --minify     # Minificar output
wcc dev                # Build + watch + SSE live-reload
```

### Configuración (wcc.config.js)

```javascript
export default {
  port: 4100,        // Puerto del dev server
  input: 'src',      // Directorio de entrada
  output: 'dist',    // Directorio de salida
  standalone: false  // Inline runtime en cada componente
}
```

### Standalone Mode

**Default (false)**: Componentes importan runtime compartido `__wcc-signals.js`
**Standalone (true)**: Runtime inline en cada componente (zero imports)

**Override por componente:**
```javascript
export default defineComponent({
  tag: 'wcc-widget',
  standalone: true,  // Override del global config
})
```

---

## 📊 Output Characteristics

- ✅ Zero runtime dependencies
- ✅ Self-contained `.js` por componente
- ✅ Source comment: `// Generated from: filename.wcc`
- ✅ Tree-shaken runtime imports
- ✅ Native `HTMLElement` class
- ✅ Idempotent `connectedCallback` (safe para re-mount)
- ✅ `disconnectedCallback` con `AbortController`
- ✅ CSS deduplication via ID guard
- ✅ Public getters/setters para props
- ✅ `CustomEvent` dispatch con `{ bubbles: true, composed: true }`

---

## 🔍 Compiler Validations

| Error Code | Condición |
|------------|-----------|
| `MISSING_DEFINE_COMPONENT` | No `defineComponent()` o falta `tag` |
| `SFC_MISSING_TEMPLATE` | Falta bloque `<template>` |
| `SFC_MISSING_SCRIPT` | Falta bloque `<script>` |
| `SFC_DUPLICATE_BLOCK` | Bloques duplicados |
| `SFC_UNEXPECTED_CONTENT` | Contenido fuera de bloques |
| `DUPLICATE_PROPS` | Props duplicados |
| `DUPLICATE_EMITS` | Events duplicados |
| `UNDECLARED_EMIT` | `emit()` con event no declarado |
| `MODEL_READONLY` | `model` en prop/computed/constant |
| `CONFLICTING_DIRECTIVES` | Directivas incompatibles |
| `REF_NOT_FOUND` | `templateRef` sin matching `ref` |

---

## 🧪 Testing

- **431 tests** con vitest
- **Property-based testing** con fast-check
- Tests cubren: parser, extractors, codegen, compiler, integrations

### Correr tests

```bash
yarn test              # Todos los tests
yarn test lib/parser   # Tests específicos
```

---

## 📁 Estructura del Proyecto

```
sprlab-wccompiler/
├── bin/
│   └── wcc.js                    # CLI entry point
├── lib/
│   ├── sfc-parser.js             # Parsea .wcc
│   ├── parser-extractors.js      # Extrae signals, props, etc.
│   ├── tree-walker.js            # Walks jsdom DOM
│   ├── codegen.js                # Genera JS
│   ├── compiler.js               # Orquesta pipeline
│   ├── reactive-runtime.js       # Runtime inline
│   ├── config.js                 # Config loader
│   ├── dev-server.js             # SSE live-reload
│   └── *.test.js                 # Tests
├── types/
│   └── wcc.d.ts                  # TypeScript declarations
├── integrations/
│   ├── vue.js
│   ├── react.js
│   └── angular.js
├── adapters/
│   ├── vue.js
│   ├── react.js
│   └── angular.js
├── example/
│   ├── src/                      # Componentes .wcc de ejemplo
│   ├── dist/                     # Compiled output
│   └── index.html                # Showcase page
└── vscode-wcc/                   # VS Code extension
```

---

## 🎓 Notas de Desarrollo

### Patrón de Transformación en Codegen

Todas las referencias a señales/props/computeds se transforman en el codegen:

```javascript
// Source
count()
props.label
emit('change', value)

// Transformed
this._count()
this._s_label()
this._emit('change', value)
```

### Effect Management

- Todos los effects se registran en `this.__disposers[]`
- Cleanup en `disconnectedCallback` via `this.__ac.abort()`
- Listeners de eventos usan `{ signal: this.__ac.signal }`

### Child Components

- **Named import**: `import WccBadge from './wcc-badge.wcc'`
- **Side-effect import**: `import './wcc-child.wcc'`
- **Guarded registration**: `if (!customElements.get(...)) customElements.define(...)`
- **Reactive props**: Se sincronizan via effects

---

## 📖 Recursos Adicionales

- **README.md**: Documentación completa del proyecto
- **FEATURES.md**: Referencia completa de features
- **TODO.md**: Tareas pendientes
- **.kiro/specs/**: Especificaciones por feature

---

##  Example Project

El proyecto de ejemplo está en `example/` y demuestra todas las features:

| Componente | Features |
|------------|----------|
| `wcc-counter` | signal, computed, props, emits, events |
| `wcc-form` | model (text, number, checkbox, radio, select, textarea) |
| `wcc-conditional` | if/else-if/else, show, :class, :style |
| `wcc-list` | each, :key, events in loop, attr binding |
| `wcc-card` | default, named, scoped slots |
| `wcc-profile` + `wcc-badge` | Nested components, reactive props |
| `wcc-lifecycle` | onMount, onDestroy, templateRef |
| `wcc-typescript` | TypeScript generics, watch |
| `dynamic-component/` | Dynamic component switching |

**Para correr:**
```bash
cd example
yarn use:local      # Usar versión local del compilador
yarn dev            # Dev server en localhost:4200
```
