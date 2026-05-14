# Compiler Pipeline - Step by Step

## Overview

El compilador de wcCompiler transforma archivos `.wcc` en JavaScript vanilla siguiendo un pipeline de 6 pasos.

## Pipeline Completo

```
.wcc file
  ↓
Step 1: SFC Parser (sfc-parser.js)
  ↓
{ script, template, style, lang, tag, standalone }
  ↓
Step 2: Import Extraction (import-resolver.js)
  ↓
Extract .wcc imports → importMap + childImports
  ↓
Step 3: Props/Emits Extraction (BEFORE type strip)
  ↓
Generic forms: defineProps<{...}>, defineEmits<{...}>
  ↓
Step 4: TypeScript Stripping (parser.js + esbuild)
  ↓
Plain JavaScript (types removed)
  ↓
Step 5: Extraction (parser-extractors.js)
  ↓
signals, computeds, effects, methods, props, emits, etc.
  ↓
Step 6: Template Processing (tree-walker.js)
  ↓
bindings, events, ifBlocks, forBlocks, slots, etc.
  ↓
Step 7: Code Generation (codegen.js)
  ↓
Self-contained .js file
```

---

## Step 1: SFC Parser

**File**: `lib/sfc-parser.js`

### Input
```html
<script lang="ts">
import { defineComponent, signal } from 'wcc'
export default defineComponent({ tag: 'wcc-counter' })
const count = signal(0)
</script>

<template>
<span>{{count()}}</span>
</template>

<style>
span { color: red; }
</style>
```

### Output
```javascript
{
  script: "import { defineComponent, signal } from 'wcc'\nexport default defineComponent({ tag: 'wcc-counter' })\nconst count = signal(0)",
  template: "\n<span>{{count()}}</span>\n",
  style: "\nspan { color: red; }\n",
  lang: 'ts',
  tag: 'wcc-counter',
  standalone: undefined
}
```

### Validation Rules
- ✅ Required: `<script>` and `<template>` blocks
- ✅ No duplicate blocks
- ✅ No content outside recognized blocks
- ✅ `defineComponent()` must be present with `tag` field
- ❌ No `template:` or `styles:` inside `defineComponent()` (SFC mode)

### Key Functions
```javascript
parseSFC(source, fileName)  // Main entry point
findBlocks(source, blockName)  // Extract blocks via regex
extractTagFromDefineComponent(script, fileName)  // Get tag name
validateNoUnexpectedContent(source, blockRanges, fileName)
```

---

## Step 2: Import Extraction

**File**: `lib/import-resolver.js`

### Input
```javascript
import WccBadge from './wcc-badge.wcc'
import './wcc-footer.wcc'
import { signal } from 'wcc'
```

### Output
```javascript
{
  named: [
    { identifier: 'WccBadge', sourcePath: './wcc-badge.wcc', compiledPath: '../dist/nested/wcc-badge.js' }
  ],
  sideEffect: [
    { sourcePath: './wcc-footer.wcc', compiledPath: '../dist/wcc-footer.js' }
  ],
  strippedSource: "import { signal } from 'wcc'\n..."  // .wcc imports removed
}
```

### Processing
1. **Named imports**: `import X from './file.wcc'`
   - PascalCase identifier → kebab-case tag
   - Used in template as `<X>` or `<x>`
   
2. **Side-effect imports**: `import './file.wcc'`
   - Child self-registers via `customElements.define()`
   - No template usage

3. **Macro imports**: `import { signal } from 'wcc'`
   - Stripped before further processing (IDE DX only)

---

## Step 3: Props/Emits Extraction (Pre-TypeStrip)

**File**: `lib/parser-extractors.js`

### Why Before Type Strip?

esbuild elimina los generics de TypeScript, así que debemos extraer esta info ANTES:

```javascript
// BEFORE esbuild (what we see)
const props = defineProps<{ label: string, count: number }>({ label: 'Click' })

// AFTER esbuild (types gone)
const props = defineProps({ label: 'Click' })
```

### Extraction Functions

```javascript
// Extract from generic form
extractPropsGeneric(source)        // ['label', 'count']
extractEmitsFromCallSignatures(source)  // ['change', 'reset']
extractPropsObjectName(source)     // 'props'
extractEmitsObjectNameFromGeneric(source)  // 'emit'

// Extract from array form (after strip)
extractPropsArray(source)          // ['label', 'count']
extractEmits(source)               // ['change', 'reset']

// Extract defaults
extractPropsDefaults(source)       // { label: "'Click'", count: '0' }
```

