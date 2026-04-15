# Documento de Requisitos — spr-compiler-library

## Introducción

Librería npm que funciona como compilador zero-runtime para web components. Toma archivos `.html` con sintaxis inspirada en Vue (bloques `<template>`, `<script>`, `<style>`) y los compila a web components 100% nativos: JavaScript vanilla puro, sin dependencias en el output, sin Shadow DOM, sin runtime. Se instala como `devDependency` y expone un CLI con comandos `spr dev` (watch + servidor local) y `spr build` (compilación única). La configuración se gestiona mediante un archivo `spr.config.js`.

## Glosario

- **Compilador**: Módulo principal que transforma archivos fuente `.html` en archivos `.js` con web components nativos.
- **Parser**: Submódulo del Compilador que lee un archivo fuente `.html` y extrae sus bloques (`<template>`, `<script>`, `<style>`) y las estructuras declarativas (props, variables, computeds, watchers, eventos, slots).
- **Generador_de_Código**: Submódulo del Compilador que toma la representación intermedia producida por el Parser y emite el archivo `.js` final con la clase HTMLElement y el registro `customElements.define`.
- **Pretty_Printer**: Submódulo que toma la representación intermedia de un componente y la formatea de vuelta a la sintaxis fuente `.html`.
- **CLI**: Interfaz de línea de comandos que expone los comandos `spr dev` y `spr build`.
- **Servidor_Dev**: Servidor de desarrollo local con live-reload iniciado por `spr dev`.
- **Archivo_Fuente**: Archivo `.html` ubicado en la carpeta de entrada que contiene los bloques `<template>`, `<script>` y `<style>` del componente.
- **Componente_Compilado**: Archivo `.js` generado en la carpeta de salida que contiene un web component nativo autocontenido.
- **Archivo_Config**: Archivo `spr.config.js` en la raíz del proyecto del usuario que define puerto, carpeta de entrada y carpeta de salida.
- **Representación_Intermedia**: Estructura de datos interna que describe props, variables reactivas, computeds, watchers, bindings, eventos y slots extraídos del Archivo_Fuente.
- **Tree_Walker**: Algoritmo que recorre el DOM del template para descubrir bindings de texto (`{{var}}`), directivas de eventos (`@event`) y elementos `<slot>`, generando referencias por ruta de nodos (`childNodes[n]`).

## Requisitos

### Requisito 1: Parsing de archivos fuente

**User Story:** Como desarrollador, quiero que el Compilador lea archivos `.html` con bloques `<template>`, `<script>` y `<style>`, para que pueda escribir componentes con una sintaxis declarativa familiar.

#### Criterios de Aceptación

1. WHEN un Archivo_Fuente válido es proporcionado, THE Parser SHALL extraer el contenido del bloque `<template>`, el contenido del bloque `<script>` y el contenido del bloque `<style>` como cadenas independientes.
2. WHEN un Archivo_Fuente no contiene un bloque `<template>`, THE Parser SHALL retornar un error descriptivo indicando que el bloque `<template>` es obligatorio.
3. WHEN un Archivo_Fuente no contiene un bloque `<script>`, THE Parser SHALL tratar el script como vacío y continuar la compilación.
4. WHEN un Archivo_Fuente no contiene un bloque `<style>`, THE Parser SHALL tratar el estilo como vacío y continuar la compilación.
5. FOR ALL Representación_Intermedia válidas, parsear y luego formatear con el Pretty_Printer y luego volver a parsear SHALL producir una Representación_Intermedia equivalente (propiedad round-trip).

### Requisito 2: Extracción de props

**User Story:** Como desarrollador, quiero declarar props con `defineProps([...])` en el script, para que mi componente pueda recibir datos externos vía atributos HTML o propiedades JavaScript.

#### Criterios de Aceptación

1. WHEN el bloque `<script>` contiene una llamada `defineProps(['prop1', 'prop2'])`, THE Parser SHALL extraer la lista de nombres de props como un arreglo de cadenas.
2. WHEN el bloque `<script>` no contiene `defineProps`, THE Parser SHALL tratar la lista de props como vacía.
3. IF la llamada `defineProps` contiene nombres de props duplicados, THEN THE Parser SHALL retornar un error descriptivo indicando los nombres duplicados.

### Requisito 3: Extracción de variables reactivas internas

