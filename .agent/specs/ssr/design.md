# SSR — Diseño

## Arquitectura

El compilador genera **dos artefactos** del mismo `.wcc`:

```
wcc-card.wcc  →  wcc-card.js           (Custom Element — sin cambios)
              →  wcc-card.ssr.js        (renderToString — nuevo)
```

El `.js` del browser recibe un cambio mínimo: `connectedCallback` adopta DOM existente si detecta SSR.

## Hidratación — el cambio clave en el browser

### Comportamiento actual

```js
connectedCallback() {
  if (this.__connected) return;
  this.__connected = true;
  const __root = __t_WccCard.content.cloneNode(true);
  this.innerHTML = '';
  this.appendChild(__root);
  // ... bindings, eventos, effects
}
```

### Comportamiento con SSR

```js
connectedCallback() {
  if (this.__connected) return;
  this.__connected = true;

  if (this.children.length > 0) {
    // SSR: el HTML ya está en el DOM, lo adoptamos
    // Los bindings/eventos se atan igual, pero no se clona el template
    this.__ssrReady = true;
    this.__invalidate('*');
    return;
  }

  // Sin SSR: clonar template (comportamiento normal)
  const __root = __t_WccCard.content.cloneNode(true);
  this.innerHTML = '';
  this.appendChild(__root);
  // ...
}
```

El flag `__ssrReady` le indica a `__invalidate` que las referencias DOM (`this.__text0`, `this.__attr_class_0`, etc.) pueden no existir y deben crearse escaneando el DOM servido.

**Simplificación:** en SSR, después de `__invalidate('*')`, los caminos DOM se resuelven igual porque `__invalidate` ya actualiza nodos vía `this.__text0.textContent = ...`. La diferencia es que esos nodos (`__text0`) están en el HTML servido en vez de en el template clonado. Como el HTML servido tiene la misma estructura, los paths `childNodes[N]` coinciden.

### Alternativa más simple aún

Si el HTML servido replica exactamente la estructura del template, los `childNodes[N]` paths del template coinciden perfectamente con el DOM servido. No se necesita `__ssrReady`. Solo se salta el clone + append.

## Output del servidor (`wcc-card.ssr.js`)

```js
// Generated from: wcc-card.wcc (wcCompiler — SSR renderer)
// Zero dependencies — runs in any JS environment without DOM

const __css = `wcc-card .card { border: 1px solid #ccc; }`;

export function renderToString(props = {}, state = {}) {
  const title = props.title ?? 'Default';
  const count = state.count ?? 0;
  const items = state.items ?? [];

  const __each0 = (items || [])
    .map(item => `<li>${__esc(item)}</li>`)
    .join('');

  const __attrs = title ? ` title="${__esc(title)}"` : '';

  return `<wcc-card${__attrs}>
  <style>${__css}</style>
  <div class="card">
    <h2>${__esc(title)}</h2>
    <p>Count: ${__esc(String(count))}</p>
    <ul>${__each0}</ul>
  </div>
</wcc-card>`;
}

function __esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

## Cómo reutiliza el `parseResult` existente

| `parseResult` field | Uso en SSR |
|---|---|
| `tagName` | Tag del elemento raíz |
| `className` | No se usa |
| `propDefs` | Genera parámetros de props con defaults |
| `signals` | Genera parámetros de state con defaults |
| `style` | CSS scopeado via `scopeCSS()` |
| `processedTemplate` | Template base para estructura HTML |
| `bindings` | `{{expr}}` → interpolación con `__esc()` |
| `ifBlocks` | `if` → condicional ternario |
| `forBlocks` | `each` → `.map()` |
| `showBindings` | `show` → `style="display:none"` inline condicional |
| `attrBindings` | `:attr` → atributo HTML inline |
| `childComponents` | Para Phase 3 (composición recursiva) |

## Lo que NO se genera en SSR

- `constructor()` — sin Proxy, sin estado reactivo
- `__invalidate()` — sin dependency graph
- Event listeners — sin `addEventListener`
- Efectos — sin `effect()`
- `watch()` — sin watchers

## CLI

```bash
wcc build --ssr
# Genera .js + .ssr.js para cada .wcc

wcc build --ssr --minify
# También minifica el .ssr.js
```

## Fases

| Fase | Qué cubre | Archivos nuevos |
|---|---|---|
| **SSR-1** | Props, texto, CSS, `:attr`, `:class`, `:style` | `lib/codegen/ssr.js` |
| **SSR-2** | `if`, `each`, `show` | mismo archivo |
| **SSR-3** | Hidratación en `connectedCallback` + child components | `lib/codegen/connected-callback.js` (mod) |