---

## Step 4: TypeScript Stripping

**File**: `lib/parser.js`

### Process
```javascript
import { build } from 'esbuild'

export async function stripTypes(source) {
  const result = await build({
    stdin: { contents: source, loader: 'ts' },
    write: false,
    bundle: false,
    target: 'esnext',
    format: 'esm',
  })
  return result.outputFiles[0].text
}
```

### What Gets Removed
- Type annotations: `const x: number = 5` → `const x = 5`
- Generic parameters: `defineProps<{...}>` → `defineProps`
- Type imports: `import type { X } from './types'`
- Interfaces, type aliases
- Type assertions: `x as Type`

### What Stays
- All runtime code
- Macro calls (signal, computed, etc.)
- Function declarations
- Everything that executes at runtime

---

## Step 5: Extraction

**File**: `lib/parser-extractors.js`

### What Gets Extracted

| Extractor | Pattern | Output |
|-----------|---------|--------|
| `extractSignals` | `const x = signal(val)` | `[{ name: 'x', value: 'val' }]` |
| `extractComputeds` | `const x = computed(() => ...)` | `[{ name: 'x', body: '...' }]` |
| `extractEffects` | `effect(() => { ... })` | `[{ body: '...' }]` |
| `extractFunctions` | `function name(args) { ... }` | `[{ name, params, body }]` |
| `extractPropsGeneric` | `defineProps<{...}>` | `['prop1', 'prop2']` |
| `extractPropsArray` | `defineProps([...])` | `['prop1', 'prop2']` |
| `extractEmits` | `defineEmits([...])` | `['event1', 'event2']` |
| `extractLifecycleHooks` | `onMount(() => {...})` | `{ onMountHooks, onDestroyHooks, onAdoptHooks }` |
| `extractRefs` | `templateRef('name')` | `[{ varName, refName }]` |
| `extractConstants` | `const x = value` (non-reactive) | `[{ name, value }]` |
| `extractExpose` | `defineExpose({ x, y })` | `['x', 'y']` |
| `extractModels` | `defineModel({ name, default })` | `[{ varName, name, default }]` |
| `extractWatchers` | `watch(target, fn)` | `[{ kind, target, newParam, oldParam, body }]` |

### Validation Performed

```javascript
// Duplicate checks
validateDuplicateProps(propNames, fileName)
validateDuplicateEmits(emitNames, fileName)

// Conflict checks
validatePropsConflicts(propsObjectName, signalNames, computedNames, constantNames, fileName)
validateEmitsConflicts(emitsObjectName, signalNames, computedNames, constantNames, propNames, propsObjectName, fileName)

// Assignment checks
validateEmitsAssignment(source, fileName)  // emit must be assigned

// Undeclared emit validation
validateUndeclaredEmits(source, emitsObjectName, emits, fileName)

// Model validations
// - MODEL_NO_ASSIGNMENT
// - MODEL_MISSING_NAME
// - MODEL_NAME_CONFLICT
// - MODEL_READONLY
// - MODEL_UNKNOWN_VAR
```

---

## Step 6: Template Processing

**File**: `lib/tree-walker.js`

### Process
```javascript
import { parseHTML } from 'linkedom'

// 1. Normalize template (PascalCase → kebab-case, self-closing → open+close)
const normalizedTemplate = normalizeTemplate(template, { importMap, fileName })

// 2. Parse with linkedom (jsdom-compatible DOM parser)
const { document } = parseHTML(`<div id="__root">${normalizedTemplate}</div>`)
const rootEl = document.getElementById('__root')

// 3. Process conditional blocks
const ifBlocks = processIfChains(rootEl, [], signalNames, computedNames, propNamesSet)

// 4. Process list blocks
const forBlocks = processForBlocks(rootEl, [], signalNames, computedNames, propNamesSet)

// 5. Process dynamic components
const dynamicComponents = processDynamicComponents(rootEl, [])

// 6. Walk tree for bindings, events, etc.
const { bindings, events, showBindings, modelBindings, attrBindings, slots, childComponents } = 
  walkTree(rootEl, signalNames, computedNames, propNamesSet)

// 7. Detect refs
const refBindings = detectRefs(rootEl)
```

