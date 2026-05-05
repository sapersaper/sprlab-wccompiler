# Documento de Diseño — Template Intellisense para `.wcc`

## Resumen

Este documento describe el diseño técnico para agregar intellisense de TypeScript/JavaScript dentro de expresiones embebidas en el bloque `<template>` de archivos `.wcc`. La solución se basa en generar un VirtualCode TypeScript adicional que contenga las expresiones del template con mapeos de posición precisos (Source Mappings), permitiendo que Volar delegue las funcionalidades de intellisense (autocompletado, hover, diagnósticos, go-to-definition) al servicio TypeScript.

## Arquitectura

La arquitectura extiende el pipeline existente del Language Plugin sin modificar los VirtualCode actuales (HTML, CSS, Script). Se agrega un nuevo VirtualCode embebido (`template_expressions_0`) que contiene las expresiones del template en un contexto TypeScript/JavaScript.

```mermaid
graph TD
    A[Archivo .wcc] --> B[wccParser.ts]
    B --> C[WccBlock: script]
    B --> D[WccBlock: template]
    B --> E[WccBlock: style]
    
    D --> F[templateExpressionParser.ts]
    F --> G[TemplateExpression[]]
    
    C --> H[languagePlugin.ts - WccCode]
    G --> H
    
    H --> I[VirtualCode: script_0 - TS/JS]
    H --> J[VirtualCode: template_0 - HTML]
    H --> K[VirtualCode: style_0 - CSS]
    H --> L[VirtualCode: template_expressions_0 - TS/JS]
    
    L --> M[Volar TypeScript Service]
    M --> N[Autocompletado / Hover / Diagnósticos / Go-to-Definition]
```

### Flujo de Datos

1. `wccParser.ts` extrae los bloques `<script>`, `<template>` y `<style>` (sin cambios).
2. El nuevo módulo `templateExpressionParser.ts` analiza el contenido del template y extrae todas las expresiones embebidas con sus posiciones exactas.
3. `languagePlugin.ts` (clase `WccCode`) genera un VirtualCode adicional (`template_expressions_0`) que:
   - Replica el contenido del bloque `<script>` como prefijo (para establecer el contexto de tipos).
   - Agrega cada expresión del template como una sentencia separada.
   - Incluye Source Mappings precisos que mapean cada expresión de vuelta a su posición en el archivo `.wcc`.

## Componentes e Interfaces

### 1. Template Expression Parser (`templateExpressionParser.ts`)

Nuevo módulo responsable de extraer expresiones embebidas del contenido del template.

```typescript
/** Tipo de expresión encontrada en el template */
export type ExpressionType = 'interpolation' | 'event' | 'bind' | 'model';

/** Expresión extraída del template con su posición */
export interface TemplateExpression {
  /** Tipo de expresión */
  type: ExpressionType;
  /** Contenido de la expresión (sin delimitadores) */
  content: string;
  /** Offset del primer carácter de la expresión relativo al inicio del bloque template */
  startOffset: number;
  /** Nombre del atributo/directiva (e.g., "click" para @click, "class" para :class) */
  attributeName?: string;
}

/**
 * Extrae todas las expresiones embebidas de un bloque template.
 * Busca: {{expr}}, @event="expr", :attr="expr", model="variable"
 */
export function extractTemplateExpressions(templateContent: string): TemplateExpression[];
```

**Estrategia de parsing:**
- Usa expresiones regulares para localizar cada tipo de expresión.
- Para interpolaciones: busca `{{` y `}}`, extrae el contenido interno y calcula el offset como la posición de `{{` + 2.
- Para `@event="expr"`: busca el patrón `@identifier="..."`, extrae el valor entre comillas y calcula el offset como la posición de la comilla de apertura + 1.
- Para `:attr="expr"`: busca el patrón `:identifier="..."`, misma lógica de offset.
- Para `model="variable"`: busca el patrón `model="..."`, misma lógica de offset.

### 2. Virtual Code Generator (integrado en `languagePlugin.ts`)

Extensión de la clase `WccCode` para generar el VirtualCode de expresiones del template.

```typescript
/**
 * Genera el VirtualCode para expresiones del template.
 * El código virtual tiene la forma:
 *
 *   // [contenido del script block - sin mapeo]
 *   expr1;
 *   expr2;
 *   ...
 *
 * Donde cada `exprN` tiene un Source Mapping que apunta a su posición
 * original en el archivo .wcc.
 */
function generateTemplateExpressionsCode(
  scriptBlock: WccBlock | null,
  templateBlock: WccBlock,
  expressions: TemplateExpression[],
  scriptLanguageId: string
): VirtualCode;
```