**User Story:** Como desarrollador, quiero declarar variables internas con `const varName = 'value'` en el script, para que mi componente tenga estado reactivo propio.

#### Criterios de Aceptación

1. WHEN el bloque `<script>` contiene declaraciones `const`, `let` o `var` a nivel raíz con un valor literal, THE Parser SHALL extraer cada una como una variable reactiva con su nombre y valor inicial.
2. THE Parser SHALL ignorar declaraciones de variables que estén dentro de funciones, bloques condicionales u otros ámbitos anidados.
3. THE Parser SHALL excluir de las variables reactivas aquellas asignaciones que usen `computed(...)` o `watch(...)`.

### Requisito 4: Extracción de propiedades computadas

**User Story:** Como desarrollador, quiero declarar propiedades computadas con `const name = computed(() => expr)`, para que pueda derivar valores reactivos a partir de props y variables internas.

#### Criterios de Aceptación

1. WHEN el bloque `<script>` contiene una declaración `const name = computed(() => expr)`, THE Parser SHALL extraer el nombre y el cuerpo de la expresión.
2. THE Parser SHALL soportar expresiones computadas que referencien props, variables internas y otras propiedades computadas.

### Requisito 5: Extracción de watchers

**User Story:** Como desarrollador, quiero declarar watchers con `watch('prop', (newVal, oldVal) => { ... })`, para que pueda ejecutar lógica cuando un valor reactivo cambie.

#### Criterios de Aceptación

1. WHEN el bloque `<script>` contiene una llamada `watch('target', (newParam, oldParam) => { body })`, THE Parser SHALL extraer el nombre del target, los nombres de los parámetros y el cuerpo de la función.
2. THE Parser SHALL soportar watchers sobre props, variables internas y propiedades computadas.

### Requisito 6: Tree walking del template

**User Story:** Como desarrollador, quiero que el Compilador analice el template para descubrir bindings, eventos y slots, para que el componente compilado actualice el DOM de forma eficiente.

#### Criterios de Aceptación

1. WHEN el template contiene interpolaciones `{{variableName}}`, THE Tree_Walker SHALL registrar un binding de texto con la ruta de nodos (`childNodes[n]`) y el nombre de la variable.
2. WHEN un nodo de texto contiene múltiples interpolaciones mezcladas con texto estático, THE Tree_Walker SHALL dividir el nodo en elementos `<span>` individuales para cada interpolación y nodos de texto para el contenido estático.
3. WHEN un elemento tiene un atributo `@event="handler"`, THE Tree_Walker SHALL registrar un binding de evento con el nombre del evento, el nombre del handler y la ruta de nodos, y SHALL eliminar el atributo del template resultante.
4. WHEN el template contiene un elemento `<slot>`, THE Tree_Walker SHALL registrar un slot con su nombre (o vacío para el slot por defecto), la ruta de nodos y el contenido por defecto.
5. WHEN un elemento `<slot>` tiene atributos `:prop="source"`, THE Tree_Walker SHALL registrar slotProps asociando cada nombre de prop con su fuente de datos.
6. THE Tree_Walker SHALL reemplazar cada elemento `<slot>` por un `<span data-slot="name">` en el template procesado.

### Requisito 7: Generación de código — estructura del componente

**User Story:** Como desarrollador, quiero que el Compilador genere un archivo `.js` con una clase que extienda `HTMLElement` y se registre con `customElements.define`, para que el resultado sea un web component nativo funcional.

#### Criterios de Aceptación

1. THE Generador_de_Código SHALL producir un archivo `.js` que contenga una clase que extienda `HTMLElement`.
2. THE Generador_de_Código SHALL registrar la clase con `customElements.define` usando el nombre del archivo fuente (sin extensión) como tag name.
3. THE Generador_de_Código SHALL derivar el nombre de la clase convirtiendo el tag name a PascalCase (por ejemplo, `spr-hi` produce `SprHi`).
4. THE Generador_de_Código SHALL generar un método estático `observedAttributes` que retorne la lista de nombres de props.
5. THE Generador_de_Código SHALL generar un método `attributeChangedCallback` que actualice la signal correspondiente cuando un atributo observado cambie.

### Requisito 8: Generación de código — reactividad

**User Story:** Como desarrollador, quiero que el componente compilado use signals para la reactividad, para que las actualizaciones del DOM sean automáticas y eficientes.

