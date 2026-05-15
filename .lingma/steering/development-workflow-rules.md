# Development Workflow & Working Rules

## Overview
This document defines the mandatory workflow and rules for all development activities in the wcCompiler project. These rules are enforced through system memories and must never be bypassed.

---

## 🔄 Mandatory Development Workflow

### Step 1: Read & Understand Task
- **Action**: Read the complete bug report file from `.lingma/work-items/bug-fixing/`
- **Example**: `0005-[open]-[high]-defineModel-missing-wrapper-methods.md`
- **Requirement**: Fully understand the problem, root cause, and expected solution
- **If unclear**: Request clarification from QA team BEFORE proceeding
- **Never**: Make assumptions about requirements

### Step 2: Status Update & Branch Creation
- **Update bug status**: Change from `open` to `inProgress` in bug report
- **Rename file**: `0005-[open]-...` → `0005-[inProgress]-...`
- **Create branch**: `{bug-number}-[bug/task]-{short-description}`
  - Example: `0005-bug-defineModel-missing-wrapper-methods`

### Step 3: TDD - Write Tests First
- **Methodology**: Test-Driven Development (TDD) is MANDATORY
- **Process**:
  1. Write failing unit tests that describe expected behavior
  2. Run tests to confirm they fail
  3. Implement minimal code to make tests pass
  4. Refactor while keeping tests passing
  5. Verify all existing tests still pass
- **Requirements**:
  - Tests must be comprehensive and cover edge cases
  - Tests must verify semantic correctness, not just syntax
  - For codegen modifications: tests must check actual JavaScript execution

### Step 4: NO Auto-Commit/Push
- **CRITICAL**: After completing development, DO NOT commit or push automatically
- **Required action**: Ask user for explicit confirmation before ANY git operation
- **Question format**: "¿Quieres que commitee y pushee estos cambios?"
- **Wait**: For user approval before proceeding

### Step 5: Version Bump & Release (After User Approval)
- **Semantic versioning**:
  - Patch (x.x.0 → x.x+1.0): Bug fixes
  - Minor (x.0.x → x+1.0.0): New features  
  - Major (0.x.x → 1.0.0): Breaking changes
- **Process**:
  1. Update `package.json` version
  2. Commit version bump
  3. Create git tag: `git tag -a v{version} -m "Release v{version}: {description}"`
  4. Push tag: `git push origin v{version}`
  5. Publish to npm: `npm publish --access public`
  6. Update bug report with release version

### Step 6: QA Verification & Final Commit
- **Wait**: For QA testing results and confirmation
- **If QA approves**: 
  - Update bug status to `done`
  - Add resolution details with QA verification date
  - Move file to `archivados/` folder
  - Commit and push final changes
- **If QA reports issues**:
  - Create additional tests for reported scenarios
  - Fix issues following TDD workflow
  - Repeat from Step 4

---

## 📋 Critical Rules (Never Bypass)

### Rule 1: Git Operations Require Explicit Confirmation
**NEVER** execute `git commit` or `git push` without explicit user confirmation.

This applies to:
- Bug fix commits
- Version bump commits
- Test file additions
- Documentation updates
- ANY repository changes

### Rule 2: QA Verification is Mandatory
**NEVER** mark a bug as "done" without explicit QA confirmation.

Even if:
- All tests pass
- Code appears correct
- You believe the fix is complete

QA team's verification is the final gate before closure.

### Rule 3: TDD is Mandatory
**ALWAYS** write tests BEFORE implementation code.

No exceptions for:
- Bug fixes
- Feature implementations
- Code refactoring
- Any code changes

### Rule 4: Read Before Acting
**ALWAYS** read and understand the complete task/bug report before starting work.

If information is missing or unclear:
- Ask questions
- Request clarification from QA
- Do NOT proceed with assumptions

### Rule 5: Codegen Testing Standards
When modifying `lib/codegen.js` or any code generation logic:

