# Define Props — Tasks

- [x] Implementar `extractPropsGeneric` (forma TypeScript con generics)
- [x] Implementar `extractPropsArray` (forma array simple)
- [x] Implementar `extractPropsDefaults` con depth counting
- [x] Implementar `extractPropsObjectName`
- [x] Implementar `camelToKebab` para conversión de attr names
- [x] Generar `static get observedAttributes()` en la clase
- [x] Generar inicialización de prop signals en constructor
- [x] Generar `attributeChangedCallback` con mapeo y coerción (boolean, number, string, undefined)
- [x] Generar public getters/setters (`get propName()` / `set propName(val)`)
- [x] Transformar `props.x` → `this._s_x()` en codegen
- [x] Transformar bare prop names en template expressions
- [x] Implementar `validateDuplicateProps`
- [x] Implementar `validatePropsConflicts`
- [x] Soportar props sin asignación a variable
- [x] Tests: extracción genérica, array, defaults
- [x] Tests: codegen con props (observedAttributes, attributeChangedCallback)
- [x] Tests: validaciones (duplicados, conflictos)
