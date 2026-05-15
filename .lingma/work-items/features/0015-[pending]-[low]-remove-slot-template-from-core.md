# FEATURE-0015: Remove slot-template-name from Core - Move to Angular Adapter

## Metadata
- **Status**: 📋 pending
- **Priority**: 🟢 `low`
- **Type**: Feature/Refactor
- **Date created**: 2026-05-15
- **Component**: Core Compiler / Angular Adapter
- **Related files**: 
  - `lib/codegen.slot-template-attr.test.js` (should be deleted or moved)
  - `lib/compiler.scoped-slots-template-attr.test.js` (should be deleted or moved)
  - `adapters/angular.ts` (where this logic should live)
  - `docs/QA-scoped-slots.md` (documentation needs update)
  - `docs/RELEASE-0.9.0.md` (documentation needs update)

## Description

The `slot-template-name="..."` attribute pattern was incorrectly implemented in the core compiler (`lib/codegen.js`). This is a framework-specific feature that should only exist in the Angular adapter, not in the core WCC compiler.

**Current State:**
- Code for detecting `slot-template-*` attributes exists in `lib/codegen.js` (REMOVED in v0.16.11)
- Tests exist in `lib/codegen.slot-template-attr.test.js` and `lib/compiler.scoped-slots-template-attr.test.js`
- Documentation mentions this pattern in `docs/QA-scoped-slots.md` and `docs/RELEASE-0.9.0.md`

**Problem:**
- Framework-specific features pollute the core compiler
- Makes the core dependent on React/Angular patterns
- Violates separation of concerns principle
- The Angular adapter already has logic to skip these attributes (lines 164 in angular.ts)

## Background

This feature was originally added in v0.9.0-v0.10.10 for cross-framework scoped slots support. The pattern allows React/Angular to pass templates as string attributes:

```html
<!-- React/Angular pattern -->
<div slot-template-item="<span>{%name%} is {%age%}</span>"></div>
```

However, this should be handled by the framework adapters, not the core compiler.

## Acceptance Criteria

### Phase 1: Cleanup Core (Already Done ✅)
- [x] Remove `slot-template-*` detection code from `lib/codegen.js`
- [x] Remove test case from `compiler.slot-syntax-regression.test.js`
- [x] Commit changes (v0.16.11)

### Phase 2: Remove Obsolete Tests
- [ ] Delete `lib/codegen.slot-template-attr.test.js` OR move to `adapters/angular-compiled/`
- [ ] Delete `lib/compiler.scoped-slots-template-attr.test.js` OR move to `adapters/angular-compiled/`
- [ ] Verify no other tests depend on this functionality
- [ ] Update test suite to pass (currently 17 failing tests related to this feature)

### Phase 3: Implement in Angular Adapter (If Still Needed)
- [ ] Add `slot-template-name` normalization logic to `adapters/angular.ts`
- [ ] Convert `slot-template-name="..."` → `<template slot="name">` before passing to WCC element
- [ ] Add tests in `adapters/angular-compiled/` directory
- [ ] Verify it works with Angular's AOT compilation

### Phase 4: Update Documentation
- [ ] Update `docs/QA-scoped-slots.md` to clarify this is Angular-specific
- [ ] Update `docs/RELEASE-0.9.0.md` to mark as deprecated/moved
- [ ] Add migration guide if needed

### Phase 5: Verify No Regressions
- [ ] All existing tests pass (except pre-existing failures)
- [ ] Angular integration still works correctly
- [ ] Vue integration unaffected
- [ ] React integration unaffected
- [ ] Scoped slots work correctly in all frameworks

## Implementation Notes

**Why This Should Be in Angular Adapter:**
1. The pattern `slot-template-name` is specific to how Angular handles templates
2. Vue uses `<template #name>` or `<template slot="name">` natively
3. React would use JSX props or children, not HTML attributes
4. The core compiler should be framework-agnostic

**Angular Adapter Already Has Related Logic:**
In `adapters/angular.ts` line 164, there's already code that skips `slot-template-*` attributes:
```typescript
!attr.name.startsWith('slot-template-')
```

This suggests the adapter expects to handle these attributes itself, not the core.

**Migration Strategy:**
Option A: Remove completely if not used
- Delete all related tests and documentation
- Simpler, cleaner approach

Option B: Move to Angular adapter
- Keep the feature but in the right place
- More work, but preserves functionality

Recommendation: Start with Option A (remove completely). If users request this feature, implement it properly in the Angular adapter.

## Test Plan

After implementation:
1. Run full test suite: `npm test`
2. Verify Angular adapter tests pass
3. Test with real Angular application using scoped slots
4. Verify Vue components still work
5. Check documentation accuracy

## Risks

- **Low Risk**: This feature may not be widely used
- **Breaking Change**: If users rely on `slot-template-name`, they'll need to migrate
- **Mitigation**: Document the change clearly in release notes

## Related Issues

- BUG-0008: Template slot syntax support (Vue standard `<template slot="name">`)
- Original implementation: v0.9.0-v0.10.10 cross-framework scoped slots
