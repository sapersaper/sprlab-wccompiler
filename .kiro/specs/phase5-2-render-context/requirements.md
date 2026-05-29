# Requirements: RenderContext — contexto de rendering recursivo

## Overview

Actualmente `codegen.js` tiene dos funciones casi idénticas para generar el setup de
items en loops: `generateItemSetup` (256 líneas) y `generateNestedItemSetup` (232 líneas).
Ambas hacen lo mismo pero con distintas variables de contexto. El problema se agrava
con cada nivel de anidamiento: para soportar 3 niveles se necesitaría una tercera copia.

La raíz: no existe un objeto que encapsule el contexto de rendering — las variables
(`signalNames`, `propNames`, `loopStack`, `indent`) se pasan como parámetros sueltos
y se filtran manualmente en cada nivel.

`RenderContext` resuelve esto con una clase inmutable que se pasa recursivamente.

## Requirements

### REQ-1: Clase `RenderContext` con propiedades de contexto

La clase SHALL encapsular todas las variables de contexto necesarias para generar
código de rendering en cualquier nivel de anidamiento.

**Campos:**
- `signalNames: Set<string>` — nombres de signals del componente
- `computedNames: Set<string>` — nombres de computeds
- `propNames: Set<string>` — nombres de props
- `methodNames: string[]` — nombres de métodos
- `constantNames: string[]` — nombres de constantes
- `modelVarMap: Map<string, string>` — mapeo de model varName → propName
- `indent: string` — indentación actual (ej: `'    '`, `'      '`, `'        '`)
- `loopStack: LoopVar[]` — pila de variables de loop activas, donde cada `LoopVar` es `{ itemVar: string, indexVar: string | null }`

**Acceptance criteria:**
- Todos los campos tienen defaults razonables (Set vacío, array vacío, `'    '`, etc.)
- El constructor acepta un objeto parcial (solo los campos necesarios)
- La clase es pura — sin dependencias de otros módulos

### REQ-2: Método `nested(itemVar, indexVar, extraIndent)` — crea contexto hijo

El método SHALL crear un nuevo `RenderContext` con el loop actual añadido a la pila
y la indentación incrementada.

**Acceptance criteria:**
- `ctx.nested('inner', 'j')` crea un contexto con `loopStack` = `[...ctx.loopStack, { itemVar: 'inner', indexVar: 'j' }]`
- `ctx.nested('subItem', null)` crea un contexto con `indexVar: null` (sin índice)
- El indent se incrementa en `extraIndent` (default `'  '`)
- El contexto original NO se modifica (inmutabilidad)

### REQ-3: Getter `currentLoop` — loop más reciente

El getter SHALL retornar el último elemento de `loopStack`, o `null` si la pila está vacía.

**Acceptance criteria:**
- `ctx.currentLoop` → `null` cuando no hay loops activos
- `ctx.nested('item', 'i').currentLoop` → `{ itemVar: 'item', indexVar: 'i' }`

### REQ-4: Método `isStatic(expr)` — detecta expresiones sin signals externos

El método SHALL retornar `true` si la expresión solo depende de variables de loop
(item/index de cualquier nivel en la pila), sin referencias a signals, props, o computeds.

**Acceptance criteria:**
- `ctx.isStatic('item.name')` → `true` (solo usa variable de loop)
- `ctx.isStatic('this._state.count')` → `false` (usa signal)
- `ctx.isStatic('item.name + outer.name')` → `true` si ambos están en loopStack
- Funciona para cualquier nivel de anidamiento (toda la pila)

### REQ-5: Método `transformExpr(expr)` — transforma según contexto

El método SHALL transformar una expresión usando la función de transformación
apropiada según el contexto actual:
- Si hay un loop activo → delega a `transformForExpr` con las variables del loop
- Si no hay loop → delega a `transformExpr` normal

**Acceptance criteria:**
- En contexto sin loop: mismo comportamiento que `transformExpr(expr, signalNames, computedNames, ...)`
- En contexto con loop: mismo comportamiento que `transformForExpr(expr, itemVar, indexVar, filteredPropNames, ...)`
- Los sets de nombres se filtran para excluir TODAS las variables de loop activas

### REQ-6: Métodos de filtrado — excluyen loop vars

`filteredSignalNames()`, `filteredComputedNames()`, `filteredPropNames()` SHALL retornar
copias de los sets originales excluyendo todas las variables de loop presentes en `loopStack`.

**Acceptance criteria:**
- `ctx.filteredSignalNames()` no contiene `item` si `item` está en `loopStack`
- `ctx.nested('inner', 'j').filteredSignalNames()` excluye tanto `inner` como `j` y cualquier variable del nivel superior
- Los sets originales NO se modifican

### REQ-7: Factory `RenderContext.fromParseResult(parseResult)`

Un método estático SHALL crear un `RenderContext` a partir de un `ParseResult`,
extrayendo automáticamente signalNames, computedNames, propNames, methodNames,
constantNames, y modelVarMap.

**Acceptance criteria:**
- `RenderContext.fromParseResult(parseResult)` produce un contexto con todos los campos poblados
- Los sets se crean a partir de los arrays del ParseResult
- El `modelVarMap` se construye a partir de `parseResult.modelDefs`

### REQ-8: Sin dependencias externas

`RenderContext` NO SHALL importar ni depender de `transformExpr`, `transformForExpr`,
ni ningún otro módulo. Los métodos `transformExpr` e `isStatic` reciben las funciones
como parámetro o se implementan inline. Esto permite testear la clase de forma aislada.

**Acceptance criteria:**
- El archivo `lib/codegen/render-context.js` solo importa de `./types.js` (si existe) o nada
- Se puede instanciar y testear sin mockear funciones de transformación
