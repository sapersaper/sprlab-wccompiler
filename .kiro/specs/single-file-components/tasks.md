# Plan de Implementación: Single File Components (.wcc)

## Visión General

Implementar soporte para Single File Components (SFC) con extensión `.wcc` en wcCompiler. Se crea un nuevo módulo `sfc-parser.js` que extrae bloques `<script>`, `<template>` y `<style>` de un archivo único, y se integra con el pipeline de compilación existente. La implementación sigue el principio de capa delgada: el SFC parser es un text splitter que alimenta el pipeline existente.

## Tareas

- [x] 1. Crear el módulo `lib/sfc-parser.js` con `parseSFC` y `printSFC`
  - [x] 1.1 Implementar la función `parseSFC(source, fileName)`
    - Crear `lib/sfc-parser.js` como módulo ESM puro (sin dependencias de Node.js)
    - Definir el tipo `SFCDescriptor` con JSDoc: `{ script, template, style, lang, tag }`
    - Implementar Fase 1 (extracción de bloques): buscar etiquetas `<script>`, `<template>`, `<style>` con regex, extraer contenido entre apertura y cierre, detectar atributo `lang` en `<script>`
    - Implementar Fase 2 (validación): verificar presencia de `<template>` y `<script>`, detectar bloques duplicados, verificar contenido no-whitespace fuera de bloques, extraer tag de `defineComponent({ tag })`, rechazar campos `template`/`styles` en `defineComponent` dentro de SFC
    - Lanzar errores con códigos: `SFC_MISSING_TEMPLATE`, `SFC_MISSING_SCRIPT`, `SFC_DUPLICATE_BLOCK`, `SFC_UNEXPECTED_CONTENT`, `SFC_INLINE_PATHS_FORBIDDEN`, `MISSING_DEFINE_COMPONENT`
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3_

  - [x] 1.2 Implementar la función `printSFC(descriptor)`
    - Reconstruir un string SFC válido a partir de un `SFCDescriptor`
    - Incluir atributo `lang="ts"` en `<script>` cuando `lang === 'ts'`
    - Omitir bloque `<style>` cuando `style` es vacío o ausente
    - _Requisitos: 10.1, 10.2, 10.3_

  - [x] 1.3 Escribir property test: Round-trip del SFC (parse → print → parse)
    - **Propiedad 1: Round-trip del SFC**
    - Generar strings arbitrarios para script (con `defineComponent({ tag })`), template y style; ensamblar SFC, parsear, imprimir, volver a parsear; verificar equivalencia de campos
    - **Valida: Requisitos 1.1, 1.2, 1.5, 1.6, 1.7, 10.1, 10.2, 10.3, 10.4**

  - [x] 1.4 Escribir property test: Independencia del orden de bloques
    - **Propiedad 2: Independencia del orden de bloques**
    - Generar contenido + todas las permutaciones de orden de bloques; verificar que `parseSFC` produce descriptores idénticos
    - **Valida: Requisito 1.3**

  - [x] 1.5 Escribir property test: Detección correcta de lenguaje
    - **Propiedad 3: Detección correcta de lenguaje**
    - Generar bloques `<script>` con y sin `lang="ts"`; verificar que `parseSFC` retorna `lang: 'ts'` o `lang: 'js'` correctamente
    - **Valida: Requisitos 1.4, 1.5**

  - [x] 1.6 Escribir property tests de validación (errores)
    - **Propiedad 4: Error en bloques requeridos ausentes**
    - **Propiedad 5: Error en bloques duplicados**
    - **Propiedad 6: Error en contenido inesperado**
    - **Propiedad 7: Error en rutas inline en modo SFC**
    - Generar SFCs inválidos (sin template, sin script, con duplicados, con contenido fuera de bloques, con `defineComponent` con template/styles); verificar que se lanzan los errores correctos
    - **Valida: Requisitos 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.2**

  - [x] 1.7 Escribir unit tests para `parseSFC` y `printSFC`
    - Test: parseo básico con 3 bloques (contenido conocido)
    - Test: SFC sin bloque `<style>` retorna style vacío
    - Test: `<style scoped>` se acepta sin error
    - Test: `defineComponent` solo con `{ tag: 'x-y' }` es válido
    - Test: error `MISSING_DEFINE_COMPONENT` cuando no hay `defineComponent()`
    - Test: error `SFC_INLINE_PATHS_FORBIDDEN` con template/styles en defineComponent
    - Test: `printSFC` omite `<style>` cuando style es vacío
    - Test: `printSFC` incluye `lang="ts"` cuando corresponde
    - _Requisitos: 1.1, 1.2, 1.4, 1.5, 1.6, 2.1, 2.2, 3.1, 3.2, 3.3, 10.1, 10.2, 10.3_

