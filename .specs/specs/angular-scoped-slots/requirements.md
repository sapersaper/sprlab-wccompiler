# Documento de Requisitos — Angular Scoped Slots Nativos

## Introducción

Crear una directiva Angular `WccSlotsDirective` que permita a los desarrolladores Angular usar **named slots** y **scoped slots** con sintaxis idiomática de Angular (`ng-template`, `#name`, `let-*`). Esta es la contraparte Angular del plugin Vue existente (`wccVuePlugin`) que maneja scoped slots en tiempo de compilación.

**Diferencia clave con Vue:** Angular requiere un enfoque en runtime (directiva) en lugar de transformación en build-time porque:
- `ng-template` es manejado internamente por Angular — no llega al DOM
- Angular necesita `TemplateRef` + `ViewContainerRef` para renderizar templates con contexto
- El compilador de Angular (ngc) no tiene hooks de pre-transformación como Vite
- Las directivas SON el mecanismo estándar de Angular para esto (como `ngTemplateOutlet`, `*ngFor`, CDK tables)

**Regla simple de sintaxis:**

| Sintaxis | Tipo |
|----------|------|
| `<ng-template #name>contenido</ng-template>` | Named slot (estático) |
| `<ng-template #name let-prop>{{prop}}</ng-template>` | Scoped slot (reactivo) |
| children sin ng-template | Default slot |

**Lo que el desarrollador escribe (Angular idiomático):**
```html
<!-- Named slot (sin scope) -->
<wcc-card>
  <ng-template #header><strong>Custom Header</strong></ng-template>
  <p>Body content</p>
  <ng-template #footer>Custom footer</ng-template>
</wcc-card>

<!-- Scoped slot (con datos del hijo) -->
<wcc-card>
  <ng-template #header><strong>Scoped Demo</strong></ng-template>
  <p>Click 👍 and watch</p>
  <ng-template #stats let-likes>⭐ {{likes}} stars!</ng-template>
</wcc-card>

<!-- Múltiples props en scoped slot -->
<wcc-card>
  <ng-template #stats let-likes let-total="total">{{likes}}/{{total}} likes!</ng-template>
</wcc-card>
```

**Lo que sucede en runtime:**
1. La directiva se activa automáticamente en custom elements (tags con guión en el nombre)
2. Detecta `ng-template` con `#name` — el nombre de la template reference variable ES el nombre del slot
3. Si el `ng-template` tiene `let-*` → scoped slot: registra un renderer y pasa props reactivas como contexto
4. Si el `ng-template` NO tiene `let-*` → named slot: renderiza el contenido estático dentro de un `<div slot="name" style="display:contents">`
5. El desarrollador **nunca** escribe `slot="name"` manualmente — la directiva lo maneja todo

El enfoque existente con `slot-template-*` y tokens `{%prop%}` sigue funcionando como fallback.

## Glosario

- **WccSlotsDirective**: Directiva Angular standalone que se activa automáticamente en Custom_Elements, detecta `ng-template` con template reference variables (`#name`) y gestiona tanto named slots (estáticos) como scoped slots (reactivos) en runtime.
- **Custom_Element**: Un elemento HTML cuyo tag name contiene un guión (e.g., `wcc-card`, `wcc-list`), indicando que es un Web Component. La directiva se activa automáticamente en estos elementos.
- **Template_Reference_Variable**: Una variable de referencia de template Angular declarada con `#name` en un `ng-template`. El nombre de la variable determina directamente el nombre del slot destino.
- **Named_Slot**: Un `ng-template` con `#name` pero SIN directivas `let-*`. Su contenido se renderiza estáticamente dentro de un wrapper `<div slot="name" style="display:contents">` en el Custom_Element.
- **Scoped_Slot**: Un `ng-template` con `#name` Y al menos una directiva `let-*`. Su contenido se renderiza dinámicamente con un contexto reactivo proporcionado por el Custom_Element.
- **Scoped_Slot_Context**: El objeto de contexto pasado a `createEmbeddedView` que contiene `$implicit` (prop implícita) y propiedades nombradas accesibles via `let-*`.
- **WCC_Runtime**: El código generado del custom element WCC que gestiona slots, props reactivas y el ciclo de vida del componente.
- **Slot_Registration_API**: El mecanismo expuesto por el custom element WCC (`registerSlotRenderer`) que permite a la directiva registrar un callback de renderizado para un scoped slot específico.
- **Slot_Update_Event**: El evento `wcc:slot-update` emitido por el custom element WCC cuando las props de un scoped slot cambian, con `detail: { slot, props }`.
- **Embedded_View**: Una vista Angular creada por `ViewContainerRef.createEmbeddedView(templateRef, context)` que renderiza el contenido del `ng-template` con el contexto proporcionado.
- **Angular_Adapter**: El módulo `@sprlab/wccompiler/adapters/angular` que exporta utilidades de integración Angular para WCC.

