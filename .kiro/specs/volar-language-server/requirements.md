# Documento de Requisitos — Volar Language Server para `.wcc`

## Introducción

Este documento define los requisitos para agregar un Language Server basado en Volar.js a la extensión VS Code existente (`vscode-wcc/`) del compilador wcCompiler. Actualmente la extensión solo provee syntax highlighting mediante gramática TextMate. El objetivo es proporcionar intellisense completo (tipos, hover, autocompletado, diagnósticos, go-to-definition) dentro de los bloques `<script>`, `<template>` y `<style>` de archivos `.wcc` Single File Component.

La arquitectura se basa en Volar.js, un framework MIT que maneja lenguajes embebidos en formatos SFC. La extensión se reestructurará como monorepo con un paquete cliente (extensión VS Code) y un paquete servidor (Language Server).

## Glosario

- **Language_Server**: Proceso Node.js que implementa el Language Server Protocol (LSP) usando `@volar/language-server`, proporcionando intellisense para archivos `.wcc`.
- **Language_Plugin**: Módulo que define cómo parsear archivos `.wcc` en objetos VirtualCode con lenguajes embebidos, siguiendo la API de `@volar/language-core`.
- **VirtualCode**: Objeto de Volar que representa un fragmento de código virtual con su `languageId`, contenido y mapeo de posiciones respecto al archivo fuente `.wcc`.
- **Service_Plugin**: Plugin de servicio de lenguaje (HTML, CSS o TypeScript) que provee funcionalidades de intellisense para un lenguaje específico.
- **Client_Extension**: Paquete VS Code (`packages/client/`) que inicia y se comunica con el Language_Server mediante LSP.
- **SFC**: Single File Component — archivo `.wcc` que contiene bloques `<script>`, `<template>` y `<style>`.
- **Bloque_Script**: Sección `<script>` o `<script lang="ts">` de un archivo SFC que contiene código JavaScript o TypeScript.
- **Bloque_Template**: Sección `<template>` de un archivo SFC que contiene markup HTML.
- **Bloque_Style**: Sección `<style>` de un archivo SFC que contiene reglas CSS.
- **Monorepo**: Estructura de proyecto con múltiples paquetes (`packages/client/`, `packages/server/`) en un solo repositorio.

## Requisitos

### Requisito 1: Reestructuración a Monorepo

**User Story:** Como desarrollador de la extensión, quiero que el proyecto `vscode-wcc/` se reestructure como monorepo con paquetes separados para cliente y servidor, para que cada componente tenga responsabilidades claras y pueda desarrollarse de forma independiente.

#### Criterios de Aceptación

1. THE Monorepo SHALL contener un paquete `packages/client/` con el código de la Client_Extension y un paquete `packages/server/` con el código del Language_Server.
2. THE Monorepo SHALL conservar los archivos existentes de syntax highlighting (gramática TextMate, language-configuration, iconos) dentro del paquete `packages/client/`.
3. THE Monorepo SHALL incluir un `package.json` raíz que defina los workspaces `packages/client` y `packages/server`.
4. WHEN se ejecute el comando de build, THE Monorepo SHALL compilar ambos paquetes produciendo artefactos listos para empaquetar como extensión VS Code.

### Requisito 2: Language Plugin para archivos `.wcc`

**User Story:** Como desarrollador del Language Server, quiero un Language_Plugin que parsee archivos `.wcc` y genere VirtualCode para cada bloque embebido, para que Volar pueda delegar el intellisense al servicio de lenguaje correspondiente.

#### Criterios de Aceptación

1. WHEN el Language_Plugin recibe un archivo `.wcc`, THE Language_Plugin SHALL generar un VirtualCode con `languageId` "typescript" para cada Bloque_Script que tenga el atributo `lang="ts"`.
2. WHEN el Language_Plugin recibe un archivo `.wcc`, THE Language_Plugin SHALL generar un VirtualCode con `languageId` "javascript" para cada Bloque_Script que no tenga atributo `lang` o tenga `lang="js"`.
3. WHEN el Language_Plugin recibe un archivo `.wcc`, THE Language_Plugin SHALL generar un VirtualCode con `languageId` "html" para cada Bloque_Template.
4. WHEN el Language_Plugin recibe un archivo `.wcc`, THE Language_Plugin SHALL generar un VirtualCode con `languageId` "css" para cada Bloque_Style.
5. THE Language_Plugin SHALL producir mapeos de posición correctos entre cada VirtualCode y el archivo `.wcc` fuente, de modo que las posiciones de línea y columna en el documento virtual correspondan a las posiciones reales en el archivo original.
6. WHEN el archivo `.wcc` no contiene un Bloque_Style, THE Language_Plugin SHALL generar VirtualCode únicamente para los bloques presentes sin producir errores.
7. WHEN el contenido de un archivo `.wcc` cambia, THE Language_Plugin SHALL regenerar los objetos VirtualCode reflejando el contenido actualizado.

### Requisito 3: TypeScript/JavaScript Intellisense en `<script>`

**User Story:** Como desarrollador de componentes `.wcc`, quiero intellisense completo de TypeScript y JavaScript dentro de bloques `<script>`, para que pueda escribir código con asistencia de tipos, autocompletado y detección de errores.

#### Criterios de Aceptación

