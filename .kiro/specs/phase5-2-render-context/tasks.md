# Implementation Plan: phase5-2-render-context

## Overview

Crear la clase `RenderContext` en `lib/codegen/render-context.js`. Esta clase encapsula
todo el contexto de rendering (signals, props, computeds, loops, indentación) y permite
crear contextos hijos para anidamiento recursivo.

No se modifica ningún código existente en este spec — solo se agrega la clase nueva.

## Prerequisites

- Phase 5-1 completado (branch `phase5-1-find-anchor`)

## Tasks

### 1. Crear `lib/codegen/render-context.js`
- [ ] 1.1 Crear directorio `lib/codegen/` (si no existe)
- [ ] 1.2 Implementar constructor con defaults para todos los campos:
  - `signalNames: Set<string>` (default `new Set()`)
  - `computedNames: Set<string>` (default `new Set()`)
  - `propNames: Set<string>` (default `new Set()`)
  - `methodNames: string[]` (default `[]`)
  - `constantNames: string[]` (default `[]`)
  - `modelVarMap: Map<string, string>` (default `new Map()`)
  - `indent: string` (default `'    '`)
  - `loopStack: LoopVar[]` (default `[]`)
- [ ] 1.3 Implementar `nested(itemVar, indexVar, extraIndent = '  ')` — crea contexto hijo inmutable
- [ ] 1.4 Implementar getter `currentLoop` — retorna último elemento de loopStack o null
- [ ] 1.5 Implementar `_allLoopVars()` — retorna Set con todas las variables de loop
- [ ] 1.6 Implementar `filteredSignalNames()` — signalNames sin loop vars
- [ ] 1.7 Implementar `filteredComputedNames()` — computedNames sin loop vars
- [ ] 1.8 Implementar `filteredPropNames()` — propNames sin loop vars
- [ ] 1.9 Implementar `isStatic(expr)` — true si expr solo usa loop vars
- [ ] 1.10 Implementar `static fromParseResult(parseResult)` — factory desde ParseResult
  - Extrae signalNames (incluyendo modelDefs varNames)
  - Extrae computedNames
  - Extrae propNames
  - Extrae methodNames
  - Extrae constantNames
  - Construye modelVarMap desde modelDefs

### 2. Escribir tests unitarios
- [ ] 2.1 Test: constructor con defaults — todos los campos tienen valores por defecto
- [ ] 2.2 Test: constructor con valores custom — respeta los valores pasados
- [ ] 2.3 Test: `nested()` crea contexto hijo con loopStack incrementado
- [ ] 2.4 Test: `nested()` incrementa indent correctamente
- [ ] 2.5 Test: `nested()` no modifica el contexto original (inmutabilidad)
- [ ] 2.6 Test: `nested()` con múltiples niveles — loopStack tiene 2+ entradas
- [ ] 2.7 Test: `currentLoop` retorna null sin loops
- [ ] 2.8 Test: `currentLoop` retorna el loop correcto después de nested()
- [ ] 2.9 Test: `_allLoopVars()` retorna todas las vars de todos los niveles
- [ ] 2.10 Test: `filteredSignalNames()` excluye loop vars
- [ ] 2.11 Test: `filteredComputedNames()` excluye loop vars
- [ ] 2.12 Test: `filteredPropNames()` excluye loop vars
- [ ] 2.13 Test: `isStatic('item.name')` → true con item en loopStack
- [ ] 2.14 Test: `isStatic('count')` → false con count en signalNames
- [ ] 2.15 Test: `isStatic('item.name + outer.name')` → true con ambos en loopStack
- [ ] 2.16 Test: `isStatic()` con niveles anidados (cada/each anidado)
- [ ] 2.17 Test: `fromParseResult()` crea contexto correcto desde mock ParseResult
- [ ] 2.18 Test: `fromParseResult()` incluye modelDefs en signalNames y modelVarMap

### 3. Verificación
- [ ] 3.1 `npx vitest run lib/codegen/render-context.test.js` — todos los tests pasan
- [ ] 3.2 `npx vitest run` — sin regresiones (la clase nueva no rompe nada)
- [ ] 3.3 `node --check lib/codegen/render-context.js` — sin errores de sintaxis

## Dependencies

- Task 2 depende de 1
- Task 3 depende de 1 y 2
- Ninguna dependencia externa — este spec es autocontenido
