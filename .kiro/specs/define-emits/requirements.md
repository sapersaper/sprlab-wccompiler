# Define Emits — Requisitos

## User Stories

1. Como desarrollador, quiero declarar eventos con forma genérica `defineEmits<{ (e: 'name', ...): void }>()` para type safety.
2. Como desarrollador, quiero declarar eventos con forma array `defineEmits(['name1', 'name2'])` como alternativa simple.
3. Como desarrollador, quiero emitir eventos con `emit('name', payload)` y que se despache un CustomEvent.
4. Como desarrollador, quiero errores en compile time si emito un evento no declarado.
5. Como desarrollador, quiero errores si declaro emits duplicados o con conflictos de nombres.

## Restricciones

- `defineEmits()` DEBE asignarse a una variable (`const emit = defineEmits(...)`)
- Los eventos se despachan como `CustomEvent` con `{ detail: payload, bubbles: true, composed: true }`
- El método `_emit` solo se genera si hay emits declarados
- Validación en compile time: duplicados, conflictos, emits no declarados
- La variable emit se transforma a `this._emit(` en codegen
