# Documento de Requisitos — Template Intellisense para `.wcc`

## Introducción

Este documento define los requisitos para agregar intellisense de TypeScript/JavaScript dentro de expresiones del bloque `<template>` en archivos `.wcc` Single File Component. Actualmente el Language Server basado en Volar provee intellisense completo dentro de `<script>`, `<template>` (HTML) y `<style>`, pero las expresiones embebidas en el template — interpolaciones `{{expr}}` y valores de directivas como `@click="handler"` — no tienen soporte de tipos, autocompletado ni navegación.

El objetivo es generar un código TypeScript virtual que represente las expresiones del template con mapeos de posición precisos, de modo que Volar pueda delegar el intellisense de TypeScript a esas posiciones dentro del template.

## Glosario

- **Language_Plugin**: Módulo (`languagePlugin.ts`) que parsea archivos `.wcc` y genera objetos VirtualCode con lenguajes embebidos para Volar.
- **VirtualCode**: Objeto de Volar que representa un fragmento de código virtual con su `languageId`, contenido y mapeo de posiciones respecto al archivo fuente `.wcc`.
- **Template_Expression**: Cualquier expresión JavaScript/TypeScript embebida dentro del bloque `<template>`, ya sea en interpolaciones `{{expr}}` o en valores de directivas.
- **Interpolation**: Expresión delimitada por `{{` y `}}` dentro del template que se evalúa y renderiza como texto.
- **Directive_Value**: Valor de un atributo de directiva (`@click="expr"`, `:class="expr"`, `model="variable"`) que contiene una expresión JavaScript/TypeScript.
- **Source_Mapping**: Mapeo bidireccional entre una posición en el archivo `.wcc` original y la posición correspondiente en el código virtual generado.
- **Virtual_Script**: Código TypeScript/JavaScript generado que contiene las expresiones del template en un contexto donde las variables del `<script>` están disponibles, permitiendo al servicio TypeScript proveer intellisense.
- **Script_Context**: Conjunto de variables, funciones y tipos declarados en el bloque `<script>` del mismo archivo `.wcc` que están disponibles para las expresiones del template.
- **Template_Parser**: Módulo que analiza el contenido del bloque `<template>` y extrae las expresiones embebidas con sus posiciones exactas.

## Requisitos

### Requisito 1: Extracción de Expresiones del Template

**User Story:** Como desarrollador del Language Plugin, quiero un parser que extraiga todas las expresiones embebidas del template con sus posiciones exactas, para que pueda generar mapeos precisos al código virtual.

#### Criterios de Aceptación

1. WHEN el Template_Parser recibe contenido de un bloque `<template>`, THE Template_Parser SHALL extraer todas las Interpolation con su contenido y offset de inicio relativo al bloque template.
2. WHEN el Template_Parser recibe contenido de un bloque `<template>`, THE Template_Parser SHALL extraer todos los Directive_Value de atributos `@event="expr"` con su contenido y offset de inicio relativo al bloque template.
3. WHEN el Template_Parser recibe contenido de un bloque `<template>`, THE Template_Parser SHALL extraer todos los Directive_Value de atributos `:attr="expr"` con su contenido y offset de inicio relativo al bloque template.
4. WHEN el Template_Parser recibe contenido de un bloque `<template>`, THE Template_Parser SHALL extraer todos los Directive_Value de atributos `model="variable"` con su contenido y offset de inicio relativo al bloque template.
5. WHEN una Interpolation contiene múltiples expresiones separadas por operadores, THE Template_Parser SHALL extraer la expresión completa como una sola unidad.
6. WHEN el template contiene Interpolation anidadas dentro de directivas de control (`each`, `if`), THE Template_Parser SHALL extraer las expresiones independientemente de su nivel de anidamiento.

### Requisito 2: Generación de Código Virtual para Expresiones del Template

**User Story:** Como desarrollador del Language Plugin, quiero generar un VirtualCode TypeScript que contenga las expresiones del template en un contexto tipado, para que el servicio TypeScript pueda proveer intellisense sobre ellas.

#### Criterios de Aceptación

1. WHEN el Language_Plugin procesa un archivo `.wcc` con Interpolation en el template, THE Language_Plugin SHALL generar un Virtual_Script que contenga cada expresión en un contexto donde el Script_Context esté disponible.
2. WHEN el Language_Plugin procesa un archivo `.wcc` con Directive_Value en el template, THE Language_Plugin SHALL incluir cada valor de directiva en el Virtual_Script generado.
3. THE Virtual_Script SHALL ser un VirtualCode embebido con `languageId` "typescript" o "javascript" según el lenguaje del bloque `<script>`.
4. THE Virtual_Script SHALL incluir Source_Mapping para cada expresión, mapeando la posición en el archivo `.wcc` original a la posición correspondiente en el código virtual generado.
5. WHEN el bloque `<script>` no existe en el archivo `.wcc`, THE Language_Plugin SHALL generar el Virtual_Script sin Script_Context previo.

### Requisito 3: Autocompletado en Expresiones del Template

**User Story:** Como desarrollador de componentes `.wcc`, quiero autocompletado de TypeScript dentro de expresiones `{{}}` y valores de directivas, para que pueda escribir expresiones con asistencia de tipos y descubrir las variables disponibles.

#### Criterios de Aceptación

