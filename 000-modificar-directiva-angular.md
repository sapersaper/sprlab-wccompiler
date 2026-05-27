# 000 — Eliminar necesidad de directiva `wccModel` para two-way binding en Angular

## Problema

Actualmente, para usar banana-box `[(count)]` en Angular con componentes WCC, el usuario debe:

1. Importar `WccModel` desde el adapter
2. Agregar `wccModel` como atributo en el template
3. Importar la directiva en el array `imports` del componente

```html
<!-- Hoy (requiere directiva) -->
<wcc-counter wccModel [(count)]="value"></wcc-counter>
```

**Objetivo:** Que funcione sin directiva, igual que en Vue donde el plugin es invisible:

```html
<!-- Deseado (zero-config) -->
<wcc-counter [(count)]="value"></wcc-counter>
```

## Causa raíz

Angular `[(count)]="value"` se expande internamente a:
```html
[count]="value" (countChange)="value = $event"
```

Pero `$event` en un custom element es el `CustomEvent` completo, no el valor. El valor está en `$event.detail`. Angular asigna el objeto `CustomEvent` a `value` en vez del número.

La directiva `WccModel` resuelve esto escuchando `wcc:model` y re-despachando `countChange` con `detail: value`. Pero queremos eliminar esa necesidad.

## Solución propuesta: Plugin de esbuild para Angular

Angular 17+ usa esbuild internamente. Crear un plugin que transforme los templates `.html` antes de la compilación AOT.

### Transformación

```
Input:  <wcc-counter [(count)]="modelCount"></wcc-counter>
Output: <wcc-counter [count]="modelCount" (countChange)="modelCount = $any($event).detail"></wcc-counter>
```

### Regex

```js
// Solo para custom elements (tags con hyphen)
/(<[\w]+-[\w-]*(?:\s[^>]*?)?)\[\((\w+)\)\]="([^"]+)"/g
→ '$1[$2]="$3" ($2Change)="$3 = $any($event).detail"'
```

### Consideraciones

- **Solo custom elements** — No transformar `[(ngModel)]` ni otros bindings en elementos nativos. Detectar por presencia de `-` en el tag name.
- **Múltiples banana-box** — Manejar `[(count)]="a" [(label)]="b"` en el mismo elemento (loop hasta que no haya más matches).
- **Archivos `.html` y templates inline** — El plugin debe procesar tanto `templateUrl: './file.html'` como `template: \`...\``.
- **No afectar otros frameworks** — El plugin solo se activa en proyectos Angular.

## Ubicación del plugin

```
integrations/angular.js  ← Plugin de esbuild (nuevo, reemplaza la necesidad de WccModel)
```

## Configuración en angular.json

Angular 17+ permite plugins de esbuild via `angular.json`:

```json
{
  "architect": {
    "build": {
      "builder": "@angular-devkit/build-angular:application",
      "options": {
        "plugins": ["./wcc-angular-plugin.mjs"]
      }
    }
  }
}
```

O como un plugin de Vite si el proyecto usa el Vite-based dev server (Angular 18+).

## Alternativa: Modificar el codegen

Otra opción es que el codegen emita el evento `countChange` de forma que Angular pueda leerlo sin `.detail`. Esto requeriría:

```js
// En vez de CustomEvent, usar un evento con el valor accesible como propiedad
const event = new CustomEvent('countChange', { detail: newVal, bubbles: true });
Object.defineProperty(event, 'target', { 
  value: { value: newVal }, 
  writable: false 
});
```

Pero esto es hacky y puede romper otros listeners. **No recomendado.**

## Archivos a modificar/crear

1. **`integrations/angular-plugin.mjs`** — Plugin de esbuild que transforma templates
2. **`framework-integrations/angular/angular.json`** — Registrar el plugin
3. **`framework-integrations/angular/src/app/app.component.ts`** — Eliminar import de `WccModel`
4. **`framework-integrations/angular/src/app/app.component.html`** — Usar `[(count)]` sin `wccModel`
5. **Tests unitarios** para el plugin de transformación

## Referencia: Cómo lo hace Vue

El `wccVuePlugin` (en `integrations/vue.js`) es un plugin de Vite con `enforce: 'pre'` que transforma `.vue` files antes de que Vue los compile. Hace exactamente lo mismo: transforma `v-model:count` en `:count` + `@wcc:model` handler.

## Estado actual (workaround)

Mientras no exista el plugin, el two-way binding funciona con la directiva `wccModel`:

```typescript
import { WccModel } from '../wcc-components/angular-adapter';

@Component({
  imports: [WccModel],
  template: `<wcc-counter wccModel [(count)]="value"></wcc-counter>`
})
```

## Prioridad

Media — El workaround funciona. El plugin es una mejora de DX.
