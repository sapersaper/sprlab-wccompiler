# External Documentation & Resources

## Overview

This document catalogs all existing external documentation, published resources, and useful links for wcCompiler. Use this as a reference for official documentation sources beyond the internal steering docs.

---

## 📚 Official Documentation Sources

### 1. README.md (Primary Documentation)
**Location**: `c:\projects\sprlab-wccompiler\README.md`  
**Lines**: 999 lines  
**Status**: ✅ Comprehensive primary documentation

**Contents**:
- Installation and quick start guide
- How it works (visual diagram)
- Single File Component format
- Vue migration guide (comparison table)
- Complete reactivity API (signals, computed, effects, batch, watch)
- Props system with TypeScript generics
- Custom events with validation
- **defineModel** (two-way binding across frameworks)
- Template directives (complete reference)
- Slots (named, scoped)
- Nested components with auto-import
- Lifecycle hooks (onMount, onDestroy, onAdopt)
- CSS scoping mechanism
- TypeScript support with type stripping
- CLI commands and configuration
- Standalone mode explanation
- Framework integrations (Vue, Angular, React, Vanilla)
- Editor support (VS Code extension)
- Runtime helper for declarative bindings

**Key Sections to Reference**:
- Lines 105-128: Vue migration comparison table
- Lines 256-306: defineModel two-way binding details
- Lines 459-491: Nested components with imports
- Lines 616-733: CLI and standalone mode
- Lines 735-975: Framework integration examples

**When to use**: 
- Primary reference for any feature
- Understanding framework-specific syntax
- Learning about advanced features like defineModel
- Checking CLI options and configuration

---

### 2. FEATURES.md (Feature Reference)
**Location**: `c:\projects\sprlab-wccompiler\FEATURES.md`  
**Lines**: 145 lines  
**Status**: ✅ Concise feature checklist

**Contents**:
- Script API table (all functions with syntax)
- Template directives table (complete list)
- Consumer slot API
- **Angular Native Scoped Slots** (detailed explanation)
- CSS features
- CLI commands summary
- Output characteristics
- Compiler validations (error codes)

**Key Unique Content**:
- Lines 63-84: Angular native scoped slots implementation details
  - WccSlotsDirective and WccSlotDef usage
  - ng-template syntax with let-* props
  - Auto-activation mechanism
  - OnPush compatibility
  - Backward compatibility notes

**When to use**:
- Quick feature lookup
- Checking if a feature exists
- Understanding Angular scoped slot implementation
- Error code reference
- Output characteristics checklist

---

### 3. docs/index.html (Landing Page)
**Location**: `c:\projects\sprlab-wccompiler\docs\index.html`  
**Lines**: 401 lines  
**Status**: ✅ Published landing page (GitHub Pages)

**Published URL**: https://sapersaper.github.io/sprlab-wccompiler/

**Contents**:
- Hero section with tagline and install command
- "How it works" visual flow diagram
- Feature grid (9 feature cards with code examples)
- Comparison table (wcCompiler vs Lit vs Stencil vs Svelte)
- Quick start guide (4 steps)
- API reference tables (Script API, Template Directives, CLI)
- Ecosystem section (VS Code extension, standalone mode, dev server, integrations)
- Footer with links

**Key Unique Content**:
- Lines 150-228: Comparison table with other frameworks
  - Runtime size comparison (0 KB vs 5-15 KB)
  - Output type comparison
  - Shadow DOM approach
  - Feature-by-feature comparison
  
- Lines 347-385: Ecosystem overview
  - VS Code extension marketplace link
  - Standalone mode use cases
  - Dev server capabilities
  - Framework integration examples

**When to use**:
- Marketing/overview material
- Comparison with alternatives
- Quick visual explanation of the compiler
- Sharing with stakeholders

---

## 🌐 Published Resources

### GitHub Repository
**URL**: https://github.com/sapersaper/sprlab-wccompiler  
**Content**:
- Full source code
- Issue tracker
- Pull requests
- Releases and changelog
- CONTRIBUTING.md guide
- License (MIT)

