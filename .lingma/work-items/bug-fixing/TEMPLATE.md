# BUG-NNNN: [Brief Bug Title]

## Metadata
- **Status**: open | investigating | confirmed | fixing | testing | fixed | rejected | duplicate | wontfix
- **Priority**: 
  - ⏫ `highest` - Critical/Blocking
  - 🔼 `high` - Important
  - ↕️ `medium` - Moderate
  - 🔽 `low` - Minor
  - ⏬ `lowest` - Trivial
- **Reported by**: [Name/Team]
- **Date reported**: YYYY-MM-DD
- **Date resolved**: YYYY-MM-DD (fill when closed)
- **Severity**: Critical | High | Medium | Low
- **Component**: [e.g., wcc-counter, codegen, parser, tree-walker]
- **Related files**: 
  - `lib/codegen.js`
  - `example/src/wcc-counter.wcc`

## Description
Clear, concise description of the bug in 2-3 sentences.

## Steps to Reproduce
1. Open http://localhost:4200
2. Navigate to [specific section]
3. Click on [element]
4. Observe: [what happens]

## Expected Behavior
What should happen according to spec/documentation.

## Actual Behavior
What actually happens (include error messages, screenshots if applicable).

## Environment
- **wcCompiler version**: v0.13.0
- **Node version**: vXX.XX.X
- **Browser**: Chrome/Firefox/Safari (if UI bug)
- **OS**: Windows/Mac/Linux

## Root Cause Analysis
*(To be filled during investigation)*

Technical explanation of why this occurs:
- What part of the code is causing the issue?
- Is it a parser, extractor, tree-walker, or codegen problem?
- Any relevant code snippets or line numbers?

## Proposed Solution
*(To be filled during investigation)*

How to fix it:
1. Step 1
2. Step 2
3. Step 3

## Implementation
*(To be filled when implementing fix)*

### Changes Made
- File: `lib/codegen.js` (line XXX)
  - Changed: [description]
  - Reason: [explanation]

### Tests Added
- [ ] Unit test in `lib/*.test.js`
- [ ] Integration test in `e2e/`
- [ ] Manual verification in example project

## Documentation Updates
*(To be filled before closing)*

External documentation updated:
- [ ] README.md - [what was updated]
- [ ] FEATURES.md - [what was updated]
- [ ] docs/index.html - [what was updated]

Internal documentation updated:
- [ ] Steering docs - [what was documented]
- [ ] This bug report - complete

## Verification
*(To be filled before closing)*

- [ ] All tests passing (`yarn test`)
- [ ] TypeScript compilation successful (`yarn typecheck`)
- [ ] Manual testing in example project
- [ ] No regressions detected
- [ ] Code review completed
- [ ] External documentation reviewed for accuracy

## Resolution
*(To be filled when bug is closed)*

**Fixed in**: Commit hash or PR number  
**Released in**: Version number (if applicable)

Summary of the fix and any important notes for future reference.

## Related Issues
- Links to related bugs or feature requests
- Duplicate of: [BUG-NNNN] (if applicable)

## Additional Context
Screenshots, console logs, stack traces, or any other relevant information.

---

*Template: Copy this file and fill in the sections as you work through the bug.*
