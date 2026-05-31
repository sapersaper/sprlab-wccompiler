# Model Directive — Requisitos

## User Stories

1. Como desarrollador, quiero usar `model="signalName"` en inputs para two-way binding.
2. Como desarrollador, quiero que model funcione en `<input>`, `<textarea>` y `<select>`.
3. Como desarrollador, quiero que checkboxes bindeen a `checked` (boolean).
4. Como desarrollador, quiero que radio buttons bindeen al `value` del radio seleccionado.
5. Como desarrollador, quiero que inputs `type="number"` coercionen el valor a Number.
6. Como desarrollador, quiero errores si model bindea a un prop, computed, o constante (read-only).
7. Como desarrollador, quiero errores si model referencia una variable no declarada.

## Relación con otros specs

> **Nota:** Este spec cubre exclusivamente `model="signal"` en elementos HTML nativos de formulario. La funcionalidad de props bidireccionales en componentes (`defineModel()`) y el binding WCC-to-WCC (`model:propName="signal"`) están documentados en el spec separado `define-model`. Ambos coexisten sin conflicto — ver Requirement 10 en `define-model` para los detalles de interacción.

## Restricciones

- Solo válido en `<input>`, `<textarea>`, `<select>`
- El target debe ser un signal (no prop, computed, ni constante)
- El valor del model debe ser un identificador válido
- Checkbox: bindea `checked` (boolean), event `change`
- Radio: bindea `checked` comparando con `value` attr, event `change`
- Number input: coerción `Number(e.target.value)`
- Text/textarea: bindea `value`, event `input`
- Select: bindea `value`, event `change`
