# Signals — Tasks

- [x] Implementar `__signal(initial)` con getter/setter y subscriber tracking
- [x] Implementar `__computed(fn)` con lazy evaluation y dirty tracking
- [x] Implementar `__effect(fn)` con auto-tracking y cleanup support
- [x] Implementar `__batch(fn)` con depth counting y flush de pending effects
- [x] Implementar `extractSignals` con depth counting para argumentos complejos
- [x] Implementar `extractComputeds` con depth counting para expresiones
- [x] Implementar `extractEffects` con brace depth tracking multi-línea
- [x] Implementar `extractConstants` excluyendo reactive calls
- [x] Transformar signal reads (`name()` → `this._name()`) en codegen
- [x] Transformar signal writes (`name.set(v)` → `this._name(v)`) en codegen
- [x] Transformar computed reads (`name()` → `this._c_name()`) en codegen
- [x] Transformar constants (`name` → `this._const_name`) en codegen
- [x] Generar inicialización de signals en constructor
- [x] Generar inicialización de computeds en constructor
- [x] Generar effects en connectedCallback
- [x] Tests: reactive runtime (signal read/write, computed, effect, batch)
- [x] Tests: extracción de signals, computeds, effects, constants
- [x] Tests: transformación de expresiones en codegen
