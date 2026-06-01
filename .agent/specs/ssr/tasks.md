# SSR — Tasks

## SSR-1: Render básico (props, texto, CSS, atributos)

- [ ] Crear `lib/codegen/ssr.js` con `generateSSR(parseResult)`
- [ ] Generar `renderToString(props, state)` con defaults de `propDefs` y `signals`
- [ ] Generar CSS scopeado inline (reutilizar `scopeCSS`)
- [ ] Generar interpolación `{{expr}}` con `__esc()`
- [ ] Generar `:attr` bindings como atributos HTML
- [ ] Generar `:class` (object → `class="..."`, string → literal)
- [ ] Generar `:style` (object → `style="..."`)
- [ ] Función `__esc()` para XSS prevention
- [ ] Tests: render básico con props + texto + CSS

## SSR-2: Directivas (if, each, show)

- [ ] Generar `if` → condicional ternario con string vacío para false
- [ ] Generar `else-if` / `else` → cadenas de ternarios
- [ ] Generar `each` → `.map()` con `__esc()`
- [ ] Generar `show` → `style="display:none"` inline condicional
- [ ] Tests: if/each/show con múltiples variantes

## SSR-3: Hidratación + CLI

- [ ] Modificar `connectedCallback` en `lib/codegen/connected-callback.js`
  - [ ] Detectar `this.children.length > 0` → skip clone + append
  - [ ] Atar event listeners igual (ya funcionan sobre DOM existente)
  - [ ] Ejecutar `__invalidate('*')` para sincronizar estado
- [ ] Opción `ssr: true` en `compile()` → retornar `ssrCode`
- [ ] Flag `--ssr` en `bin/wcc.js`
- [ ] CLI genera `.ssr.js` junto al `.js`
- [ ] Tests: SSR round-trip (render → parse → match DOM structure)
- [ ] Tests: hidratación (simular SSR HTML + connectedCallback)