**Useful Links**:
- Issues: For bug reports and feature requests
- Releases: Version history and changelogs
- Actions: CI/CD pipeline status
- Wiki: May contain additional documentation

---

### npm Package
**URL**: https://www.npmjs.com/package/@sprlab/wccompiler  
**Package Name**: `@sprlab/wccompiler`  
**Current Version**: v0.13.0  

**npm Page Contains**:
- Installation instructions
- Package metadata (dependencies, size)
- README (synced from repo)
- Version history
- Download statistics
- Security advisories

**Install Commands**:
```bash
npm install -D @sprlab/wccompiler
yarn add -D @sprlab/wccompiler
pnpm add -D @sprlab/wccompiler
```

---

### GitHub Pages Site
**URL**: https://sapersaper.github.io/sprlab-wccompiler/  
**Source**: `docs/index.html`  
**Hosting**: GitHub Pages (automatic deployment)

**Site Sections**:
1. **Hero**: Value proposition and quick install
2. **How it Works**: Visual 3-step process
3. **Features**: 9 feature cards with examples
4. **Comparison**: Table vs Lit/Stencil/Svelte
5. **Quick Start**: 4-step getting started guide
6. **API Reference**: Condensed API tables
7. **Ecosystem**: Tools and integrations

**Deployment**:
- Automatically deployed from `main` branch
- Source in `docs/` directory
- Static HTML/CSS (no build step)

---

### VS Code Marketplace
**Extension Name**: "wcCompiler (.wcc) Language Support"  
**Publisher**: sprlab  
**URL**: https://marketplace.visualstudio.com/items?itemName=sprlab.wccompiler-language-support

**Features**:
- Syntax highlighting for `.wcc` files
- IntelliSense completions
- Diagnostics and error reporting
- Typed templateRef support
- Snippet support

**Installation**:
```bash
# From VS Code
Extensions → Search "wcCompiler" → Install

# Or via command line
code --install-extension sprlab.wccompiler-language-support
```

---

## 📖 Documentation Cross-Reference

### Where to Find What

