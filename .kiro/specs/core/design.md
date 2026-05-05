# Core — Diseño

## Arquitectura del Pipeline

```
.wcc file
    │
    ├── sfc-parser.js → extrae bloques <script>, <template>, <style>, lang, tag
    │
    ├── parser-extractors.js → extrae declaraciones reactivas del script
    │
    ├── parser.js → stripTypes (si lang="ts")
    │
    ├── jsdom → parsea template HTML en DOM
    │
    ├── tree-walker.js → detecta bindings, events, directivas
    │
    └── codegen.js → genera JS autocontenido con:
         - Inline reactive runtime (~60 líneas)
         - CSS scoped inyectado en document.head
         - Clase HTMLElement con Custom Elements API
         - customElements.define()
```

## SFC Parser (`sfc-parser.js`)

- Fase 1: Extracción de bloques via regex (`findBlocks`)
- Fase 2: Validación (bloques requeridos, duplicados, contenido inesperado, defineComponent)
- Retorna `SFCDescriptor`: `{ script, template, style, lang, tag }`
- Detecta `lang="ts"` en atributos de `<script>`
- Extrae tag de `defineComponent({ tag: '...' })`
- Rechaza `template:` y `styles:` dentro de defineComponent en modo SFC

## CSS Scoper (`css-scoper.js`)

- Prefija cada selector CSS con el tag name del componente
- Maneja selectores separados por coma
- Preserva at-rules (`@media`, `@keyframes`) sin prefixar
- Scopa selectores dentro de `@media` recursivamente
- No modifica contenido de `@keyframes`

## Code Generation (`codegen.js`)

El output generado tiene esta estructura:
1. Inline reactive runtime (`__signal`, `__computed`, `__effect`, `__batch`)
2. Imports de child components (si hay)
3. CSS scoped inyectado via `<style>` en `document.head`
4. Template element con innerHTML procesado
5. Clase que extiende `HTMLElement`:
   - `observedAttributes` (si hay props)
   - `constructor()`: clona template, inicializa signals/computeds/constants
   - `connectedCallback()`: activa effects, bindings, event listeners
   - `disconnectedCallback()`: cleanup (si hay onDestroy)
   - `attributeChangedCallback()`: sincroniza attrs → prop signals
   - Métodos del usuario transformados
6. `customElements.define(tagName, ClassName)`

## Compiler (`compiler.js`)

Función principal: `compile(filePath, config)` → `Promise<string>`

Orquesta el pipeline completo:
1. Lee archivo .wcc
2. Parsea SFC
3. Extrae props/emits de generics (antes de strip types)
4. Strip TypeScript types (si lang=ts)
5. Extrae señales, computeds, effects, watchers, funciones, refs, constantes
6. Procesa template con jsdom + tree-walker
7. Valida refs y model bindings
8. Resuelve child component imports
9. Genera código con codegen

## Browser Compiler (`compiler-browser.js`)

Versión del compilador que funciona en el browser (sin dependencias Node.js como `fs`, `path`):
- `compileFromStrings({ script, template, style, tag, lang, stripTypes })` — compila desde strings
- `compileFromSFC(source, options)` — compila un SFC string completo
- Incluye su propia implementación de tree-walker (sin jsdom, usa DOMParser nativo)
- Usa `createRoot(html)` con DOMParser en lugar de jsdom

## Utilidades

- `stripMacroImport(source)` — elimina `import {...} from 'wcc'` / `'@sprlab/wccompiler'`
- `toClassName(tagName)` — convierte kebab-case a PascalCase (e.g. "wcc-counter" → "WccCounter")