## Requisitos

### Requisito 1: Activación Automática en Custom Elements

**User Story:** Como desarrollador Angular usando componentes WCC, quiero que la directiva se active automáticamente en custom elements sin necesidad de atributos adicionales, para que la integración sea transparente y sin boilerplate.

#### Criterios de Aceptación

1. THE Angular_Adapter SHALL export `WccSlotsDirective` como una directiva Angular standalone desde `@sprlab/wccompiler/adapters/angular`.
2. WHEN `WccSlotsDirective` is imported into a component's `imports` array, THE WccSlotsDirective SHALL activate automatically on all elements whose tag name contains a hyphen (Custom_Elements).
3. THE WccSlotsDirective SHALL NOT require any attribute (como `wccSlots`) en el elemento host para activarse.
4. THE WccSlotsDirective SHALL be compatible with Angular standalone components (sin necesidad de NgModule).
5. THE WccSlotsDirective SHALL coexistir con `CUSTOM_ELEMENTS_SCHEMA` sin conflictos.
6. THE WccSlotsDirective SHALL ser compatible con Angular versión 16 o superior.

### Requisito 2: Detección de Slots via Template Reference Variables (#name)

**User Story:** Como desarrollador Angular, quiero usar `ng-template #slotName` dentro de custom elements para declarar slots, para que pueda usar sintaxis Angular estándar sin atributos auxiliares como `wccSlot="name"`.

#### Criterios de Aceptación

1. WHEN un `ng-template` con una Template_Reference_Variable (`#name`) está presente como hijo de un Custom_Element, THE WccSlotsDirective SHALL detectar ese template y asociarlo con el slot cuyo nombre coincide con la variable de referencia.
2. THE WccSlotsDirective SHALL NOT requerir una directiva auxiliar `wccSlot="name"` — el nombre del slot se obtiene directamente de la template reference variable `#name`.
3. WHEN un `ng-template` tiene al menos una directiva `let-*`, THE WccSlotsDirective SHALL clasificar ese template como un Scoped_Slot.
4. WHEN un `ng-template` NO tiene ninguna directiva `let-*`, THE WccSlotsDirective SHALL clasificar ese template como un Named_Slot.
5. WHEN múltiples `ng-template` con diferentes Template_Reference_Variables están presentes dentro del mismo Custom_Element, THE WccSlotsDirective SHALL registrar cada uno independientemente según su tipo (named o scoped).

### Requisito 3: Manejo de Named Slots (Estáticos)

**User Story:** Como desarrollador Angular, quiero usar `ng-template #name` sin `let-*` para declarar named slots estáticos, para que pueda proyectar contenido en slots nombrados sin necesidad de escribir `slot="name"` manualmente.

#### Criterios de Aceptación

1. WHEN un `ng-template` es clasificado como Named_Slot (tiene `#name` pero no `let-*`), THE WccSlotsDirective SHALL renderizar su contenido dentro de un elemento wrapper `<div slot="name" style="display:contents">` como hijo del Custom_Element.
2. THE wrapper element SHALL usar `style="display:contents"` para no afectar el layout visual.
3. THE wrapper element SHALL tener el atributo `slot` con el valor correspondiente al nombre de la Template_Reference_Variable.
4. WHEN el componente Angular se destruye, THE WccSlotsDirective SHALL remover los wrapper elements de Named_Slots del DOM.
5. WHEN un Named_Slot es detectado, THE WccSlotsDirective SHALL renderizar su contenido inmediatamente sin esperar eventos del Custom_Element.
6. THE WccSlotsDirective SHALL permitir que el desarrollador nunca escriba `slot="name"` manualmente — la directiva maneja toda la proyección de slots.

### Requisito 4: Manejo de Scoped Slots (Reactivos)

**User Story:** Como desarrollador Angular, quiero usar `ng-template #name let-prop` para declarar scoped slots reactivos, para que pueda recibir datos dinámicos del custom element con sintaxis Angular estándar.

#### Criterios de Aceptación

