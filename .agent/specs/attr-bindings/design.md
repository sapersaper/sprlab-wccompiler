# Attr Bindings — Diseño

## Sintaxis en Template

```html
<div :class="{ active: isActive() }">...</div>
<div :style="{ color: textColor() }">...</div>
<button :disabled="isLoading()">Submit</button>
<a :href="url()">Link</a>
<img bind:src="imageUrl()" />
```

## Detección (tree-walker)

- Detecta atributos que empiezan con `:` o `bind:`
- Clasifica el kind:
  - `class` → kind: 'class'
  - `style` → kind: 'style'
  - Boolean attribute (de lista `BOOLEAN_ATTRIBUTES`) → kind: 'bool'
  - Otros → kind: 'attr'
- Registra `AttrBinding`: `{ varName, attr, expression, kind, path }`

## Generación de Código

### Constructor
```js
this.__attr0 = __root.childNodes[0];
```

### connectedCallback

#### kind: 'attr' (normal)
```js
__effect(() => {
  const __val = transformedExpr;
  if (__val == null || __val === false) { this.__attr0.removeAttribute('href'); }
  else { this.__attr0.setAttribute('href', __val); }
});
```

#### kind: 'bool' (boolean attribute)
```js
__effect(() => {
  this.__attr0.disabled = !!(transformedExpr);
});
```
Usa property assignment directo (no setAttribute/removeAttribute).

#### kind: 'class'

Detecta si la expresión empieza con `{` (objeto) o no (string):

**Objeto** (`{ active: isActive() }`):
```js
__effect(() => {
  const __obj = transformedExpr;
  for (const [__k, __val] of Object.entries(__obj)) {
    __val ? this.__attr0.classList.add(__k) : this.__attr0.classList.remove(__k);
  }
});
```

**String** (`myClass()`):
```js
__effect(() => {
  this.__attr0.className = transformedExpr;
});
```

#### kind: 'style'

Detecta si la expresión empieza con `{` (objeto) o no (string):

**Objeto** (`{ color: textColor() }`):
```js
__effect(() => {
  const __obj = transformedExpr;
  for (const [__k, __val] of Object.entries(__obj)) {
    this.__attr0.style[__k] = __val;
  }
});
```

**String**:
```js
__effect(() => {
  this.__attr0.style.cssText = transformedExpr;
});
```
