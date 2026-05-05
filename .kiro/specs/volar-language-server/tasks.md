# Plan de Implementación: Volar Language Server para `.wcc`

## Visión General

Implementar un Language Server basado en Volar.js para archivos `.wcc` Single File Component. Se reestructura la extensión VS Code existente (`vscode-wcc/`) como monorepo con paquetes `packages/client/` (extensión VS Code) y `packages/server/` (Language Server). El servidor usa un Language Plugin personalizado que parsea archivos `.wcc`, extrae bloques embebidos y genera objetos VirtualCode con mapeos de posición precisos. Los Service Plugins de Volar (`volar-service-typescript`, `volar-service-html`, `volar-service-css`) proveen el intellisense para cada lenguaje embebido.

## Tareas

- [x] 1. Reestructurar `vscode-wcc/` como monorepo
  - [x] 1.1 Crear estructura de directorios y configuración raíz
    - Crear directorios `packages/client/` y `packages/server/`
    - Crear `package.json` raíz en `vscode-wcc/` con `workspaces: ["packages/client", "packages/server"]`
    - Crear `tsconfig.base.json` en la raíz con configuración TypeScript compartida (target ES2020, module NodeNext, strict)
    - _Requisitos: 1.1, 1.3_

  - [x] 1.2 Mover archivos existentes a `packages/client/`
    - Mover `syntaxes/wcc.tmLanguage.json` a `packages/client/syntaxes/`
    - Mover `language-configuration.json` a `packages/client/`
    - Mover `icons/` a `packages/client/icons/`
    - Mover `README.md` a `packages/client/`
    - Crear `packages/client/package.json` como manifest de extensión VS Code (conservar contributes de gramática, lenguaje e iconos del `package.json` original, agregar `activationEvents` para archivos `.wcc`, agregar dependencia de `@volar/vscode` y `vscode-languageclient`)
    - Crear `packages/client/tsconfig.json` que extienda `tsconfig.base.json`
    - _Requisitos: 1.2, 8.1, 8.2, 8.3_

  - [x] 1.3 Configurar paquete `packages/server/`
    - Crear `packages/server/package.json` con dependencias: `@volar/language-server`, `@volar/language-core`, `volar-service-typescript`, `volar-service-html`, `volar-service-css`, `vscode-uri`
    - Crear `packages/server/tsconfig.json` que extienda `tsconfig.base.json`
    - Crear directorio `packages/server/src/` y `packages/server/bin/`
    - _Requisitos: 1.1_

  - [x] 1.4 Configurar scripts de build
    - Agregar scripts `build` en el `package.json` raíz que compile ambos paquetes con `tsc`
    - Verificar que `tsc --build` compila `packages/client/` y `packages/server/` sin errores
    - Crear `packages/server/bin/server.js` como entry point que importa el módulo compilado del servidor
    - _Requisitos: 1.4_

- [x] 2. Implementar el parser de bloques WCC (`wccParser.ts`)
  - [x] 2.1 Crear `packages/server/src/wccParser.ts`
    - Definir interfaz `WccBlock` con campos: `type`, `content`, `startOffset`, `endOffset`, `attrs`
    - Definir interfaz `WccParseResult` con campos: `script`, `template`, `style` (cada uno `WccBlock | null`)
    - Implementar función `parseWccBlocks(source: string): WccParseResult`
    - Usar regex para localizar etiquetas de apertura y cierre de cada bloque
    - Calcular `startOffset` como la posición inmediatamente después de la etiqueta de apertura
    - Calcular `endOffset` como la posición del inicio de la etiqueta de cierre
    - Extraer `attrs` de la etiqueta de apertura (ej: ` lang="ts"`)
    - Retornar `null` para bloques ausentes sin lanzar errores
    - Ignorar bloques con etiqueta de apertura sin cierre
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 2.2 Escribir property test: Tolerancia a bloques ausentes (Propiedad 3)
    - **Propiedad 3: Tolerancia a bloques ausentes**
    - Generar archivos `.wcc` con cualquier subconjunto de bloques (solo script, solo template, script+style, etc.)
    - Verificar que `parseWccBlocks` retorna `null` para bloques ausentes sin lanzar errores
    - Verificar que genera resultados correctos para los bloques presentes
    - **Valida: Requisito 2.6**

  - [x] 2.3 Escribir property test: Extracción correcta de contenido (Propiedad 5)
    - **Propiedad 5: Extracción correcta de contenido**
    - Generar archivos `.wcc` con contenido aleatorio en cada bloque (evitando etiquetas de cierre dentro del contenido)
    - Verificar que `block.content` es exactamente el texto entre las etiquetas de apertura y cierre
    - Verificar que `source.slice(block.startOffset, block.endOffset) === block.content`
    - **Valida: Requisitos 2.1, 2.2, 2.3, 2.4, 2.5**

  - [x] 2.4 Escribir unit tests para `wccParser.ts`
    - Test: archivo con tres bloques extrae contenido correcto de cada uno
    - Test: archivo sin `<style>` retorna `style: null`
    - Test: archivo vacío retorna todos los campos `null`
    - Test: `<script lang="ts">` extrae `attrs` con ` lang="ts"`
    - Test: etiqueta sin cierre es ignorada (retorna `null` para ese bloque)
    - Test: offsets calculados son correctos para un archivo conocido
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 3. Checkpoint — Verificar que el parser de bloques funciona correctamente
  - Ejecutar todos los tests, consultar al usuario si surgen dudas.

