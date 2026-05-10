# Implementation Plan: Angular Scoped Slots

## Overview

Implement native scoped slots for Angular via a runtime directive (`WccSlotsDirective`) and codegen changes to the WCC compiler. The directive auto-activates on custom elements (tags with hyphen) using an exclusion selector + runtime guard — no `[wccSlots]` attribute needed. Slots are declared with `ng-template[slot]` syntax. The directive classifies slots as "named" or "scoped" using the `__scopedSlots` static array emitted by codegen. Named slots render immediately into `<div slot="name" style="display:contents">` wrappers. Scoped slots register a renderer callback and render reactively with Angular context.

Implementation language: TypeScript for the Angular directive (`adapters/angular.ts`), JavaScript for codegen changes (`lib/codegen.js`).

## Tasks

- [x] 1. Codegen: Emit `__scopedSlots` static array and instance getter
  - [x] 1.1 Emit `static __scopedSlots = ['slotName1', 'slotName2', ...]` in the custom element class when scoped slots are present
    - Add generation in `lib/codegen.js` within the class body section
    - The array lists all slot names that have reactive props (`:prop="expr"` syntax in the `.wcc` file)
    - Only emit when the component has at least one scoped slot
    - _Requirements: 7.1_

  - [x] 1.2 Emit instance getter `get __scopedSlots() { return this.constructor.__scopedSlots || []; }`
    - Allows the directive to access the list from an element instance
    - _Requirements: 7.1_

- [x] 2. Codegen: Add `registerSlotRenderer` method and `__slotProps` storage
  - [x] 2.1 Emit `registerSlotRenderer(slotName, callback)` method in the custom element class when scoped slots are present
    - Add method generation in `lib/codegen.js` within the class body generation section
    - The method stores the callback in `this.__slotRenderers[slotName]`
    - If `this.__slotProps[slotName]` already exists, invoke callback immediately with current props
    - Return a cleanup function that deletes the renderer entry
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 2.2 Initialize `__slotRenderers` and `__slotProps` in the constructor
    - Add `this.__slotRenderers = {}` and `this.__slotProps = {}` initialization
    - Only emit when the component has scoped slots
    - _Requirements: 7.1, 7.2_

- [x] 3. Codegen: Modify scoped slot effect to emit event and support renderer delegation
  - [x] 3.1 Store current props in `this.__slotProps[slotName]` within the effect
    - Before any rendering logic, assign the computed props object to `__slotProps`
    - _Requirements: 7.2, 8.5_

  - [x] 3.2 Emit `wcc:slot-update` CustomEvent with `{ slot, props }` detail and `bubbles: false`
    - Dispatch the event after storing props but before token replacement
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 3.3 Add conditional check: if a renderer is registered, invoke it and skip token replacement
    - Check `this.__slotRenderers && this.__slotRenderers[slotName]` before the token replacement block
    - If renderer exists, call `this.__slotRenderers[slotName](__props)` and skip innerHTML replacement
    - Preserve existing token replacement as the `else` fallback path
    - _Requirements: 7.3, 7.5_

  - [x] 3.4 Write unit tests for codegen changes
    - Test that `__scopedSlots` static array is emitted for components with scoped slots
    - Test that `__scopedSlots` is NOT emitted for components without scoped slots
    - Test that `registerSlotRenderer` method is emitted for components with scoped slots
    - Test that `registerSlotRenderer` is NOT emitted for components without scoped slots
    - Test that the effect stores props in `__slotProps`
    - Test that the effect emits `wcc:slot-update` event
    - Test that token replacement is skipped when a renderer is registered
    - Test that token replacement still works as fallback when no renderer is registered
    - Test file: `lib/codegen.scoped-slots.test.js`
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 8.1, 8.2, 8.3_

- [x] 4. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Angular directive: Create `WccSlotDef` auxiliary directive
  - [x] 5.1 Create `adapters/angular.ts` with the `WccSlotDef` directive
    - Standalone directive with selector `ng-template[slot]`
    - Use `@Attribute('slot')` in constructor to capture the slot name (static attribute, not `@Input`)
    - Inject `TemplateRef<any>` via `inject()` and expose it as a public `templateRef` property
    - Store the slot name as public readonly `slotName: string`
    - Export the directive
    - _Requirements: 2.1, 2.2, 2.5_

