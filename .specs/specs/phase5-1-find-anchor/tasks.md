# Implementation Plan: phase5-1-find-anchor

## Overview

Reemplazar el sistema de anchor paths hardcodeados (`childNodes[N]`) por `findAnchor(root, type, index)`,
una función runtime que usa `TreeWalker` para encontrar comment markers en el DOM.

## Prerequisites

Ninguno. Este es el primer spec del refactor Phase 5. Solo depende del código actual en `main`.

## Tasks

### 1. Función `findAnchor` standalone
- [ ] 1.1 Crear `lib/find-anchor.js` con la función `findAnchor(root, type, index)`
  - Usa `document.createTreeWalker(root, NodeFilter.SHOW_COMMENT)`
  - Busca `" ${type} "` (con espacios) en `node.textContent`
  - Retorna el n-ésimo match o `null`
- [ ] 1.2 Escribir tests unitarios en `lib/find-anchor.test.js`
  - `findAnchor` encuentra `<!-- each -->` en un div con varios hijos
  - `findAnchor` con índice 1 retorna el segundo match
  - `findAnchor` con índice fuera de rango retorna `null`
  - `findAnchor` ignora otros comments (`<!-- hola -->`)
  - `findAnchor` funciona con subárboles profundos (anidados)
  - `findAnchor` funciona sobre un `DocumentFragment` (template.content)
- [ ] 1.3 Verificar que `npm test` pasa (el nuevo archivo no rompe nada)

### 2. Tree-walker: asignar `anchorType` + `anchorIndex`
- [ ] 2.1 En `processIfChains`, agregar contador `let ifCount = 0` y asignar `anchorType: 'if'`, `anchorIndex: ifCount++` a cada `IfBlock` creado (además del `anchorPath` existente)
- [ ] 2.2 En `processForBlocks`, agregar contador `let forCount = 0` y asignar `anchorType: 'each'`, `anchorIndex: forCount++` a cada `ForBlock` creado
- [ ] 2.3 En `processDynamicComponents`, agregar contador `let dynCount = 0` y asignar `anchorType: 'dynamic'`, `anchorIndex: dynCount++` a cada `DynamicComponentBinding` creado
- [ ] 2.4 Verificar con tests existentes que `anchorType` y `anchorIndex` están presentes (agregar assertions a `tree-walker.if.test.js`, `tree-walker.each.test.js`, `tree-walker.dynamic-component.test.js`)
- [ ] 2.5 Verificar que `npm test` pasa (agregamos campos, no quitamos nada aún)

### 3. Codegen: emitir `findAnchor` helper + usar en vez de `pathExpr` para anchors
- [ ] 3.1 En `generateComponent` preamble, emitir `findAnchor` function inline si `ifBlocks.length > 0 || forBlocks.length > 0 || dynamicComponents.length > 0`
- [ ] 3.2 En connectedCallback, reemplazar `pathExpr(ifBlock.anchorPath, '__root')` → `findAnchor(__root, '${ifBlock.anchorType}', ${ifBlock.anchorIndex})` para if-blocks
- [ ] 3.3 En connectedCallback, reemplazar `pathExpr(forBlock.anchorPath, '__root')` → `findAnchor(__root, '${forBlock.anchorType}', ${forBlock.anchorIndex})` para for-blocks
- [ ] 3.4 En connectedCallback, reemplazar `pathExpr(dyn.anchorPath, '__root')` → `findAnchor(__root, '${dyn.anchorType}', ${dyn.anchorIndex})` para dynamic components
- [ ] 3.5 En `generateItemSetup`, reemplazar todos los `pathExpr(..., anchorPath, 'node')` → `findAnchor(node, type, index)` para if-blocks, for-blocks, y dynamic components anidados
- [ ] 3.6 En `generateNestedItemSetup`, ídem para dynamic components
- [ ] 3.7 En if-block `_setup` methods, reemplazar `pathExpr(..., anchorPath, 'node')` → `findAnchor(node, type, index)` para for-blocks y dynamic components en branches
- [ ] 3.8 Verificar que el código generado compila (sintaxis JS válida) con tests unitarios
- [ ] 3.9 Actualizar tests que verifican el output generado para esperar `findAnchor(__root, 'if', 0)` en vez de `__root.childNodes[1]...`

### 4. Limpiar código obsoleto
- [ ] 4.1 Eliminar `recomputePathsFromProcessedHtml()` de `tree-walker.js` (líneas 25-61, código muerto)
- [ ] 4.2 Eliminar `stripFirstAnchorSegment()` de `walkBranch` (líneas 508-517) y sus 3 llamadas
- [ ] 4.3 Eliminar las 9 líneas de `recomputeAnchorPath` en `compiler.js` (L322-330)
- [ ] 4.4 Eliminar las llamadas a `recomputeAnchorPath` en `compiler-browser.js` (L317, 504, 505)
- [ ] 4.5 Si `recomputeAnchorPath` ya no se usa internamente, remover su export de `tree-walker.js` y del import en `compiler.js`
- [ ] 4.6 Remover el campo `anchorPath` de los objetos `IfBlock`, `ForBlock`, `DynamicComponentBinding` (solo queda `anchorType` + `anchorIndex`)

### 5. Actualizar todos los tests
- [ ] 5.1 `tree-walker.if.test.js` — reemplazar assertions de `anchorPath` por `anchorType`/`anchorIndex`
- [ ] 5.2 `tree-walker.each.test.js` — ídem
- [ ] 5.3 `tree-walker.dynamic-component.test.js` — ídem
- [ ] 5.4 `tree-walker.dynamic-component.property.test.js` — ídem
- [ ] 5.5 `codegen.if.test.js` — actualizar mocks: quitar `anchorPath`, agregar `anchorType`/`anchorIndex`
- [ ] 5.6 `codegen.each.test.js` — ídem
- [ ] 5.7 `codegen.dynamic-component.test.js` — ídem
- [ ] 5.8 `codegen.dynamic-component.property.test.js` — ídem
- [ ] 5.9 `codegen.nested-directives.test.js` — ídem
- [ ] 5.10 `codegen.bug0007-nested-loops-conditionals.test.js` — ídem
- [ ] 5.11 `codegen.constants.test.js` — ídem (si usa anchorPath)
- [ ] 5.12 `compiler.if.test.js` — actualizar snapshots/assertions de código generado
- [ ] 5.13 `compiler.each.test.js` — ídem
- [ ] 5.14 `compiler.dynamic-component.test.js` — ídem
- [ ] 5.15 `compiler.test.js` — ídem (si tiene assertions de anchorPath)
- [ ] 5.16 `compiler.sfc.test.js` — ídem

### 6. Verificación final
- [ ] 6.1 `npm test` pasa con 0 failing tests
- [ ] 6.2 `grep anchorPath lib/` no encuentra referencias en código fuente (solo en tests viejos si quedan)
- [ ] 6.3 `grep childNodes\[ lib/codegen.js` solo encuentra usos legítimos (bindings, events — no anchors)
- [ ] 6.4 Compilar un componente de ejemplo con `if`, `each`, y `dynamic` y verificar que `findAnchor` aparece en el output

## Dependencies

- Tasks 1 y 2 son independientes, se pueden hacer en paralelo
- Task 3 depende de 1 y 2
- Tasks 4 y 5 dependen de 3
- Task 6 depende de 4 y 5
