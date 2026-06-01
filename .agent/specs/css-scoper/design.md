# CSS Scoper — Diseño

## Enfoque: `@scope` con límites automáticos

Se reemplaza el tag-name prefixing actual por `@scope` con límites detectados del template.

### Output actual (tag prefix)

```css
wcc-card .title { color: red }
wcc-card .btn { color: blue }
```

### Output nuevo (`@scope` con límites)

```css
@scope (wcc-card) to (wcc-button, wcc-badge) {
  .title { color: red }
  .btn { color: blue }
}
```

### ¿Cómo se detectan los límites?

1. **Imports `.wcc`** → `import WccButton from './wcc-button.wcc'` → `wcc-button` es boundary
2. **Tags PascalCase en template** → `<WccBadge>` → `wcc-badge` es boundary
3. **Tags con guión detectados por tree-walker** → `<my-el>`, `<x-tooltip>` son boundaries
4. **Tags sin guión** (`div`, `span`, `h1`) → NO son boundaries

El compilador recolecta todos estos tags durante el pipeline y los pasa al css-scoper.

### Casos especiales

**Dynamic components (`<component :is="...">`):**
Se documenta que pierde aislamiento. Se puede marcar automáticamente con `data-wcc-unscoped` como escape hatch opcional.

**Sin imports `.wcc` (solo HTML plano):**
Sigue funcionando: el límite se construye de los tags detectados en el template.

## Transformación de `:host`

Con `@scope`, `:host` se reemplaza por `:scope`:

```css
/* Input */
:host { display: block }
:host(.active) { border: 2px }

/* Output */
@scope (wcc-card) to (...) {
  :scope { display: block }
  :scope(.active) { border: 2px }
}
```

## Transformación de `:host-context`

`:host-context(.dark)` es más complejo porque depende del padre. Enfoque inicial: **no implementar**. Se puede lograr con un selector CSS normal y `@scope`:

```css
/* Input */
:host-context(.dark) { background: #333 }

/* Manual — el usuario escribe en su lugar */
.dark wcc-card { background: #333 }
```

O en futura iteración, el compilador podría detectar y generar automáticamente.

## Transformación de CSS nesting (`&`)

Con `@scope`, el nesting nativo funciona sin cambios:

```css
/* Input */
.parent {
  color: red;
  & .child { color: blue }
}

/* Output */
@scope (wcc-card) to (...) {
  .parent {
    color: red;
    & .child { color: blue }
  }
}
```

`& .child` ya referencia `:scope .parent .child` — correcto.

## `splitTopLevelCommas` — fix para Bug 2

Reemplazar `split(',')` por parser que respeta paréntesis, strings y corchetes:

```js
function splitTopLevelCommas(str) {
  const parts = [];
  let depthParen = 0;
  let depthBracket = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let start = 0;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === "'" && !inDoubleQuote) inSingleQuote = !inSingleQuote;
    else if (ch === '"' && !inSingleQuote) inDoubleQuote = !inDoubleQuote;
    else if (!inSingleQuote && !inDoubleQuote) {
      if (ch === '(') depthParen++;
      else if (ch === ')') depthParen--;
      else if (ch === '[') depthBracket++;
      else if (ch === ']') depthBracket--;
      else if (ch === ',' && depthParen === 0 && depthBracket === 0) {
        parts.push(str.slice(start, i));
        start = i + 1;
      }
    }
  }
  parts.push(str.slice(start));
  return parts;
}
```

## Skip de comentarios — fix para Bug 1

Antes de leer un selector, consumir bloques `/* ... */`:

```js
function skipComments(str, i) {
  while (i < str.length - 1 && str[i] === '/' && str[i + 1] === '*') {
    const end = str.indexOf('*/', i + 2);
    if (end === -1) return str.length;
    i = end + 2;
    // skip whitespace after comment
    while (i < str.length && /\s/.test(str[i])) i++;
  }
  return i;
}
```

## `@supports` — test explícito

El código actual ya maneja `@supports` recursivamente via `consumeAtRule`, pero debe agregarse test explícito.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `lib/css-scoper.js` | Reescribir para generar `@scope` en vez de tag prefix + fixes Bug 1-2 |
| `lib/compiler.js` | Pasar lista de boundaries al css-scoper |
| `test/css-scoper.test.js` | Agregar tests para todos los casos |

**Sin cambios en:** `codegen/`, runtime, template, HTML output.
