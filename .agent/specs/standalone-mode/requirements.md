# Documento de Requisitos

## Introducción

Agregar una opción `standalone` a wcCompiler que controla si un componente compilado incluye el runtime reactivo inline (haciéndolo completamente autocontenido sin dependencias) o lo importa desde un módulo compartido (menor tamaño por componente cuando se usan múltiples componentes).

- `standalone: true` → inlinear el runtime reactivo completo en la salida del componente (autocontenido, sin imports necesarios)
- `standalone: false` (DEFAULT) → importar el runtime desde un módulo compartido `__wcc-signals.js` (comportamiento actual con `runtimeImportPath`)

## Glosario

- **Compiler**: El pipeline de compilación de wcCompiler que transforma archivos `.wcc` en web components nativos de JavaScript. Compuesto por: SFC Parser → Parser Extractors → Tree Walker → Codegen.
- **CLI**: La interfaz de línea de comandos (`bin/wcc.js`) que orquesta la compilación de todos los componentes de un proyecto.
- **Codegen**: El módulo generador de código (`lib/codegen.js`) que produce la salida JavaScript final de un componente.
- **SFC_Parser**: El módulo (`lib/sfc-parser.js`) que extrae los bloques `<script>`, `<template>` y `<style>` de archivos `.wcc` y parsea `defineComponent()`.
- **Config_Loader**: El módulo (`lib/config.js`) que carga y valida `wcc.config.js` del proyecto.
- **Reactive_Runtime**: El código del sistema reactivo (`__signal`, `__computed`, `__effect`, `__batch`, `__untrack`) que puede ser inlineado o importado desde un módulo compartido.
- **Shared_Runtime_File**: El archivo `__wcc-signals.js` generado en el directorio de salida que exporta las funciones del runtime reactivo para ser importadas por los componentes.
- **defineComponent**: La macro de configuración del componente que se invoca en el bloque `<script>` de cada archivo `.wcc`.

## Requisitos

### Requisito 1: Opción standalone en defineComponent

**User Story:** Como desarrollador de componentes, quiero especificar `standalone: true` en `defineComponent()` de un componente individual, para que ese componente sea completamente autocontenido sin dependencias externas de runtime.

#### Criterios de Aceptación

1. WHEN `defineComponent({ tag: 'my-comp', standalone: true })` is specified, THE SFC_Parser SHALL extract the `standalone` property and include it in the parsed descriptor.
2. WHEN `defineComponent({ tag: 'my-comp', standalone: false })` is specified, THE SFC_Parser SHALL extract the `standalone` property with value `false`.
3. WHEN `defineComponent({ tag: 'my-comp' })` is specified without a `standalone` property, THE SFC_Parser SHALL treat the `standalone` value as `undefined` (not set at component level).
4. WHEN the `standalone` property is present with a non-boolean value, THE SFC_Parser SHALL throw an error with code `INVALID_STANDALONE_OPTION`.

### Requisito 2: Opción standalone global en wcc.config.js

**User Story:** Como desarrollador de un proyecto con múltiples componentes, quiero configurar `standalone` a nivel global en `wcc.config.js`, para que todos los componentes del proyecto usen la misma estrategia de runtime sin tener que configurar cada uno individualmente.

#### Criterios de Aceptación

1. WHEN `wcc.config.js` includes `standalone: true`, THE Config_Loader SHALL parse and include the `standalone` property in the configuration resultante.
2. WHEN `wcc.config.js` includes `standalone: false`, THE Config_Loader SHALL parse and include the `standalone` property with value `false`.
3. WHEN `wcc.config.js` does not include a `standalone` property, THE Config_Loader SHALL default `standalone` to `false`.
4. WHEN `wcc.config.js` includes `standalone` with a non-boolean value, THE Config_Loader SHALL throw an error with code `INVALID_CONFIG`.

### Requisito 3: Precedencia de la opción per-component sobre global

