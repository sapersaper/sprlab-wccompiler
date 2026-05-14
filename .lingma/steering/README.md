# Steering Documentation Index

## 📚 Complete Knowledge Base for wcCompiler

This directory contains comprehensive documentation about the wcCompiler project. Use this as your primary reference for understanding the codebase, development workflow, and best practices.

---

## 📖 Document Overview

### [00-project-overview.md](./00-project-overview.md)
**Purpose**: High-level project introduction  
**Contains**:
- Project vision and philosophy
- Architecture overview
- API reference (signals, components, templates)
- CLI commands
- Feature support matrix
- Testing information
- Example project summary

**When to use**: 
- Getting started with the project
- Understanding overall architecture
- Quick API reference
- Learning about available features

---

### [01-reactive-runtime.md](./01-reactive-runtime.md)
**Purpose**: Deep dive into the signal-based reactivity system  
**Contains**:
- Signal implementation details (~144 lines)
- Computed values with caching
- Effects with cleanup
- Batching mechanism
- Tree-shaking strategy
- Performance characteristics
- Comparison with other frameworks

**When to use**:
- Debugging reactivity issues
- Understanding how signals work internally
- Optimizing component performance
- Learning about dependency tracking

---

### [02-compiler-pipeline.md](./02-compiler-pipeline.md)
**Purpose**: Step-by-step compilation process  
**Contains**:
- 7-step pipeline breakdown
- SFC parsing details
- Import resolution
- TypeScript stripping
- AST extraction
- Template processing
- Code generation
- Error codes and validation
- Performance notes

**When to use**:
- Debugging compilation errors
- Understanding how .wcc transforms to .js
- Adding new compiler features
- Fixing parser/extractor/codegen bugs

---

### [03-example-project.md](./03-example-project.md)
**Purpose**: Complete guide to the example showcase  
**Contains**:
- All 8 example components documented
- Running instructions
- Configuration options
- Common patterns
- Troubleshooting tips
- Performance recommendations

**When to use**:
- Learning by example
- Testing changes visually
- Understanding real-world usage
- Creating new components

---

### [04-framework-integrations.md](./04-framework-integrations.md)
**Purpose**: Framework-specific integration guides  
**Contains**:
- Vue plugin setup and usage
- Angular directive configuration
- React 19 plugin patterns
- Vanilla JS integration
- Cross-framework patterns
- Migration guides
- Best practices per framework

**When to use**:
- Integrating with specific frameworks
- Debugging framework-specific issues
- Understanding plugin architecture
- Migrating from framework components

---

### [05-development-workflow.md](./05-development-workflow.md)
**Purpose**: Development processes and bug fixing  
**Contains**:
- Environment setup
- Debugging strategies
- Bug fixing process (6 phases)
- Testing strategy
- Code review checklist
- Performance testing
- Emergency procedures
- Success metrics

**When to use**:
- Starting development work
- Following bug fixing process
- Setting up debugging
- Writing tests
- Preparing releases

---

### [06-quick-reference.md](./06-quick-reference.md)
**Purpose**: Quick lookup for common tasks  
**Contains**:
- Essential commands
- API quick reference
- Template directives table
- File structure examples
- Error codes
- Common patterns
- Framework snippets
- Debugging tips
- Git workflow

**When to use**:
- Looking up syntax quickly
- Finding command references
- Copy-pasting code patterns
- Checking error meanings
- Daily development tasks

---

### [07-external-documentation.md](./07-external-documentation.md)
**Purpose**: Map to all external documentation and published resources  
**Contains**:
- README.md complete breakdown (999 lines)
- FEATURES.md feature reference (145 lines)
- docs/index.html landing page analysis (401 lines)
- GitHub repository information
- npm package details
- GitHub Pages site documentation
- VS Code Marketplace extension
- Documentation cross-reference tables
- Search strategies
- Content hierarchy explanation

**When to use**:
- Understanding what external docs exist
- Finding the best source for specific information
- Keeping documentation in sync
- Learning about published resources
- Referencing official URLs

---

## 🔍 How to Find Information

### By Task

| I want to... | Read this document |
|--------------|-------------------|
| Understand what wcCompiler is | 00-project-overview.md |
| Learn how signals work | 01-reactive-runtime.md |
| Debug a compilation error | 02-compiler-pipeline.md |
| See working examples | 03-example-project.md |
| Integrate with Vue/Angular/React | 04-framework-integrations.md |
| Fix a bug properly | 05-development-workflow.md |
| Look up syntax/commands | 06-quick-reference.md |

### By Problem Type

