# Documento de Diseño

## Visión General

Plugin de esbuild para Angular que transforma la sintaxis banana-box `[(prop)]="expr"` en custom elements WCC durante el build, eliminando la necesidad de la directiva `WccModel`. El plugin intercepta archivos `.html` y `.ts` antes de la compilación AOT y reescribe los bindings para extraer `$event.detail` correctamente, logrando two-way binding zero-config.

El patrón a seguir es el plugin de Vue (`integrations/vue.js`), que es un plugin de Vite con `enforce: 'pre'` que transforma archivos `.vue` antes de que el compilador de Vue los procese. El equivalente Angular es un plugin de esbuild que transforma `.html` y `.ts` antes del compilador AOT.

## Arquitectura

### Pipeline de Build de Angular

Angular 17+ usa esbuild internamente a través de `@angular-devkit/build-angular:application`. Este builder acepta plugins de esbuild personalizados via `angular.json`:

```
angular.json → architect.build.options.plugins → ["./path/to/plugin.mjs"]
```

El plugin se ejecuta en la fase de carga (`onLoad`) del pipeline de esbuild, interceptando archivos antes de que el compilador AOT de Angular los analice:

```
Archivo .html/.ts → Plugin esbuild (transformación) → Compilador AOT Angular → Bundle final
```

### Diagrama de Flujo

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  esbuild load   │────▶│  wcc-angular-plugin  │────▶│  Angular AOT    │
│  (.html / .ts)  │     │  (regex transform)   │     │  compiler       │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
                                   │
                         ┌─────────┴─────────┐
                         │                   │
                    .html files         .ts files
                    (transform          (detectar template:
                     completo)           y transformar string)
