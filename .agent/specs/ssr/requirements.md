# SSR — Static `renderToString`

## User Stories

1. Como desarrollador, quiero que mis componentes `.wcc` puedan renderizarse a HTML estático en el servidor para mejorar SEO y First Contentful Paint.
2. Como desarrollador, quiero que el HTML servido por SSR sea idéntico a lo que el componente renderizaría en el browser.
3. Como desarrollador, quiero que cuando el JS cargue en el browser, adopte el DOM existente sin re-renderizar ni causar flashes.
4. Como desarrollador, quiero que el SSR funcione en cualquier runtime JS (Node, Deno, Bun, Edge Workers) sin dependencias DOM.
5. Como desarrollador, quiero generar SSR con `wcc build --ssr` sin cambiar mi código fuente `.wcc`.

## Restricciones

- El runtime del browser **no se modifica** — el mismo `.js` funciona con y sin SSR
- El `.ssr.js` debe ser zero-dependencias (inline, sin imports externos)
- El HTML de SSR debe incluir CSS scopeado inline para evitar FOUC
- SSR no ejecuta JS del usuario — `computed()` y funciones arbitrarias no se evalúan en servidor
- `connectedCallback` debe detectar DOM servido y adoptarlo sin borrar

## Features cubiertas en SSR

| Feature | SSR |
|---------|:----:|
| Props como atributos HTML | ✅ |
| `{{expr}}` bindings simples | ✅ |
| `if` / `else-if` / `else` | ✅ |
| `each` sobre arrays | ✅ |
| `show` (`display:none`) | ✅ |
| `:attr` bindings | ✅ |
| `:class` object/string | ✅ |
| `:style` object/string | ✅ |
| CSS scopeado inline | ✅ |
| XSS escape (`__esc`) | ✅ |
| `computed()` con state inicial | ⚠️ vía `state` parameter |
| Child components anidados | ⚠️ Phase 3 |
| Event handlers | ❌ No aplica en SSR |
| `watch()` | ❌ No aplica en SSR |
| `model` directive | ❌ No aplica en SSR |