- [x] 4. Implementar el Language Plugin y WccCode (`languagePlugin.ts`)
  - [x] 4.1 Crear la clase `WccCode` en `packages/server/src/languagePlugin.ts`
    - Implementar la interfaz `VirtualCode` de `@volar/language-core`
    - Campos: `id = 'root'`, `languageId = 'wcc'`, `snapshot`, `mappings`, `embeddedCodes`
    - En el constructor: recibir `ts.IScriptSnapshot`, llamar a `parseWccBlocks`, generar `embeddedCodes` para cada bloque presente
    - Para cada bloque, crear un `VirtualCode` embebido con:
      - `id`: `"script_0"`, `"template_0"`, o `"style_0"`
      - `languageId`: `"typescript"` (si `attrs` contiene `lang="ts"`), `"javascript"` (si no tiene `lang` o tiene `lang="js"`), `"html"` (template), `"css"` (style)
      - `snapshot`: snapshot del contenido del bloque
      - `mappings`: un `CodeMapping` con `sourceOffsets: [block.startOffset]`, `generatedOffsets: [0]`, `lengths: [block.content.length]`
    - Implementar método `update(snapshot)` que re-parsea y regenera `embeddedCodes`
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7_

  - [x] 4.2 Crear el `wccLanguagePlugin` en `packages/server/src/languagePlugin.ts`
    - Implementar `LanguagePlugin<URI>` de `@volar/language-core`
    - `getLanguageId(uri)`: retornar `"wcc"` si la URI termina en `.wcc`, `undefined` en caso contrario
    - `createVirtualCode(uri, languageId, snapshot)`: si `languageId === "wcc"`, crear y retornar `new WccCode(snapshot)`, sino retornar `undefined`
    - `updateVirtualCode(uri, wccCode, snapshot)`: llamar `wccCode.update(snapshot)` y retornar `wccCode`
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 4.3 Escribir property test: Asignación correcta de languageId (Propiedad 1)
    - **Propiedad 1: Asignación correcta de languageId**
    - Generar archivos `.wcc` con combinaciones aleatorias de bloques y atributos `lang`
    - Crear `WccCode` y verificar que cada `embeddedCode` tiene el `languageId` correcto
    - **Valida: Requisitos 2.1, 2.2, 2.3, 2.4**

  - [x] 4.4 Escribir property test: Round-trip de mapeo de posiciones (Propiedad 2)
    - **Propiedad 2: Round-trip de mapeo de posiciones**
    - Generar archivos `.wcc` y posiciones aleatorias dentro de cada bloque
    - Verificar que `sourceOffset = block.startOffset + generatedOffset` y `generatedOffset = sourceOffset - block.startOffset`
    - Verificar que el mapeo es consistente: `sourceOffsets[0] + offset == block.startOffset + offset` para cualquier offset dentro del rango
    - **Valida: Requisitos 2.5, 7.1, 7.2, 7.3, 7.4**

  - [x] 4.5 Escribir property test: Consistencia de actualización (Propiedad 4)
    - **Propiedad 4: Consistencia de actualización de contenido**
    - Generar un archivo `.wcc` inicial, crear `WccCode`, luego generar una modificación del archivo
    - Llamar a `update()` con el nuevo snapshot y verificar que los `embeddedCodes` reflejan el contenido actualizado
    - **Valida: Requisito 2.7**

  - [x] 4.6 Escribir unit tests para `WccCode` y `wccLanguagePlugin`
    - Test: archivo con tres bloques genera tres `embeddedCodes`
    - Test: archivo sin `<style>` genera dos `embeddedCodes`
    - Test: `<script lang="ts">` produce `languageId: "typescript"`
    - Test: `<script>` sin lang produce `languageId: "javascript"`
    - Test: `<script lang="js">` produce `languageId: "javascript"`
    - Test: archivo vacío produce `embeddedCodes` vacío
    - Test: `getLanguageId` retorna `"wcc"` para URIs `.wcc` y `undefined` para otras
    - Test: `update()` refleja cambios en el contenido
    - Test: mappings tienen offsets correctos para un archivo conocido
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 7.1, 7.2, 7.3, 7.4_

