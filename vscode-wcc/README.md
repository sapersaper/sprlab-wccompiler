# wcCompiler — VS Code Extension

Language support for [wcCompiler](https://github.com/sapersaper/sprlab-wccompiler) Single File Components (`.wcc`).

## What is wcCompiler?

A zero-runtime compiler that transforms `.wcc` files into 100% native Web Components. No framework dependencies in the output — just vanilla JavaScript using the Custom Elements API.

## Extension Features

- **Syntax Highlighting** — Full TextMate grammar for `.wcc` files with embedded JS/TS/HTML/CSS
- **IntelliSense** — Autocompletion, hover, and go-to-definition powered by Volar
- **Type Checking** — TypeScript diagnostics in both script and template expressions
- **Template Expressions** — IntelliSense inside `{{}}`, `@event`, `:attr`, `model`, `if`, `show`
- **Snippets** — Quick scaffolding for components and directives

## Snippets

| Prefix | Description |
|---|---|
| `wcc` | Full component scaffold |
| `wccmin` | Minimal component (no style) |
| `each` | each iteration directive |
| `eachkey` | each with :key |
| `wif` / `wshow` / `wmodel` | Directives |
| `sig` / `comp` / `wat` | signal / computed / watch |
| `dprops` / `demits` / `dexpose` | defineProps / defineEmits / defineExpose |
| `mount` / `destroy` | Lifecycle hooks |
| `tref` | templateRef |

## Architecture

```
vscode-wcc/
├── packages/
│   ├── client/          Extension client (activation, grammar, snippets)
│   │   ├── src/         Extension entry point
│   │   ├── syntaxes/    TextMate grammar (.tmLanguage.json)
│   │   ├── snippets/    Code snippets (wcc.json)
│   │   └── icons/       Extension and file icons
│   └── server/          Volar Language Server
│       └── src/
│           ├── languagePlugin.ts        Volar plugin (WccCode, virtual codes)
│           ├── templateExpressionParser.ts  Template expression extraction
│           └── wccParser.ts             SFC block parser with offsets
├── package.json         Extension manifest
└── tsconfig.base.json   Shared TS config
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Launch Extension Development Host
# Open vscode-wcc/ in VS Code → press F5
```

## Publishing

```bash
# Package as VSIX
npx vsce package

# Publish to Marketplace
npx vsce publish
```

## Links

- [wcCompiler Documentation](https://sapersaper.github.io/sprlab-wccompiler/)
- [Playground](https://sapersaper.github.io/sprlab-wccompiler/playground/)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=SPRLab.wcc-language)