- Tests must verify generated code is syntactically valid AND semantically correct
- Tests must check actual JavaScript execution
- Tests must cover edge cases and operator precedence
- Tests must verify transformations don't affect string literals incorrectly
- Run ALL existing tests to ensure no regressions

---

## 📊 Bug Status Management

### Status Values
- `open`: Bug reported, not yet started
- `inProgress`: Currently being worked on
- `inTesting`: Ready for QA verification
- `done`: QA verified and closed

### File Naming Convention
Format: `{number}-[{status}]-[{priority}]-{description}.md`

Examples:
- `0005-[open]-[high]-defineModel-missing-wrapper-methods.md`
- `0005-[inProgress]-[high]-defineModel-missing-wrapper-methods.md`
- `0005-[inTesting]-[high]-defineModel-missing-wrapper-methods.md`
- `archivados/0005-[done]-[high]-defineModel-missing-wrapper-methods.md`

### Status Transitions
1. `open` → `inProgress`: When starting work
2. `inProgress` → `inTesting`: When ready for QA
3. `inTesting` → `done`: After QA confirmation
4. Move to `archivados/` folder when status is `done`

---

## 🧪 Testing Standards

### Unit Test Requirements
- Must be written BEFORE implementation (TDD)
- Must verify semantic correctness, not just syntax
- Must cover edge cases
- Must check actual code execution for codegen
- All existing tests must pass (no regressions)

### Test Coverage
- Happy path scenarios
- Edge cases
- Error conditions
- Operator precedence issues
- String literal handling
- Complex expressions

---

## 🚀 Release Process

### Version Bump Types
- **Patch** (0.16.4 → 0.16.5): Bug fixes only
- **Minor** (0.16.x → 0.17.0): New features
- **Major** (0.x.x → 1.0.0): Breaking changes

### Release Steps
1. Confirm version bump type with user
2. Update `package.json`
3. Commit version bump
4. Create and push git tag
5. Publish to npm
6. Update bug reports with release info

---

## 💬 Communication Standards

### Language
- All communication in Spanish (user preference)

### Confirmation Requests
- Always ask before destructive operations
- Always ask before git commit/push
- Always confirm version bump type
- Always verify understanding of requirements

### QA Interaction
- Thank QA team for thorough testing
- Document their findings in bug reports
- Address all reported issues
- Wait for their approval before closing bugs

---

## 📝 Documentation Standards

### Bug Reports Must Include
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Root cause analysis
- Resolution details (when fixed)
- QA verification date
- Release version (when published)

### Code Comments
- Explain WHY, not WHAT
- Document complex logic
- Reference related bugs/issues
- Include examples when helpful

---

## ⚠️ Common Pitfalls to Avoid

1. **Auto-committing/pushing**: Always ask first
2. **Skipping tests**: TDD is mandatory
3. **Assuming QA approval**: Wait for explicit confirmation
4. **Incomplete bug understanding**: Read full report, ask questions
5. **Insufficient test coverage**: Cover edge cases and semantics
6. **Wrong version bump type**: Confirm with user
7. **Premature bug closure**: QA verification is required

---

## ✅ Checklist for Each Task

Before starting:
- [ ] Read complete bug report
- [ ] Understand requirements
- [ ] Asked questions if unclear
- [ ] Updated bug status to inProgress
- [ ] Created feature branch

During development:
- [ ] Wrote tests FIRST (TDD)
- [ ] Tests cover edge cases
- [ ] Implementation makes tests pass
- [ ] All existing tests still pass

Before committing:
- [ ] Asked user for permission
- [ ] Received explicit approval
- [ ] Version bump confirmed (if applicable)

After QA:
- [ ] QA verification received
- [ ] Bug status updated to done
- [ ] Resolution documented
- [ ] File moved to archivados/
- [ ] Committed and pushed

---

*Last updated: 2026-05-15*
*These rules are enforced through system memories and are MANDATORY*
