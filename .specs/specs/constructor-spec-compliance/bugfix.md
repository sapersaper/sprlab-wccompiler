# Bugfix Requirements Document

## Introduction

WCC compiled components violate the Custom Elements specification by performing DOM manipulation in the constructor. The `generateComponent` function in `lib/codegen.js` emits code that clones templates, assigns DOM refs, clears `innerHTML`, and appends children — all within the constructor. This violates the spec requirement that "The element must not gain any attributes or children" during construction, causing a `NotSupportedError: Failed to execute 'createElement' on 'Document': The result must not have children` when frameworks (Vue 3, React, Angular) create WCC components programmatically via `document.createElement()`.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a WCC compiled component is created via `document.createElement()` THEN the browser throws `NotSupportedError: Failed to execute 'createElement' on 'Document': The result must not have children` because the constructor clones a template and appends it as children

1.2 WHEN the constructor executes THEN the system clones the template (`__t_ClassName.content.cloneNode(true)`), assigns DOM ref variables from the cloned tree, clears `innerHTML`, and calls `appendChild(__root)` — all of which are DOM mutations forbidden by the Custom Elements spec during construction

1.3 WHEN a framework (Vue 3, React, Angular) attempts to render a WCC component programmatically THEN the component cannot be instantiated, making WCC components incompatible with all major frameworks that use `document.createElement()`

### Expected Behavior (Correct)

2.1 WHEN a WCC compiled component is created via `document.createElement()` THEN the constructor SHALL complete without throwing any error and without adding attributes or children to the element

2.2 WHEN the constructor executes THEN the system SHALL only initialize reactive state (signals, computeds, constants, watcher prev-values, prop signals) and SHALL NOT perform any DOM manipulation (no template cloning, no DOM ref assignment, no innerHTML clearing, no appendChild)

2.3 WHEN the component's `connectedCallback` fires for the first time THEN the system SHALL clone the template, assign DOM refs from the cloned tree, clear `innerHTML`, append the cloned root, and then set up effects, event listeners, and other reactive bindings — performing all DOM setup that was previously in the constructor

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a WCC component is used in static HTML (`<wcc-counter></wcc-counter>`) THEN the system SHALL CONTINUE TO render correctly with full reactivity, event handling, and DOM updates

3.2 WHEN a WCC component has slots THEN the system SHALL CONTINUE TO resolve slot content (named slots, default slots, scoped slots) correctly during first connection

3.3 WHEN a WCC component has `if` directives THEN the system SHALL CONTINUE TO create branch templates, anchor references, and manage conditional rendering correctly

3.4 WHEN a WCC component has `each` directives THEN the system SHALL CONTINUE TO create iteration templates, anchor references, and manage list rendering correctly

3.5 WHEN a WCC component has `templateRef` declarations THEN the system SHALL CONTINUE TO assign ref DOM references correctly so they are accessible in effects and methods

3.6 WHEN a WCC component has child component imports THEN the system SHALL CONTINUE TO resolve and render nested custom elements correctly

3.7 WHEN a WCC component is disconnected and reconnected THEN the system SHALL CONTINUE TO use the idempotent guard (`if (this.__connected) return`) to prevent duplicate setup

3.8 WHEN a WCC component uses the standalone runtime mode THEN the system SHALL CONTINUE TO inline the reactive runtime and function identically

3.9 WHEN a WCC component defines props with `defineProps` THEN the system SHALL CONTINUE TO initialize prop signals and respond to attribute changes via `attributeChangedCallback`

---

## Bug Condition

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type ComponentCreationContext
  OUTPUT: boolean
  
  // The bug triggers when a WCC component is created programmatically
  // (detached from DOM), where the spec is enforced by the browser
  RETURN X.creationMethod = "document.createElement"
END FUNCTION
```

## Property Specification

```pascal
// Property: Fix Checking — Constructor must not add children
FOR ALL X WHERE isBugCondition(X) DO
  element ← document.createElement(X.tagName)
  ASSERT element.children.length = 0
  ASSERT element.innerHTML = ""
  ASSERT no_error_thrown
END FOR
```

## Preservation Goal

```pascal
// Property: Preservation Checking — Connected components render identically
FOR ALL X WHERE NOT isBugCondition(X) DO
  // When component is placed in DOM (static HTML or appendChild after createElement)
  ASSERT F(X).renderedDOM = F'(X).renderedDOM
  ASSERT F(X).reactivity = F'(X).reactivity
  ASSERT F(X).eventHandling = F'(X).eventHandling
END FOR
```

**Key Definitions:**
- **F**: The original codegen — DOM manipulation in constructor
- **F'**: The fixed codegen — DOM manipulation deferred to connectedCallback
