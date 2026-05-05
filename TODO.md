# TODO — Tareas pendientes

## cli-tooling

- [ ] ⏫ Source maps — generar `.map` que mapee el JS compilado al `.wcc` original, permitiendo debuggear en DevTools con el código fuente en vez del output transformado (requiere trackear posiciones línea por línea durante codegen)

## core

- [ ]* Opciones adicionales en defineComponent (shadow, extends, formAssociated, mode)

## volar-language-server

- [ ] ⏫ Hover/intellisense sobre variables dentro del atributo `each="..."`
- [ ] ⏫ Inferir tipo de `templateRef<T>` desde el `defineExpose` del child component (cross-file type resolution)
  ```ts
  // wcc-badge.wcc → expone tipo automáticamente
  defineExpose({ log, doubled })
  
  // wcc-profile.wcc → infiere tipo sin escribirlo a mano
  import type { WccBadge } from './wcc-badge.wcc'
  const badge = templateRef<WccBadge>('badge')
  badge.value!.log('hello') // ✅ tipado
  ```
- [ ]* ⏫ Semantic tokens para colorear props, signals y computeds en template

---

`*` = opcional / futuro
