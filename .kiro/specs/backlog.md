# Backlog — Features pendientes

## 1. ~~`expose()` — Declarar variables/funciones usadas en el template~~ ✅ Implementado como `templateBindings()`

Implementado el 2026-04-30. La macro se llama `templateBindings()` en lugar de `expose()` para dejar claro que las variables van hacia el template.

---

## 2. Nombre del paquete npm vs módulo `'wcc'`

**Problema:** El paquete se publica como `@sprlab/wccompiler` pero el módulo TypeScript se declara como `'wcc'`. Cuando se usa `link:..` para desarrollo local, TypeScript no resuelve `import { ... } from 'wcc'` automáticamente porque el nombre del paquete no coincide.

**Workaround actual:** El ejemplo usa un `jsconfig.json` con `paths`:
```json
{
  "paths": {
    "wcc": ["./node_modules/wccompiler/types/wcc.d.ts"]
  }
}
```

**Nota:** Esto NO afecta a usuarios que instalan desde npm — solo al desarrollo local con `link:`. Cuando se instala normalmente, TypeScript encuentra el `declare module 'wcc'` automáticamente.

**Posibles soluciones:**
- Renombrar el paquete a `wcc` o `@sprlab/wcc` en npm
- Agregar `typesVersions` en `package.json` para mapear `wcc`
- Dejarlo como está (solo afecta dev local)

**Prioridad:** Baja — solo afecta al desarrollo del compilador, no a los usuarios.
