# Angular adapter — Tasks

## Analysis

- [ ] Identificar en `angular-adapter.js` todas las referencias a `registerSlotRenderer`
- [ ] Identificar cómo se renderizan los templates de `ng-template` en el adapter
- [ ] Verificar que `__scopedSlots` está siendo populado en el runtime actual

## Implementación

- [ ] Crear `initScopedSlotNew()` que almacena template en `__slotTpl_name`
- [ ] Renderizar el template `ng-template` a HTML string para almacenar en `__slotTpl`
- [ ] Agregar `queueMicrotask` para re-renderizar each loops después de almacenar templates
- [ ] Mantener `initNamedSlot()` sin cambios (ya funciona)

## Tests

- [ ] Compilar wcc-list para Angular: `node ../../bin/wcc.js build --config wcc.config.angular.js`
- [ ] Correr e2e de Angular: `npx playwright test fixtures/angular.spec.js`
- [ ] Verificar Tests 8-10 (scoped slots) pasan
- [ ] Verificar Tests 1-7 (props, events, named slots) no se rompen
- [ ] Correr unit tests: `npx vitest --run`

## CI

- [ ] Commit + push
- [ ] Verificar CI pasa