```

## Algoritmo Central

### Función de Transformación

La función `transformBananaBox(content)` aplica la siguiente transformación mediante regex:

**Input:**
```html
<wcc-counter [(count)]="modelCount"></wcc-counter>
```

**Output:**
```html
<wcc-counter [count]="modelCount" (countChange)="modelCount = $any($event).detail"></wcc-counter>
```

### Regex Principal

```js
/(<[\w]+-[\w-]*(?:\s[^>]*?)?)\[\((\w+)\)\]="([^"]+)"/g
```

Donde:
- Grupo 1: `(<[\w]+-[\w-]*(?:\s[^>]*?)?)` — Tag de custom element (con `-`) y atributos previos
- Grupo 2: `(\w+)` — Nombre de la propiedad dentro de `[()]`
- Grupo 3: `([^"]+)` — Expresión del binding

**Reemplazo:**
```js
'$1[$2]="$3" ($2Change)="$3 = $any($event).detail"'
```

### Reglas de Exclusión

1. **Elementos nativos** — La regex solo matchea tags con guión (`[\w]+-[\w-]*`), por lo que `<input [(ngModel)]>` no se transforma.
2. **`[(ngModel)]`** — Se excluye explícitamente antes de aplicar la regex, verificando que la propiedad capturada no sea `ngModel`.
3. **Múltiples banana-box** — Se aplica la regex en un loop hasta que no haya más matches (mismo patrón que el plugin de Vue).

### Manejo de Múltiples Bindings

```html
<!-- Input -->
<wcc-counter [(count)]="a" [(label)]="b"></wcc-counter>

<!-- Output (después de 2 iteraciones) -->
<wcc-counter [count]="a" (countChange)="a = $any($event).detail" [label]="b" (labelChange)="b = $any($event).detail"></wcc-counter>
```

## Estructura de Archivos

```
sprlab-wc/
├── integrations/
│   ├── vue.js              ← Plugin Vite existente para Vue
│   ├── react.js            ← Plugin existente para React
│   └── angular-plugin.js   ← NUEVO: Plugin esbuild para Angular
├── framework-integrations/
│   └── angular/
│       ├── angular.json    ← Registrar plugin aquí
│       └── src/app/
│           ├── app.component.ts   ← Eliminar import WccModel
│           └── app.component.html ← Usar [()] sin wccModel
└── bin/
    └── wcc.js              ← Agregar copia del plugin
```

## Puntos de Integración

### 1. Registro en `angular.json`

Agregar la referencia al plugin en la configuración del builder:

```json
{
  "architect": {
    "build": {
      "builder": "@angular-devkit/build-angular:application",
      "options": {
        "plugins": ["./src/wcc-components/angular-plugin.js"]
      }
    }
  }
}
```

El plugin se copia al directorio `src/wcc-components/` del proyecto Angular junto con el adapter existente.

### 2. Copia via CLI (`bin/wcc.js`)

La función `copyIntegrationPlugin` en `bin/wcc.js` debe incluir el nuevo archivo:

```js
angular: [
  { src: join(rootDir, 'adapters/angular-compiled/angular.js'), dest: 'angular-adapter.js' },
  { src: join(rootDir, 'adapters/angular-compiled/angular.d.ts'), dest: 'angular-adapter.d.ts' },
  { src: join(rootDir, 'integrations/angular-plugin.js'), dest: 'angular-plugin.js' },  // NUEVO
],
```

### 3. Coexistencia con `WccModel`

El plugin y la directiva `WccModel` pueden coexistir sin conflictos:
- Si el plugin está activo, transforma `[(prop)]` antes de que Angular lo vea → la directiva `wccModel` no es necesaria.
- Si el plugin NO está registrado, la directiva `WccModel` sigue funcionando como fallback.
- Si ambos están presentes, el plugin transforma el binding y la directiva simplemente no encuentra `[(prop)]` que procesar (ya fue expandido).

## Procesamiento de Templates

### Templates Externos (`.html`)

El plugin filtra archivos por extensión `.html` en el hook `onLoad` de esbuild:

```js
build.onLoad({ filter: /\.html$/ }, async (args) => {
  const content = await fs.readFile(args.path, 'utf8');
  const transformed = transformBananaBox(content);
  if (transformed === content) return null; // sin cambios
  return { contents: transformed, loader: 'text' };
});
```

### Templates Inline (`.ts`)

Para archivos `.ts`, el plugin detecta la propiedad `template:` y transforma solo el contenido del string:

```js
build.onLoad({ filter: /\.ts$/ }, async (args) => {
  const content = await fs.readFile(args.path, 'utf8');
  // Detectar template: `...` o template: '...' o template: "..."
  const templateRegex = /template\s*:\s*(`[^`]*`|'[^']*'|"[^"]*")/g;
  let result = content;
  let match;
  while ((match = templateRegex.exec(content)) !== null) {
    const templateStr = match[1].slice(1, -1); // quitar delimitadores
    const transformed = transformBananaBox(templateStr);
    if (transformed !== templateStr) {
      result = result.replace(match[1], match[1][0] + transformed + match[1][0]);
    }
  }
  if (result === content) return null;
  return { contents: result, loader: 'ts' };
});
```

## Estrategia de Testing

### Tests Unitarios

La función `transformBananaBox` es pura (string → string), lo que permite testearla en aislamiento:

```js
// tests/angular-plugin.test.js
describe('transformBananaBox', () => {
  test('transforma banana-box en custom element');
  test('NO transforma en elementos nativos');
  test('NO transforma [(ngModel)]');
  test('maneja múltiples banana-box en mismo elemento');
  test('preserva atributos existentes');
  test('retorna sin cambios si no hay banana-box');
  test('maneja expresiones complejas en el binding');
});
```

### Test de Integración

Verificar que la app Angular de test (`framework-integrations/angular/`) compila y funciona correctamente con el plugin activo y sin la directiva `WccModel`.

## Correctness Properties

1. Para todo template con banana-box en custom elements, la transformación produce un template Angular sintácticamente válido.
2. La transformación es idempotente: aplicarla dos veces produce el mismo resultado que aplicarla una vez (el output no contiene `[()]`).
3. Para todo template sin banana-box en custom elements, la función retorna el input sin modificaciones.
4. El nombre del evento generado siempre es `{prop}Change` (propiedad + sufijo "Change").
5. La expresión del binding se preserva exactamente en ambos lados del output (property binding y event handler).
