# Plan de Implementación: wcCompiler (spr-compiler-library)

## Resumen

Reescritura limpia del compilador de web components como librería npm. Se implementa de forma incremental: primero el núcleo (parser, tree walker, codegen con runtime reactivo inline), luego el pretty printer, CSS scoper, CLI y servidor dev. Cada paso construye sobre el anterior y se valida con tests.

## Tareas

- [ ] 1. Estructura del proyecto e interfaces base
  - Crear la estructura de directorios `bin/` y `lib/`
  - Crear `package.json` con campo `name: "wccompiler"`, `bin: { "wcc": "./bin/wcc.js" }`, `type: "module"`, dependencias `jsdom` y devDependencies `fast-check`, `vitest`
  - Crear `lib/reactive-runtime.js` que exporte un template string con el mini runtime reactivo (~40 líneas: `__signal`, `__computed`, `__effect` con tracking de dependencias vía stack global `__currentEffect`)
  - Crear `lib/config.js` con la función `loadConfig(projectRoot)` que lea `wcc.config.js`, valide tipos (`port` numérico, `input`/`output` strings no vacíos) y retorne defaults si no existe el archivo
  - _Requisitos: 17.1, 17.2, 17.3, 18.1, 18.3_

- [ ] 2. Parser de archivos fuente
  - [ ] 2.1 Implementar extracción de bloques `<template>`, `<script>`, `<style>`
    - Crear `lib/parser.js` con la función `parse(html, fileName)`
    - Extraer los tres bloques con regex; error `MISSING_TEMPLATE` si falta `<template>`; tratar `<script>` y `<style>` como vacíos si no existen
    - Derivar `tagName` del fileName y `className` en PascalCase
    - _Requisitos: 1.1, 1.2, 1.3, 1.4_

  - [ ] 2.2 Implementar extracción de `defineProps`, variables reactivas, computeds, watchers y funciones
    - Extraer props de `defineProps([...])` con detección de duplicados (error `DUPLICATE_PROPS`)
    - Extraer variables reactivas a nivel raíz (`const`/`let`/`var` con valor literal), excluyendo las que usen `computed(...)` o `watch(...)` y las que estén dentro de funciones o bloques anidados
    - Extraer computeds de `const name = computed(() => expr)`
    - Extraer watchers de `watch('target', (newParam, oldParam) => { body })`
    - Extraer funciones declaradas con `function name(params) { body }`
    - _Requisitos: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 4.1, 5.1_

  - [ ]* 2.3 Tests de propiedad para extracción de bloques
    - **Propiedad 2: Extracción de bloques del archivo fuente**
    - **Valida: Requisito 1.1**

  - [ ]* 2.4 Tests de propiedad para extracción de props
    - **Propiedad 3: Extracción de props con detección de duplicados**
    - **Valida: Requisitos 2.1, 2.3**

  - [ ]* 2.5 Tests de propiedad para extracción de variables reactivas
    - **Propiedad 4: Extracción de variables reactivas (solo raíz, excluyendo computed/watch)**
    - **Valida: Requisitos 3.1, 3.2, 3.3**

  - [ ]* 2.6 Tests de propiedad para extracción de computeds
    - **Propiedad 5: Extracción de propiedades computadas**
    - **Valida: Requisito 4.1**

  - [ ]* 2.7 Tests de propiedad para extracción de watchers
    - **Propiedad 6: Extracción de watchers**
    - **Valida: Requisito 5.1**

  - [ ]* 2.8 Tests unitarios del parser
    - Archivo sin `<template>` retorna error (1.2)
    - Archivo sin `<script>` continúa con script vacío (1.3)
    - Archivo sin `<style>` continúa con estilo vacío (1.4)
    - Archivo sin `defineProps` retorna lista vacía (2.2)
    - _Requisitos: 1.2, 1.3, 1.4, 2.2_

- [ ] 3. Tree Walker del template
  - [ ] 3.1 Implementar `lib/tree-walker.js` con la función `walkTree(rootEl, propsSet, computedNames, rootVarNames)`
    - Descubrir bindings de texto `{{var}}` con ruta `childNodes[n]`; dividir nodos con múltiples interpolaciones en `<span>` individuales
    - Descubrir bindings de eventos `@event="handler"` y eliminar el atributo del template procesado
    - Descubrir slots `<slot>` (con nombre, por defecto, con slotProps `:prop="source"`) y reemplazar por `<span data-slot="name">`
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 3.2 Tests de propiedad para bindings de texto
    - **Propiedad 7: Tree walker — bindings de texto (incluyendo interpolaciones mixtas)**
    - **Valida: Requisitos 6.1, 6.2**

  - [ ]* 3.3 Tests de propiedad para bindings de eventos
    - **Propiedad 8: Tree walker — bindings de eventos**
    - **Valida: Requisito 6.3**

  - [ ]* 3.4 Tests de propiedad para slots
    - **Propiedad 9: Tree walker — descubrimiento y reemplazo de slots**
    - **Valida: Requisitos 6.4, 6.5, 6.6**

