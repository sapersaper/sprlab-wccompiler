# TODO — Tareas pendientes

## core

- [ ] ⏫ Source maps — generar `.map` que mapee el JS compilado al `.wcc` original, permitiendo debuggear en DevTools con el código fuente en vez del output transformado (requiere trackear posiciones línea por línea durante codegen)
- [ ] ⏶ disconnectedCallback cleanup — trackear effects y event listeners, limpiarlos al desconectar el componente del DOM (previene memory leaks en SPAs con routing dinámico)
- [ ]* Opciones adicionales en defineComponent (shadow, extends, formAssociated, mode)

## volar-language-server

- [ ]* ⏫ Semantic tokens para colorear props, signals y computeds en template

---

`*` = opcional / futuro
