# CSS Scoper — Tasks

## Compilador

- [ ] Recolectar boundaries de imports `.wcc` en `compiler.js`
- [ ] Recolectar boundaries de tree-walker (tags con guión en template)
- [ ] Reescribir `scopeCSS()` para generar `@scope` en vez de tag prefix
- [ ] Implementar `skipComments()` para Bug 1
- [ ] Implementar `splitTopLevelCommas()` con depth de paréntesis, brackets y strings para Bug 2
- [ ] Detectar `:host` y transformar a `:scope` (Bug 3)
- [ ] Agregar tests para CSS nesting (`&`) documentando que funciona (Bug 4)
- [ ] Agregar test para `@supports` con nesting

## Fallback

- [ ] Implementar fallback a tag-name prefixing si el browser no soporta `@scope`
- [ ] Agregar detección con `CSS.supports('at-rule(@scope)')`

## Tests

- [ ] Test: comentarios antes del selector (Bug 1)
- [ ] Test: `:is()` con comas internas (Bug 2)
- [ ] Test: `:where()` con comas internas (Bug 2)
- [ ] Test: `:not()` con múltiples args (Bug 2)
- [ ] Test: `[data-value="a,b"]` con comas en strings (Bug 2 edge case)
- [ ] Test: `:host` y `:host(.class)` (Bug 3)
- [ ] Test: CSS nesting `&` funciona correctamente (Bug 4)
- [ ] Test: `@scope` genera los límites correctos según boundaries
- [ ] Test: dynamic component pierde aislamiento (documentado)
- [ ] Test: `@supports` con selectores anidados
- [ ] Test: fallback a tag-name prefixing cuando no hay soporte
