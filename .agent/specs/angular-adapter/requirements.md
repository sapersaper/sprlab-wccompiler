# Angular adapter — alinear con scoped slots runtime

## User Stories

1. Como desarrollador Angular, quiero que los scoped slots con `let-item` en `wcc-list` rendericen correctamente los items con sus valores reales.
2. Como desarrollador Angular, quiero que el adapter funcione con el sistema de slots actual (`__slotTpl_name` + `__slotMap`), no con `registerSlotRenderer`.
3. Como desarrollador, quiero que los named slots vía `ng-template[slot]` sigan funcionando como hasta ahora.

## Restricciones

- El adapter debe funcionar con **Angular 19 standalone**
- No debe romper los named slots existentes (Tests 6-7 de Angular)
- El timing de Angular (custom elements se conectan antes de proyectar hijos) debe soportarse
- El cambio debe hacerse en `angular-adapter.js`, no en el compilador compartido
- `connected-callback.js` no debe modificarse para este fix

## Tests afectados

| Test | Componente | Estado |
|------|-----------|--------|
| Test 6 | Named slots (`ng-template[slot]`) | ✅ Pasa |
| Test 7 | Named slots (`div slot="name"`) | ✅ Pasa |
| Test 8 | Scoped slot (`let-item let-index`) | ❌ Fallo |
| Test 9 | Scoped slot custom class | ❌ Fallo |
| Test 10 | Scoped slot + Angular interpolation | ❌ Fallo |

## Arquitectura actual

### Cómo funciona el adapter hoy

1. `WccSlotDef` directive captura `ng-template[slot]` elements
2. `WccSlotsDirective` en `ngAfterContentInit` lee los slotDefs
3. Clasifica slots como nombrados o scoped viendo `__scopedSlots` del host element
4. Scoped slots: llama `element.registerSlotRenderer(name, renderer)` (❌ no existe en runtime actual)
5. Named slots: escribe directamente en `[data-slot="name"]` container

### Cómo funciona el runtime actual

1. `connectedCallback` lee `this.childNodes` y construye `__slotMap`
2. Para each loops, `renderScopedSlots()` reemplaza tokens `{%prop%}` con valores reales
3. `__slotTpl_name` almacena el template del consumer

## Fix propuesto

El adapter debe, en vez de llamar `registerSlotRenderer`:
1. Almacenar el template del consumer en `element.__slotTpl_name`
2. El WCC runtime ya lee `__slotTpl_name` en `renderScopedSlots()`
3. Disparar `__renderEach_N()` o `__invalidate` para re-renderizar

Para el timing de Angular (proyección tardía), el adapter debe esperar a que el elemento esté definido y entonces inyectar los templates en `__slotTpl_name`.
