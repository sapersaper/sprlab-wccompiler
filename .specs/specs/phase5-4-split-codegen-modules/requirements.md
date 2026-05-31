# Requirements: split-codegen-modules

## Overview

Split the remaining ~2044 lines of `lib/codegen.js` into focused modules under `lib/codegen/`,
leaving `generateComponent` as a thin orchestrator in `lib/codegen/index.js`.

## Modules to create

| File | Extracted from codegen.js | Approx lines |
|------|--------------------------|--------------|
| `lib/codegen/event-generator.js` | `generateEventHandler`, `generateForEventHandler` | ~60 |
| `lib/codegen/preamble.js` | Source comment, runtime, imports, CSS, template, findAnchor | ~90 |
| `lib/codegen/constructor.js` | Constructor + Proxy + batch + watchers init | ~180 |
| `lib/codegen/connected-callback.js` | DOM setup, slot resolution, render inicial, event listeners | ~450 |
| `lib/codegen/invalidate.js` | `__invalidate(key)` method generation | ~120 |
| `lib/codegen/render-methods.js` | `__renderIf_N`, `__renderEach_N`, `__renderDynamic_N`, if setup methods | ~300 |
| `lib/codegen/class-methods.js` | User methods, model wrappers, expose, refs, emit, attributeChanged | ~200 |
| `lib/codegen/index.js` | `generateComponent` orchestrator (imports all above) | ~80 |

## Acceptance

- All 1307 tests pass
- `generateComponent` is ~80 lines of pure orchestration
- Each new module exports exactly one main function