- [ ] 4. Checkpoint — Verificar que parser y tree walker funcionan correctamente
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. CSS Scoper
  - [ ] 5.1 Implementar `lib/css-scoper.js` con la función `scopeCSS(css, tagName)`
    - Prefijar cada selector CSS con el tag name del componente
    - Preservar at-rules (`@media`, `@keyframes`) sin prefijar
    - _Requisitos: 12.1, 12.4_

  - [ ]* 5.2 Tests de propiedad para CSS scoping
    - **Propiedad 15: CSS scoping preserva at-rules**
    - **Valida: Requisitos 12.1, 12.4**

- [ ] 6. Generador de Código
  - [ ] 6.1 Implementar `lib/codegen.js` con la función `generateComponent(parseResult)`
    - Inline del mini runtime reactivo al inicio del archivo (desde `reactive-runtime.js`)
    - Generar clase que extienda `HTMLElement` con nombre PascalCase
    - Generar `customElements.define` con el tag name
    - Generar `observedAttributes` con la lista de props
    - Generar `attributeChangedCallback` que actualice signals
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5, 13.1_

  - [ ] 6.2 Implementar generación de reactividad
    - Signal por cada prop (inicializada a `null`) y por cada variable reactiva (con valor literal)
    - Computed por cada propiedad computada con referencias transformadas a llamadas de signal
    - Effect en `connectedCallback` que actualice `textContent` de cada binding
    - Getters y setters públicos por cada prop
    - _Requisitos: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 6.3 Implementar generación de watchers con tracking de valor previo
    - Inicializar `__prev_{target}` como `undefined`
    - Effect que lea valor actual, ejecute cuerpo solo cuando previo no sea `undefined`, actualice previo
    - Transformar referencias a variables en el cuerpo a llamadas de signal
    - _Requisitos: 9.1, 9.2, 9.3_

  - [ ] 6.4 Implementar generación de eventos y emit
    - `addEventListener` en `connectedCallback` para cada binding de evento
    - Método `_emit(name, detail)` con `CustomEvent` (`bubbles: true`, `composed: true`)
    - Transformar `emit(...)` a `this._emit(...)` en el código generado
    - _Requisitos: 10.1, 10.2, 10.3_

  - [ ] 6.5 Implementar generación de slots
    - Código en constructor que resuelva slots leyendo `childNodes` antes de reemplazar innerHTML
    - Inyección de contenido para slots con nombre (vía `<template #name>`)
    - Reemplazo de contenido para slot por defecto
    - Effects reactivos para slots con slotProps
    - _Requisitos: 11.1, 11.2, 11.3, 11.4_

  - [ ] 6.6 Implementar inyección de CSS con scope
    - Crear elemento `<style>` con CSS scopeado y agregarlo a `document.head`
    - Omitir inyección si no hay bloque `<style>`
    - _Requisitos: 12.1, 12.2, 12.3_

  - [ ]* 6.7 Tests de propiedad para estructura del componente
    - **Propiedad 10: Codegen — estructura del componente**
    - **Valida: Requisitos 7.1, 7.2, 7.3, 7.4, 7.5**

  - [ ]* 6.8 Tests de propiedad para reactividad
    - **Propiedad 11: Codegen — reactividad**
    - **Valida: Requisitos 8.1, 8.2, 8.3, 8.4, 8.5**

  - [ ]* 6.9 Tests de propiedad para watchers codegen
    - **Propiedad 12: Codegen — watchers con tracking de valor previo**
    - **Valida: Requisitos 9.1, 9.2, 9.3**

  - [ ]* 6.10 Tests de propiedad para eventos codegen
    - **Propiedad 13: Codegen — eventos y emit**
    - **Valida: Requisitos 10.1, 10.3**

  - [ ]* 6.11 Tests de propiedad para slots codegen
    - **Propiedad 14: Codegen — slots**
    - **Valida: Requisitos 11.1, 11.2, 11.4**

  - [ ]* 6.12 Tests de propiedad para output sin imports
    - **Propiedad 16: Output sin imports externos**
    - **Valida: Requisito 13.1**

  - [ ]* 6.13 Tests unitarios del codegen
    - Método `_emit` genera CustomEvent correcto (10.2)
    - CSS injection presente cuando hay `<style>` (12.2)
    - CSS injection ausente cuando no hay `<style>` (12.3)
    - Slot por defecto reemplaza contenido (11.3)
    - _Requisitos: 10.2, 11.3, 12.2, 12.3_

