# Design: item-renderer

## Before (2 funciones, 488 líneas)

```
generateItemSetup(lines, forBlock, itemVar, indexVar, propNames,
  signalNamesSet, computedNamesSet, methodNames, constantNames,
  modelVarMap, indentOverride)
  → bindings, events, show, attr, model
  → ifBlocks inline (duplica lógica de bindings/events con 'bnode')
  → forBlocks inline (duplica lógica con 'innerNode')
  → dynamicComponents

generateNestedItemSetup(lines, innerFor, outerItemVar, outerIndexVar,
  innerItemVar, innerIndexVar, propNames, signalNamesSet,
  computedNamesSet, methodNames, indent, modelVarMap)
  → MISMA lógica pero con filtered sets manuales
  → isNestedStatic(), transformNested() helpers duplicados
```

## After (1 función, ~200 líneas)

```
renderItemSetup(lines, forBlock, ctx, nodeRef = 'node')
  → usa ctx.indent, ctx.currentLoop.itemVar/indexVar
  → ctx.isStatic(expr) — funciona para cualquier profundidad
  → ctx.nested(itemVar, indexVar) — crea contexto hijo para recursión
  → renderItemSetup recursivo con innerCtx
```

## Key insight

`ctx.loopStack` contiene TODAS las variables de loop activas. `isStatic()` y
`filteredSignalNames()` consultan la pila completa, no solo el nivel actual.
Por eso funciona para cualquier profundidad sin código adicional.
