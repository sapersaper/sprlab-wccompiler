# Constructor Spec Compliance Bugfix Design

## Overview

WCC compiled components perform DOM manipulation (template cloning, DOM ref assignment, innerHTML clearing, appendChild) inside the constructor of the generated HTMLElement subclass. This violates the Custom Elements specification which states "The element must not gain any attributes or children" during construction. The fix moves all DOM operations from the constructor into `connectedCallback`, leaving only reactive state initialization (signals, computeds, constants, watcher prev-values, prop signals) in the constructor. This is a codegen-only change in `lib/codegen.js`'s `generateComponent` function.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — when a WCC component is created via `document.createElement()` (detached from DOM), the browser enforces the spec and throws `NotSupportedError`
- **Property (P)**: The desired behavior — `document.createElement('wcc-tag')` completes without error and produces an element with no children; upon connection the component renders correctly
- **Preservation**: All existing rendering behavior (reactivity, events, slots, if/each directives, refs, child components) must continue to work identically when the component is connected to the DOM
- **generateComponent**: The function in `lib/codegen.js` that takes a `ParseResult` and produces the JavaScript class string for a compiled web component
- **connectedCallback**: The Custom Elements lifecycle method called when the element is inserted into the DOM
- **Idempotency guard**: The `if (this.__connected) return` check at the top of `connectedCallback` that prevents duplicate setup on reconnection

## Bug Details

### Bug Condition

The bug manifests when a WCC compiled component is instantiated via `document.createElement()` (or any programmatic construction path). The generated constructor clones a template, assigns DOM refs, clears `innerHTML`, and calls `appendChild` — all DOM mutations forbidden by the Custom Elements spec during construction.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ComponentCreationContext
  OUTPUT: boolean
  
  RETURN input.creationMethod = "document.createElement"
         AND generatedConstructor performs DOM manipulation
         AND browser enforces Custom Elements spec