**Estructura del código virtual generado:**

```
[contenido del script block]\n
[expresión1];\n
[expresión2];\n
...
```

El contenido del script se incluye como prefijo sin mapeo (para que TypeScript resuelva los tipos) y cada expresión tiene un mapeo individual que apunta a su posición en el archivo `.wcc` original.

### 3. Modificaciones a `WccCode`

La clase `WccCode` se extiende para:
- Llamar a `extractTemplateExpressions()` cuando existe un bloque template.
- Generar el VirtualCode `template_expressions_0` con los mapeos.
- Registrarlo como un `embeddedCode` adicional.
- Eliminar el mecanismo actual de `usageSuffix` (ya no necesario porque el nuevo VirtualCode cubre esa funcionalidad).

### 4. Registro en TypeScript Service

El `getServiceScript` actual retorna solo `script_0`. Para que Volar también procese `template_expressions_0` con TypeScript, se usa `getExtraServiceScripts` que permite registrar scripts adicionales:

```typescript
typescript: {
  extraFileExtensions: [...],
  getServiceScript(root) { /* retorna script_0 como antes */ },
  getExtraServiceScripts(_uri, root) {
    const scripts: { ... }[] = [];
    for (const code of root.embeddedCodes ?? []) {
      if (code.id === 'template_expressions_0') {
        scripts.push({
          code,
          extension: code.languageId === 'typescript' ? '.ts' : '.js',
          scriptKind: code.languageId === 'typescript' ? 3 : 1,
        });
      }
    }
    return scripts;
  },
},
```

## Modelos de Datos

### TemplateExpression

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `type` | `ExpressionType` | Tipo: `'interpolation'` \| `'event'` \| `'bind'` \| `'model'` |
| `content` | `string` | Texto de la expresión sin delimitadores |
| `startOffset` | `number` | Offset del primer carácter relativo al inicio del bloque template |
| `attributeName` | `string?` | Nombre del evento/atributo (e.g., `"click"`, `"class"`) |

### CodeMapping (de Volar)

Cada expresión genera un `CodeMapping`:

```typescript
{
  sourceOffsets: [templateBlock.startOffset + expression.startOffset],
  generatedOffsets: [prefixLength + currentGeneratedOffset],
  lengths: [expression.content.length],
  data: fullCapabilities,  // completion, navigation, semantic, verification
}
```

### Ejemplo Concreto

Para el archivo:
```wcc
<script lang="ts">
const name = signal('World')
function updateName(e: Event) { ... }
</script>
<template>
  <p>{{name}}</p>
  <input @input="updateName" />
</template>
```

El VirtualCode `template_expressions_0` generaría:

```typescript
// Prefijo (sin mapeo): contenido del script
const name = signal('World')
function updateName(e: Event) { ... }

// Expresiones con mapeo individual:
name;
updateName;
```

Los Source Mappings serían:
- `name` → mapea a offset de `name` dentro de `{{name}}` en el archivo `.wcc`
- `updateName` → mapea a offset de `updateName` dentro de `@input="updateName"` en el archivo `.wcc`

## Correctness Properties

*Una propiedad de correctitud es una característica o comportamiento que debe mantenerse verdadero en todas las ejecuciones válidas de un sistema — esencialmente, una declaración formal sobre lo que el sistema debe hacer. Las propiedades sirven como puente entre especificaciones legibles por humanos y garantías de correctitud verificables por máquina.*

### Property 1: Extracción correcta de expresiones del template

*Para cualquier* contenido de template que contenga expresiones embebidas (interpolaciones `{{expr}}`, directivas `@event="expr"`, bindings `:attr="expr"`, o `model="var"`), el Template_Parser SHALL extraer cada expresión con un `content` que coincida exactamente con el texto de la expresión en el template, y un `startOffset` tal que `templateContent.slice(startOffset, startOffset + content.length) === content`.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

### Property 2: El Virtual_Script contiene todas las expresiones del template

*Para cualquier* archivo `.wcc` con un bloque template que contenga expresiones embebidas, el VirtualCode `template_expressions_0` generado SHALL contener el texto de cada expresión extraída como una sentencia dentro del código virtual.

**Validates: Requirements 2.1, 2.2**

### Property 3: LanguageId del Virtual_Script coincide con el bloque script