### What Gets Discovered

| Element | Discovery | Result |
|---------|-----------|--------|
| `{{expr}}` | Text interpolation | `bindings[]` |
| `@click="handler"` | Event listener | `events[]` |
| `if="condition"` | Conditional | `ifBlocks[]` |
| `each="item in list"` | List | `forBlocks[]` |
| `show="visible"` | Visibility toggle | `showBindings[]` |
| `model="signal"` | Two-way binding | `modelBindings[]` |
| `:class="{ active: x }"` | Class binding | `attrBindings[]` |
| `:href="url"` | Attribute binding | `attrBindings[]` |
| `<slot name="x">` | Slot | `slots[]` |
| `<slot :prop="source">` | Scoped slot | `slots[]` with `slotProps[]` |
| `ref="name"` | DOM ref | `refBindings[]` |
| `<WccBadge>` | Child component | `childComponents[]` |
| `<component :is="tag">` | Dynamic component | `dynamicComponents[]` |

---

## Step 7: Code Generation

**File**: `lib/codegen.js` (2075 lines)

### Output Structure

```javascript
// Generated from: wcc-counter.wcc (wcCompiler)

// ── Runtime ──────────────────────────────────────────
function __signal(initial) { ... }
function __computed(fn) { ... }
function __effect(fn) { ... }

// ── Styles ───────────────────────────────────────────
if (!document.getElementById('__css_WccCounter')) {
  const __css_WccCounter = document.createElement('style');
  __css_WccCounter.id = '__css_WccCounter';
  __css_WccCounter.textContent = `wcc-counter .counter { ... }`;
  document.head.appendChild(__css_WccCounter);
}

// ── Template ─────────────────────────────────────────
const __t_WccCounter = document.createElement('template');
__t_WccCounter.innerHTML = `<span>...</span>`;

// ── Component ───────────────────────────────────────
class WccCounter extends HTMLElement {
  static get observedAttributes() { return ['label']; }
  static __meta = { tag: 'wcc-counter', props: [...], events: [...] };
  
  constructor() {
    super();
    this._count = __signal(0);
    this._c_doubled = __computed(() => this._count() * 2);
  }
  
  connectedCallback() {
    // DOM setup
    // Effects registration
    // Event listeners
    // Lifecycle hooks
  }
  
  disconnectedCallback() {
    this.__ac.abort();
    this.__disposers.forEach(d => d());
  }
  
  _increment() {
    this._count(this._count() + 1);
  }
}

if (!customElements.get('wcc-counter')) 
  customElements.define('wcc-counter', WccCounter);

export default WccCounter;
```

### Key Transformations

| Source | Transformed |
|--------|-------------|
| `count()` | `this._count()` |
| `count.set(x)` | `this._count(x)` |
| `doubled()` | `this._c_doubled()` |
| `props.label` | `this._s_label()` |
| `label` (no assignment) | `this._s_label()` |
| `emit('change', x)` | `this._emit('change', x)` |
| `TAX_RATE` | `this._const_TAX_RATE` |
| `templateRef('canvas').value` | `this._canvas.value` |

---

## File: lib/compiler.js (Orchestrator)

### Main Function

```javascript
async function compileSFC(filePath, config) {
  // 1. Read and parse SFC
  const rawSource = readFileSync(filePath, 'utf-8')
  const descriptor = parseSFC(rawSource, fileName)
  
  // 2. Extract .wcc imports
  const wccImports = extractWccImports(source, fileName)
  
  // 3. Extract props/emits from generic forms (BEFORE type strip)
  const propsFromGeneric = extractPropsGeneric(source)
  
  // 4. Validate assignments
  validatePropsAssignment(source, filePath)
  validateEmitsAssignment(source, filePath)
  
  // 5. Strip TypeScript
  if (descriptor.lang === 'ts') {
    source = await stripTypes(source)
  }
  
  // 6. Extract component metadata
  const tagName = descriptor.tag
  const className = toClassName(tagName)
  
  // 7. Extract lifecycle hooks
  const { onMountHooks, onDestroyHooks } = extractLifecycleHooks(source)
  
  // 8. Extract reactive declarations
  const signals = extractSignals(source)
  const computeds = extractComputeds(source)
  const methods = extractFunctions(source)
  // ... more extractions
  
  // 9-14. Extract props, emits, validate
  // ...
  
  // 15. Build initial ParseResult
  const parseResult = { tagName, className, template, style, signals, ... }
  
  // 16. Process template
  const normalizedTemplate = normalizeTemplate(template, { importMap, fileName })
  const { document } = parseHTML(`<div id="__root">${normalizedTemplate}</div>`)
  const rootEl = document.getElementById('__root')
  
  const forBlocks = processForBlocks(rootEl, ...)
  const ifBlocks = processIfChains(rootEl, ...)
  const { bindings, events, slots, childComponents } = walkTree(rootEl, ...)
  
  // 17. Validate refs, models
  // ...
  
  // 18-19. Merge results
  parseResult.bindings = bindings
  parseResult.childImports = childImports
  
  // 20. Generate component
  const standaloneResolved = resolveStandalone(descriptor.standalone, config?.standalone)
  const code = generateComponent(parseResult, { ...config, sourceFile: fileName })
  
  return { code, usesSharedRuntime: !standaloneResolved }
}
```

