# Requirements: item-renderer — renderItemSetup recursivo con RenderContext

## Overview

`generateItemSetup` (256 líneas) y `generateNestedItemSetup` (232 líneas) son casi
idénticas. La única diferencia es cómo filtran las variables de loop: la primera
maneja un nivel, la segunda maneja dos niveles filtrando manualmente las outer vars.

Con `RenderContext` (spec 5-2), una sola función `renderItemSetup` reemplaza ambas
usando `ctx.loopStack` para saber en qué profundidad está.

## Requirements

### REQ-1: `renderItemSetup(lines, forBlock, ctx, nodeRef)` — función única

La función SHALL generar el setup de bindings, events, show, attr, model, if-blocks
anidados, for-blocks anidados (recursivo), y dynamic components para un item de each.

**Acceptance criteria:**
- Reemplaza completamente `generateItemSetup` y `generateNestedItemSetup`
- Usa `ctx.indent` para la indentación (en vez de `indentOverride`)
- Usa `ctx.currentLoop` para obtener `itemVar`/`indexVar` (en vez de parámetros sueltos)
- Usa `ctx.nested(itemVar, indexVar)` para anidamiento recursivo
- El `nodeRef` default es `'node'`

### REQ-2: Bindings, events, show, attr, model — mismo comportamiento

Todas las secciones de bindings SHALL generar el mismo código que las funciones actuales.

**Acceptance criteria:**
- Text bindings: mismo output (con `transformForExpr` usando filtered sets)
- Events: mismo output (con `generateForEventHandler`)
- Show bindings: mismo output
- Attr bindings (class, style, attr, bool): mismo output
- Model bindings: mismo output
- Dynamic components directos en el item: mismo output

### REQ-3: If-blocks anidados — branchItem wrapper

Los if-blocks dentro de un forBlock SHALL usar un wrapper `branchItem` que expone
los mismos arrays que un `ForBlock` (`bindings`, `events`, `showBindings`, etc.),
permitiendo que `renderItemSetup` se llame recursivamente sin confusión de tipos.

**Acceptance criteria:**
- Cada branch del ifBlock se convierte en un objeto con `bindings`, `events`, `showBindings`, `attrBindings`, `modelBindings`, `forBlocks`, `dynamicComponents`, `ifBlocks: []`
- Se llama `renderItemSetup(lines, branchItem, ctx, 'bnode')` para los bindings internos de la branch

### REQ-4: For-blocks anidados — recursivo con ctx.nested()

Los for-blocks dentro de un forBlock SHALL crear un contexto hijo con `ctx.nested()`
y llamar `renderItemSetup(lines, innerFor, innerCtx, 'innerNode')` recursivamente.

**Acceptance criteria:**
- `innerCtx = ctx.nested(innerFor.itemVar, innerFor.indexVar)` crea el contexto
- `innerCtx.indent` es `ctx.indent + '  '`
- Para 3 niveles de anidamiento: se crean 2 nested() calls correctamente
- La función es recursiva sin límite de profundidad

### REQ-5: Sin regresiones

Todos los tests existentes que usan `each` SHALL seguir pasando.

**Acceptance criteria:**
- `codegen.each.test.js` — todos pasan
- `codegen.nested-directives.test.js` — todos pasan
- `compiler.each.test.js` — todos pasan
- Cualquier otro test que involucre `each` loops sigue pasando
