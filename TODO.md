# TODO

## 🚨 Angular slots sin `wccSlots` — Hacer `WccSlotDef` autónomo (Prioridad Máxima)

**Problema:** Actualmente los slots con `<ng-template slot="name">` en Angular requieren el atributo `[wccSlots]` en el elemento WCC padre. Esto activa `WccSlotsDirective`, que hace query de los `WccSlotDef` hijos y renderiza sus templates.

**Solución que se perdió en un refactor:** Hacer que `WccSlotDef` sea autónomo — que cada directiva en un `<ng-template slot="name">` se renderice a sí misma sin necesidad de `WccSlotsDirective`.

**Contexto técnico:**
- `WccSlotDef` (selector: `ng-template[slot]`) ya inyecta `TemplateRef` y obtiene `slotName` del atributo `slot`
- Podría inyectar `ViewContainerRef`, renderizar el template, crear un wrapper `<div slot="name">`, e insertarlo como hijo del WCC padre vía `elementRef.nativeElement.parentElement`
- Para scoped slots necesita leer `__scopedSlots` del WCC padre y setear `__slotTpl_name` o `registerSlotRenderer`
- Actualmente `WccSlotsDirective.initNamedSlot()` y `initScopedSlot()` tienen la lógica de renderizado que habría que mover a `WccSlotDef`

**Archivos involucrados:**
- `framework-integrations/angular/src/wcc-components/angular-adapter.js` — `WccSlotDef` (lines 42-69), `WccSlotsDirective` (lines 79+)
- `framework-integrations/angular/src/app/basics.component.html` — Tests 6, 7, 8, 9, 10 (usan `wccSlots`)
- `framework-integrations/angular/src/app/composition.component.html` — Test 17 (usa `wccSlots`)

**Criterio de éxito:** `<wcc-card><ng-template slot="header">...</ng-template></wcc-card>` funciona SIN `[wccSlots]` en el padre.

**Complejidad: 3/5** — Media-alta
- Named slots: ~2/5 (render template, wrap, insert)
- Scoped slots: ~3/5 (requiere `__scopedSlots` + `__slotTpl`)
- Limpieza de `WccSlotsDirective` + actualización de tests + templates: ~4/5

### Tareas
- [ ] Agregar `ViewContainerRef` a `WccSlotDef`
- [ ] Implementar `ngAfterViewInit` que renderice named slots (wrapper `<div slot="name">` + appendChild)
- [ ] Implementar `ngAfterViewInit` que renderice scoped slots (leer `__scopedSlots`, setear `__slotTpl_name`)
- [ ] Eliminar dependencia de `WccSlotsDirective` de los templates
- [ ] Remover o simplificar `WccSlotsDirective`
- [ ] Actualizar tests E2E

## 🧪 Framework Integrations — Suite de pruebas E2E (Task-0023 → Task-0033)

### Task-0023: [WCC] Crear componentes de prueba: directivas básicas
Crear 4 nuevos `.wcc` en `framework-integrations/wcc/src/`:
- **`wcc-conditional.wcc`**: `if`/`else-if`/`else` directives. Prop `visible` (boolean). Muestra "Visible"/"Hidden". Botón toggle.
- **`wcc-toggle.wcc`**: `show` directive. Prop `show` (boolean). Muestra/oculta bloque de texto.
- **`wcc-input.wcc`**: `model` directive en `<input>`. `defineModel` para `value`. Prop `placeholder`.
- **`wcc-styled.wcc`**: `:class` y `:style` dinámicos. Props `variant` ("primary"/"secondary") y `color`.

### Task-0024: [WCC] Crear componentes de prueba: anidamiento y composición
Crear 2 nuevos `.wcc` en `framework-integrations/wcc/src/`:
- **`wcc-wrapper.wcc`**: Contenedor con slot por defecto. Prop `title` opcional.
- **`wcc-parent.wcc`**: Usa `<wcc-counter>` internamente. Props `initialCount`, `label`. Re-expone evento `count-changed`.

### Task-0025: [Build] Configurar builds y compilar para los 3 frameworks
Compilar los nuevos componentes contra Vue/React/Angular:
```
cd framework-integrations/wcc
node ../../bin/wcc.js build --config wcc.config.vue.js
node ../../bin/wcc.js build --config wcc.config.react.js
node ../../bin/wcc.js build --config wcc.config.angular.js
```

### Task-0026: [Vue] Integrar y testear directivas básicas + E2E
Agregar test sections 12-16 en `App.vue`. Tests: conditional toggle, show toggle, input v-model, styled classes. E2E en `vue.spec.js`.

### Task-0027: [React] Integrar y testear directivas básicas + E2E
Agregar test sections 12-16 en `App.jsx`. Tests: conditional, show, input (prop+event), styled. E2E en `react.spec.js`.

### Task-0028: [Angular] Integrar y testear directivas básicas + E2E
Agregar test sections 11-15 en `app.component.html`. Tests: conditional, show, input, styled. E2E en `angular.spec.js`.

### Task-0029: [E2E] Anidamiento WCC→WCC (todos los frameworks)
Tests de anidamiento en los 3 frameworks:
- WCC→WCC simple (`wcc-wrapper` > `wcc-counter`)
- 2 niveles de profundidad (`wcc-wrapper` > `wcc-card`)
- `wcc-parent` con `wcc-counter` interno
- `each` con `wcc-counter` por item

### Task-0030: [E2E] Anidamiento Framework→WCC→Framework
Componentes del framework dentro de slots de WCC:
- Vue: `<VueBadge>` dentro de `wcc-card` slot
- React: `<Badge>` dentro de `renderItem`/slot de `wcc-card`
- Angular: `<app-badge>` dentro de `<ng-template slot>`

### Task-0031: [E2E] Loops, condicionales e interacciones framework+WCC
- `v-for`/`*ngFor`/`.map()` renderizando múltiples `wcc-counter` — estado independiente
- `v-if`/`*ngIf`/`&&` toggle de `wcc-card` — destroy/reconnect sin errores
- Reactividad multi-nivel: estado framework → WCC prop → WCC evento → framework

### Task-0032: [E2E] Casos borde
- Slot fallback: WCC sin slots vs con slots
- Destroy/reconnect: toggle elimina y recrea el WCC
- Template syntax leaks: `{{`, `{%`, `${` no aparecen en DOM
- CSS scoping: estilos WCC no afectan al framework, viceversa

### Task-0033: [E2E] Plugins/adaptadores específicos por framework
- **Vue**: `v-model.number`/`.trim` modifiers, múltiples v-model, v-model en `wcc-input`
- **React**: JSX prop slots, compound components sintaxis
- **Angular**: `[(banana-box)]`, `wccEvent`/`wccEvents` directives, `wccSlots` con anidamiento
