# TODO — Tareas pendientes

## core

- [ ] ⏫ Source maps — generar `.map` que mapee el JS compilado al `.wcc` original, permitiendo debuggear en DevTools con el código fuente en vez del output transformado (requiere trackear posiciones línea por línea durante codegen)
- [ ] ⏶ disconnectedCallback cleanup de effects — trackear disposers de `__effect`, limpiarlos en `disconnectedCallback` (requiere que `__effect` retorne dispose function)
- [ ] ⏶ Nombres descriptivos para bindings DOM (`__text_count`, `__btn_increment` en vez de `__b0`, `__e0`)
- [ ]* Opciones adicionales en defineComponent (shadow, extends, formAssociated, mode)

## volar-language-server

- [ ]* ⏫ Semantic tokens para colorear props, signals y computeds en template

---

`*` = opcional / futuro