**User Story:** Como desarrollador, quiero que la opción `standalone` a nivel de componente tenga prioridad sobre la configuración global, para poder tener un proyecto con runtime compartido pero marcar componentes específicos como autocontenidos (o viceversa).

#### Criterios de Aceptación

1. WHEN a component specifies `standalone: true` in `defineComponent()` and the global config has `standalone: false`, THE Compiler SHALL compile that component with el runtime inlineado.
2. WHEN a component specifies `standalone: false` in `defineComponent()` and the global config has `standalone: true`, THE Compiler SHALL compile that component importando el runtime desde el módulo compartido.
3. WHEN a component does not specify `standalone` in `defineComponent()`, THE Compiler SHALL use the global config value to determine the compilation mode.

### Requisito 4: Compilación en modo standalone (runtime inlineado)

**User Story:** Como desarrollador, quiero que cuando un componente se compila en modo standalone, el output contenga el runtime reactivo completo inlineado, para que el componente funcione sin ninguna dependencia externa.

#### Criterios de Aceptación

1. WHEN a component is compiled with `standalone: true` (resolved), THE Codegen SHALL inline the full Reactive_Runtime at the top of the generated JavaScript output.
2. WHEN a component is compiled with `standalone: true` (resolved), THE Codegen SHALL NOT generate any `import` statement for the Reactive_Runtime.
3. WHEN a component is compiled with `standalone: true` (resolved), THE generated output SHALL be a fully self-contained JavaScript file that defines a working custom element without external runtime imports.

### Requisito 5: Compilación en modo compartido (runtime importado)

**User Story:** Como desarrollador, quiero que cuando un componente se compila en modo compartido (standalone: false), el output importe el runtime desde un módulo externo, para reducir el tamaño total cuando uso múltiples componentes.

#### Criterios de Aceptación

1. WHEN a component is compiled with `standalone: false` (resolved), THE Codegen SHALL generate an `import` statement that imports only the used runtime functions from the Shared_Runtime_File.
2. WHEN a component is compiled with `standalone: false` (resolved), THE Codegen SHALL NOT inline the Reactive_Runtime in the output.
3. WHEN a component uses only `__signal` and `__effect`, THE Codegen SHALL import only `{ __signal, __effect }` from the shared module (tree-shaking).

### Requisito 6: Generación del archivo de runtime compartido por el CLI

**User Story:** Como desarrollador, quiero que el CLI genere el archivo `__wcc-signals.js` solo cuando al menos un componente lo necesita, para no generar archivos innecesarios en el directorio de salida.

#### Criterios de Aceptación

1. WHEN the global config has `standalone: false` and at least one component resolves to `standalone: false`, THE CLI SHALL generate the `__wcc-signals.js` file in the output directory.
2. WHEN the global config has `standalone: true` and ALL components either have `standalone: true` or do not override the global setting, THE CLI SHALL NOT generate the `__wcc-signals.js` file in the output directory.
3. WHEN the global config has `standalone: true` but at least one component specifies `standalone: false` in `defineComponent()`, THE CLI SHALL generate the `__wcc-signals.js` file in the output directory.

### Requisito 7: Paso de la opción standalone a través del pipeline

**User Story:** Como mantenedor del compilador, quiero que la opción `standalone` resuelta se propague correctamente desde el parser hasta el codegen, para que cada etapa del pipeline tenga acceso a la decisión de compilación.

#### Criterios de Aceptación

1. WHEN the SFC_Parser extracts a `standalone` value from `defineComponent()`, THE Compiler SHALL merge it with the global config respecting the precedence rules (component overrides global).
2. WHEN the resolved `standalone` value is `true`, THE Compiler SHALL pass `runtimeImportPath` as `undefined` to the Codegen.
3. WHEN the resolved `standalone` value is `false`, THE Compiler SHALL pass the calculated `runtimeImportPath` to the Codegen.
4. THE Compiler SHALL resolve the final `standalone` value before invoking the Codegen, ensuring the Codegen receives a clear directive via the existing `runtimeImportPath` mechanism.
