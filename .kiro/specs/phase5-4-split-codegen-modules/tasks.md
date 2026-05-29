# Tasks: phase5-4-split-codegen-modules

- [ ] 1. Create `lib/codegen/event-generator.js` — extract `generateEventHandler`, `generateForEventHandler`
- [ ] 2. Create `lib/codegen/preamble.js` — extract preamble generation (source comment, runtime, imports, CSS, template, findAnchor)
- [ ] 3. Create `lib/codegen/constructor.js` — extract constructor generation (Proxy, batch, watchers init)
- [ ] 4. Create `lib/codegen/connected-callback.js` — extract connectedCallback (DOM setup, slots, events)
- [ ] 5. Create `lib/codegen/invalidate.js` — extract __invalidate method generation
- [ ] 6. Create `lib/codegen/render-methods.js` — extract __renderIf/Each/Dynamic + if setup methods
- [ ] 7. Create `lib/codegen/class-methods.js` — extract user methods, model wrappers, expose, refs, emit, attributeChanged
- [ ] 8. Create `lib/codegen/index.js` — create new `generateComponent` orchestrator importing all modules
- [ ] 9. Replace `lib/codegen.js` with re-export shim → `lib/codegen/index.js`
- [ ] 10. `npm test` — all 1307+ tests pass
