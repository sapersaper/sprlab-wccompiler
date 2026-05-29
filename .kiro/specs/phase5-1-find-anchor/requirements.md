# Requirements: findAnchor — resolución de anchors en runtime

## Overview

Actualmente los anchors estructurales (`<!-- each -->`, `<!-- if -->`, `<!-- dynamic -->`)
se resuelven con paths hardcodeados generados en compile-time:

```js
this.__if0_anchor = __root.childNodes[1].childNodes[5].childNodes[5];
this.__for0_anchor = __root.childNodes[1].childNodes[5].childNodes[5];
```

Esto es frágil: cualquier cambio de whitespace, un comment HTML, o diferencias entre
el DOM de compilación (linkedom) y el DOM de runtime (browser/JSDOM) desplaza los índices.

El sistema actual incluye:
- `recomputeAnchorPath()` en tree-walker — recalcula paths después de modificar el DOM
- `recomputePathsFromProcessedHtml()` — función no utilizada que recalcula paths via HTML serializado
- `stripFirstAnchorSegment()` en walkBranch — quita el primer segmento del wrapper `__branchRoot`
- `pathExpr()` en codegen — convierte arrays de path en expresiones `__root.childNodes[N]...`
- Llamadas a `recomputeAnchorPath()` en `compiler.js:323-329` después de cada fase de procesamiento

La solución: reemplazar todo esto con `findAnchor(root, type, index)`, una función pura
que usa `TreeWalker` para buscar el n-ésimo comment node del tipo dado dentro del subárbol.

## Requirements

### REQ-1: Función `findAnchor(root, type, index)`

La función SHALL buscar en runtime el n-ésimo comment node cuyo `textContent` coincide
con `" ${type} "` (con espacios alrededor), usando `document.createTreeWalker` con
`NodeFilter.SHOW_COMMENT`.

**Acceptance criteria:**
- `findAnchor(root, 'each', 0)` retorna el primer `<!-- each -->` en el subárbol de `root`
- `findAnchor(root, 'if', 1)` retorna el segundo `<!-- if -->` en el subárbol de `root`
- `findAnchor(root, 'dynamic', 0)` retorna el primer `<!-- dynamic -->` en el subárbol de `root`
- Si no existe el n-ésimo comment del tipo dado, retorna `null`
- La función ignora whitespace y otros tipos de nodo (solo cuenta comments que coinciden)
- Es una función pura sin efectos secundarios, testable con cualquier estructura DOM

### REQ-2: Tree-walker asigna `anchorType` y `anchorIndex` en vez de `anchorPath`

En `buildIfBlock`, `processForBlocks`, y `processDynamicComponents`, en lugar de calcular
y almacenar `anchorPath`, se SHALL asignar:

```js
{
  anchorType: 'if',       // 'each' | 'if' | 'dynamic'
  anchorIndex: 0,         // índice entre anchors del mismo tipo
}
```

**Acceptance criteria:**
- Cada `IfBlock`, `ForBlock`, `DynamicComponentBinding` tiene `anchorType` y `anchorIndex`
- Los índices son secuenciales por tipo dentro del componente (0, 1, 2...)
- No se calcula `anchorPath` en ningún punto del tree-walker
- `_anchorNode` sigue existiendo temporalmente para la lógica de reemplazo de DOM, pero no se usa para paths

### REQ-3: Codegen usa `findAnchor` en vez de `pathExpr` para anchors

Todas las ocurrencias de `pathExpr(item.anchorPath, rootVar)` para anchors SHALL ser
reemplazadas por `findAnchor(${rootVar}, '${anchorType}', ${anchorIndex})`.

Ubicaciones afectadas en codegen.js:
- `connectedCallback`: `this.__if0_anchor`, `this.__for0_anchor`, `this.__dyn0_anchor` (líneas ~2499-2522)
- `generateItemSetup`: if-blocks anidados (línea ~755), for-blocks anidados (línea ~881), dynamic components (líneas ~821, 849, 913, 942)
- `generateNestedItemSetup`: dynamic components (línea ~1170)
- if-block setup methods: for-blocks y dynamic components en branches (líneas ~3318, 3388)

**Acceptance criteria:**
- `__root.childNodes[1].childNodes[5]` ya no aparece en el output generado para anchors
- En su lugar: `findAnchor(__root, 'if', 0)`, `findAnchor(__root, 'each', 0)`, `findAnchor(__root, 'dynamic', 0)`
- Dentro de each: `findAnchor(node, 'if', 1)`, `findAnchor(innerNode, 'each', 0)`
- El HTML generado es idéntico (los markers `<!-- each -->`, `<!-- if -->`, `<!-- dynamic -->` ya existen)

### REQ-4: Eliminar código obsoleto de resolución de paths

Se SHALL eliminar del codebase:
- `recomputePathsFromProcessedHtml()` — ya es código muerto (nunca se llama)
- `stripFirstAnchorSegment()` en `walkBranch` — el wrapper `__branchRoot` ya no produce segmentos que quitar porque no hay paths
- Las llamadas a `recomputeAnchorPath()` en `compiler.js:322-330` — los anchors ya no usan paths
- Las llamadas a `recomputeAnchorPath()` en `compiler-browser.js:504-505` — ídem

Se SHALL preservar:
- `recomputeAnchorPath()` como export — puede ser útil para debugging o futuro
- `_anchorNode` en los objetos — necesario para la lógica de reemplazo de DOM en el tree-walker

**Acceptance criteria:**
- `grep recomputePathsFromProcessedHtml lib/` no encuentra resultados
- `grep stripFirstAnchorSegment lib/` no encuentra resultados
- `compiler.js` no contiene `recomputeAnchorPath` en las líneas de post-procesamiento (L322-330)
- Los tests existentes que verifican `anchorPath` se actualizan para verificar `anchorType` + `anchorIndex`

### REQ-5: `findAnchor` se inlinea en el código generado

La función `findAnchor` SHALL ser emitida inline en el preamble del código generado,
antes de la clase del componente, como una helper function:

```js
function findAnchor(root, type, index) {
  const needle = ' ' + type + ' ';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  let count = 0;
  let node;
  while ((node = walker.nextNode())) {
    if (node.textContent === needle) {
      if (count === index) return node;
      count++;
    }
  }
  return null;
}
```

**Acceptance criteria:**
- Todo componente que use `if`, `each`, o `dynamic` incluye `findAnchor` inline
- La función aparece una sola vez por componente generado
- Si un componente no usa ninguno de los tres, `findAnchor` no se emite

### REQ-6: No regresión en comportamiento existente

Todos los tests existentes que pasaban antes SHALL seguir pasando después del cambio.
Los únicos tests que requieren actualización son aquellos que verifican explícitamente
el valor de `anchorPath` con paths hardcodeados (`childNodes[N]`).

**Acceptance criteria:**
- `npm test` pasa (excepto tests que verifican `anchorPath` con strings literales)
- Los componentes compilados producen el mismo HTML en runtime
- Los anchors se resuelven correctamente en el DOM, incluso con whitespace o comments HTML

## Edge Cases

- Componentes sin `if`, `each`, ni `dynamic`: no emiten `findAnchor`
- Múltiples anchors del mismo tipo: índices correctos (0, 1, 2...)
- Anchors dentro de templates clonados: `findAnchor` opera sobre el clon, no el original
- Anchors anidados (each dentro de if dentro de each): cada `findAnchor` busca en su subárbol correcto
- HTML con comments de usuario: `findAnchor` solo matchea `<!-- each -->`, `<!-- if -->`, `<!-- dynamic -->`