1. WHILE el cursor está dentro de un Bloque_Script con `lang="ts"`, THE Language_Server SHALL proveer diagnósticos de tipo TypeScript (errores y advertencias).
2. WHILE el cursor está dentro de un Bloque_Script, THE Language_Server SHALL proveer sugerencias de autocompletado para identificadores, propiedades y métodos disponibles en el contexto.
3. WHEN el usuario posiciona el cursor sobre un identificador dentro de un Bloque_Script, THE Language_Server SHALL mostrar información de hover con el tipo y documentación del símbolo.
4. WHEN el usuario invoca "Go to Definition" sobre un símbolo dentro de un Bloque_Script, THE Language_Server SHALL navegar a la definición del símbolo.
5. WHEN el usuario invoca "Go to Definition" sobre un import dentro de un Bloque_Script, THE Language_Server SHALL navegar al archivo o módulo importado.
6. WHILE el cursor está dentro de un Bloque_Script con JavaScript puro, THE Language_Server SHALL proveer intellisense de JavaScript incluyendo autocompletado e inferencia de tipos básica.

### Requisito 4: HTML Intellisense en `<template>`

**User Story:** Como desarrollador de componentes `.wcc`, quiero intellisense HTML dentro de bloques `<template>`, para que pueda escribir markup con autocompletado de etiquetas y atributos.

#### Criterios de Aceptación

1. WHILE el cursor está dentro de un Bloque_Template, THE Language_Server SHALL proveer autocompletado de etiquetas HTML estándar.
2. WHILE el cursor está dentro de un Bloque_Template, THE Language_Server SHALL proveer autocompletado de atributos HTML para la etiqueta actual.
3. WHEN el usuario posiciona el cursor sobre una etiqueta o atributo HTML dentro de un Bloque_Template, THE Language_Server SHALL mostrar información de hover con la documentación del elemento o atributo.

### Requisito 5: CSS Intellisense en `<style>`

**User Story:** Como desarrollador de componentes `.wcc`, quiero intellisense CSS dentro de bloques `<style>`, para que pueda escribir estilos con autocompletado de propiedades y valores.

#### Criterios de Aceptación

1. WHILE el cursor está dentro de un Bloque_Style, THE Language_Server SHALL proveer autocompletado de propiedades CSS.
2. WHILE el cursor está dentro de un Bloque_Style, THE Language_Server SHALL proveer autocompletado de valores CSS para la propiedad actual.
3. WHEN el usuario posiciona el cursor sobre una propiedad o valor CSS dentro de un Bloque_Style, THE Language_Server SHALL mostrar información de hover con la documentación de la propiedad.
4. WHILE el cursor está dentro de un Bloque_Style, THE Language_Server SHALL reportar diagnósticos para reglas CSS inválidas.

### Requisito 6: Inicio y Ciclo de Vida del Language Server

**User Story:** Como usuario de VS Code, quiero que el Language Server se inicie automáticamente al abrir archivos `.wcc` y se detenga al cerrar el workspace, para que el intellisense esté disponible sin configuración manual.

#### Criterios de Aceptación

1. WHEN VS Code abre un archivo con extensión `.wcc`, THE Client_Extension SHALL iniciar el Language_Server como proceso hijo.
2. WHEN el Language_Server se inicia, THE Language_Server SHALL registrar los Service_Plugin de TypeScript, HTML y CSS.
3. WHILE el Language_Server está activo, THE Language_Server SHALL procesar notificaciones de cambio de documento y actualizar los diagnósticos.
4. WHEN el usuario cierra la ventana de VS Code o desactiva la extensión, THE Client_Extension SHALL detener el Language_Server de forma ordenada.
5. IF el Language_Server termina inesperadamente, THEN THE Client_Extension SHALL mostrar un mensaje de error al usuario.

### Requisito 7: Mapeo Correcto de Posiciones

**User Story:** Como desarrollador de componentes `.wcc`, quiero que las posiciones reportadas por el intellisense (errores, hover, go-to-definition) correspondan a las líneas correctas del archivo `.wcc` original, para que pueda navegar directamente al código relevante.

#### Criterios de Aceptación

1. WHEN el Language_Server reporta un diagnóstico dentro de un Bloque_Script, THE Language_Server SHALL indicar la línea y columna correctas dentro del archivo `.wcc` original.
2. WHEN el Language_Server reporta un diagnóstico dentro de un Bloque_Style, THE Language_Server SHALL indicar la línea y columna correctas dentro del archivo `.wcc` original.
3. WHEN el usuario invoca hover o go-to-definition, THE Language_Server SHALL mapear la posición del cursor en el archivo `.wcc` a la posición correspondiente en el VirtualCode y viceversa.
4. FOR ALL posiciones dentro de un VirtualCode, parsear la posición virtual y mapearla de vuelta al archivo `.wcc` SHALL producir la posición original (propiedad round-trip).

### Requisito 8: Compatibilidad con Extensión Existente

**User Story:** Como usuario actual de la extensión, quiero que el syntax highlighting y las funcionalidades existentes sigan funcionando después de agregar el Language Server, para que no pierda funcionalidad al actualizar.

#### Criterios de Aceptación

1. THE Client_Extension SHALL conservar la gramática TextMate existente para syntax highlighting de archivos `.wcc`.
2. THE Client_Extension SHALL conservar la configuración de lenguaje existente (brackets, auto-close, comments, folding).
3. THE Client_Extension SHALL conservar los iconos existentes para archivos `.wcc` y para la extensión.
4. WHEN la extensión se activa, THE Client_Extension SHALL proveer tanto syntax highlighting como intellisense del Language_Server simultáneamente.