#### Criterios de Aceptación

1. THE Generador_de_Código SHALL crear una signal para cada prop declarada, inicializada con `null`.
2. THE Generador_de_Código SHALL crear una signal para cada variable reactiva interna, inicializada con su valor literal.
3. THE Generador_de_Código SHALL crear un computed para cada propiedad computada, transformando las referencias a props, variables internas y otros computeds a sus respectivas llamadas de signal.
4. THE Generador_de_Código SHALL crear un effect en `connectedCallback` que actualice el `textContent` de cada nodo con binding al valor actual de su signal o computed.
5. THE Generador_de_Código SHALL generar getters y setters públicos para cada prop que deleguen a la signal correspondiente.

### Requisito 9: Generación de código — watchers con tracking de valor previo

**User Story:** Como desarrollador, quiero que los watchers compilados reciban el valor anterior y el nuevo, para que pueda comparar cambios en mi lógica reactiva.

#### Criterios de Aceptación

1. THE Generador_de_Código SHALL inicializar una variable `__prev_{target}` como `undefined` para cada watcher.
2. THE Generador_de_Código SHALL generar un effect que lea el valor actual del target, ejecute el cuerpo del watcher solo cuando el valor previo no sea `undefined`, y actualice el valor previo al final.
3. THE Generador_de_Código SHALL transformar las referencias a variables dentro del cuerpo del watcher a sus respectivas llamadas de signal.

### Requisito 10: Generación de código — eventos y emit

**User Story:** Como desarrollador, quiero usar `@event="handler"` en el template y `emit('event-name', data)` en el script, para que mis componentes puedan comunicarse con el exterior.

#### Criterios de Aceptación

1. THE Generador_de_Código SHALL generar un `addEventListener` en `connectedCallback` para cada binding de evento, vinculando el evento al método correspondiente de la clase.
2. THE Generador_de_Código SHALL generar un método `_emit(name, detail)` que despache un `CustomEvent` con `bubbles: true` y `composed: true`.
3. THE Generador_de_Código SHALL transformar las llamadas `emit(...)` en el script a `this._emit(...)` en el código generado.

### Requisito 11: Generación de código — slots

**User Story:** Como desarrollador, quiero usar `<slot>`, `<slot name="x">` y scoped slots en mis componentes, para que los consumidores puedan inyectar contenido personalizado.

#### Criterios de Aceptación

1. THE Generador_de_Código SHALL generar código en el constructor que resuelva los slots leyendo los `childNodes` del elemento antes de reemplazar el innerHTML.
2. WHEN un slot con nombre tiene contenido proporcionado por el consumidor (vía `<template #name>`), THE Generador_de_Código SHALL inyectar ese contenido en el placeholder correspondiente.
3. WHEN un slot por defecto tiene contenido proporcionado por el consumidor, THE Generador_de_Código SHALL reemplazar el contenido por defecto con los nodos del consumidor.
4. WHEN un slot tiene slotProps, THE Generador_de_Código SHALL generar un effect reactivo que interpole las variables del template del consumidor con los valores actuales de las fuentes de datos.

### Requisito 12: CSS con scope

**User Story:** Como desarrollador, quiero que el bloque `<style>` se compile con scope automático usando el tag name del componente, para que los estilos no colisionen con otros componentes sin usar Shadow DOM.

#### Criterios de Aceptación

1. WHEN el Archivo_Fuente contiene un bloque `<style>`, THE Generador_de_Código SHALL prefijar cada selector CSS con el tag name del componente (por ejemplo, `.counter` se convierte en `spr-hi .counter`).
2. THE Generador_de_Código SHALL inyectar el CSS con scope creando un elemento `<style>` y agregándolo a `document.head` en el código generado.
3. WHEN el Archivo_Fuente no contiene un bloque `<style>`, THE Generador_de_Código SHALL omitir la inyección de CSS.
4. THE Generador_de_Código SHALL preservar las at-rules CSS (como `@media`, `@keyframes`) sin prefijarlas con el tag name.

### Requisito 13: Output autocontenido sin dependencias runtime

**User Story:** Como desarrollador, quiero que el archivo compilado sea completamente autocontenido, para que no necesite ninguna librería runtime ni imports externos en producción.

#### Criterios de Aceptación