END FUNCTION
```

### Examples

- `document.createElement('wcc-counter')` → throws `NotSupportedError: Failed to execute 'createElement' on 'Document': The result must not have children` because the constructor calls `this.appendChild(__root)`
- Vue 3 rendering `<wcc-counter/>` → framework calls `document.createElement('wcc-counter')` internally → same error, component cannot be used in Vue
- React rendering `<wcc-counter/>` via `createElement` → same error, component incompatible with React
- Static HTML `<wcc-counter></wcc-counter>` → works because the parser creates the element differently (upgrade path), but this is fragile and non-standard reliance

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Components used in static HTML (`<wcc-counter></wcc-counter>`) must continue to render correctly with full reactivity, event handling, and DOM updates
- Slot resolution (named, default, scoped) must continue to work — slot content is read from `this.childNodes` before clearing, which still happens in `connectedCallback` before `innerHTML = ''`
- `if` directives must continue to create branch templates, anchor references, and manage conditional rendering
- `each` directives must continue to create iteration templates, anchor references, and manage list rendering
- `templateRef` declarations must continue to assign ref DOM references correctly
- Child component imports must continue to resolve and render nested custom elements
- The idempotency guard (`if (this.__connected) return`) must continue to prevent duplicate setup on reconnection
- Standalone runtime mode must continue to inline the reactive runtime and function identically
- Props initialized via `defineProps` must continue to respond to `setAttribute()` calls before connection (via `attributeChangedCallback` writing to prop signals that live in the constructor)

**Scope:**
All inputs that do NOT involve programmatic `document.createElement()` construction should be completely unaffected by this fix. This includes:
- Components declared in static HTML (parser upgrade path)
- Components appended after `createElement` + `connectedCallback` (these will now work correctly)
- All existing test scenarios that test connected component behavior

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is clear:

1. **DOM Manipulation in Constructor**: The `generateComponent` function emits the following DOM operations inside the `constructor()` body:
   - `__t_ClassName.content.cloneNode(true)` — clones the template
   - `this.__b0 = __root.childNodes[0]...` — assigns DOM refs from the cloned tree
   - `this.innerHTML = ''` — clears existing children
   - `this.appendChild(__root)` — appends the cloned template as children
   
   These violate the spec requirement that constructors must not add children or attributes.

2. **Slot Resolution Ordering**: Slot resolution reads `this.childNodes` before `innerHTML = ''`. This ordering must be preserved in `connectedCallback` — slots must be resolved before clearing.

3. **If/Each Template and Anchor Creation**: If-block templates (`this.${vn}_t0 = document.createElement('template')`) and each-block templates are created in the constructor and reference anchor nodes from `__root`. These must move to `connectedCallback` since they depend on the cloned DOM tree.

4. **Ref Bindings**: Ref assignments (`this._ref_name = __root.childNodes[...]`) reference the cloned tree and must also move to `connectedCallback`.

## Correctness Properties

Property 1: Bug Condition - Constructor Does Not Add Children

_For any_ valid WCC component definition compiled by `generateComponent`, when the compiled component is instantiated via `document.createElement(tagName)`, the constructor SHALL complete without throwing any error AND the resulting element SHALL have zero children (`element.children.length === 0`) and empty innerHTML (`element.innerHTML === ""`).

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Connected Components Render Identically

_For any_ valid WCC component definition compiled by `generateComponent`, when the compiled component is connected to the DOM (via `appendChild` or static HTML), the fixed code SHALL produce the same rendered DOM, the same reactive behavior, and the same event handling as the original code — preserving all existing functionality for connected components.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `lib/codegen.js`

**Function**: `generateComponent`

**Specific Changes**:

1. **Keep in Constructor** (reactive state only):
   - Prop signal initialization: `this._s_name = __signal(default)`
   - Signal initialization: `this._name = __signal(value)`
   - Constant initialization: `this._const_name = value`
   - Computed initialization: `this._c_name = __computed(() => ...)`
   - Watcher prev-value initialization: `this.__prev_name = undefined`

2. **Move to connectedCallback** (DOM operations — insert AFTER the idempotency guard, BEFORE effects):
   - Slot resolution (`__slotMap`, `__defaultSlotNodes` reading from `this.childNodes`)
   - Template cloning: `const __root = __t_ClassName.content.cloneNode(true)`
   - DOM ref assignments for bindings, events, show, model, slots, child components, attr bindings
   - If-block template creation and anchor assignment
   - Each-block template creation and anchor assignment
   - Ref binding assignments
   - DOM append: `this.innerHTML = ''; this.appendChild(__root)`
   - Static slot injection

3. **Ordering within connectedCallback** (critical):
   ```
   if (this.__connected) return;
   this.__connected = true;
   
   // 1. Slot resolution (reads childNodes BEFORE clearing)
   // 2. Clone template
   // 3. Assign DOM refs
   // 4. If-block templates and anchors
   // 5. Each-block templates and anchors
   // 6. Ref bindings
   // 7. innerHTML = ''; appendChild(__root)
   // 8. Static slot injection
   
   // 9. AbortController + disposers
   this.__ac = new AbortController();
   this.__disposers = [];
   
   // 10. Effects, event listeners, etc. (already here)
   ```

4. **No changes needed to**:
   - `disconnectedCallback` — still cleans up `__ac` and `__disposers`
   - `attributeChangedCallback` — still writes to prop signals (which are in constructor)
   - User methods, computed bodies, effect bodies — all reference `this._*` which are initialized in constructor (signals) or `connectedCallback` (DOM refs), and effects only run after DOM refs are assigned

5. **Edge case: attributeChangedCallback before connectedCallback**:
   - Frameworks may call `setAttribute()` before connecting. This triggers `attributeChangedCallback` which writes to prop signals. Since prop signals are initialized in the constructor, this works correctly. DOM refs are not accessed in `attributeChangedCallback`.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that compile a WCC component using the existing `compile()` function, evaluate the generated code, and call `document.createElement(tagName)`. Run these tests on the UNFIXED code to observe the `NotSupportedError` being thrown.

**Test Cases**:
1. **Simple Counter Component**: Compile a basic counter component and call `document.createElement('wcc-counter')` (will throw on unfixed code)
2. **Component with Slots**: Compile a component with named/default slots and call `createElement` (will throw on unfixed code)
3. **Component with Props**: Compile a component with `defineProps` and call `createElement`, then `setAttribute` before connecting (will throw on unfixed code)
4. **Component with If/Each**: Compile a component with directives and call `createElement` (will throw on unfixed code)

**Expected Counterexamples**:
- `document.createElement` throws `NotSupportedError` because the constructor calls `this.appendChild(__root)`
- Root cause confirmed: DOM manipulation in constructor violates spec

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  compiledCode := generateComponent(input.parseResult)
  element := document.createElement(input.tagName)
  ASSERT element.children.length = 0
  ASSERT element.innerHTML = ""
  ASSERT no_error_thrown
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  // Component is connected to DOM (static HTML or appendChild after createElement)
  ASSERT F(input).renderedDOM = F'(input).renderedDOM
  ASSERT F(input).reactivity = F'(input).reactivity
  ASSERT F(input).eventHandling = F'(input).eventHandling
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many component configurations automatically (varying signals, computeds, bindings, events, slots, if/each blocks)
- It catches edge cases in the codegen output that manual unit tests might miss
- It provides strong guarantees that the generated code structure is correct for all valid inputs

**Test Plan**: The existing 471 tests already verify connected component behavior. Run the full test suite to confirm preservation. Additionally, write property-based tests that generate random `ParseResult` objects and verify the generated constructor contains only reactive state initialization.

**Test Cases**:
1. **Full Test Suite Preservation**: All 471 existing tests must pass — they test connected component behavior which should be unchanged
2. **Constructor Content Verification**: For any valid ParseResult, the generated constructor must not contain `appendChild`, `innerHTML`, `cloneNode`, or DOM ref assignments
3. **ConnectedCallback Content Verification**: For any valid ParseResult, the generated connectedCallback must contain the DOM setup code in the correct order
4. **Prop Signal Timing**: Verify that `setAttribute` before connection correctly updates prop signals (attributeChangedCallback works without DOM refs)

### Unit Tests

- Test that `document.createElement('wcc-tag')` does not throw for compiled components
- Test that `createElement` produces an element with no children
- Test that after connecting (appendChild to document), the component renders correctly
- Test that `setAttribute` before connection updates prop signals correctly
- Test that reconnection (disconnect + reconnect) still uses the idempotency guard

### Property-Based Tests

- Generate random valid ParseResult objects (varying combinations of signals, computeds, bindings, events, slots, if-blocks, each-blocks, props, refs) and verify the generated constructor contains ONLY signal/computed/constant/watcher initialization
- Generate random valid ParseResult objects and verify the generated connectedCallback contains DOM setup followed by effects
- Generate random component configurations and verify `document.createElement` produces empty elements without errors

### Integration Tests

- Compile a full component with all features (props, signals, computeds, slots, if, each, refs, events, model, show, attr bindings) and verify it works end-to-end after connection
- Test the Vue/React use case: createElement → setAttribute → appendChild → verify rendering
- Test disconnect/reconnect cycle with the fixed code
