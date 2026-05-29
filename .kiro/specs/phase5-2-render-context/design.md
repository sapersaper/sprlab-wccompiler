# Design: RenderContext — contexto de rendering recursivo

## Problema actual

En `generateItemSetup` y `generateNestedItemSetup`, el contexto de rendering se pasa
como parámetros sueltos:

```js
// generateItemSetup — 9 parámetros de contexto
function generateItemSetup(lines, forBlock, itemVar, indexVar, propNames,
  signalNamesSet, computedNamesSet, methodNames, constantNames, modelVarMap, indentOverride)

// generateNestedItemSetup — 11 parámetros + helpers internos
function generateNestedItemSetup(lines, innerFor, outerItemVar, outerIndexVar,
  innerItemVar, innerIndexVar, propNames, signalNamesSet, computedNamesSet,
  methodNames, indent, modelVarMap)
```

Cada nueva variable de contexto requiere modificar ambas firmas y todos los call sites.
Para el nivel 3 se necesitaría una tercera función con 13+ parámetros.

## Solución: `RenderContext`

```js
export class RenderContext {
  constructor(opts = {}) {
    this.signalNames   = opts.signalNames   ?? new Set()
    this.computedNames = opts.computedNames ?? new Set()
    this.propNames     = opts.propNames     ?? new Set()
    this.methodNames   = opts.methodNames   ?? []
    this.constantNames = opts.constantNames ?? []
    this.modelVarMap   = opts.modelVarMap   ?? new Map()
    this.indent        = opts.indent        ?? '    '
    this.loopStack     = opts.loopStack     ?? []
  }

  nested(itemVar, indexVar, extraIndent = '  ') {
    return new RenderContext({
      signalNames: this.signalNames,
      computedNames: this.computedNames,
      propNames: this.propNames,
      methodNames: this.methodNames,
      constantNames: this.constantNames,
      modelVarMap: this.modelVarMap,
      indent: this.indent + extraIndent,
      loopStack: [...this.loopStack, { itemVar, indexVar }],
    })
  }

  get currentLoop() {
    return this.loopStack[this.loopStack.length - 1] ?? null
  }

  _allLoopVars() {
    return new Set(
      this.loopStack.flatMap(({ itemVar, indexVar }) =>
        [itemVar, indexVar].filter(Boolean)
      )
    )
  }

  filteredSignalNames() {
    const loopVars = this._allLoopVars()
    return new Set([...this.signalNames].filter(n => !loopVars.has(n)))
  }
  filteredComputedNames() { /* idem */ }
  filteredPropNames() { /* idem */ }

  isStatic(expr) {
    const loopVars = this._allLoopVars()
    for (const name of this.signalNames) {
      if (!loopVars.has(name) && new RegExp(`\\b${name}\\b`).test(expr)) return false
    }
    for (const name of this.propNames) {
      if (!loopVars.has(name) && new RegExp(`\\b${name}\\b`).test(expr)) return false
    }
    for (const name of this.computedNames) {
      if (!loopVars.has(name) && new RegExp(`\\b${name}\\b`).test(expr)) return false
    }
    return true
  }

  static fromParseResult(parseResult) {
    const signalNames = new Set(parseResult.signals.map(s => s.name))
    for (const md of (parseResult.modelDefs || [])) signalNames.add(md.varName)
    return new RenderContext({
      signalNames,
      computedNames: new Set((parseResult.computeds || []).map(c => c.name)),
      propNames: new Set((parseResult.propDefs || []).map(p => p.name)),
      methodNames: (parseResult.methods || []).map(m => m.name),
      constantNames: (parseResult.constantVars || []).map(v => v.name),
      modelVarMap: new Map((parseResult.modelDefs || []).map(md => [md.varName, md.name])),
    })
  }
}
```

### Cómo cambia el código que usa el contexto

**HOY (generateItemSetup, 9 parámetros):**
```js
function generateItemSetup(lines, forBlock, itemVar, indexVar, propNames,
  signalNamesSet, computedNamesSet, methodNames, constantNames, modelVarMap, indentOverride) {
  const indent = indentOverride || '        ';
  // ... usa cada parámetro individualmente
}
```

**DESPUÉS (con RenderContext):**
```js
function renderItemSetup(lines, forBlock, ctx, nodeRef = 'node') {
  // ctx.indent, ctx.signalNames, ctx.propNames, etc. — todo accesible via ctx
  // ctx.currentLoop.itemVar, ctx.currentLoop.indexVar — loop actual
  // ctx.nested('inner', 'j') — crea contexto para un nivel más profundo
}
```

### Flujo de anidamiento recursivo

```
RenderContext inicial (nivel 0):
  indent: '    '
  loopStack: []

  └─ each "item in items"
       ctx.nested('item', 'i')
       → indent: '      '
       → loopStack: [{ itemVar: 'item', indexVar: 'i' }]

       └─ each "sub in item.subs"
            ctx.nested('sub', 'j')
            → indent: '        '
            → loopStack: [{ itemVar: 'item', indexVar: 'i' },
                          { itemVar: 'sub', indexVar: 'j' }]

            → transformExpr('sub.name')
              usa loopStack[1] → transformForExpr con sub, j
              filteredSignalNames excluye 'item', 'i', 'sub', 'j'
```

### Por qué `transformExpr` e `isStatic` no son parte de la clase

`transformExpr` y `transformForExpr` son funciones grandes (~300 líneas cada una)
con lógica compleja de transformación de strings. Incluirlas en `RenderContext`
crearía una dependencia circular o un archivo muy grande.

En su lugar, `RenderContext` proporciona los **datos** necesarios para que las
funciones de transformación operen:
- `isStatic(expr)` usa regex simples — se implementa inline
- `transformExpr(expr)` se implementará en `codegen/index.js` o en el futuro
  `item-renderer.js` usando los datos del contexto

## Affected Files

| File | Change |
|------|--------|
| `lib/codegen/render-context.js` | **NUEVO** — clase `RenderContext` completa |
| `lib/codegen/render-context.test.js` | **NUEVO** — tests unitarios |

Nota: en este spec solo se crea la clase. No se modifica ningún código existente.
La integración con `generateItemSetup` y `generateNestedItemSetup` ocurre en
el spec `phase5-5-item-renderer`.

## Testing

`RenderContext` es completamente testeable sin dependencias:
- Instanciar con mocks simples
- Verificar `nested()` crea contextos correctos
- Verificar `isStatic()` con diferentes expresiones y loopStacks
- Verificar `filteredSignalNames()`/`filteredComputedNames()`/`filteredPropNames()`
- Verificar `fromParseResult()` con un ParseResult mock
- Verificar inmutabilidad: `nested()` no modifica el original

## Riesgos

- **Ninguno.** Esta clase es nueva y no modifica código existente. Se integra en specs posteriores.
