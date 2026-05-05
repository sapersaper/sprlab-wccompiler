# Nested Components — Diseño

## Sintaxis en Template

```html
<wcc-badge label="{{name}}"></wcc-badge>
<wcc-profile :avatar="avatarUrl()"></wcc-profile>
```

## Detección (tree-walker)

- Detecta elementos con tag name que contiene hyphen (custom elements)
- Excluye el tag del componente actual
- Busca atributos con `{{interpolation}}` en el valor
- Registra `ChildComponentBinding`: `{ tag, varName, path, propBindings }`
- `ChildPropBinding`: `{ attr, expr, type }`

## Resolución de Imports (`resolveChildComponent`)

- Busca archivo en el directorio del parent: `${tag}.wcc`, `${tag}.js`, `${tag}.ts`
- Retorna path relativo: `./${tag}.js`
- Si no encuentra → warning (no error)

## Generación de Código

### Imports
```js
import './wcc-badge.js';
import './wcc-profile.js';
```

### Constructor
```js
this.__child0 = __root.childNodes[0];
```

### connectedCallback
```js
// Para cada prop binding reactivo:
__effect(() => {
  this.__child0.setAttribute('label', this._name() ?? '');
});
```

## Prop Binding Types

- `type: 'signal'` → `this._name()`
- `type: 'computed'` → `this._c_name()`
- `type: 'prop'` → `this._s_name()`
- `type: 'method'` → `this._name()`
