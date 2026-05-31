# CLI & Tooling — Diseño

## CLI (`bin/wcc.js`)

### `wcc build`
1. Carga config con `loadConfig(cwd)`
2. Genera `__wcc-signals.js` en el output (runtime compartido)
3. Descubre archivos .wcc recursivamente en `config.input`
4. Compila cada archivo con `compile(filePath, { runtimeImportPath })`
5. Cada componente importa del runtime compartido (path relativo calculado)
6. Escribe output en `config.output` (preserva estructura de directorios)
7. Copia `wcc-runtime.js` al output
8. Exit code 1 si hay errores

### `wcc dev`
1. Ejecuta build inicial
2. Inicia dev server con `startDevServer({ port, root, outputDir })`
3. Watch del directorio input con `fs.watch` (recursive)
4. Re-compila archivos modificados (.wcc, .ts, .js)
5. El dev server notifica a los clientes SSE para reload

## Config (`lib/config.js`)

```js
export async function loadConfig(projectRoot) → WccConfig
```

- Busca `wcc.config.js` en el root del proyecto
- Retorna defaults si no existe: `{ port: 4100, input: 'src', output: 'dist' }`
- Importa dinámicamente con cache-busting (`?t=Date.now()`)
- Valida: port (número finito), input (string no vacío), output (string no vacío)
- Error code: `INVALID_CONFIG`

## Dev Server (`lib/dev-server.js`)

```js
export function startDevServer({ port, root, outputDir }) → DevServerHandle
```

- HTTP server con archivos estáticos
- MIME types para .html, .js, .css, .json, .png, .jpg, .svg, .ico
- Endpoint `/__sse`: Server-Sent Events para live-reload
- Inyecta snippet SSE en archivos HTML (antes de `</body>`)
- Watch del `outputDir` con debounce (200ms) → notifica clientes SSE
- `DevServerHandle.close()`: cierra conexiones SSE, watcher, y server

## WCC Runtime (`lib/wcc-runtime.js`)

Helper opcional para consumidores de componentes wcc:
- `init(initialState)` — bindea `:prop` y `@event` attributes en el DOM
- `set(key, value)` — actualiza estado y notifica listeners
- `get(key)` — lee valor actual
- `on(name, fn)` — registra event handler por nombre

No es requerido — los componentes son 100% nativos sin él.
