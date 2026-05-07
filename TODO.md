# TODO — Tareas pendientes

## core

- [ ] ⏫ Source maps — generar `.map` que mapee el JS compilado al `.wcc` original, permitiendo debuggear en DevTools con el código fuente en vez del output transformado (requiere trackear posiciones línea por línea durante codegen)
- [ ] ⏶ Nombres descriptivos para bindings DOM (`__text_count`, `__btn_increment` en vez de `__b0`, `__e0`)
- [ ]* Opciones adicionales en defineComponent (shadow, extends, formAssociated, mode)
- [ ]* Componente dinámico (`<component :is="...">`) — similar al meta-component de Vue que permite renderizar componentes dinámicamente según una expresión reactiva. Analizar viabilidad dado que wcCompiler resuelve imports en compile-time.

## volar-language-server

- [ ]* ⏫ Semantic tokens para colorear props, signals y computeds en template

---

`*` = opcional / futuro
