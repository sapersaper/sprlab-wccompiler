# CSS Scoper — Requisitos

## User Stories

1. Como desarrollador, quiero que los estilos del `<style>` de un `.wcc` solo afecten a elementos **dentro del template de ese componente**, no a elementos dentro de componentes hijos.
2. Como desarrollador, quiero poder estilizar el elemento raíz del componente con pseudo-clases como `:host()` o `:host-context()`.
3. Como desarrollador, quiero que el CSS generado sea semánticamente correcto y no produzca CSS inválido en casos edge (comentarios, `:is()`, `:where()`, CSS nesting).

## Restricciones

- No se usa Shadow DOM — Light DOM con CSS nativo
- El HTML de salida debe permanecer limpio (sin data-attributes sintéticos)
- Los estilos se inyectan en `document.head` con guard de id para evitar duplicados
- `@scope` con límites se usa para el aislamiento real entre componentes
- Los límites se detectan automáticamente de los imports `.wcc` y del tree-walker
- El tag de componentes wcc siempre empieza con `wcc-`

## Bugs confirmados a resolver

### Bug 1 — Comentarios CSS al inicio del selector
- `/* comment */ .foo { color: red }` → produce CSS inválido

### Bug 2 — `:is()`, `:where()`, `:not()` con comas internas
- `:is(h1, h2) { color: blue }` → divide por comas incorrectamente

### Bug 3 — `:host` prefijo incorrecto
- `:host { display: block }` → debe ser `wcc-card { display: block }`, no `wcc-card :host`

### Bug 4 — CSS nesting nativo (`&`)
- No es bug, pero debe documentarse y testearse explícitamente

### ~~Bug 5 — `:global()`~~
- Eliminado: no es una feature deseada

## Feature nueva: `:host()` y `:host-context()`

Soportar como parte del enfoque `@scope`:
- `:scope` (nativo de `@scope`) reemplaza `:host()`
- `:host-context(.dark)` se cubre con `@scope` anidado o selectores del padre

## Feature nueva: `&` en selectores compuestos

El CSS nesting nativo debe funcionar correctamente: `.card { &.active { color: red } }` debe compilar a `wcc-card.active` (bajo tag prefix) o funcionar naturalmente bajo `@scope`.
