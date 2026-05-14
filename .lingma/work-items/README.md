# Work Items Tracking

## Overview

This directory tracks all work items for wcCompiler, including bug fixes and new features.

---

## Structure

```
.lingma/work-items/
├── README.md              # This file
├── bug-fixing/            # Bug tracking
│   ├── README.md
│   ├── TEMPLATE.md
│   ├── 0001-open-bug.md
│   └── archivados/
└── features/              # Feature tracking
    ├── README.md
    ├── TEMPLATE.md
    ├── 0001-open-feature.md
    └── archivados/
```

---

## Categories

### 🐛 Bug Fixing (`bug-fixing/`)

Track bugs, issues, and problems that need to be fixed.

**Statuses**: open → investigating → confirmed → fixing → testing → (archive)

**Archive statuses**: fixed, rejected, duplicate, wontfix

**See**: [bug-fixing/README.md](bug-fixing/README.md)

---

### ✨ Features (`features/`)

Track new features, enhancements, and improvements.

**Statuses**: open → investigating → planned → designing → implementing → testing → (archive)

**Archive statuses**: completed, rejected, duplicate, postponed

**See**: [features/README.md](features/README.md)

---

## Naming Convention

Both bugs and features use the same naming pattern:

**Format**: `NNNN-[status]-[priority]-brief-description.md`

**Priority Levels**:
- ⏫ `highest` - Critical/Blocking
- 🔼 `high` - Important
- ↕️ `medium` - Moderate
- 🔽 `low` - Minor
- ⏬ `lowest` - Trivial

### Examples

**Bugs**:
```
0001-[open]-[highest]-critical-security-fix.md
0002-[fixing]-[high]-counter-not-updating.md
0003-[confirmed]-[medium]-css-scoping-issue.md
0004-[testing]-[low]-minor-ui-glitch.md
0005-[fixed]-[lowest]-typo-in-docs.md
```

**Features**:
```
0001-[open]-[highest]-add-dynamic-slots.md
0002-[implementing]-[high]-performance-optimization.md
0003-[planned]-[medium]-custom-directives.md
0004-[designing]-[low]-improve-error-messages.md
0005-[completed]-[lowest]-update-dependencies.md
```

---

## Workflow

### For Bugs
1. QA reports bug
2. Create bug file from template
3. Investigate and confirm
4. Implement fix
5. Update external documentation ⚠️ CRITICAL
6. Test and verify
7. Archive with date

### For Features
1. Stakeholder requests feature
2. Create feature file from template
3. Investigate feasibility
4. Plan and design
5. Implement
6. Update external documentation ⚠️ CRITICAL
7. Test and verify
8. Archive with date

---

## Key Principles

### 1. External Documentation First ⚠️

Before closing ANY work item (bug or feature), you MUST update consumer-facing documentation:

- **README.md** - Primary user documentation
- **FEATURES.md** - Feature reference
- **docs/index.html** - Landing page

Internal steering docs are updated AFTER external docs.

### 2. Sequential Numbering

Each category (bugs/features) maintains its own sequence:
- Bugs: 0001, 0002, 0003...
- Features: 0001, 0002, 0003...

### 3. Status in Filename

The status is part of the filename for easy filtering:
```bash
# See all open bugs
ls bug-fixing/*-open-*.md

# See all features being implemented
ls features/*-implementing-*.md
```

### 4. Archive with Date

When archiving, add the completion date:
```bash
mv 0001-fixed-bug.md archivados/0001-fixed-bug-2026-05-14.md
```

This preserves history while keeping active items clean.

---

## Quick Commands

### View Active Items
```bash
# All active bugs
ls bug-fixing/*.md

# All active features
ls features/*.md

# By status
ls bug-fixing/*-open-*.md
ls features/*-implementing-*.md
```

### Search
```bash
# Search bugs
grep -r "counter" bug-fixing/ --include="*.md"

# Search features
grep -r "slots" features/ --include="*.md"

# Search all work items
grep -r "performance" . --include="*.md"
```

### Archive
```bash
# Archive a bug
mv bug-fixing/0001-fixed-bug.md \
   bug-fixing/archivados/0001-fixed-bug-2026-05-14.md

# Archive a feature
mv features/0001-completed-feature.md \
   features/archivados/0001-completed-feature-2026-05-14.md
```

---

## Cross-References

Bugs and features may be related. Use cross-references:

```markdown
## Related Items
- Bug: [0003-fixed-counter-issue](../bug-fixing/0003-fixed-counter-issue.md)
- Feature: [0005-completed-reactive-system](../features/0005-completed-reactive-system.md)
```

---

## Templates

Use the provided templates when creating new items:

### New Bug
```bash
cp bug-fixing/TEMPLATE.md bug-fixing/0001-open-description.md
```

### New Feature
```bash
cp features/TEMPLATE.md features/0001-open-feature-name.md
```

---

## Priority Levels

### Bugs
- **Critical**: Breaks core functionality, immediate fix needed
- **High**: Significant impact, fix soon
- **Medium**: Moderate impact, schedule appropriately
- **Low**: Minor issue, fix when convenient

### Features
- **P0 - Critical**: Must-have for next release
- **P1 - High**: Important, schedule soon
- **P2 - Medium**: Nice to have, plan for future
- **P3 - Low**: Optional, implement if time permits

---

## Documentation Requirements

### Before Closing ANY Work Item

✅ **External Documentation** (Consumer-Facing):
- [ ] README.md updated
- [ ] FEATURES.md updated
- [ ] docs/index.html updated (if user-facing)
- [ ] Code examples tested

✅ **Internal Documentation**:
- [ ] Steering docs updated
- [ ] Work item file completed
- [ ] Lessons learned documented

---

## Best Practices

1. **Be Descriptive**: Use clear, descriptive filenames
2. **Update Status**: Rename files when status changes
3. **Link Related Items**: Cross-reference bugs and features
4. **Document Thoroughly**: Fill all template sections
5. **Archive Promptly**: Move completed items to archive
6. **Review Regularly**: Check for stale items

---

## Future Extensions

This structure can be extended with additional categories:

```
work-items/
├── bug-fixing/
├── features/
├── improvements/      # Performance optimizations, refactoring
├── research/          # Spikes, POCs, investigations
└── technical-debt/    # Code quality improvements
```

Each category would follow the same pattern with README, TEMPLATE, and archivados.

---

*For detailed processes, see the individual README files in each subdirectory.*
