# TypeScript Support — Diseño

## Detección

- En modo SFC: `<script lang="ts">` → `descriptor.lang === 'ts'`
- En modo multi-archivo: extensión `.ts` del archivo fuente

## Pipeline

1. Extraer props/emits de generics (ANTES de strip) — los generics se pierden con esbuild
2. `stripTypes(source)` → JavaScript sin type annotations
3. Continuar pipeline normal con el JS resultante

## Type Stripping (`parser.js → stripTypes`)

```js
import { transform } from 'esbuild';

export async function stripTypes(tsCode) {
  const result = await transform(tsCode, {
    loader: 'ts',
    target: 'esnext',
    sourcemap: false,
  });
  return result.code;
}
```

- Usa esbuild para máxima velocidad
- `target: 'esnext'` preserva toda la sintaxis JS moderna
- No genera sourcemaps (el output es autocontenido)
- Errores de sintaxis se wrappean con code `TS_SYNTAX_ERROR`

## Soporte de Features TypeScript

- Interfaces y type aliases → stripeados
- Generics en defineProps/defineEmits → extraídos antes del strip
- Type annotations en variables y funciones → stripeados
- Enums → transformados por esbuild
- `as` casts → stripeados
