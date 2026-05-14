# Feature Tracking System

## Overview

This directory tracks new features, enhancements, and improvements for wcCompiler.

---

## File Naming Convention

**Format**: `NNNN-[status]-[priority]-brief-description.md`

**Priority Levels**:
- ⏫ `highest` - Critical/Blocking - Must-have for next release
- 🔼 `high` - Important - Schedule soon
- ↕️ `medium` - Moderate - Plan for future
- 🔽 `low` - Minor - Optional enhancement
- ⏬ `lowest` - Trivial - Backlog item

**Examples**:
```
0001-[open]-[highest]-add-dynamic-slots.md
0002-[investigating]-[high]-performance-optimization.md
0003-[planned]-[medium]-custom-directives.md
0004-[designing]-[high]-new-api-endpoint.md
0005-[implementing]-[highest]-reactive-system-v2.md
0006-[testing]-[medium]-vue-plugin-improvements.md
0007-[completed]-[high]-bundle-mode.md
0008-[rejected]-[low]-legacy-browser-support.md
```

### Status Values

**Active Statuses** (stay in root directory):
- `open` - Feature request received, pending review
- `investigating` - Feasibility analysis in progress
- `planned` - Approved and scheduled for development
- `designing` - Design/specification in progress
- `implementing` - Development in progress
- `testing` - Implementation complete, in QA testing

**Archive Statuses** (moved to `archivados/`):
- `completed` - Feature shipped and documented ✅
- `rejected` - Not implementing (with reason) ❌
- `duplicate` - Duplicate of another feature 🔀
- `postponed` - Deferred to future release ⏸️

---

## Directory Structure

```
.lingma/work-items/features/
├── README.md                        # This file
├── TEMPLATE.md                      # Template for new features
├── 0001-open-feature-name.md        # Active features
├── 0002-implementing-another.md     # Features in progress
└── archivados/                      # Completed/rejected features
    ├── 0001-completed-vue-plugin-2026-05-14.md
    ├── 0002-rejected-legacy-support-2026-05-10.md
    └── ...
```

---

## Archive Policy

When a feature is completed or closed (status: `completed`, `rejected`, `duplicate`, or `postponed`):

1. Update the feature file with final details
2. Move to `archivados/` folder with date:
   ```bash
   mv 0001-completed-feature.md archivados/0001-completed-feature-YYYY-MM-DD.md
   ```
3. Keep active features in root directory for easy access

---

## Workflow Process

### Creating a New Feature Request

1. Copy the template:
   ```bash
   cp .lingma/work-items/features/TEMPLATE.md .lingma/work-items/features/0001-open-feature-name.md
   ```

2. Update the filename with next number and status
3. Fill in the metadata and description sections
4. Begin investigation/planning

### Feature Lifecycle

```
open → investigating → planned → designing → implementing → testing → completed
                                                                        ↓
                                                                  (archive)
```

Or if rejected at any stage:
```
[Any status] → rejected → (archive)
```

---

## Feature Proposal Template Sections

Each feature file should include:

1. **Metadata** - Status, dates, priority, stakeholders
2. **Problem Statement** - What problem does this solve?
3. **Proposed Solution** - High-level approach
4. **Requirements** - Functional and technical requirements
5. **Design** - API design, architecture decisions
6. **Implementation Plan** - Steps, timeline, dependencies
7. **Testing Strategy** - How will it be tested?
8. **Documentation Plan** - What docs need updating?
9. **Acceptance Criteria** - When is it "done"?
10. **Post-Launch** - Monitoring, feedback collection

---

## Useful Commands

### View Active Features
```bash
# List all active features
ls .lingma/work-items/features/*.md

# Count by status
ls .lingma/work-items/features/*-open-*.md | wc -l          # Open
ls .lingma/work-items/features/*-planned-*.md | wc -l       # Planned
ls .lingma/work-items/features/*-implementing-*.md | wc -l  # In progress
```

### View Archived Features
```bash
# List archived features
ls .lingma/work-items/features/archivados/*.md

# Count total archived
ls .lingma/work-items/features/archivados/*.md | wc -l
```

### Search Features
```bash
# Search in active features
grep -l "slots" .lingma/work-items/features/*.md

# Search in all features (active + archived)
grep -r "performance" .lingma/work-items/features/ --include="*.md"

# Find features by status
ls .lingma/work-items/features/*-planned-*.md
```

### Archive a Feature
```bash
# Move completed feature to archive with date
mv .lingma/work-items/features/0001-completed-feature.md \
   .lingma/work-items/features/archivados/0001-completed-feature-2026-05-14.md
```

---

## Priority Levels

- **P0 - Critical**: Must-have for next release
- **P1 - High**: Important, schedule soon
- **P2 - Medium**: Nice to have, plan for future
- **P3 - Low**: Optional, implement if time permits

---

## Relationship to Bug Fixing

Features and bugs are tracked separately but may be related:

- A bug fix might reveal a need for a new feature
- A feature implementation might uncover bugs
- Reference related items in both files when applicable

**Cross-reference format**:
```markdown
## Related Items
- Bug: [0003-fixed-counter-issue](../bug-fixing/0003-fixed-counter-issue.md)
- Feature: [0005-completed-reactive-system](./0005-completed-reactive-system.md)
```

---

## Documentation Requirements

Before marking a feature as `completed`:

### External Documentation (Consumer-Facing)
- [ ] README.md updated with new feature
- [ ] FEATURES.md updated with feature details
- [ ] docs/index.html updated if user-facing
- [ ] Code examples added and tested
- [ ] API reference documented

### Internal Documentation
- [ ] Steering docs updated with technical details
- [ ] Architecture decisions documented
- [ ] This feature file completed with lessons learned

---

## Review Checklist

Before merging feature implementation:

- [ ] All acceptance criteria met
- [ ] Tests written and passing
- [ ] No regressions introduced
- [ ] Performance impact assessed
- [ ] External documentation updated
- [ ] Internal documentation updated
- [ ] Code review completed
- [ ] Stakeholder approval obtained
- [ ] Feature file ready for archive

---

*For bug tracking, see: [../bug-fixing/README.md](../bug-fixing/README.md)*
