# Design Document — Nested Components

## Overview

When a template contains custom elements like `<wcc-badge label="{{role}}">`, the compiler:
1. Detects the custom element during tree-walking
2. Extracts reactive attribute bindings (`label="{{role}}"` → bind `role` to `label`)
3. Resolves the child component's source file in the input directory
4. Generates an `import` statement and reactive `__effect` for each binding

## Data Flow

```
Template:
  <div class="profile">
    <wcc-badge label="{{role}}" color="green"></wcc-badge>
  </div>

Tree Walker:
  1. Detect <wcc-badge> (tag contains hyphen → custom element)
  2. Scan attributes:
     - label="{{role}}" → reactive binding { attr: 'label', expr: 'role', type: 'interpolation' }
     - color="green" → static (no interpolation, leave as-is)
  3. Record ChildComponentBinding:
     { tag: 'wcc-badge', varName: '__child0', path: [...], propBindings: [{ attr: 'label', expr: 'role' }] }
  4. Remove {{role}} from attribute value in DOM (set to empty string)

Compiler:
  1. For each child tag, search input dir for matching defineComponent({ tag: 'wcc-badge' })
  2. Compute relative path: './wcc-badge.js'

Code Generator:
  // Import at top
  import './wcc-badge.js';

  // In constructor: ref to child element
  this.__child0 = __root.childNodes[0].childNodes[1];

  // In connectedCallback: reactive prop binding
  __effect(() => {
    this.__child0.setAttribute('label', this._s_role() ?? '');
  });
```

## Data Models

### ChildPropBinding

```js
/**
 * @typedef {Object} ChildPropBinding
 * @property {string} attr   — Attribute name on the child element (e.g., 'label')
 * @property {string} expr   — Expression from {{expr}} (e.g., 'role')
 * @property {string} type   — Binding source type: 'signal' | 'computed' | 'prop' | 'constant' | 'method'
 */
```

### ChildComponentBinding

```js
/**
 * @typedef {Object} ChildComponentBinding
 * @property {string} tag          — Child component tag name (e.g., 'wcc-badge')
 * @property {string} varName      — Internal ref name (e.g., '__child0')
 * @property {string[]} path       — DOM path from __root
 * @property {ChildPropBinding[]} propBindings — Reactive attribute bindings
 */
```

### ChildComponentImport

```js
/**
 * @typedef {Object} ChildComponentImport
 * @property {string} tag          — Child component tag name
 * @property {string} importPath   — Relative import path (e.g., './wcc-badge.js')
 */
```