- [x] 2. Checkpoint — Verificar que el SFC parser funciona correctamente
  - Ejecutar todos los tests, consultar al usuario si surgen dudas.

- [x] 3. Integrar SFC en el pipeline de compilación del servidor
  - [x] 3.1 Modificar `lib/compiler.js` para soportar archivos `.wcc`
    - Agregar import de `parseSFC` desde `./sfc-parser.js`
    - Agregar detección de extensión `.wcc` al inicio de `compile()`
    - Implementar función interna `compileSFC(filePath, config)` que: lee el archivo `.wcc`, llama a `parseSFC()`, aplica stripping de tipos si `lang === 'ts'`, reutiliza funciones de `parser-extractors.js` para extraer señales/props/emits/etc., procesa template y style a través del pipeline existente (jsdom → tree-walker → codegen)
    - Asegurar que el flujo existente para `.ts`/`.js` no se modifica
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 8.1_

  - [x] 3.2 Modificar `resolveChildComponent` en `lib/compiler.js` para buscar `.wcc`
    - Agregar `.wcc` a las extensiones buscadas, con prioridad sobre `.js`/`.ts`
    - _Requisitos: 6.1, 6.2_

  - [x] 3.3 Escribir property test: Equivalencia de output SFC vs multi-archivo
    - **Propiedad 8: Equivalencia de output SFC vs multi-archivo**
    - Crear componentes equivalentes en ambos formatos, compilar ambos, verificar output idéntico
    - **Valida: Requisitos 4.1, 4.3**

  - [x] 3.4 Escribir unit tests de integración para compilación SFC
    - Test: compilación end-to-end de un archivo `.wcc` produce output JS válido
    - Test: `<script lang="ts">` con tipos se compila correctamente
    - Test: componente hijo en formato `.wcc` se resuelve correctamente
    - Test: componentes multi-archivo existentes siguen compilando sin cambios
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 6.1, 6.2, 8.1, 8.3_

- [x] 4. Integrar SFC en el compilador del navegador
  - [x] 4.1 Agregar `compileFromSFC` en `lib/compiler-browser.js`
    - Importar `parseSFC` desde `./sfc-parser.js`
    - Implementar `compileFromSFC(source, options)` que parsea el SFC y delega a `compileFromStrings`
    - Exportar la nueva función
    - _Requisitos: 7.1, 7.2, 7.3_

  - [x] 4.2 Escribir unit tests para `compileFromSFC`
    - Test: compilación SFC en modo browser produce output JS válido
    - Test: SFC inválido lanza los mismos errores de validación
    - _Requisitos: 7.1, 7.2, 7.3_

- [x] 5. Checkpoint — Verificar compilación SFC end-to-end
  - Ejecutar todos los tests, consultar al usuario si surgen dudas.

- [x] 6. Integrar SFC en el CLI
  - [x] 6.1 Modificar `bin/wcc.js` para descubrir y compilar archivos `.wcc`
    - En `discoverFiles()`: agregar `.wcc` a las extensiones aceptadas
    - En `build()`: reemplazar `.wcc` por `.js` en la ruta de salida (además de `.ts`)
    - En el watcher de `dev`: observar cambios en `.wcc` además de `.ts`/`.js`, y reemplazar `.wcc` por `.js` en la ruta de salida
    - _Requisitos: 5.1, 5.2, 5.3_

  - [x] 6.2 Escribir unit tests para el CLI con archivos `.wcc`
    - Test: `discoverFiles` incluye archivos `.wcc`
    - Test: la ruta de salida reemplaza `.wcc` por `.js`
    - _Requisitos: 5.1, 5.2_

- [x] 7. Crear ejemplo de componente SFC
  - [x] 7.1 Crear `example/src/wcc-greeting.wcc` como componente de ejemplo
    - Incluir bloques `<script>`, `<template>` y `<style>`
    - Demostrar uso de `signal`, `computed`, interpolación y eventos
    - Usar `defineComponent({ tag: 'wcc-greeting' })`
    - _Requisitos: 9.1, 9.2_

- [x] 8. Checkpoint final — Verificar que todos los tests pasan
  - Ejecutar todos los tests, consultar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los property tests validan propiedades universales de corrección del SFC parser
- Los unit tests validan ejemplos concretos, integración end-to-end y edge cases
- El módulo `sfc-parser.js` es puro (sin dependencias de Node.js) para ser usable en browser y server
