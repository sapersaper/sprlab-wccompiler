# TODO

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
