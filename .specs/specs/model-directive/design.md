# Model Directive — Diseño

## Sintaxis en Template

```html
<input model="name" />
<input type="checkbox" model="checked" />
<input type="radio" model="selected" value="a" />
<input type="number" model="count" />
<textarea model="text"></textarea>
<select model="choice">...</select>
```

## Detección (tree-walker)

- Detecta atributo `model` en elementos
- Valida que el elemento sea `<input>`, `<textarea>`, o `<select>`
- Valida que el valor sea un identificador válido
- Determina `prop`, `event`, `coerce`, `radioValue` según tag y type:
  - `select` → prop: 'value', event: 'change'
  - `textarea` → prop: 'value', event: 'input'
  - `checkbox` → prop: 'checked', event: 'change'
  - `radio` → prop: 'checked', event: 'change', radioValue: attr value
  - `number` → prop: 'value', event: 'input', coerce: true
  - default → prop: 'value', event: 'input'

## Validaciones (compiler.js)

- `MODEL_READONLY`: no puede bindear a prop, computed, o constante
- `MODEL_UNKNOWN_VAR`: el signal referenciado debe existir

## Generación de Código

### Constructor
```js
this.__model0 = __root.childNodes[0];
```

### connectedCallback
```js
// Text input:
__effect(() => { this.__model0.value = this._name() ?? ''; });
this.__model0.addEventListener('input', (e) => { this._name(e.target.value); });

// Checkbox:
__effect(() => { this.__model0.checked = !!this._checked(); });
this.__model0.addEventListener('change', (e) => { this._checked(e.target.checked); });

// Radio:
__effect(() => { this.__model0.checked = (this._selected() === 'a'); });
this.__model0.addEventListener('change', (e) => { this._selected(e.target.value); });

// Number:
__effect(() => { this.__model0.value = this._count() ?? ''; });
this.__model0.addEventListener('input', (e) => { this._count(Number(e.target.value)); });
```
