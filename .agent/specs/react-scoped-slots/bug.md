# BUG-0016: React scoped slots no soportan variables de estado externas

## Versión
v0.24.3

## Descripción
Los render props que solo usan los parámetros del slot (`item`, `index`) funcionan correctamente.
Pero si el render prop referencia variables de estado externas de React, el plugin falla
al serializar y **descarta el render prop completo**.

## Reproducción

```jsx
// ✅ Funciona — solo usa parámetros del slot
<wcc-list renderItem={(item) => <li>★ {item}</li>} />

// ❌ No funciona — usa reactMessage (estado externo)
function Test() {
  const [msg] = useState('hello')
  return <wcc-list renderItem={(item) => <li>{item} ({msg})</li>} />
}
```

DOM resultante: `{{item}}` literal (default content).

## Causa raíz

`integrations/react.js` línea 802-807:

```js
const renderWarnings = []
serializeJsxToHtml(classification.body, classification.params, renderWarnings)
if (renderWarnings.length > 0) {
    pluginCtx.warn(...)
    remainingAttributes.push(attr)
    continue  // ← descarta el render prop
}
```

`serializeJsxToHtml` no puede serializar `reactMessage` (variable externa) → warning → skip.

## Posible solución

Para variables externas, mantener la expresión como texto literal en el slot HTML.
En lugar de descartar, generar un placeholder que el runtime de WCC pueda evaluar.

**Archivo:** `integrations/react.js` — `serializeJsxToHtml`
