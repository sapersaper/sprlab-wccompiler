# TODO — Tareas pendientes

## 🔴 PRIORIDAD ALTA (Zero-Runtime Refactor)

- [x] **Fase 1**: Proxy State + `__invalidate` básico (text, show, attr, class, style) → `.kiro/specs/proxy-state-invalidate/`
- [x] **Fase 2**: If-blocks + Computed + Watch → `.kiro/specs/if-computed-watch-zero-runtime/`
- [x] **Fase 3**: Each loops (keyed, non-keyed, external signals, nested) → `.kiro/specs/each-loops-zero-runtime/`
- [ ] **Fase 4**: Model bindings, child props, scoped slots, dynamic components, effect removal → `.kiro/specs/advanced-features-zero-runtime/`

## core

- [ ]* Source maps — generar `.map` que mapee el JS compilado al `.wcc` original
- [ ]* Opciones adicionales en defineComponent (shadow, extends, formAssociated, mode)

## volar-language-server

- [ ]* Semantic tokens para colorear props, signals y computeds en template

## interop / compatibilidad (baja prioridad)

- [ ]* SSR (Server-Side Rendering) — Next.js, Nuxt, Angular Universal
- [ ]* Lazy loading — `import()` dinámico de WCC components
- [ ]* Form participation — `ElementInternals` y `formAssociated`
- [ ]* Accessibility (a11y) — roles ARIA en frameworks

---

`*` = opcional / futuro

## ✅ COMPLETADO
