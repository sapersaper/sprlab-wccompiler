# Documento de Requisitos — Single File Components (.wcc)

## Introducción

Soporte para Single File Components (SFC) con extensión `.wcc` que contienen bloques `<script>`, `<template>` y `<style>` en un único archivo, al estilo Vue. Esta funcionalidad complementa el formato multi-archivo existente (.ts/.js + .html + .css) sin romper la compatibilidad hacia atrás. El objetivo es ofrecer una experiencia de desarrollo más compacta donde script, template y estilos conviven en el mismo archivo.

## Glosario

- **SFC_Parser**: Módulo que extrae los bloques `<script>`, `<template>` y `<style>` de un archivo `.wcc`
- **Parser**: Módulo existente (`lib/parser.js`) que analiza archivos fuente `.ts/.js` y produce un IR (ParseResult)
- **Compiler**: Módulo existente (`lib/compiler.js`) que orquesta el pipeline completo de compilación
- **Compiler_Browser**: Módulo existente (`lib/compiler-browser.js`) que compila componentes desde strings en el navegador
- **CLI**: Herramienta de línea de comandos (`bin/wcc.js`) que ejecuta `build` y `dev`
- **SFC_File**: Archivo con extensión `.wcc` que contiene bloques `<script>`, `<template>` y `<style>` en un único archivo
- **Block**: Sección delimitada por etiquetas de apertura y cierre dentro de un SFC_File (`<script>`, `<template>`, `<style>`)
- **Multi_File_Format**: Formato existente donde el componente se define en archivos separados (.ts/.js + .html + .css)
- **defineComponent_Call**: Invocación a `defineComponent()` dentro del bloque `<script>` de un SFC_File

## Requisitos

### Requisito 1: Parseo de archivos SFC

**User Story:** Como desarrollador, quiero escribir mis componentes web en un único archivo `.wcc` con bloques `<script>`, `<template>` y `<style>`, para tener todo el código del componente en un solo lugar.

#### Criterios de Aceptación

1. WHEN un SFC_File contiene un bloque `<script>`, un bloque `<template>` y un bloque `<style>`, THE SFC_Parser SHALL extraer el contenido de cada bloque como strings independientes
2. WHEN un SFC_File contiene un bloque `<script>` y un bloque `<template>` sin bloque `<style>`, THE SFC_Parser SHALL extraer script y template, y retornar un string vacío para style
3. WHEN un SFC_File contiene los bloques en cualquier orden (por ejemplo `<style>` antes de `<script>`), THE SFC_Parser SHALL extraer correctamente cada bloque independientemente de su posición
4. WHEN un bloque `<script>` incluye el atributo `lang="ts"`, THE SFC_Parser SHALL detectar el lenguaje como TypeScript
5. WHEN un bloque `<script>` no incluye atributo `lang`, THE SFC_Parser SHALL asumir el lenguaje como JavaScript
6. WHEN un bloque `<style>` incluye el atributo `scoped`, THE SFC_Parser SHALL extraer el contenido de estilo sin modificación (el scoping se aplica por tag name en etapas posteriores)
7. THE SFC_Parser SHALL preservar el contenido exacto de cada bloque sin alterar espacios en blanco, saltos de línea ni indentación internos

### Requisito 2: Validación de archivos SFC

**User Story:** Como desarrollador, quiero recibir mensajes de error claros cuando mi archivo `.wcc` tiene problemas estructurales, para poder corregirlos rápidamente.

#### Criterios de Aceptación

1. IF un SFC_File no contiene un bloque `<template>`, THEN THE SFC_Parser SHALL lanzar un error con código `SFC_MISSING_TEMPLATE` y un mensaje que indique el archivo afectado
2. IF un SFC_File no contiene un bloque `<script>`, THEN THE SFC_Parser SHALL lanzar un error con código `SFC_MISSING_SCRIPT` y un mensaje que indique el archivo afectado
3. IF un SFC_File contiene más de un bloque `<script>`, THEN THE SFC_Parser SHALL lanzar un error con código `SFC_DUPLICATE_BLOCK` indicando el bloque duplicado
4. IF un SFC_File contiene más de un bloque `<template>`, THEN THE SFC_Parser SHALL lanzar un error con código `SFC_DUPLICATE_BLOCK` indicando el bloque duplicado
5. IF un SFC_File contiene más de un bloque `<style>`, THEN THE SFC_Parser SHALL lanzar un error con código `SFC_DUPLICATE_BLOCK` indicando el bloque duplicado
6. IF un SFC_File contiene texto fuera de los bloques reconocidos (`<script>`, `<template>`, `<style>`) que no sea espacio en blanco, THEN THE SFC_Parser SHALL lanzar un error con código `SFC_UNEXPECTED_CONTENT`

### Requisito 3: defineComponent en modo SFC

**User Story:** Como desarrollador, quiero que `defineComponent()` dentro de un archivo `.wcc` solo requiera el campo `tag`, ya que template y styles están en el mismo archivo.

#### Criterios de Aceptación

1. WHEN el bloque `<script>` de un SFC_File contiene `defineComponent({ tag: 'my-component' })` sin campos `template` ni `styles`, THE Parser SHALL aceptar la definición y usar el tag name proporcionado
2. IF el bloque `<script>` de un SFC_File contiene `defineComponent()` con un campo `template` o `styles`, THEN THE Parser SHALL lanzar un error con código `SFC_INLINE_PATHS_FORBIDDEN` indicando que las rutas externas no son válidas en modo SFC
3. IF el bloque `<script>` de un SFC_File no contiene una llamada a `defineComponent()`, THEN THE Parser SHALL lanzar un error con código `MISSING_DEFINE_COMPONENT`

