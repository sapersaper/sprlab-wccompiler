# Plan de Migración de Specs — v3

## Contexto

Los specs en `.kiro/specs/` están desactualizados — reflejan decisiones de diseño que cambiaron (formato multi-archivo, auto-unwrap de signals, watch con strings, templateBindings). Necesitamos specs nuevos que reflejen el código actual como la verdad.

## Instrucciones

- Crear cada spec en `.kiro/specs-v3/{nombre}/` con `requirements.md`, `design.md`, y `tasks.md`
- Las tasks deben estar marcadas como `[x]` (completadas) ya que el código existe
- Leer el código fuente relevante antes de escribir cada spec
- Los specs deben reflejar lo que el código HACE hoy, no lo que debería hacer
- Usar español para los documentos
- Ser conciso — solo user stories esenciales

## Lista de 18 Specs

### Script API
| # | Spec | Cubre |
|---|---|---|
| 1 | **core** | SFC format (.wcc), defineComponent({ tag }), CSS scoping, compilación pipeline |
| 2 | **signals** | signal(), computed(), effect(), constants |
| 3 | **define-props** | defineProps (generic + object + array), props sin asignación, coerción |
| 4 | **define-emits** | defineEmits (generic + array), emit validation en compile time |
| 5 | **define-expose** | defineExpose (exponer métodos/propiedades para acceso externo) |
| 6 | **watch** | watch(signal, fn), watch(() => expr, fn) |
| 7 | **lifecycle-hooks** | onMount (sync + async), onDestroy |

### Template — Directivas
| # | Spec | Cubre |
|---|---|---|
| 8 | **if-directive** | if / else-if / else |
| 9 | **each-directive** | each con (item, index), :key, source con signal() |
| 10 | **show-directive** | show="expr()" |
| 11 | **model-directive** | model en input/select/textarea/checkbox/radio |
| 12 | **attr-bindings** | :class, :style, :attr, :disabled (bool), bind:attr |
| 13 | **event-handlers** | @click="name", @click="fn(item)", @click="() => expr" |

### Template — Componentes y Slots
| # | Spec | Cubre |
|---|---|---|
| 14 | **slots** | default, named, scoped slots, fallback content |
| 15 | **template-refs** | templateRef('name') + ref="name" |
| 16 | **nested-components** | Auto-import, :prop binding reactivo |

### TypeScript y Tooling
| # | Spec | Cubre |
|---|---|---|
| 17 | **typescript-support** | lang="ts", generics, type stripping, interfaces |
| 18 | **volar-language-server** | Language plugin, intellisense, template expressions, hover, go-to-definition |
| 19 | **cli-tooling** | CLI (build/dev), wcc.config.js, dev-server (SSE live-reload), wcc-runtime.js, browser compiler |

## Archivos clave del código a leer

| Spec | Archivos principales |
|---|---|
| core | `lib/compiler.js`, `lib/sfc-parser.js`, `lib/css-scoper.js`, `lib/codegen.js` |
| signals | `lib/parser-extractors.js` (extractSignals, extractComputeds, extractEffects), `lib/reactive-runtime.js` |
| define-props | `lib/parser-extractors.js` (extractPropsGeneric, extractPropsArray, extractPropsDefaults) |
| define-emits | `lib/parser-extractors.js` (extractEmits, extractEmitsFromCallSignatures) |
| define-expose | `lib/parser-extractors.js` (REACTIVE_CALLS), `types/wcc.d.ts` |
| watch | `lib/parser-extractors.js` (extractWatchers), `lib/codegen.js` (watcher effects) |
| lifecycle-hooks | `lib/parser-extractors.js` (extractLifecycleHooks), `lib/codegen.js` |
| if-directive | `lib/tree-walker.js` (processIfChains), `lib/codegen.js` (if effects) |
| each-directive | `lib/tree-walker.js` (processForBlocks, parseEachExpression), `lib/codegen.js` (each effects) |
| show-directive | `lib/tree-walker.js` (show detection), `lib/codegen.js` (show effects) |
| model-directive | `lib/tree-walker.js` (model detection), `lib/codegen.js` (model effects) |
| attr-bindings | `lib/tree-walker.js` (attr detection), `lib/codegen.js` (attr effects) |
| event-handlers | `lib/tree-walker.js` (event detection), `lib/codegen.js` (generateEventHandler, generateForEventHandler) |
| slots | `lib/tree-walker.js` (slot detection), `lib/codegen.js` (slot resolution) |
| template-refs | `lib/tree-walker.js` (detectRefs), `lib/parser-extractors.js` (extractRefs) |
| nested-components | `lib/tree-walker.js` (child component detection), `lib/compiler.js` (resolveChildComponent) |
| typescript-support | `lib/parser.js` (stripTypes), `lib/compiler.js` (lang detection) |
| volar-language-server | `./vscode-wcc/packages/server/src/languagePlugin.ts`, `./vscode-wcc/packages/server/src/templateExpressionParser.ts`, `./vscode-wcc/packages/server/src/wccParser.ts` |
| cli-tooling | `bin/wcc.js`, `lib/config.js`, `lib/dev-server.js`, `lib/wcc-runtime.js`, `lib/compiler-browser.js` |

## Orden de ejecución

Empezar por `core` (es la base), luego `signals`, luego el resto en cualquier orden.

## Después de completar

1. Verificar que cada spec se cumple contra el código
2. Eliminar `.kiro/specs/` (los viejos)
3. Renombrar `.kiro/specs-v3/` → `.kiro/specs/`