| Topic | Best Source | Alternative |
|-------|-------------|-------------|
| Getting Started | README.md (lines 11-56) | docs/index.html (#guide) |
| API Reference | README.md (full) | FEATURES.md (tables) |
| Feature Checklist | FEATURES.md | README.md |
| Framework Integration | README.md (lines 735-975) | docs/index.html (#ecosystem) |
| Comparison with Others | docs/index.html (lines 150-228) | README.md |
| CLI Usage | README.md (lines 616-733) | FEATURES.md (lines 95-102) |
| Error Codes | FEATURES.md (lines 117-144) | README.md (search "validation") |
| Angular Scoped Slots | FEATURES.md (lines 63-84) | README.md (lines 799-844) |
| defineModel | README.md (lines 256-306) | FEATURES.md (line 20) |
| Standalone Mode | README.md (lines 683-733) | docs/index.html (#ecosystem) |
| TypeScript | README.md (lines 530-614) | FEATURES.md (line 27) |
| VS Code Extension | docs/index.html (lines 351-355) | README.md (line 978) |

---

## 🔗 Useful URLs Summary

### Primary Resources
- **GitHub Repo**: https://github.com/sapersaper/sprlab-wccompiler
- **npm Package**: https://www.npmjs.com/package/@sprlab/wccompiler
- **Documentation Site**: https://sapersaper.github.io/sprlab-wccompiler/
- **VS Code Extension**: https://marketplace.visualstudio.com/items?itemName=sprlab.wccompiler-language-support

### Direct Links
- **Issues**: https://github.com/sapersaper/sprlab-wccompiler/issues
- **Releases**: https://github.com/sapersaper/sprlab-wccompiler/releases
- **Contributing Guide**: https://github.com/sapersaper/sprlab-wccompiler/blob/main/CONTRIBUTING.md
- **Full README**: https://github.com/sapersaper/sprlab-wccompiler/blob/main/README.md

### Raw Files
- **README.md**: https://raw.githubusercontent.com/sapersaper/sprlab-wccompiler/main/README.md
- **FEATURES.md**: https://raw.githubusercontent.com/sapersaper/sprlab-wccompiler/main/FEATURES.md
- **package.json**: https://raw.githubusercontent.com/sapersaper/sprlab-wccompiler/main/package.json

---

## 📊 Documentation Statistics

| Document | Location | Lines | Last Updated | Purpose |
|----------|----------|-------|--------------|---------|
| README.md | Project root | 999 | Active | Primary documentation |
| FEATURES.md | Project root | 145 | Active | Feature reference |
| docs/index.html | docs/ | 401 | Active | Landing page |
| CONTRIBUTING.md | Project root | ~200 | Active | Development guide |
| TODO.md | Project root | ~100 | Active | Pending tasks |

**Total External Documentation**: ~1,845 lines

**Internal Steering Docs** (`.lingma/steering/`):
- 7 documents, ~4,100 lines
- Deep technical knowledge
- Development workflow
- Bug fixing process

**Combined Total**: ~5,945 lines of documentation

---

## 🔄 Keeping Documentation in Sync

### When to Update Each Source

**README.md** (Update when):
- Adding new features
- Changing API
- Modifying CLI commands
- Updating framework integrations
- Changing configuration options

**FEATURES.md** (Update when):
- Adding/removing features
- New error codes
- Changes to output characteristics
- New CLI flags

**docs/index.html** (Update when):
- Marketing message changes
- New comparison data
- Updated quick start steps
- New ecosystem tools

**Internal Steering Docs** (Update when):
- Discovering new patterns
- Fixing bugs (document learnings)
- Improving processes
- Adding technical deep dives

### Sync Process

1. **Make changes to README.md first** (source of truth)
2. **Update FEATURES.md** to match new features
3. **Update docs/index.html** for public-facing changes
4. **Update steering docs** with technical details
5. **Test all links** after updates
6. **Commit with clear message**: `docs: update [feature] documentation`

---

## 🎯 Documentation Strategy

### Audience Mapping

| Audience | Primary Resource | Secondary |
|----------|-----------------|-----------|
| New users | docs/index.html | README.md (quick start) |
| Developers | README.md | FEATURES.md |
| Contributors | CONTRIBUTING.md | Internal steering docs |
| Decision makers | docs/index.html (comparison) | README.md (features) |
| QA testers | FEATURES.md (error codes) | Example project |
| Framework devs | README.md (integrations) | Framework-specific sections |

### Content Hierarchy

```
Level 1: docs/index.html (Overview/Landing)
  ↓
Level 2: README.md (Complete Guide)
  ↓
Level 3: FEATURES.md (Quick Reference)
  ↓
Level 4: Internal steering docs (Deep Technical)
  ↓
Level 5: Source code + tests (Ultimate Truth)
```

---

## 💡 Tips for Using External Documentation

### For Quick Answers
1. Check FEATURES.md first (concise tables)
2. Then README.md (detailed explanations)
3. Search with `Ctrl+F` for specific terms

### For Learning
1. Start with docs/index.html (visual overview)
2. Follow README.md quick start
3. Explore example project
4. Read steering docs for deep understanding

### For Contributing
1. Read CONTRIBUTING.md
2. Review internal steering docs
3. Check TODO.md for pending work
4. Look at recent PRs for patterns

### For Troubleshooting
1. Check FEATURES.md error codes
2. Search README.md for feature docs
3. Look at test files for examples
4. Check GitHub issues for similar problems

---

## 📝 Notes on Specific Features

### defineModel (Two-Way Binding)
**Best documented in**: README.md lines 256-306

**Key points**:
- Emits 4 different event formats for cross-framework compatibility
- Zero-config in Angular (`[(prop)]`)
- Requires plugin in Vue (`v-model:prop`)
- Manual setup in React
- Generic event in vanilla JS (`wcc:model`)

**Events emitted**:
- `{name}-changed` (kebab-case)
- `{name}Changed` (camelCase)
- `{name}Change` (Angular banana-box)
- `wcc:model` (generic)

---

### Angular Native Scoped Slots
**Best documented in**: FEATURES.md lines 63-84

**Implementation details**:
- Uses `WccSlotsDirective` and `WccSlotDef`
- Captures `TemplateRef` from `ng-template`
- Classifies slots as named or scoped
- Named slots render immediately
- Scoped slots register renderer callbacks
- Compatible with OnPush change detection
- Backward compatible with legacy syntax

**Why it's special**:
- Idiomatic Angular syntax (no token replacement)
- Reactive rendering with proper change detection
- No plugin needed for basic functionality
- Only directive needed for scoped slots

---

### Standalone Mode
**Best documented in**: README.md lines 683-733

**Key concepts**:
- Inline reactive runtime in each component
- Zero external dependencies
- Isolated reactive scope per component
- Perfect for distribution scenarios
- Per-component override available

**Use cases**:
- npm packages
- CDN widgets
- Micro-frontends
- Third-party site embedding
- Offline-first apps

**Trade-offs**:
- ✅ Zero dependencies
- ✅ Self-contained
- ❌ Larger file size
- ❌ No cross-component reactivity
- ❌ Runtime duplication if used multiple times

---

### Bundle Mode
**Best documented in**: README.md lines 628-659

**What it does**:
- Produces single `bundle.js` file
- IIFE format (no ES modules)
- Works from `file://` protocol
- Includes all components + runtime
- Supports minification

**When to use**:
- Static HTML files
- Electron apps
- Offline applications
- Quick prototyping
- Distribution as single file

**When NOT to use**:
- HTTP-served apps (use ES modules)
- Need lazy loading
- Using Vite/Webpack (they bundle)

---

## 🔍 Search Strategies

### Finding Information Quickly

**In README.md**:
```bash
# Search for specific feature
grep -n "defineModel" README.md

# Find framework section
grep -n "Vue\|Angular\|React" README.md

# Find CLI commands
grep -n "wcc build\|wcc dev" README.md
```

**In FEATURES.md**:
```bash
# Find error codes
grep -n "Error Code" FEATURES.md

# Find directive syntax
grep -n "each\|if\|model" FEATURES.md
```

**In docs/index.html**:
```bash
# Find sections
grep -n "section id=" docs/index.html

# Find comparison data
grep -n "Lit\|Stencil\|Svelte" docs/index.html
```

### VS Code Search Tips

- `Ctrl+Shift+F`: Search across all docs
- Use regex: `signal\(\w+\)` for signal patterns
- Filter by file: `*.md` or `*.html`
- Case-sensitive search for exact matches

---

## 📅 Documentation History

### Major Updates

**v0.13.0** (Current):
- Added defineModel documentation
- Enhanced Angular scoped slots docs
- Added bundle mode explanation
- Updated framework integration examples
- Added comparison table in landing page

**v0.12.x**:
- Added standalone mode documentation
- Enhanced TypeScript section
- Added VS Code extension info
- Improved nested components docs

**v0.11.x**:
- Initial framework integration docs
- Added scoped slots documentation
- Created FEATURES.md reference
- Built docs/index.html landing page

---

## ✅ Documentation Checklist

Before releasing a new version, verify:

- [ ] README.md updated with new features
- [ ] FEATURES.md includes new additions
- [ ] docs/index.html reflects changes
- [ ] All links work correctly
- [ ] Code examples are accurate
- [ ] TypeScript types documented
- [ ] Error codes listed
- [ ] Framework examples tested
- [ ] CLI commands verified
- [ ] Breaking changes highlighted
- [ ] Migration guide provided (if needed)
- [ ] Changelog updated
- [ ] Version numbers consistent

---

## 🚀 Future Documentation Plans

### Potential Additions

1. **Video Tutorials**
   - Getting started walkthrough
   - Building a complete app
   - Framework integration demos

2. **Interactive Playground**
   - Live code editor
   - Real-time compilation
   - Output preview

3. **Blog Posts**
   - "Why wcCompiler?"
   - "Migrating from Vue/Lit"
   - "Building distributable widgets"

4. **Case Studies**
   - Real-world usage examples
   - Performance benchmarks
   - Integration stories

5. **Advanced Guides**
   - Custom compiler plugins
   - Extending the runtime
   - Performance optimization
   - Testing strategies

---

*Last updated: 2026-05-14*  
*This document serves as a map to all external wcCompiler documentation resources.*