### Requisito 4: Integración con el pipeline de compilación

**User Story:** Como desarrollador, quiero que los archivos `.wcc` se compilen con el mismo pipeline que los archivos multi-archivo, para obtener el mismo output JavaScript autocontenido.

#### Criterios de Aceptación

1. WHEN el Compiler recibe un archivo con extensión `.wcc`, THE Compiler SHALL delegar al SFC_Parser para extraer los bloques, y luego procesar script, template y style a través del pipeline existente (parser → tree-walker → codegen)
2. WHEN el Compiler recibe un archivo con extensión `.ts` o `.js`, THE Compiler SHALL continuar usando el flujo multi-archivo existente sin cambios
3. THE Compiler SHALL producir output JavaScript idéntico en estructura para un componente SFC y su equivalente multi-archivo cuando ambos definen la misma lógica, template y estilos
4. WHEN un SFC_File tiene `<script lang="ts">`, THE Compiler SHALL aplicar el stripping de tipos TypeScript al contenido del bloque script antes de continuar el pipeline

### Requisito 5: Integración con el CLI

**User Story:** Como desarrollador, quiero que los comandos `wcc build` y `wcc dev` descubran y compilen archivos `.wcc` automáticamente, para no tener que configurar nada adicional.

#### Criterios de Aceptación

1. WHEN el CLI ejecuta `wcc build`, THE CLI SHALL descubrir archivos con extensión `.wcc` además de `.ts` y `.js` en el directorio de entrada
2. WHEN el CLI compila un archivo `.wcc`, THE CLI SHALL escribir el output con extensión `.js` en el directorio de salida (reemplazando `.wcc` por `.js`)
3. WHEN el CLI ejecuta `wcc dev`, THE CLI SHALL observar cambios en archivos `.wcc` además de `.ts` y `.js`, y recompilar automáticamente al detectar modificaciones

### Requisito 6: Resolución de componentes hijos

**User Story:** Como desarrollador, quiero que un componente padre pueda importar automáticamente componentes hijos definidos en archivos `.wcc`, para que la composición funcione sin importar el formato de archivo.

#### Criterios de Aceptación

1. WHEN un template referencia un componente hijo con tag personalizado (por ejemplo `<wcc-badge>`), THE Compiler SHALL buscar archivos `.wcc` además de `.ts` y `.js` para resolver la ruta de importación del componente hijo
2. WHEN un componente hijo existe tanto en formato `.wcc` como en formato multi-archivo, THE Compiler SHALL priorizar el archivo `.wcc` sobre el multi-archivo

### Requisito 7: Compilación en el navegador

**User Story:** Como desarrollador del playground, quiero poder compilar componentes SFC desde el navegador, para que el playground soporte el formato `.wcc`.

#### Criterios de Aceptación

1. THE Compiler_Browser SHALL exponer una función `compileFromSFC` que acepte un string con el contenido completo de un SFC_File y un objeto de opciones
2. WHEN `compileFromSFC` recibe un string SFC válido, THE Compiler_Browser SHALL parsear los bloques, y delegar al pipeline existente `compileFromStrings` para producir el JavaScript compilado
3. IF `compileFromSFC` recibe un string SFC inválido (sin `<template>` o sin `<script>`), THEN THE Compiler_Browser SHALL lanzar los mismos errores de validación que el SFC_Parser del servidor

### Requisito 8: Compatibilidad hacia atrás

**User Story:** Como desarrollador con componentes existentes en formato multi-archivo, quiero que mis componentes sigan compilando sin cambios después de agregar soporte SFC.

#### Criterios de Aceptación

1. THE Compiler SHALL compilar todos los componentes multi-archivo existentes sin modificación en su comportamiento ni en su output
2. THE CLI SHALL mantener el comportamiento actual para archivos `.ts` y `.js` sin alteraciones
3. WHEN un proyecto contiene una mezcla de archivos `.wcc` y archivos multi-archivo, THE Compiler SHALL compilar ambos formatos correctamente en la misma ejecución

### Requisito 9: Ejemplo de componente SFC

**User Story:** Como desarrollador nuevo, quiero ver un ejemplo de componente `.wcc` en el directorio de ejemplo, para entender el formato rápidamente.

#### Criterios de Aceptación

1. THE ejemplo SHALL incluir al menos un archivo `.wcc` en el directorio `example/src/` que demuestre el uso de bloques `<script>`, `<template>` y `<style>` con reactividad (signal, computed, interpolación y eventos)
2. WHEN el ejemplo SFC se compila con `wcc build`, THE CLI SHALL producir un archivo `.js` funcional que registre un custom element válido

### Requisito 10: Pretty-printer y round-trip para SFC

**User Story:** Como desarrollador del compilador, quiero un pretty-printer que reconstruya un archivo `.wcc` a partir de sus bloques, para poder verificar la corrección del parser mediante round-trip testing.

#### Criterios de Aceptación

1. THE SFC_Printer SHALL formatear un objeto con campos `script`, `template`, `style`, `lang` y `tag` de vuelta a un string SFC válido con bloques `<script>`, `<template>` y `<style>`
2. WHEN el SFC_Printer recibe un objeto sin campo `style` o con style vacío, THE SFC_Printer SHALL omitir el bloque `<style>` del output
3. WHEN el SFC_Printer recibe `lang` con valor `ts`, THE SFC_Printer SHALL incluir el atributo `lang="ts"` en la etiqueta `<script>`
4. FOR ALL SFC_Files válidos, parsear con SFC_Parser y luego imprimir con SFC_Printer y volver a parsear SHALL producir bloques equivalentes (propiedad round-trip)
