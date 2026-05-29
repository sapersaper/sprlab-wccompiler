# Design: findAnchor — resolución de anchors en runtime

## Current Architecture

### Cómo se resuelven anchors hoy

```
Compile time (tree-walker + compiler):
  1. processIfChains/processForBlocks/processDynamicComponents
     → reemplazan elementos DOM con comment nodes (<!-- if -->, <!-- each -->, <!-- dynamic -->)
     → guardan referencia al comment node en `_anchorNode`
     → calculan `anchorPath` como array de strings: ['childNodes[1]', 'childNodes[5]', 'childNodes[5]']

  2. compiler.js:322-330
     → recalcula `anchorPath` con `recomputeAnchorPath(rootEl, _anchorNode)`
     → esto corrige los paths después de que el DOM fue modificado

  3. walkBranch (para templates anidados: if dentro de each, each dentro de if)
     → envuelve el HTML en un `<div id="__branchRoot">`
     → después de procesar, llama `stripFirstAnchorSegment()` para quitar `childNodes[0]`
       (el wrapper __branchRoot) de todos los anchor paths

Runtime (código generado):
  this.__if0_anchor = __root.childNodes[1].childNodes[5].childNodes[5];
  this.__for0_anchor = __root.childNodes[1].childNodes[5].childNodes[5];
```

### Problemas del sistema actual

1. **Fragilidad whitespace**: linkedom y JSDOM tratan whitespace text nodes distinto.
   Un path calculado como `childNodes[1].childNodes[5]` en linkedom puede necesitar
   ser `childNodes[1].childNodes[7]` en JSDOM.

2. **Complejidad**: 3 mecanismos distintos (`recomputeAnchorPath`, `recomputePathsFromProcessedHtml`,
   `stripFirstAnchorSegment`) para resolver el mismo problema: encontrar un comment marker.

3. **Código muerto**: `recomputePathsFromProcessedHtml()` existe pero nunca se llama.

4. **Código generado ilegible**: `__root.childNodes[1].childNodes[5].childNodes[5]` no
   comunica qué es ni por qué esa ruta.

## Proposed Solution

### `findAnchor(root, type, index)` — función pura en runtime

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

**Por qué TreeWalker:**
- API estándar del browser, sin dependencias
- Recorre en depth-first order (mismo orden que childNodes secuencial)
- `NodeFilter.SHOW_COMMENT` salta automáticamente elementos, texto, whitespace
- O(n) donde n = número de comment nodes en el subárbol (típicamente < 10)
- Para templates típicos (< 200 nodos), el overhead es imperceptible

### Cambios en tree-walker

En lugar de calcular `anchorPath`, cada función de procesamiento asigna `anchorType` y `anchorIndex`:

**`processIfChains` → `buildIfBlock`:**
```js
// HOY:
const anchorPath = [...parentPath, `childNodes[${commentIndex}]`];
return { ..., anchorPath };

// DESPUÉS:
ifBlockCount++;
return { ..., anchorType: 'if', anchorIndex: ifBlockCount - 1 };
```

**`processForBlocks`:**
```js
// HOY:
const anchorPath = [...currentPath, `childNodes[${commentIndex}]`];
return { ..., anchorPath };

// DESPUÉS:
forBlockCount++;
return { ..., anchorType: 'each', anchorIndex: forBlockCount - 1 };
```

**`processDynamicComponents`:**
```js
// HOY:
const anchorPath = [...currentPath, `childNodes[${commentIndex}]`];
return { ..., anchorPath };

// DESPUÉS:
dynCount++;
return { ..., anchorType: 'dynamic', anchorIndex: dynCount - 1 };
```

Se mantienen contadores globales por tipo dentro de cada llamada a las funciones de procesamiento,
pasados como parámetro o closures.

### Cambios en compiler.js

Se eliminan las líneas 322-330 que recalculan `anchorPath`:

```js
// SE ELIMINA:
for (const fb of forBlocks) {
  fb.anchorPath = recomputeAnchorPath(rootEl, fb._anchorNode);
}
for (const ib of ifBlocks) {
  ib.anchorPath = recomputeAnchorPath(rootEl, ib._anchorNode);
}
for (const dc of dynamicComponents) {
  dc.anchorPath = recomputeAnchorPath(rootEl, dc._anchorNode);
}
```

Los `anchorType` y `anchorIndex` ya están asignados por el tree-walker, no necesitan recálculo.

### Cambios en walkBranch

Se elimina `stripFirstAnchorSegment()` (líneas 508-517):

```js
// SE ELIMINA:
function stripFirstAnchorSegment(items) {
  for (const item of items) {
    if (item.anchorPath && item.anchorPath.length > 0 && item.anchorPath[0].startsWith('childNodes[')) {
      item.anchorPath = item.anchorPath.slice(1);
    }
  }
}
stripFirstAnchorSegment(forBlocks);
stripFirstAnchorSegment(ifBlocks);
stripFirstAnchorSegment(dynamicComponents);
```

Ya no hay `anchorPath` que limpiar. Los `anchorType`/`anchorIndex` no dependen de la
posición en el DOM del wrapper `__branchRoot`.

### Cambios en codegen.js