---

## Error Handling

### Error Codes and Conditions

| Code | Thrown When | File |
|------|-------------|------|
| `MISSING_DEFINE_COMPONENT` | No `defineComponent()` or missing tag | sfc-parser.js |
| `SFC_MISSING_TEMPLATE` | No `<template>` block | sfc-parser.js |
| `SFC_MISSING_SCRIPT` | No `<script>` block | sfc-parser.js |
| `SFC_DUPLICATE_BLOCK` | Duplicate blocks | sfc-parser.js |
| `SFC_UNEXPECTED_CONTENT` | Content outside blocks | sfc-parser.js |
| `SFC_INLINE_PATHS_FORBIDDEN` | template/styles in defineComponent | sfc-parser.js |
| `DUPLICATE_PROPS` | Duplicate prop names | parser-extractors.js |
| `PROPS_OBJECT_CONFLICT` | Props name collision | parser-extractors.js |
| `DUPLICATE_EMITS` | Duplicate emit names | parser-extractors.js |
| `EMITS_OBJECT_CONFLICT` | Emits name collision | parser-extractors.js |
| `UNDECLARED_EMIT` | emit() with undeclared event | parser-extractors.js |
| `EMITS_ASSIGNMENT_REQUIRED` | defineEmits() without assignment | parser-extractors.js |
| `MODEL_READONLY` | model on prop/computed/constant | compiler.js |
| `MODEL_UNKNOWN_VAR` | model on undeclared variable | compiler.js |
| `MODEL_NO_ASSIGNMENT` | defineModel() not assigned | compiler.js |
| `MODEL_MISSING_NAME` | defineModel() without name | compiler.js |
| `MODEL_NAME_CONFLICT` | Model name collision | compiler.js |
| `CONFLICTING_DIRECTIVES` | Incompatible directives | tree-walker.js |
| `ORPHAN_ELSE` | else without preceding if | tree-walker.js |
| `REF_NOT_FOUND` | templateRef without matching ref | compiler.js |
| `TS_SYNTAX_ERROR` | TypeScript syntax error | parser.js |

---

## Compilation Options

### Standalone Mode

```javascript
// Resolve logic (lib/compiler.js:448-451)
function resolveStandalone(componentValue, globalValue) {
  if (componentValue === true || componentValue === false) return componentValue;
  return globalValue;
}
```

**Priority**: Component-level > Global config

### Minification

```javascript
// lib/compiler.js:463-476
if (config?.minify) {
  const { transform } = await import('esbuild')
  const minified = await transform(result.code, {
    minify: true,
    loader: 'js',
    target: 'esnext',
  })
  result.code = minified.code
}
```

---

## Performance Notes

| Step | Complexity | Notes |
|------|-----------|-------|
| SFC Parsing | O(n) | Regex-based, single pass |
| Import Extraction | O(n) | Regex on import statements |
| Props/Emits Extraction | O(n) | Regex matching |
| TypeScript Stripping | O(n) | esbuild AST transformation |
| Signal/Method Extraction | O(n) | Line-by-line scanning |
| Template Parsing | O(n) | linkedom DOM parsing |
| Tree Walking | O(m) | m = DOM nodes |
| Code Generation | O(n+m) | String concatenation |

Total compilation time for typical component: <50ms