| Problem | Start here | Then check |
|---------|-----------|------------|
| Component not rendering | 06-quick-reference.md (Common Issues) | 02-compiler-pipeline.md |
| Signals not updating | 01-reactive-runtime.md | 06-quick-reference.md (Debugging) |
| Props not passing | 04-framework-integrations.md | 02-compiler-pipeline.md |
| Events not firing | 06-quick-reference.md (Error Codes) | 02-compiler-pipeline.md |
| Compilation fails | 02-compiler-pipeline.md (Error Codes) | 05-development-workflow.md |
| Framework integration issue | 04-framework-integrations.md | 05-development-workflow.md |
| Performance problem | 01-reactive-runtime.md (Performance) | 03-example-project.md (Tips) |

### By Role

| Role | Primary documents | Secondary |
|------|------------------|-----------|
| New developer | 00, 06 | 03 |
| Bug fixer | 05, 02 | 01 |
| Feature developer | 02, 05 | 00 |
| Integration specialist | 04 | 00, 06 |
| QA tester | 03, 06 | 05 |
| Tech lead | All | - |

---

## 📁 Related Directories

### `.lingma/work-items/`
Central directory for tracking all work items.

#### `work-items/bug-fixing/`
Bug reports and fix documentation. Each bug gets its own file with:
- Reproduction steps
- Root cause analysis
- Proposed solution
- Test plan
- Resolution notes
- **Archive folder**: Completed bugs moved to `archivados/`

#### `work-items/features/`
Feature requests and development tracking. Each feature includes:
- Problem statement
- Design and architecture
- Implementation plan
- Testing strategy
- Documentation requirements
- **Archive folder**: Completed features moved to `archivados/`

**See**: [work-items/README.md](../work-items/README.md) for complete workflow.

### `.kiro/specs/`
Feature specifications and design documents. Contains:
- Planned features
- Design decisions
- Implementation plans
- Acceptance criteria

### `lib/*.test.js`
Test files serve as executable documentation:
- Usage examples
- Edge cases
- Expected behavior
- Regression prevention

### `example/src/*.wcc`
Live examples of all features:
- Working code
- Best practices
- Integration patterns
- Visual verification

---

## 🔄 Keeping Documentation Updated

### When to Update

**After fixing a bug**:
- Add learnings to relevant steering doc
- Update quick reference if new pattern discovered
- Note in bug report what docs were updated

**After adding a feature**:
- Update project overview with new API
- Add example to example project doc
- Update quick reference with new syntax
- Create/update spec in `.kiro/specs/`

**After refactoring**:
- Update compiler pipeline doc if flow changed
- Update reactive runtime doc if internals changed
- Note breaking changes in project overview

**Monthly review**:
- Check for outdated information
- Add new patterns discovered
- Remove deprecated content
- Verify all links work

### Update Process

1. **Identify affected documents**
2. **Make changes with clear explanations**
3. **Add "Last updated" date**
4. **Review related docs for consistency**
5. **Commit with message**: `docs(steering): update [doc name] with [changes]`

---

## 📊 Document Statistics

| Document | Lines | Topics Covered | Last Updated |
|----------|-------|----------------|--------------|
| 00-project-overview.md | 502 | Architecture, API, CLI, Features | 2026-05-14 |
| 01-reactive-runtime.md | 303 | Signals, Computeds, Effects, Batching | 2026-05-14 |
| 02-compiler-pipeline.md | 522 | Parser, Extractors, Codegen, Errors | 2026-05-14 |
| 03-example-project.md | 604 | Components, Patterns, Config | 2026-05-14 |
| 04-framework-integrations.md | 757 | Vue, Angular, React, Vanilla | 2026-05-14 |
| 05-development-workflow.md | 742 | Process, Debugging, Testing | 2026-05-14 |
| 06-quick-reference.md | 670 | Commands, Syntax, Patterns | 2026-05-14 |
| 07-external-documentation.md | 580 | External docs, URLs, Resources | 2026-05-14 |
| **Total** | **4,680** | **Complete coverage** | **2026-05-14** |

---

## 🎯 Learning Path

### For New Team Members

