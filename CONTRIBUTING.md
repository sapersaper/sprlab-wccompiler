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
├── bin/wcc.js              # CLI entry point (build, dev)
├── lib/                    # Compiler source
│   ├── sfc-parser.js       # Parses .wcc SFC blocks (<script>, <template>, <style>)
│   ├── parser-extractors.js # Extracts signals, computeds, props, emits, etc. from script
│   ├── parser.js           # Type stripping (esbuild) + re-exports extractors
│   ├── tree-walker.js      # Walks jsdom DOM to discover bindings/events/directives
│   ├── codegen.js          # Generates self-contained JS from IR
│   ├── compiler.js         # Orchestrates the full pipeline
│   ├── compiler-browser.js # Browser-compatible compiler (no Node.js deps)
│   ├── css-scoper.js       # Prefixes CSS selectors with tag name
│   ├── reactive-runtime.js # Inline signal/computed/effect/batch runtime
│   ├── wcc-runtime.js      # Optional host-page binding helper
│   ├── config.js           # wcc.config.js loader
│   ├── dev-server.js       # Dev server with SSE live-reload + error overlay
│   ├── types.js            # JSDoc type definitions
│   └── *.test.js           # Tests (vitest + fast-check)
├── types/wcc.d.ts          # TypeScript declarations for 'wcc' module
├── example/                # Showcase app with all features
│   ├── src/                # Component source files (.wcc)
│   ├── dist/               # Compiled output (gitignored)
│   ├── index.html          # Host page
│   └── wcc.config.js       # Example config
├── vscode-wcc/             # VS Code extension (syntax, intellisense, snippets)
├── .kiro/specs/            # Feature specifications
└── FEATURES.md             # Complete feature reference
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
| `nested/wcc-profile` | child component, templateRef, defineExpose |
| `nested/wcc-badge` | defineProps, defineExpose, :style |
| `wcc-lifecycle` | onMount, onDestroy, templateRef, defineProps |
| `wcc-typescript` | TypeScript generics, interfaces, defineProps\<T\>, defineEmits\<T\>, watch |

## Compilation Pipeline

```
.wcc file → SFC Parser → { script, template, style, lang, tag }
                                    ↓
Script → Parser Extractors → signals, computeds, props, emits, etc.
                                    ↓
Template → jsdom DOM → Tree Walker → bindings, events, directives
                                    ↓
                              Code Generator → self-contained .js
```

1. **SFC Parser** extracts `<script>`, `<template>`, `<style>` blocks from the `.wcc` file
2. **Parser Extractors** analyze the script to extract signals, computeds, effects, props, emits, lifecycle hooks, refs, constants, watchers, defineExpose
3. **Tree Walker** walks the jsdom DOM to discover `{{interpolation}}`, `@event`, `if/else-if/else`, `each`, `show`, `model`, `:attr`, `<slot>`, `ref`, child components
4. **Code Generator** produces a self-contained JS file with inline reactive runtime, scoped CSS, HTMLElement class, and `customElements.define` registration

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
