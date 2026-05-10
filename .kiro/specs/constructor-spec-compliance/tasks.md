# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Constructor Adds Children on createElement
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the constructor violates the Custom Elements spec
  - **File**: `lib/codegen.constructor-compliance.test.js`
  - **Scoped PBT Approach**: Use fast-check to generate component configurations (varying signals, props, bindings, slots, if-blocks, each-blocks) and verify that `document.createElement(tagName)` on the compiled component throws `NotSupportedError` or produces an element with children (confirming the bug)
  - **Setup**: Use jsdom to provide `document.createElement`, compile components using `generateComponent`, evaluate the generated code, then call `document.createElement(tagName)`
  - **Property assertion**: For all valid component configurations, `document.createElement(tagName)` should complete without error AND produce an element with `children.length === 0` and `innerHTML === ""`
  - On UNFIXED code: test will FAIL because the constructor calls `this.appendChild(__root)`, causing either a `NotSupportedError` or producing an element with children
  - Document counterexamples found (e.g., "createElement('wcc-counter') throws NotSupportedError because constructor calls appendChild")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Generated Constructor Contains Only Reactive State
  - **IMPORTANT**: Follow observation-first methodology
  - **File**: `lib/codegen.constructor-compliance.test.js` (same file, separate describe block)
  - **Observation phase**: On UNFIXED code, observe that `generateComponent` produces a constructor containing both reactive state init AND DOM manipulation. Record the DOM manipulation patterns present (appendChild, innerHTML, cloneNode, DOM ref assignments)
  - **Property-based test**: Use fast-check to generate random valid ParseResult objects (varying combinations of signals, computeds, props, bindings, events, slots, if-blocks, each-blocks, refs, watchers, constants) and verify structural properties of the generated code:
    - The generated code always contains a `class ClassName extends HTMLElement`
    - The generated code always contains a `connectedCallback()` with the idempotency guard `if (this.__connected) return`
    - The generated code always contains `customElements.define(tagName, ClassName)`
    - Signal initialization (`this._name = __signal(...)`) is always present for each signal
    - Computed initialization (`this._c_name = __computed(...)`) is always present for each computed
    - Prop signal initialization (`this._s_name = __signal(...)`) is always present for each prop
  - These structural properties hold on BOTH unfixed and fixed code (they test what must be preserved)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline structural behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.9_

- [ ] 3. Fix constructor spec compliance in codegen

  - [x] 3.1 Move DOM operations from constructor to connectedCallback in `generateComponent`
    - In `lib/codegen.js`, function `generateComponent` (starts at line 810):
    - **Keep in constructor** (reactive state only):
      - Prop signal initialization: `this._s_name = __signal(default)`
      - Signal initialization: `this._name = __signal(value)`
      - Constant initialization: `this._const_name = value`
      - Computed initialization: `this._c_name = __computed(() => ...)`
      - Watcher prev-value initialization: `this.__prev_name = undefined`
    - **Move to connectedCallback** (insert AFTER idempotency guard + AbortController/disposers init, BEFORE effects):
      1. Slot resolution (reading `this.childNodes` into `__slotMap` and `__defaultSlotNodes`)
      2. Template cloning: `const __root = __t_ClassName.content.cloneNode(true)`
      3. DOM ref assignments for bindings, events, show, model, slots, child components, attr bindings
      4. If-block template creation (`document.createElement('template')`) and anchor assignment
      5. Each-block template creation and anchor assignment
      6. Ref binding assignments (`this._ref_name = ...`)
      7. DOM append: `this.innerHTML = ''; this.appendChild(__root)`
      8. Static slot injection (named slots, default slots, scoped slot template storage)
    - **Ordering within connectedCallback** (critical):
      ```
      if (this.__connected) return;
      this.__connected = true;
      // -- Slot resolution (reads childNodes BEFORE clearing) --
      // -- Clone template --
      // -- Assign DOM refs --
      // -- If-block templates and anchors --
      // -- Each-block templates and anchors --
      // -- Ref bindings --
      // -- innerHTML = ''; appendChild(__root) --
      // -- Static slot injection --
      this.__ac = new AbortController();
      this.__disposers = [];
      // -- Effects, event listeners, watchers (already here) --
      ```
    - **Edge case**: `attributeChangedCallback` fires before `connectedCallback` — this is safe because it only writes to prop signals (initialized in constructor), never accesses DOM refs
    - _Bug_Condition: isBugCondition(input) where input.creationMethod = "document.createElement" AND generatedConstructor performs DOM manipulation_
    - _Expected_Behavior: Constructor completes without error, element.children.length === 0, element.innerHTML === ""_
    - _Preservation: Connected components render identically — all DOM setup happens in connectedCallback before effects_
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Constructor Does Not Add Children
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior: `document.createElement(tagName)` produces an empty element without error
    - When this test passes, it confirms the expected behavior is satisfied
    - Run: `yarn vitest --run lib/codegen.constructor-compliance.test.js`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed — constructor no longer adds children)
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Generated Code Structure Preserved
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms structural properties are preserved after the fix)
    - Confirm all structural invariants still hold after the codegen refactor
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.9_

- [x] 4. Checkpoint - Run full test suite and verify no regressions
  - Run `yarn vitest --run` to execute all tests
  - All existing tests (471+) must pass — they test connected component behavior which should be unchanged by this fix
  - If any tests fail, investigate whether the failure is due to:
    - Incorrect ordering of DOM operations in connectedCallback
    - Missing DOM refs that effects depend on
    - Slot resolution timing issues
  - Fix any regressions before proceeding
  - Ensure all tests pass, ask the user if questions arise
