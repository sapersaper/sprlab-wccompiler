# Tareas de Implementación: standalone-mode

## Tarea 1: Extraer `standalone` en el SFC Parser

- [x] 1.1 Agregar función `extractStandaloneOption(body, fileName)` en `lib/sfc-parser.js` que extraiga `standalone: true|false` del body de defineComponent usando regex
- [x] 1.2 Validar que si `standalone` está presente, su valor sea un literal booleano (`true` o `false`); si no, lanzar error con código `INVALID_STANDALONE_OPTION`
- [x] 1.3 Agregar campo `standalone` al retorno de `parseSFC()` (tipo `boolean | undefined`)
- [x] 1.4 Escribir tests unitarios en `lib/sfc-parser.standalone.test.js` para: extracción de true, false, ausencia (undefined), y valores inválidos
- [x] 1.5 Escribir test de propiedad (fast-check) para Propiedad 1: extracción round-trip de standalone booleano
- [x] 1.6 Escribir test de propiedad (fast-check) para Propiedad 2 (parser): rechazo de valores no-booleanos

## Tarea 2: Soportar `standalone` en Config Loader

- [x] 2.1 Agregar `standalone: false` al objeto `defaults` en `lib/config.js`
- [x] 2.2 Agregar validación: si `standalone` está presente y no es booleano, lanzar error con código `INVALID_CONFIG`
- [x] 2.3 Actualizar el typedef `WccConfig` para incluir `standalone: boolean`
- [x] 2.4 Escribir tests unitarios en `lib/config.standalone.test.js` para: standalone true, false, ausente (default false), y valores inválidos
- [x] 2.5 Escribir test de propiedad (fast-check) para Propiedad 2 (config): rechazo de valores no-booleanos en config

## Tarea 3: Resolver precedencia en el Compiler

- [x] 3.1 Crear y exportar función `resolveStandalone(componentValue, globalValue)` en `lib/compiler.js`
- [x] 3.2 Integrar resolución en `compileSFC()`: después de parsear, resolver standalone y mapear a `runtimeImportPath`
- [x] 3.3 Modificar `compileSFC()` para aceptar `config.standalone` y `config.outputDir` (o la ruta base para calcular runtimeImportPath)
- [x] 3.4 Hacer que `compile()` retorne `{ code, usesSharedRuntime }` en vez de solo el string de código
- [x] 3.5 Escribir tests unitarios para `resolveStandalone` con todas las combinaciones
- [x] 3.6 Escribir test de propiedad (fast-check) para Propiedad 3: resolución de precedencia
- [x] 3.7 Escribir tests de integración del compiler para Propiedad 4 (standalone=true → output autocontenido) y Propiedad 5 (standalone=false → imports con tree-shaking)

## Tarea 4: Generación condicional de `__wcc-signals.js` en el CLI

- [x] 4.1 Modificar `build()` en `bin/wcc.js` para pasar `config.standalone` al compiler
- [x] 4.2 Acumular `usesSharedRuntime` de cada componente compilado
- [x] 4.3 Generar `__wcc-signals.js` solo si al menos un componente tiene `usesSharedRuntime: true`
- [x] 4.4 En modo `dev` (watch), recalcular si se necesita el archivo compartido al recompilar
- [x] 4.5 Escribir tests de integración CLI en `lib/cli.standalone.test.js` para los tres escenarios del Requisito 6

## Tarea 5: Actualizar documentación y ejemplo

- [x] 5.1 Agregar `standalone: true` al ejemplo en `example/wcc.config.js` como comentario documentando la opción
- [x] 5.2 Actualizar `README.md` con documentación de la opción standalone (config global y per-component)