1. WHEN un `ng-template` es clasificado como Scoped_Slot (tiene `#name` Y `let-*`), THE WccSlotsDirective SHALL registrar un callback de renderizado en el Custom_Element via `registerSlotRenderer(slotName, callback)`.
2. WHEN el Custom_Element invoca el callback con nuevas props, THE WccSlotsDirective SHALL crear o actualizar una Embedded_View con el Scoped_Slot_Context derivado de las props.
3. WHEN las props del slot se actualizan, THE WccSlotsDirective SHALL actualizar el contexto de la Embedded_View existente en lugar de destruir y recrear la vista.
4. THE Embedded_View de un Scoped_Slot SHALL ser insertada en el DOM dentro del slot correspondiente del Custom_Element (usando un wrapper `<div slot="name" style="display:contents">`).
5. IF las props del slot son `null` o `undefined`, THEN THE WccSlotsDirective SHALL limpiar la Embedded_View del scoped slot.

### Requisito 5: Registro de Slot Renderer en el Custom Element

**User Story:** Como desarrollador del runtime WCC, quiero que la directiva Angular registre un callback de renderizado en el custom element para scoped slots, para que el componente WCC pueda invocar el renderizado del slot cuando las props cambien.

#### Criterios de Aceptación

1. WHEN la directiva detecta un Scoped_Slot, THE WccSlotsDirective SHALL invocar `element.registerSlotRenderer(slotName, callback)` en el Custom_Element host.
2. IF el Custom_Element no expone `registerSlotRenderer`, THEN THE WccSlotsDirective SHALL escuchar el evento `wcc:slot-update` como mecanismo alternativo.
3. THE callback registrado SHALL recibir un objeto `props` y renderizar el template con el contexto correspondiente.
4. WHEN la directiva se destruye (componente Angular desmontado), THE WccSlotsDirective SHALL desregistrar los slot renderers y limpiar las vistas embebidas.
5. THE WccSlotsDirective SHALL esperar a que el Custom_Element esté definido (`customElements.whenDefined`) antes de intentar registrar el slot renderer.

### Requisito 6: Inserción de la Vista en el DOM del Slot

**User Story:** Como desarrollador Angular, quiero que el contenido renderizado del ng-template aparezca en el slot correcto del custom element, para que la composición visual sea correcta.

#### Criterios de Aceptación

1. WHEN la directiva renderiza contenido para un slot (named o scoped), THE WccSlotsDirective SHALL insertar los nodos DOM resultantes dentro de un wrapper `<div slot="slotName" style="display:contents">` como hijo del Custom_Element.
2. WHEN una Embedded_View es actualizada, THE WccSlotsDirective SHALL reemplazar el contenido anterior sin duplicar nodos ni wrapper elements.
3. THE WccSlotsDirective SHALL reutilizar el mismo wrapper element en actualizaciones sucesivas del mismo slot.
4. THE WccSlotsDirective SHALL preservar el contenido del default slot (children sin ng-template) sin interferir.
5. IF el Custom_Element usa Light DOM con marcadores de slot, THEN THE WccSlotsDirective SHALL insertar la vista en la posición del marcador del slot.

### Requisito 7: API de Registro en el Custom Element WCC (Codegen)

**User Story:** Como mantenedor del compilador WCC, quiero que el codegen emita una API de registro de slot renderers en los custom elements, para que la directiva Angular pueda comunicarse con el componente.

#### Criterios de Aceptación

1. WHEN un componente WCC tiene scoped slots definidos, THE Codegen SHALL emitir un método `registerSlotRenderer(slotName, callback)` en la clase del custom element.
2. THE método `registerSlotRenderer` SHALL almacenar el callback asociado al slot name y invocarlo cuando las props del slot cambien.
3. WHEN las props de un scoped slot cambian (dentro de un `__effect`), THE WCC_Runtime SHALL invocar el callback registrado con las nuevas props Y emitir el evento `wcc:slot-update`.
4. THE método `registerSlotRenderer` SHALL retornar una función de cleanup que desregistra el callback.
5. WHEN un slot tiene un renderer registrado, THE WCC_Runtime SHALL omitir el renderizado basado en tokens (`{%prop%}` replacement) para ese slot, delegando el renderizado al callback.

### Requisito 8: Evento wcc:slot-update

**User Story:** Como desarrollador del runtime WCC, quiero que el custom element emita eventos cuando las props de un slot cambian, para que la directiva Angular pueda reaccionar a los cambios sin acoplamiento directo.

#### Criterios de Aceptación

1. WHEN las props de un scoped slot cambian, THE WCC_Runtime SHALL emitir un `CustomEvent` con nombre `wcc:slot-update` en el elemento host.
2. THE evento `wcc:slot-update` SHALL tener `detail` con la estructura `{ slot: string, props: Record<string, any> }`.
3. THE evento `wcc:slot-update` SHALL tener `bubbles: false` para evitar propagación innecesaria.
4. THE evento `wcc:slot-update` SHALL ser emitido después de que las props internas se actualicen pero antes del renderizado basado en tokens.
5. WHEN múltiples props de un slot cambian en el mismo ciclo reactivo, THE WCC_Runtime SHALL emitir un solo evento con todas las props actualizadas.