*Para cualquier* archivo `.wcc`, el VirtualCode `template_expressions_0` SHALL tener `languageId` "typescript" si el bloque `<script>` tiene `lang="ts"`, y "javascript" en caso contrario (incluyendo cuando no hay bloque script).

**Validates: Requirements 2.3**

### Property 4: Round-trip de Source Mapping a nivel de carácter

*Para cualquier* archivo `.wcc` con expresiones en el template, y *para cualquier* posición `i` dentro de una expresión extraída, el Source Mapping SHALL satisfacer: `sourceContent[sourceOffset + i] === virtualContent[generatedOffset + i]` para todo `i` en `[0, length)`. Además, la transformación `posición_original → posición_virtual → posición_original` SHALL producir la posición inicial (propiedad round-trip).

**Validates: Requirements 2.4, 5.4, 7.1, 7.2, 7.3**

### Property 5: Regeneración correcta de mappings tras actualización

*Para cualquier* par de archivos `.wcc` (versión inicial y versión modificada), después de llamar a `update()` con el nuevo contenido, los Source Mappings del VirtualCode `template_expressions_0` SHALL reflejar las posiciones correctas en el nuevo contenido — es decir, la propiedad de round-trip (Property 4) se mantiene para el contenido actualizado.

**Validates: Requirements 7.4**

## Manejo de Errores

| Escenario | Comportamiento |
|-----------|---------------|
| Template sin expresiones | No se genera `template_expressions_0`; el comportamiento existente se mantiene |
| Expresión con sintaxis inválida | Se extrae tal cual; TypeScript reportará el error de sintaxis con la posición mapeada correctamente |
| Interpolación sin cierre `}}` | El parser ignora la interpolación incompleta (no se extrae) |
| Directiva con comillas sin cerrar | El parser ignora el atributo incompleto |
| Archivo sin bloque `<script>` | Se genera `template_expressions_0` sin prefijo de contexto; TypeScript reportará errores de "variable no definida" |
| Archivo sin bloque `<template>` | No se genera `template_expressions_0` |
| Expresiones vacías `{{}}` | Se extraen con `content: ""` pero no se incluyen en el código virtual (se filtran) |

## Estrategia de Testing

### Tests Unitarios (example-based)

- **templateExpressionParser**: Tests con templates conocidos verificando extracción correcta de cada tipo de expresión, incluyendo edge cases (expresiones anidadas, múltiples expresiones en una línea, expresiones con operadores complejos).
- **Generación de VirtualCode**: Tests verificando que el código virtual generado tiene la estructura esperada para archivos `.wcc` conocidos.
- **Compatibilidad**: Tests verificando que los VirtualCode existentes (script_0, template_0, style_0) siguen generándose correctamente.
- **Integración con Volar**: Tests end-to-end verificando autocompletado, hover, diagnósticos y go-to-definition (Requisitos 3, 4, 5, 6).

### Tests de Propiedad (property-based)

Se usa **fast-check** (ya presente en el proyecto) con mínimo 100 iteraciones por propiedad.

| Propiedad | Tag |
|-----------|-----|
| Property 1 | `Feature: template-intellisense, Property 1: Extracción correcta de expresiones del template` |
| Property 2 | `Feature: template-intellisense, Property 2: El Virtual_Script contiene todas las expresiones del template` |
| Property 3 | `Feature: template-intellisense, Property 3: LanguageId del Virtual_Script coincide con el bloque script` |
| Property 4 | `Feature: template-intellisense, Property 4: Round-trip de Source Mapping a nivel de carácter` |
| Property 5 | `Feature: template-intellisense, Property 5: Regeneración correcta de mappings tras actualización` |

### Generadores para PBT

Los generadores de fast-check deben producir:
- **Contenido de template válido**: HTML con interpolaciones `{{expr}}`, directivas `@event="handler"`, bindings `:attr="expr"`, y `model="var"` en posiciones aleatorias.
- **Expresiones válidas**: Identificadores simples, accesos a propiedades (`obj.prop`), llamadas a funciones (`fn()`), expresiones con operadores (`a + b`).
- **Archivos .wcc completos**: Combinaciones de bloques script/template/style con contenido aleatorio.

### Configuración

- Cada test de propiedad ejecuta mínimo **100 iteraciones**.
- Cada test incluye un comentario referenciando la propiedad del diseño.
- Formato del tag: `Feature: template-intellisense, Property {N}: {título}`
