# Plan de Implementación: Template Intellisense para `.wcc`

## Resumen

Implementar intellisense de TypeScript/JavaScript dentro de expresiones embebidas en el bloque `<template>` de archivos `.wcc`. La implementación se basa en crear un nuevo módulo parser de expresiones del template, generar un VirtualCode adicional con Source Mappings precisos, y registrarlo en el servicio TypeScript de Volar.

## Tareas

- [x] 1. Crear el módulo Template Expression Parser
  - [x] 1.1 Crear `templateExpressionParser.ts` con la interfaz `TemplateExpression` y la función `extractTemplateExpressions`
    - Definir el tipo `ExpressionType` con valores `'interpolation' | 'event' | 'bind' | 'model'`
    - Definir la interfaz `TemplateExpression` con campos `type`, `content`, `startOffset`, `attributeName`
    - Implementar la función `extractTemplateExpressions(templateContent: string): TemplateExpression[]`
    - Usar expresiones regulares para localizar interpolaciones `{{expr}}`, directivas `@event="expr"`, bindings `:attr="expr"`, y `model="variable"`
    - Calcular offsets correctos: para `{{expr}}` el offset es posición de `{{` + 2; para atributos es posición de comilla de apertura + 1
    - Filtrar expresiones vacías (e.g., `{{}}`)
    - Manejar expresiones anidadas dentro de directivas de control (`each`, `if`)
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 1.2 Escribir tests unitarios para `templateExpressionParser`
    - Verificar extracción de interpolaciones simples y complejas
    - Verificar extracción de directivas `@event`, `:attr`, `model`
    - Verificar offsets correctos para cada tipo de expresión
    - Verificar manejo de expresiones vacías, anidadas, y con operadores
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 1.3 Escribir test de propiedad para extracción correcta de expresiones
    - **Property 1: Extracción correcta de expresiones del template**
    - **Valida: Requisitos 1.1, 1.2, 1.3, 1.4**

- [x] 2. Generar el VirtualCode para expresiones del template
  - [x] 2.1 Implementar la función `generateTemplateExpressionsCode` en `languagePlugin.ts`
    - Crear función que reciba el bloque script, bloque template, expresiones extraídas, y languageId
    - Generar código virtual con el contenido del script como prefijo (sin mapeo)
    - Agregar cada expresión como sentencia separada con `;` y `\n`
    - Crear Source Mappings individuales para cada expresión: `sourceOffsets: [templateBlock.startOffset + expression.startOffset]`, `generatedOffsets: [prefixLength + currentOffset]`, `lengths: [expression.content.length]`
    - Asignar `fullCapabilities` a cada mapping
    - Retornar un objeto `VirtualCode` con id `'template_expressions_0'` y el languageId correcto
    - _Requisitos: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.2 Integrar la generación en la clase `WccCode`
    - Importar `extractTemplateExpressions` desde `templateExpressionParser.ts`
    - En `generateEmbeddedCodes`, cuando exista bloque template, llamar a `extractTemplateExpressions`
    - Si hay expresiones extraídas (no vacías), llamar a `generateTemplateExpressionsCode` y agregar el VirtualCode resultante a `codes[]`
    - Eliminar el mecanismo actual de `usageSuffix` (función `extractTemplateUsages` y su uso en el bloque script)
    - Manejar el caso sin bloque script: generar VirtualCode sin prefijo de contexto
    - _Requisitos: 2.1, 2.2, 2.5, 7.4, 8.5_

  - [x] 2.3 Escribir test de propiedad para contenido del Virtual_Script
    - **Property 2: El Virtual_Script contiene todas las expresiones del template**
    - **Valida: Requisitos 2.1, 2.2**

  - [x] 2.4 Escribir test de propiedad para languageId del Virtual_Script
    - **Property 3: LanguageId del Virtual_Script coincide con el bloque script**
    - **Valida: Requisitos 2.3**

- [x] 3. Checkpoint - Verificar que los tests pasan
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 4. Implementar Source Mappings precisos y registro en TypeScript Service
  - [x] 4.1 Implementar `getExtraServiceScripts` en el plugin de TypeScript
    - Agregar el método `getExtraServiceScripts(_uri, root)` al objeto `typescript` del `wccLanguagePlugin`
    - Iterar sobre `root.embeddedCodes` buscando `template_expressions_0`
    - Retornar el script con la extensión y scriptKind correctos según el languageId
    - _Requisitos: 2.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3_

  - [x] 4.2 Escribir test de propiedad para round-trip de Source Mapping
    - **Property 4: Round-trip de Source Mapping a nivel de carácter**
    - **Valida: Requisitos 2.4, 5.4, 7.1, 7.2, 7.3**

  - [x] 4.3 Escribir test de propiedad para regeneración de mappings tras actualización
    - **Property 5: Regeneración correcta de mappings tras actualización**
    - **Valida: Requisitos 7.4**

- [x] 5. Verificar compatibilidad con intellisense existente
  - [x] 5.1 Escribir tests de compatibilidad para VirtualCodes existentes
    - Verificar que `script_0`, `template_0`, y `style_0` siguen generándose correctamente
    - Verificar que el intellisense HTML, TypeScript/JavaScript, y CSS existente no se ve afectado
    - Verificar que archivos sin template no generan `template_expressions_0`
    - Verificar que archivos con template sin expresiones no generan `template_expressions_0`
    - _Requisitos: 8.1, 8.2, 8.3, 8.4_

- [x] 6. Checkpoint final - Verificar que todos los tests pasan
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los tests de propiedad validan propiedades universales de correctitud
- Los tests unitarios validan ejemplos específicos y edge cases
- El framework de testing es **vitest** con **fast-check** para tests de propiedad (ambos ya configurados en el proyecto)