- [x] 6. Angular directive: Implement `WccSlotsDirective` (main)
  - [x] 6.1 Create the `WccSlotsDirective` scaffold in `adapters/angular.ts`
    - Standalone directive with exclusion selector (`:not(div):not(span):not(p)...` for all standard HTML elements)
    - Runtime guard in `ngAfterContentInit`: early return if tag name does not contain a hyphen
    - Inject `ElementRef`, `ViewContainerRef`, `ChangeDetectorRef`
    - Use `@ContentChildren(WccSlotDef)` to query slot templates
    - Implement `AfterContentInit` and `OnDestroy` lifecycle hooks
    - Define internal `SlotState` map and cleanup arrays
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 6.2 Implement `classifyAndInitSlots()` — classification using `__scopedSlots`
    - Read `element.__scopedSlots` (or `element.constructor.__scopedSlots`) from the host custom element
    - For each `WccSlotDef` in `ContentChildren`: if its `slotName` is in `__scopedSlots`, classify as scoped; otherwise classify as named
    - Call `initNamedSlot(slotDef)` or `initScopedSlot(slotDef)` accordingly
    - Ignore templates with empty `slotName`
    - _Requirements: 2.3, 2.4, 2.5_

  - [x] 6.3 Implement `initNamedSlot(slotDef)` — immediate static rendering
    - Create wrapper `<div slot="name" style="display:contents">`
    - Call `vcr.createEmbeddedView(slotDef.templateRef)` (no context needed)
    - Append view root nodes into the wrapper element
    - Append wrapper as child of the host custom element
    - Store state in the `slots` map
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 6.1_

  - [x] 6.4 Implement `initScopedSlot(slotDef)` — async registration with renderer
    - Wait for `customElements.whenDefined(tagName)` before registration
    - Guard against destroyed state after async gap
    - Call `element.registerSlotRenderer(slotName, callback)` for the scoped slot
    - If `registerSlotRenderer` is not available, fall back to `addEventListener('wcc:slot-update', ...)`
    - Store cleanup function returned by `registerSlotRenderer`
    - _Requirements: 4.1, 5.1, 5.2, 5.3, 5.5_

  - [x] 6.5 Implement `buildContext(props)` — context construction
    - 0 props: `$implicit = undefined`
    - 1 prop: `$implicit` = that single value, plus the named prop key
    - N props (N > 1): `$implicit` = full props object, plus all named props
    - Return `SlotContext` object compatible with Angular's `createEmbeddedView`
    - _Requirements: 11.1, 11.2, 11.3, 11.5_

  - [x] 6.6 Implement `renderSlot(slotName, props)` — view creation/update
    - Build context via `buildContext(props)`
    - If no existing view: create via `vcr.createEmbeddedView(templateRef, context)`, then call `insertView`
    - If existing view: update context properties via `Object.assign` and call `viewRef.markForCheck()`
    - Call `this.cdr.markForCheck()` to trigger Angular change detection
    - Handle `props === null/undefined` by destroying the existing view
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 11.4, 12.1, 12.2, 12.3_

  - [x] 6.7 Implement `insertView(slotName, state)` — DOM insertion for scoped slots
    - Create wrapper `<div slot="name" style="display:contents">` if not already present
    - Append view root nodes into the wrapper
    - Reuse existing wrapper element on subsequent renders (don't duplicate)
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 6.8 Implement `cleanup()` — lifecycle teardown in `ngOnDestroy`
    - Invoke all cleanup functions from `registerSlotRenderer`
    - Destroy all `EmbeddedViewRef` instances (named and scoped)
    - Remove all `wcc:slot-update` event listeners
    - Remove wrapper elements from DOM (check `parentNode` before removing)
    - Handle case where host element is already disconnected from DOM
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 6.9 Write property tests for `buildContext`
    - **Property 4: Single-prop objects produce `$implicit` equal to that single value**
    - **Property 5: Multi-prop objects produce `$implicit` equal to the full object**
    - Property: All named props are always present as context keys regardless of count
    - Property: Empty props object produces `$implicit` as `undefined`
    - Use `fast-check` with arbitrary `Record<string, any>` generators (1-5 keys, primitive values)
    - Test file: `adapters/angular-slots.test.ts`
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.5**

  - [x] 6.10 Write property tests for slot classification
    - **Property 1: Classification correctness — slots in `__scopedSlots` are classified as scoped, others as named**
    - Use `fast-check` with arbitrary slot name lists and `__scopedSlots` subsets
    - Test file: `adapters/angular-slots.test.ts`
    - **Validates: Requirements 2.3, 2.4, 2.5**

  - [x] 6.11 Write unit tests for directive behavior
    - Test that directive activates on elements with hyphen in tag name (custom elements)
    - Test that directive does NOT activate on standard HTML elements (runtime guard)
    - Test `WccSlotDef` captures slot name from `@Attribute('slot')`
    - Test named slot creates wrapper with `slot="name"` and `display:contents` immediately
    - Test scoped slot waits for `customElements.whenDefined` before registering
    - Test fallback to `wcc:slot-update` event when `registerSlotRenderer` is absent
    - Test cleanup destroys views and removes listeners on `ngOnDestroy`
    - Test no errors when host element is removed before Angular destroy
    - Test `null` props clears the embedded view
    - Test `markForCheck` is called on context update (OnPush compatibility)
    - Test immediate invocation when props already exist at registration time
    - Test wrapper element is not duplicated on multiple updates
    - Test file: `adapters/angular-slots.test.ts`
    - _Requirements: 1.2, 1.3, 3.1, 3.3, 4.3, 4.5, 5.2, 5.5, 6.2, 9.4, 9.5, 12.1, 12.2_

- [x] 7. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Backward compatibility and coexistence
  - [x] 8.1 Ensure `slot-template-*` attribute pattern continues to work without the directive
    - Verify that without `WccSlotsDirective` imported, the existing token replacement path is unchanged
    - Verify that mixed usage (some slots via `ng-template[slot]`, others via `slot-template-*`) works correctly
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 8.2 Handle priority when both `ng-template[slot]` and `slot-template-*` target the same slot
    - When a renderer is registered (via directive), it takes priority and skips token replacement
    - Slots not covered by `ng-template[slot]` continue using the token replacement path
    - _Requirements: 10.1, 10.4_

  - [x] 8.3 Write integration tests for coexistence scenarios
    - Test: component without directive uses `slot-template-*` normally (no regression)
    - Test: component with directive and mixed slots (some ng-template[slot], some slot-template-*)
    - Test: multiple independent scoped slots in the same component
    - Test: directive with `CUSTOM_ELEMENTS_SCHEMA` — no conflicts
    - Test: named slots render immediately without waiting for any event
    - Test file: `adapters/angular-slots.test.ts`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 1.5_

- [x] 9. Update Angular framework testing app
  - [x] 9.1 Add a scoped slot demo to `framework-testing/angular/src/app/app.component.ts`
    - Import `WccSlotsDirective` and `WccSlotDef` in the component's `imports` array
    - Add a test case using `<wcc-card>` with `<ng-template slot="stats" let-likes>{{likes}} likes</ng-template>`
    - Add a test case with named slot: `<ng-template slot="header"><strong>Header</strong></ng-template>`
    - Add a test case with multiple scoped slots
    - Demonstrate reactive updates (slot props changing over time)
    - _Requirements: 1.2, 2.1, 3.1, 4.1, 11.1_

  - [x] 9.2 Add or update a WCC component in `framework-testing/angular/src/wcc/` with scoped slots
    - Ensure at least one component has a scoped slot that exposes reactive props
    - Compile the component with the updated codegen (includes `registerSlotRenderer` and `__scopedSlots`)
    - _Requirements: 7.1, 7.3_

- [x] 10. Documentation update
  - [x] 10.1 Update `adapters/angular.js` documentation comments to reference the new directives
    - Add usage examples showing `WccSlotsDirective` and `WccSlotDef` imports
    - Document the `ng-template[slot]` pattern (no `wccSlot="name"` attribute)
    - Document auto-activation behavior (no `[wccSlots]` attribute needed)
    - Document `let-*` binding syntax for scoped slot props
    - Document named slot behavior (immediate render, no `let-*`)
    - _Requirements: 1.1, 1.3, 2.1, 3.1_

  - [x] 10.2 Update `FEATURES.md` to document Angular native scoped slots
    - Add entry describing the feature and its usage
    - Reference the adapter module path
    - _Requirements: 1.1_

- [x] 11. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Codegen changes are in JavaScript (`lib/codegen.js`), directive is in TypeScript (`adapters/angular.ts`)
- Test files: `lib/codegen.scoped-slots.test.js` for codegen, `adapters/angular-slots.test.ts` for directive
- Property tests use `fast-check` (existing devDependency) with minimum 100 iterations
- The directive requires Angular ≥16 as a peerDependency
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- `WccSlotDef` uses `ng-template[slot]` selector with `@Attribute('slot')` — NOT an `@Input`
- No `[wccSlots]` attribute — the directive auto-activates on custom elements via exclusion selector + runtime guard
- Classification uses `__scopedSlots` from the element (emitted by codegen), not `let-*` detection
- Named slots render immediately into `<div slot="name" style="display:contents">` without waiting for events
