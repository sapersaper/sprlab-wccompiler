# Requirements: wire-final — integración y limpieza final

## Overview

Último paso del refactor Phase 5. Verificar que todos los imports funcionan,
que la estructura de directorios es correcta, y que no hay código muerto.

## Requirements

### REQ-1: `lib/codegen.js` shim re-exporta todo lo necesario
- `generateComponent` desde `./codegen/index.js`
- `transformExpr`, `transformMethodBody`, `pathExpr`, `wrapTernaryExpr` desde `./transform/`
- `transformForExpr`, `isStaticForExpr`, `isStaticForBinding` desde `./transform/`
- `extractDeps`, `refsComputedOrMethod`, `extractComputedDeps`, `topologicalSortComputeds`, `buildDepGraph` desde `./transform/`

### REQ-2: `compiler.js` y `compiler-browser.js` importan correctamente
Ambos importan `generateComponent` from `./codegen.js` (que ahora es el shim).

### REQ-3: Todos los tests pasan
131 files, 1307+ tests.

### REQ-4: No hay `generateItemSetup` ni `generateNestedItemSetup` en el codebase
Reemplazadas por `renderItemSetup` en spec 5-5.

### REQ-5: No hay `anchorPath` en código fuente (solo en tests viejos o backup)
Reemplazado por `anchorType` + `anchorIndex` en spec 5-1.