- [ ] 7. Checkpoint — Verificar que el codegen produce componentes válidos
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Pretty Printer
  - [ ] 8.1 Implementar `lib/printer.js` con la función `prettyPrint(ir)`
    - Reconstruir bloque `<template>` con bindings `{{var}}`, atributos `@event="handler"` y elementos `<slot>`
    - Reconstruir bloque `<script>` con `defineProps`, variables, computeds, watchers y funciones
    - Reconstruir bloque `<style>` con CSS original (sin scope)
    - Preservar orden y semántica de todos los elementos de la IR
    - _Requisitos: 14.1, 14.2_

  - [ ]* 8.2 Tests de propiedad para round-trip Parser ↔ Pretty Printer
    - **Propiedad 1: Round-trip Parser ↔ Pretty Printer**
    - **Valida: Requisitos 1.5, 14.2, 14.3**

  - [ ]* 8.3 Tests de propiedad para Pretty Printer produce fuente válida
    - **Propiedad 18: Pretty Printer produce fuente válida**
    - **Valida: Requisito 14.1**

- [ ] 9. Checkpoint — Verificar round-trip parser ↔ printer
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. CLI y servidor dev
  - [ ] 10.1 Implementar `bin/wcc.js` con comandos `wcc build` y `wcc dev`
    - `wcc build`: leer config → compilar todos los `.html` de `input/` → escribir `.js` en `output/`; crear carpeta de salida si no existe; reportar conteo de éxitos y errores; continuar compilando si un archivo falla
    - _Requisitos: 15.1, 15.2, 15.3, 15.4_

  - [ ] 10.2 Implementar `lib/dev-server.js` con servidor HTTP y live-reload
    - Servidor HTTP estático que sirva archivos del proyecto
    - Inyectar snippet WebSocket en respuestas HTML para live-reload
    - Enviar mensaje de recarga cuando cambien archivos en `output/`
    - _Requisitos: 16.3, 16.4_

  - [ ] 10.3 Implementar comando `wcc dev` con watch + servidor
    - Compilación inicial de todos los archivos
    - Watch en carpeta `input/` para recompilar archivos modificados
    - Iniciar servidor dev en el puerto configurado
    - _Requisitos: 16.1, 16.2_

  - [ ]* 10.4 Tests de propiedad para validación de configuración
    - **Propiedad 17: Validación de configuración**
    - **Valida: Requisitos 17.1, 17.3**

  - [ ]* 10.5 Tests unitarios del CLI y config
    - Carpeta de salida creada automáticamente (15.3)
    - Reporte de conteo de archivos compilados (15.4)
    - Defaults de config cuando no existe archivo (17.2)
    - Campo `bin` en package.json apunta a `bin/wcc.js` (18.1)
    - `jsdom` en dependencies (18.3)
    - _Requisitos: 15.3, 15.4, 17.2, 18.1, 18.3_

- [ ] 11. Integración final y validación end-to-end
  - [ ] 11.1 Conectar todos los módulos en el flujo completo
    - Integrar parser + tree walker + css scoper + codegen en una función `compile(filePath, config)` en `lib/compiler.js`
    - Verificar que el archivo fuente de ejemplo `src/spr-hi.html` compila correctamente a un componente autocontenido sin imports
    - _Requisitos: 13.1, 13.2, 13.3_

  - [ ]* 11.2 Tests de integración
    - Compilación completa de archivo fuente de ejemplo produce output válido
    - Output no contiene sentencias `import`
    - Output contiene `customElements.define` y clase `HTMLElement`
    - _Requisitos: 13.1, 13.2, 13.3_

- [ ] 12. Checkpoint final — Verificar que todo funciona correctamente
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los tests de propiedad validan propiedades universales de correctitud con fast-check
- Los tests unitarios validan escenarios específicos y edge cases
- El mini runtime reactivo (~40 líneas) se inlinea en cada componente compilado — cero imports en el output
