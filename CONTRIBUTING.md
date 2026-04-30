# Contributing — wcCompiler Development Guide

## Prerequisites

- Node.js 24+
- Yarn 4 (via Volta or Corepack)

## Setup

```bash
git clone <repo-url>
cd sprlab-wc
yarn install
```

## Project Structure

```
├── bin/wcc.js          # CLI entry point
├── lib/                # Compiler source (parser, tree-walker, codegen, compiler)
│   ├── parser.js       # Parses .ts/.js source files into IR
│   ├── tree-walker.js  # Walks jsdom DOM to discover bindings/events/directives
│   ├── codegen.js      # Generates self-contained JS from IR
│   ├── compiler.js     # Orchestrates the full pipeline
│   ├── css-scoper.js   # Prefixes CSS selectors with tag name
│   ├── reactive-runtime.js  # Inline signal/computed/effect runtime
│   ├── wcc-runtime.js  # Optional host-page binding helper
│   ├── config.js       # wcc.config.js loader
│   ├── dev-server.js   # Dev server with live-reload
│   ├── printer.js      # Pretty-printer for round-trip testing
│   └── *.test.js       # Tests (vitest + fast-check)
├── types/wcc.d.ts      # TypeScript declarations for 'wcc' module
├── example/            # Showcase app with all features
│   ├── src/            # Component source files (.js, .ts, .html, .css)
│   ├── dist/           # Compiled output (gitignored)
│   ├── index.html      # Host page
│   └── wcc.config.js   # Example config
├── .kiro/specs/        # Feature specifications
└── FEATURES.md         # Complete feature reference
```

## Running Tests

```bash
yarn test              # Run all 431 tests
yarn test lib/parser   # Run specific test file
```

Tests use vitest with fast-check for property-based testing. Each feature has:
- Property tests (universal correctness across random inputs)
- Unit tests (specific examples and edge cases)
- Integration tests (end-to-end compilation)

## Running the Example

```bash
cd example
yarn install
yarn build    # Compile all components
yarn dev      # Build + watch + dev server at http://localhost:4200
```

The example showcases every feature:

| Component | Features |
|---|---|
| `wcc-counter` | signal, computed, defineProps, defineEmits, @event, TypeScript |
| `wcc-form` | model (text, number, checkbox, radio, select, textarea) |
| `wcc-conditional` | if/else-if/else, show, :class, :style |
| `wcc-list` | each, :key, @event in loop, :attr binding |
| `wcc-card` | default slot, named slot, scoped slot, fallback content |
| `wcc-lifecycle` | onMount, onDestroy, templateRef, defineProps |
| `wcc-typescript` | TypeScript generics, interfaces, defineProps\<T\>, defineEmits\<T\> |

## Compilation Pipeline

```
Source (.ts/.js) → Parser → IR (ParseResult)
                                    ↓
Template (.html) → jsdom DOM → Tree Walker → bindings, events, directives
                                    ↓
                              Code Generator → self-contained .js
```

1. **Parser** reads the source file, strips macro imports and TS types, extracts `defineComponent`, signals, computeds, effects, functions, props, emits, lifecycle hooks, refs, constants
2. **Tree Walker** walks the jsdom DOM to discover `{{interpolation}}`, `@event`, `if/else-if/else`, `each`, `show`, `model`, `:attr`, `<slot>`, `ref` — replaces directives with anchors/placeholders
3. **Code Generator** produces a self-contained JS file with inline reactive runtime, scoped CSS, HTMLElement class, and `customElements.define` registration

## Publishing

```bash
# Bump version in package.json
yarn npm publish --access public
```

The `"files"` field in `package.json` controls what gets published: `bin/`, `lib/*.js` (excluding tests), `types/`, and `README.md`.

## Feature Specs

Each feature has a spec in `.kiro/specs/` with:
- `requirements.md` — User stories and acceptance criteria
- `design.md` — Architecture, data models, correctness properties
- `tasks.md` — Implementation plan with changelog

See `FEATURES.md` for the complete feature reference table.