1. WHILE el cursor está dentro de una Interpolation `{{}}`, THE Language_Server SHALL proveer sugerencias de autocompletado que incluyan las variables y funciones del Script_Context.
2. WHILE el cursor está dentro de un Directive_Value `@event="..."`, THE Language_Server SHALL proveer sugerencias de autocompletado que incluyan las funciones del Script_Context.
3. WHILE el cursor está dentro de un Directive_Value `:attr="..."`, THE Language_Server SHALL proveer sugerencias de autocompletado que incluyan las variables y expresiones del Script_Context.
4. WHILE el cursor está dentro de un Directive_Value `model="..."`, THE Language_Server SHALL proveer sugerencias de autocompletado que incluyan las variables reactivas del Script_Context.
5. WHEN el usuario escribe un punto después de un identificador dentro de una Template_Expression, THE Language_Server SHALL proveer autocompletado de propiedades y métodos del tipo del identificador.

### Requisito 4: Hover con Información de Tipos

**User Story:** Como desarrollador de componentes `.wcc`, quiero ver información de tipos al posicionar el cursor sobre identificadores en expresiones del template, para que pueda verificar tipos sin navegar al script.

#### Criterios de Aceptación

1. WHEN el usuario posiciona el cursor sobre un identificador dentro de una Interpolation, THE Language_Server SHALL mostrar información de hover con el tipo del identificador según el Script_Context.
2. WHEN el usuario posiciona el cursor sobre un identificador dentro de un Directive_Value, THE Language_Server SHALL mostrar información de hover con el tipo del identificador.
3. WHEN el usuario posiciona el cursor sobre una llamada a función dentro de una Template_Expression, THE Language_Server SHALL mostrar la firma de la función incluyendo parámetros y tipo de retorno.

### Requisito 5: Diagnósticos de Tipo en Expresiones del Template

**User Story:** Como desarrollador de componentes `.wcc`, quiero ver errores de tipo dentro de expresiones del template, para que pueda detectar errores antes de ejecutar el componente.

#### Criterios de Aceptación

1. WHEN una Interpolation referencia un identificador que no existe en el Script_Context, THE Language_Server SHALL reportar un diagnóstico de error en la posición correcta dentro del archivo `.wcc`.
2. WHEN una Interpolation contiene una expresión con error de tipo, THE Language_Server SHALL reportar el diagnóstico de tipo en la posición correcta dentro del archivo `.wcc`.
3. WHEN un Directive_Value referencia una función que no existe en el Script_Context, THE Language_Server SHALL reportar un diagnóstico de error en la posición del valor de la directiva.
4. THE Language_Server SHALL mapear las posiciones de los diagnósticos del Virtual_Script de vuelta a las posiciones correctas en el archivo `.wcc` original.

### Requisito 6: Go-to-Definition desde Template a Script

**User Story:** Como desarrollador de componentes `.wcc`, quiero poder hacer click en un identificador dentro del template y navegar a su definición en el bloque `<script>`, para que pueda inspeccionar y modificar el código fuente rápidamente.

#### Criterios de Aceptación

1. WHEN el usuario invoca "Go to Definition" sobre un identificador dentro de una Interpolation, THE Language_Server SHALL navegar a la declaración del identificador en el Bloque_Script del mismo archivo `.wcc`.
2. WHEN el usuario invoca "Go to Definition" sobre un handler en un Directive_Value `@event="handler"`, THE Language_Server SHALL navegar a la declaración de la función en el Bloque_Script.
3. WHEN el usuario invoca "Go to Definition" sobre una variable en un Directive_Value `model="variable"`, THE Language_Server SHALL navegar a la declaración de la variable en el Bloque_Script.
4. WHEN el identificador referenciado proviene de un módulo importado, THE Language_Server SHALL navegar a la definición en el módulo correspondiente.

### Requisito 7: Mapeo Preciso de Posiciones (Source Mappings)

**User Story:** Como desarrollador del Language Plugin, quiero que los mapeos de posición entre el template y el código virtual sean precisos a nivel de carácter, para que todas las funcionalidades de intellisense apunten a la posición exacta en el archivo original.

#### Criterios de Aceptación

1. FOR ALL Template_Expression extraídas, THE Source_Mapping SHALL mapear cada carácter de la expresión en el archivo `.wcc` a su carácter correspondiente en el Virtual_Script (mapeo uno-a-uno).
2. WHEN el Language_Server resuelve una posición en el Virtual_Script, THE Source_Mapping SHALL producir la posición correcta en el archivo `.wcc` original (propiedad round-trip: posición original → virtual → original produce la posición inicial).
3. WHEN el template contiene múltiples expresiones, THE Source_Mapping SHALL mantener mapeos independientes para cada expresión sin interferencia entre ellos.
4. WHEN el contenido del archivo `.wcc` cambia, THE Language_Plugin SHALL regenerar los Source_Mapping reflejando las nuevas posiciones de las expresiones.

### Requisito 8: Compatibilidad con Intellisense Existente

**User Story:** Como usuario de la extensión, quiero que el intellisense existente (HTML en template, TypeScript en script, CSS en style) siga funcionando después de agregar intellisense en expresiones del template, para que no pierda funcionalidad.

#### Criterios de Aceptación

1. THE Language_Plugin SHALL conservar el VirtualCode HTML existente para el bloque `<template>`, proveyendo intellisense HTML fuera de las expresiones.
2. THE Language_Plugin SHALL conservar el VirtualCode TypeScript/JavaScript existente para el bloque `<script>` con todas sus capacidades actuales.
3. THE Language_Plugin SHALL conservar el VirtualCode CSS existente para el bloque `<style>`.
4. WHEN el cursor está fuera de una Template_Expression pero dentro del bloque `<template>`, THE Language_Server SHALL proveer intellisense HTML estándar (etiquetas, atributos).
5. THE Language_Plugin SHALL mantener la supresión existente de falsos "declared but never read" para variables usadas en el template.