**Week 1: Foundations**
1. Read 00-project-overview.md (understand what we're building)
2. Read 06-quick-reference.md (learn basic syntax)
3. Run example project: `cd example && yarn dev`
4. Explore components in browser at localhost:4200

**Week 2: Deep Dive**
1. Read 01-reactive-runtime.md (understand reactivity)
2. Read 02-compiler-pipeline.md (understand compilation)
3. Read generated code in `example/dist/`
4. Modify a component and see live-reload

**Week 3: Integration**
1. Read 04-framework-integrations.md
2. Try integrating with your preferred framework
3. Read 05-development-workflow.md
4. Fix a small bug following the process

**Week 4: Contribution**
1. Pick a bug from `.lingma/bug-fixing/`
2. Follow the complete bug fixing process
3. Add tests and documentation
4. Submit PR for review

---

## 💡 Tips for Using This Documentation

### Effective Searching

**Use grep for specific topics**:
```bash
# Find all mentions of "batching"
grep -r "batch" .lingma/steering/

# Find code examples
grep -r "```javascript" .lingma/steering/

# Find error codes
grep -r "MISSING_DEFINE_COMPONENT" .lingma/steering/
```

**Use VS Code search**:
- `Ctrl+Shift+F`: Search across all docs
- Use regex for patterns: `signal\(\w+\)`
- Filter by file type: `*.md`

### Cross-Referencing

Documents reference each other. When you see:
- "See 01-reactive-runtime.md" → Jump to that section
- "As described in the compiler pipeline" → Check 02-compiler-pipeline.md
- "Following the bug fixing process" → Read 05-development-workflow.md

### Staying Current

**Subscribe to changes**:
- Watch the `.lingma/steering/` folder in Git
- Review updates in team meetings
- Ask questions when something is unclear

**Contribute back**:
- Found something missing? Add it!
- Discovered a better explanation? Update it!
- Found an error? Fix it!

---

## 🚀 Quick Start

**I need to fix a bug RIGHT NOW**:
1. Open 06-quick-reference.md → "Debugging Quick Reference"
2. Follow steps to reproduce and isolate
3. Check 02-compiler-pipeline.md for error codes
4. Read 05-development-workflow.md for proper process
5. Document in `.lingma/bug-fixing/BUG-XXX.md`

**I need to understand how something works**:
1. Start with 00-project-overview.md for high-level
2. Dive into specific docs based on topic:
   - Reactivity → 01-reactive-runtime.md
   - Compilation → 02-compiler-pipeline.md
   - Examples → 03-example-project.md
   - Integration → 04-framework-integrations.md

**I need to add a new feature**:
1. Read 02-compiler-pipeline.md to understand where to add it
2. Check 05-development-workflow.md for process
3. Look at similar features in existing code
4. Create spec in `.kiro/specs/`
5. Implement following the pipeline

**I need a quick syntax reminder**:
1. Open 06-quick-reference.md
2. Find the relevant section (Signals, Templates, etc.)
3. Copy-paste the pattern
4. Adjust for your use case

---

## 📞 Getting Help

### Documentation Issues
- Something unclear? Add a comment in the doc
- Missing information? Create an issue
- Found an error? Submit a PR to fix it

### Technical Questions
- Check relevant steering doc first
- Search existing bugs in `.lingma/bug-fixing/`
- Look at test files for examples
- Ask in team chat with specific context

### Process Questions
- Read 05-development-workflow.md
- Check `.kiro/specs/` for planned work
- Review recent commits for patterns
- Ask tech lead for clarification

---

## 🎓 Continuous Learning

### Weekly Study Topics

**Week 1**: Reactive System
- Read 01-reactive-runtime.md thoroughly
- Experiment with signals in example project
- Read signal implementation in `lib/reactive-runtime.js`
- Compare with Solid.js/Preact Signals/Vue

**Week 2**: Compiler Internals
- Read 02-compiler-pipeline.md thoroughly
- Trace compilation of a simple component
- Read parser/extractor/codegen code
- Add console logs to understand flow

**Week 3**: Framework Integration
- Read 04-framework-integrations.md thoroughly
- Set up integration with each framework
- Read plugin/adaptor code
- Understand transformation logic

**Week 4**: Advanced Topics
- Study complex components in example
- Read all test files for edge cases
- Understand performance optimizations
- Review error handling strategies

---

## ✅ Checklist: Am I Ready?

Before starting serious development, ensure you can:

- [ ] Explain what wcCompiler does and why it exists
- [ ] Create a basic .wcc component from scratch
- [ ] Understand how signals track dependencies
- [ ] Trace the compilation pipeline step-by-step
- [ ] Run the example project and see all components
- [ ] Debug a compilation error using error codes
- [ ] Follow the bug fixing process correctly
- [ ] Write tests for new functionality
- [ ] Integrate components with at least one framework
- [ ] Navigate the codebase efficiently

If you checked all boxes, you're ready! 🎉

---

*This index was created on 2026-05-14 as part of the steering documentation initiative.*  
*Keep it updated as new documents are added or existing ones are modified.*
