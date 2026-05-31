# CLI & Tooling — Requisitos

## User Stories

1. Como desarrollador, quiero ejecutar `wcc build` para compilar todos los archivos .wcc del directorio `input` al directorio `output`.
2. Como desarrollador, quiero ejecutar `wcc dev` para compilar, iniciar un dev server con live-reload, y watch de cambios.
3. Como desarrollador, quiero configurar port, input y output en `wcc.config.js`.
4. Como desarrollador, quiero que el dev server inyecte SSE (Server-Sent Events) para live-reload automático.
5. Como desarrollador, quiero que `wcc-runtime.js` se copie al output para uso opcional como helper de bindings declarativos.

## Restricciones

- CLI: dos comandos (`build`, `dev`)
- Config: `wcc.config.js` con defaults `{ port: 4100, input: 'src', output: 'dist' }`
- Dev server: HTTP estático + SSE en `/__sse` + inyección de snippet en HTML
- Watch: solo archivos `.wcc`, `.ts`, `.js` (excluye `.test.`)
- wcc-runtime.js: helper opcional (no requerido para que los componentes funcionen)
