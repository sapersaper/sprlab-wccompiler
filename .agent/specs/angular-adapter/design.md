# Angular adapter — Diseño

## Problema

El Angular adapter (`angular-adapter.js`) usa `registerSlotRenderer()` para scoped slots,
pero el WCC runtime actual implementa scoped slots vía `__slotTpl_name` + `__slotMap`.

## Flujo actual del adapter (roto)

```
ngAfterContentInit()
  → classifyAndInitSlots()
    → customElements.whenDefined(tagName)  ← espera que el CE exista
    → registerSlotRenderer(name, renderer)  ← ❌ no existe en runtime BUG-0012
```

## Flujo nuevo propuesto

```
ngAfterContentInit()
  → classifyAndInitSlots()
    → customElements.whenDefined(tagName)   ← espera que el CE exista
    → for scoped slots:
        element.__slotTpl_name = content    ← almacena template como string
        element._state.items = ...          ← fuerza re-render
    → for named slots:
        element.innerHTML = ...             ← igual que hoy (funciona)
```

## Cambios en el adapter

### `classifyAndInitSlots()`

Actualmente:
```ts
await customElements.whenDefined(tagName);
const element = hostEl;
const scopedNames = element.__scopedSlots || [];
for (const slotDef of this.slotDefs) {
    if (scopedNames.includes(slotDef.slotName)) {
        this.initScopedSlot(slotDef);  // → registerSlotRenderer
    }
}
```

Nuevo:
```ts
await customElements.whenDefined(tagName);
const element = hostEl;
const scopedNames = element.__scopedSlots || [];
for (const slotDef of this.slotDefs) {
    if (scopedNames.includes(slotDef.slotName)) {
        this.initScopedSlotNew(slotDef);
    } else {
        this.initNamedSlot(slotDef);  // ← sin cambios
    }
}
```

### `initScopedSlotNew(slotDef)`

```ts
initScopedSlotNew(slotDef) {
    const hostEl = this.el.nativeElement;
    // Render the template with empty context to get the HTML
    const context = {};
    const embeddedView = this.viewContainer.createEmbeddedView(slotDef.templateRef, context);
    this.changeDetector.detectChanges();
    const html = embeddedView.rootNodes
        .map(n => n.outerHTML || n.textContent || '')
        .join('');
    embeddedView.destroy();

    // Store the template in the WCC slot system
    hostEl['__slotTpl_' + slotDef.slotName] = html;

    // Wait for microtask then re-render (Angular neaeds a tick to project)
    queueMicrotask(() => {
        if (typeof hostEl.__renderEach_0 === 'function') {
            hostEl.__renderEach_0();
        } else {
            hostEl.__invalidate('*');
        }
    });
}
```

### `renderSlot(slotName, props)` (nuevo — reemplaza registerSlotRenderer)

```ts
renderSlot(slotName, props) {
    const slotDef = this.slotDefs.find(s => s.slotName === slotName);
    if (!slotDef) return '';
    const context = {};
    // Map slot-to-item variables
    if (slotDef.templateRef.createEmbeddedView) {
        const params = slotDef.params || [];
        for (const param of params) {
            if (props[param] !== undefined) {
                context[`\${'$implicit'}`] = props[param];
            }
        }
    }
    // ... render and return HTML
}
```

## Timing

El `queueMicrotask` en `initScopedSlotNew` garantiza que el WCC runtime ya esté listo
para recibir el slot content. Esto reemplaza la dependencia del `connected-callback.js`
deferred retry.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `framework-integrations/angular/src/wcc-components/angular-adapter.js` | `initScopedSlot` → `initScopedSlotNew` + `renderSlot` |
| `framework-integrations/e2e/fixtures/angular.spec.js` | Ajustar tests si es necesario |