**En preamble (antes de la clase):**
```js
// Si el componente tiene ifBlocks, forBlocks, o dynamicComponents:
lines.push('function findAnchor(root, type, index) {');
// ... cuerpo de findAnchor ...
lines.push('}');
```

**En connectedCallback (reemplaza pathExpr para anchors):**
```js
// HOY:
lines.push(`    this.${vn}_anchor = ${pathExpr(ifBlock.anchorPath, '__root')};`);

// DESPUÉS:
lines.push(`    this.${vn}_anchor = findAnchor(__root, '${ifBlock.anchorType}', ${ifBlock.anchorIndex});`);
```

Mismo patrón para `forBlock.anchorPath` y `dyn.anchorPath` en connectedCallback.

**En generateItemSetup (reemplaza pathExpr para anchors anidados):**
```js
// HOY:
lines.push(`${indent}  const ${ivn}_anchor = ${pathExpr(ifBlock.anchorPath, 'node')};`);

// DESPUÉS:
lines.push(`${indent}  const ${ivn}_anchor = findAnchor(node, '${ifBlock.anchorType}', ${ifBlock.anchorIndex});`);
```

Mismo patrón para for-blocks y dynamic components dentro de each items.

**En generateNestedItemSetup:**
Mismo patrón. Todos los `pathExpr(..., anchorPath, ...)` se reemplazan.

### Cambios en compiler-browser.js

Se eliminan las mismas llamadas a `recomputeAnchorPath()` (líneas 317, 504, 505).
La función `recomputeAnchorPath` se puede mantener exportada para uso externo,
pero ya no se usa internamente.

### Estructura de datos actualizada

**IfBlock:**
```ts
interface IfBlock {
  varName: string;
  anchorType: 'if';        // NUEVO
  anchorIndex: number;     // NUEVO (reemplaza anchorPath)
  _anchorNode: Comment;    // se preserva para la lógica de reemplazo DOM
  branches: IfBranch[];
}
```

**ForBlock:**
```ts
interface ForBlock {
  varName: string;
  anchorType: 'each';      // NUEVO
  anchorIndex: number;     // NUEVO (reemplaza anchorPath)
  _anchorNode: Comment;    // se preserva
  // ... resto igual
}
```

**DynamicComponentBinding:**
```ts
interface DynamicComponentBinding {
  varName: string;
  anchorType: 'dynamic';   // NUEVO
  anchorIndex: number;     // NUEVO (reemplaza anchorPath)
  _anchorNode: Comment;    // se preserva
  // ... resto igual
}
```

## Affected Files

| File | Change |
|------|--------|
| `lib/tree-walker.js` | Agregar `anchorType`/`anchorIndex` en buildIfBlock (L597), processForBlocks (L975), processDynamicComponents (L1091). Eliminar `recomputePathsFromProcessedHtml` (L25-61). Eliminar `stripFirstAnchorSegment` en walkBranch (L508-517). |
| `lib/compiler.js` | Eliminar recomputeAnchorPath calls (L322-330). |
| `lib/compiler-browser.js` | Eliminar recomputeAnchorPath calls (L317, 504, 505). |
| `lib/codegen.js` | Emitir `findAnchor` helper en preamble. Reemplazar `pathExpr(item.anchorPath, root)` → `findAnchor(root, type, index)` en connectedCallback (L2499, 2510, 2518), generateItemSetup (L755, 794, 821, 849, 881, 913, 942), generateNestedItemSetup (L1170), setup methods (L3318, 3388). |
| Tests (~15 archivos) | Actualizar mocks: `anchorPath: ['childNodes[0]']` → `anchorType: 'each'/'if', anchorIndex: 0`. Actualizar assertions sobre código generado. |

## Qué NO cambia

- El HTML generado es **idéntico** — los markers `<!-- each -->`, `<!-- if -->`, `<!-- dynamic -->` ya existen hoy
- No se agregan IDs, data attributes, ni nada al DOM
- La lógica de reemplazo de DOM en el tree-walker (insertBefore, removeChild) no se modifica
- `_anchorNode` se sigue guardando para la lógica de reemplazo

## Beneficios

- **Elimina `recomputePathsFromProcessedHtml`** (código muerto, ~35 líneas)
- **Elimina `stripFirstAnchorSegment`** (workaround, ~10 líneas)
- **Elimina 9 líneas de recomputeAnchorPath en compiler.js**
- **Elimina ~15 líneas de recomputeAnchorPath en compiler-browser.js**
- **Código generado más legible**: `findAnchor(__root, 'if', 0)` vs `__root.childNodes[1].childNodes[5].childNodes[5]`
- **Inmune a whitespace y diferencias entre parsers HTML**
- **Testeable**: `findAnchor` es una función pura

## Riesgos

- **TreeWalker performance**: O(n) sobre comment nodes. En templates típicos (< 10 comments),
  imperceptible. En el peor caso (template con cientos de comment nodes), ~0.1ms.
  La ganancia en corrección y mantenibilidad lo justifica.

- **Orden de inserción de `findAnchor` en el preamble**: debe emitirse antes del primer uso.
  Si se emite dentro de la clase, no será accesible desde el scope del módulo. Solución:
  emitir como función top-level en el módulo (mismo nivel que `__t_ClassName`).