- [x] 5. Checkpoint — Verificar Language Plugin y mapeos de posición
  - Ejecutar todos los tests, consultar al usuario si surgen dudas.

- [x] 6. Implementar el Language Server (`index.ts`)
  - [x] 6.1 Crear `packages/server/src/index.ts`
    - Importar `createServer`, `createConnection`, `createSimpleProject` de `@volar/language-server/node`
    - Importar `create as createTsService` de `volar-service-typescript`
    - Importar `create as createHtmlService` de `volar-service-html`
    - Importar `create as createCssService` de `volar-service-css`
    - Importar `wccLanguagePlugin` de `./languagePlugin`
    - Crear conexión con `createConnection()`
    - Crear servidor con `createServer(connection)`
    - En `connection.onInitialize`: configurar `server.initialize` con `wccLanguagePlugin` y los tres service plugins (TypeScript, HTML, CSS)
    - Implementar `connection.onInitialized` para `server.initialized()`
    - Implementar `connection.onShutdown` para `server.shutdown()`
    - Llamar `connection.listen()`
    - _Requisitos: 6.2, 6.3_

  - [x] 6.2 Crear `packages/server/bin/server.js`
    - Entry point ejecutable que importa el módulo compilado `../dist/index.js`
    - _Requisitos: 6.1_

- [x] 7. Implementar la Client Extension (`extension.ts`)
  - [x] 7.1 Crear `packages/client/src/extension.ts`
    - Importar `LanguageClient` de `vscode-languageclient/node`
    - Importar utilidades de `@volar/vscode` (activateAutoInsertion, createLabsInfo)
    - Implementar función `activate(context)`:
      - Resolver ruta al módulo del servidor (`../server/bin/server.js`)
      - Configurar `ServerOptions` con `module` y transporte IPC
      - Configurar `ClientOptions` con `documentSelector: [{ language: 'wcc' }]`
      - Crear instancia de `LanguageClient`
      - Iniciar el cliente con `client.start()`
      - Activar auto-inserción de etiquetas de cierre
      - Registrar disposables en `context.subscriptions`
    - Implementar función `deactivate()`:
      - Detener el cliente con `client?.stop()`
    - _Requisitos: 6.1, 6.4, 6.5, 8.4_

  - [x] 7.2 Actualizar `packages/client/package.json` con configuración de activación
    - Agregar `main` apuntando al entry point compilado (`./dist/extension.js`)
    - Agregar `activationEvents: ["onLanguage:wcc"]`
    - Verificar que `contributes` conserva gramática TextMate, language-configuration e iconos existentes
    - Agregar dependencias: `@volar/vscode`, `vscode-languageclient`
    - Agregar `engines.vscode` compatible
    - _Requisitos: 6.1, 8.1, 8.2, 8.3, 8.4_

- [x] 8. Configurar build y empaquetado
  - [x] 8.1 Configurar compilación TypeScript de ambos paquetes
    - Verificar que `tsconfig.json` de `packages/client/` y `packages/server/` extienden `tsconfig.base.json`
    - Configurar `outDir: "./dist"` en ambos paquetes
    - Agregar script `build` en el `package.json` raíz que compile ambos paquetes
    - _Requisitos: 1.4_

  - [x] 8.2 Configurar `.vscodeignore` y empaquetado
    - Actualizar `.vscodeignore` para excluir archivos fuente TypeScript y solo incluir `dist/`, `syntaxes/`, `icons/`, `language-configuration.json`
    - Verificar que el servidor compilado se incluye en el paquete de la extensión
    - _Requisitos: 1.4, 8.4_

- [x] 9. Checkpoint — Verificar build y estructura del monorepo
  - Ejecutar build completo, verificar que compila sin errores, consultar al usuario si surgen dudas.

- [x] 10. Configurar launch.json para debug de la extensión
  - [x] 10.1 Crear o actualizar `vscode-wcc/.vscode/launch.json`
    - Agregar configuración "Launch Extension" que ejecute la extensión en Extension Development Host
    - Configurar `outFiles` para apuntar a los archivos compilados de `packages/client/dist/`
    - Agregar configuración "Attach to Server" para debug del Language Server
    - _Requisitos: 6.1_

- [x] 11. Checkpoint final — Verificar que todos los tests pasan y la extensión funciona
  - Ejecutar todos los tests, verificar build completo, consultar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los property tests validan propiedades universales de correctitud del parser y Language Plugin
- Los unit tests validan ejemplos concretos y edge cases
- Ambos paquetes se escriben en TypeScript y se compilan a JavaScript
- El parser del servidor (`wccParser.ts`) es intencionalmente más permisivo que el parser del compilador (`lib/sfc-parser.js`) para funcionar mientras el usuario escribe código incompleto
- Los Service Plugins de primera parte de Volar (`volar-service-typescript`, `volar-service-html`, `volar-service-css`) proveen el intellisense real — no se implementan servicios propios