1. THE Componente_Compilado SHALL contener toda la lógica de reactividad inline sin importar módulos externos.
2. THE Componente_Compilado SHALL funcionar en cualquier navegador moderno sin necesidad de bundlers, polyfills ni dependencias adicionales.
3. THE Componente_Compilado SHALL registrarse a sí mismo con `customElements.define` al ser cargado como módulo ES.

### Requisito 14: Pretty printer de componentes

**User Story:** Como desarrollador, quiero un Pretty_Printer que convierta la Representación_Intermedia de vuelta a la sintaxis fuente `.html`, para que pueda validar la fidelidad del parsing mediante round-trip.

#### Criterios de Aceptación

1. THE Pretty_Printer SHALL formatear una Representación_Intermedia como un Archivo_Fuente válido con bloques `<template>`, `<script>` y `<style>`.
2. THE Pretty_Printer SHALL preservar el orden y la semántica de props, variables, computeds, watchers, funciones, bindings de template, eventos y slots.
3. FOR ALL Representación_Intermedia válidas, parsear el output del Pretty_Printer SHALL producir una Representación_Intermedia equivalente a la original (propiedad round-trip).

### Requisito 15: CLI — comando `spr build`

**User Story:** Como desarrollador, quiero ejecutar `spr build` para compilar todos los archivos fuente de una vez, para que pueda generar los componentes listos para producción.

#### Criterios de Aceptación

1. WHEN el usuario ejecuta `spr build`, THE CLI SHALL compilar todos los Archivos_Fuente de la carpeta de entrada y escribir los Componentes_Compilados en la carpeta de salida.
2. WHEN un Archivo_Fuente falla al compilar, THE CLI SHALL reportar el error con el nombre del archivo y el mensaje descriptivo, y SHALL continuar compilando los archivos restantes.
3. WHEN la carpeta de salida no existe, THE CLI SHALL crearla automáticamente.
4. THE CLI SHALL reportar en la consola el número de archivos compilados exitosamente y el número de errores.

### Requisito 16: CLI — comando `spr dev`

**User Story:** Como desarrollador, quiero ejecutar `spr dev` para tener compilación automática y un servidor local con live-reload, para que pueda iterar rápidamente durante el desarrollo.

#### Criterios de Aceptación

1. WHEN el usuario ejecuta `spr dev`, THE CLI SHALL compilar todos los Archivos_Fuente inicialmente y luego observar la carpeta de entrada por cambios.
2. WHEN un Archivo_Fuente cambia, THE CLI SHALL recompilar ese archivo y escribir el resultado en la carpeta de salida.
3. WHEN el usuario ejecuta `spr dev`, THE Servidor_Dev SHALL iniciar un servidor HTTP local en el puerto configurado.
4. WHEN un Componente_Compilado cambia en la carpeta de salida, THE Servidor_Dev SHALL notificar al navegador para que recargue automáticamente.

### Requisito 17: Configuración vía `spr.config.js`

**User Story:** Como desarrollador, quiero configurar el compilador mediante un archivo `spr.config.js`, para que pueda personalizar el puerto del servidor, la carpeta de entrada y la carpeta de salida.

#### Criterios de Aceptación

1. WHEN un Archivo_Config existe en la raíz del proyecto, THE CLI SHALL leer las propiedades `port`, `input` y `output` del archivo.
2. WHEN el Archivo_Config no existe, THE CLI SHALL usar los valores por defecto: puerto `4100`, carpeta de entrada `src`, carpeta de salida `dist`.
3. IF el Archivo_Config contiene propiedades con valores inválidos (por ejemplo, puerto no numérico, rutas vacías), THEN THE CLI SHALL retornar un error descriptivo indicando la propiedad y el problema.

### Requisito 18: Empaquetado como librería npm

**User Story:** Como desarrollador, quiero instalar el compilador como `devDependency` vía npm, para que pueda integrarlo fácilmente en cualquier proyecto.

#### Criterios de Aceptación

1. THE CLI SHALL ser ejecutable como comando `spr` cuando la librería esté instalada vía npm (campo `bin` en `package.json`).
2. THE CLI SHALL funcionar sin requerir dependencias globales adicionales más allá de Node.js.
3. THE CLI SHALL declarar `jsdom` como dependencia de la librería (no del proyecto consumidor).