### Requisito 9: Ciclo de Vida y Limpieza

**User Story:** Como desarrollador Angular, quiero que la directiva limpie correctamente los recursos cuando el componente se destruye, para que no haya memory leaks ni nodos huérfanos.

#### Criterios de Aceptación

1. WHEN el componente Angular que contiene la directiva se destruye, THE WccSlotsDirective SHALL destruir todas las Embedded_Views creadas (tanto de named slots como de scoped slots).
2. WHEN el componente Angular se destruye, THE WccSlotsDirective SHALL invocar la función de cleanup retornada por `registerSlotRenderer` para cada scoped slot registrado.
3. WHEN el componente Angular se destruye, THE WccSlotsDirective SHALL remover todos los event listeners de `wcc:slot-update` del Custom_Element.
4. WHEN el componente Angular se destruye, THE WccSlotsDirective SHALL remover todos los wrapper elements (`<div slot="name">`) insertados en el Custom_Element.
5. IF el Custom_Element es removido del DOM antes que el componente Angular se destruya, THEN THE WccSlotsDirective SHALL manejar la situación sin errores.
6. THE WccSlotsDirective SHALL usar `DestroyRef` o `ngOnDestroy` para gestionar la limpieza del ciclo de vida.

### Requisito 10: Compatibilidad con el Enfoque Existente (slot-template-*)

**User Story:** Como desarrollador Angular, quiero que el enfoque existente con `slot-template-*` siga funcionando, para que pueda migrar gradualmente a la sintaxis nativa.

#### Criterios de Aceptación

1. WHEN un Custom_Element tiene tanto un `ng-template #slotName` (via directiva) como un elemento con `slot-template-slotName` attribute, THE WccSlotsDirective SHALL dar prioridad al `ng-template` sobre el atributo.
2. WHEN `WccSlotsDirective` no está importada en un componente, THE WCC_Runtime SHALL continuar procesando `slot-template-*` attributes normalmente (sin regresión).
3. THE WccSlotsDirective SHALL no interferir con el default slot (children sin ng-template que no tienen template reference variables).
4. WHEN un Custom_Element tiene slots mixtos (algunos con `ng-template`, otros con `slot-template-*`), THE WccSlotsDirective SHALL manejar solo los slots declarados via `ng-template` y dejar los demás al runtime WCC.

### Requisito 11: Soporte para Múltiples Props y Contexto Complejo

**User Story:** Como desarrollador Angular, quiero poder acceder a múltiples props del scoped slot usando `let-*`, para que pueda construir templates ricos con todos los datos expuestos por el slot.

#### Criterios de Aceptación

1. WHEN un `ng-template` tiene `let-varName` (sin valor asignado), THE WccSlotsDirective SHALL asignar `$implicit` del contexto a esa variable.
2. WHEN un `ng-template` tiene `let-varName="propKey"` (con valor), THE WccSlotsDirective SHALL asignar `context[propKey]` a la variable local `varName`.
3. WHEN un scoped slot expone múltiples props (e.g., `{ likes: 5, total: 100 }`), THE WccSlotsDirective SHALL construir un contexto con `$implicit` igual al primer prop y cada prop como propiedad nombrada.
4. WHEN el contexto del slot se actualiza parcialmente (solo algunas props cambian), THE WccSlotsDirective SHALL actualizar el contexto de la Embedded_View sin recrear la vista.
5. FOR ALL combinaciones válidas de `let-*` bindings en un `ng-template`, THE WccSlotsDirective SHALL producir un contexto que Angular resuelve correctamente según las reglas estándar de `ngTemplateOutlet`.

### Requisito 12: Detección de Cambios Angular

**User Story:** Como desarrollador Angular, quiero que los cambios en las props del slot disparen la detección de cambios de Angular, para que la UI se actualice automáticamente.

#### Criterios de Aceptación

1. WHEN las props de un scoped slot se actualizan via `wcc:slot-update` o via el callback de `registerSlotRenderer`, THE WccSlotsDirective SHALL marcar la vista para verificación de cambios (`ChangeDetectorRef.markForCheck()` o equivalente).
2. THE WccSlotsDirective SHALL funcionar correctamente con la estrategia `OnPush` de detección de cambios.
3. WHEN la directiva actualiza el contexto de una Embedded_View, THE template bindings dentro del `ng-template` SHALL reflejar los nuevos valores en el siguiente ciclo de detección de cambios.
4. THE WccSlotsDirective SHALL no causar ciclos infinitos de detección de cambios (no disparar actualizaciones dentro de un ciclo de CD activo).
