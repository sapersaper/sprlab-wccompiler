# Slots — Diseño

## Sintaxis en Template (componente)

```html
<!-- Default slot -->
<slot>Fallback content</slot>

<!-- Named slot -->
<slot name="header">Default header</slot>

<!-- Scoped slot -->
<slot name="item" :data="currentItem">{{data}}</slot>
```

## Sintaxis del Consumidor

```html
<my-component>
  <!-- Default slot content -->
  <p>Hello</p>
  
  <!-- Named slot -->
  <template #header>Custom Header</template>
  
  <!-- Scoped slot -->
  <template #item="{ data }">Item: {{data}}</template>
</my-component>
```

## Detección (tree-walker)

- Detecta elementos `<slot>`
- Extrae `name` attribute ('' para default)
- Extrae fallback content (innerHTML)
- Extrae `:prop="expr"` attributes como slot props
- Reemplaza `<slot>` con `<span data-slot="name">`
- Registra `SlotBinding`: `{ varName, name, path, defaultContent, slotProps }`

## Generación de Código

### Constructor
```js
// Leer childNodes ANTES de limpiar innerHTML
const __slotMap = {};
const __defaultSlotNodes = [];
for (const child of Array.from(this.childNodes)) {
  if (child.nodeName === 'TEMPLATE') {
    for (const attr of child.attributes) {
      if (attr.name.startsWith('#')) {
        const slotName = attr.name.slice(1);
        __slotMap[slotName] = { content: child.innerHTML, propsExpr: attr.value };
      }
    }
  } else if (child.nodeType === 1 || (child.nodeType === 3 && child.textContent.trim())) {
    __defaultSlotNodes.push(child);
  }
}

// Después de appendChild:
// Default slot:
if (__defaultSlotNodes.length) { this.__s0.textContent = ''; __defaultSlotNodes.forEach(n => this.__s0.appendChild(n.cloneNode(true))); }

// Named slot:
if (__slotMap['header']) { this.__s1.innerHTML = __slotMap['header'].content; }

// Scoped slot: store template for reactive effect
if (__slotMap['item']) { this.__slotTpl_item = __slotMap['item'].content; }
```

### connectedCallback (scoped slots)
```js
if (this.__slotTpl_item) {
  __effect(() => {
    let __h = this.__slotTpl_item;
    const __sp = { data: this._currentItem() };
    for (const [k, v] of Object.entries(__sp)) {
      __h = __h.replace(new RegExp('\\{\\{\\s*' + k + '\\s*\\}\\}', 'g'), v ?? '');
    }
    this.__s2.innerHTML = __h;
  });
}
```
