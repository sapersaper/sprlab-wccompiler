# Implementation Plan: Framework Integrations

## Overview

Add optional Vue, React, and Angular integration helpers to `@sprlab/wccompiler`. Each integration is a standalone ESM file in `integrations/`, exposed via subpath exports, with framework dependencies declared as optional peer deps. Tests use vitest + fast-check for property-based testing.

## Tasks

- [x] 1. Update package.json with exports, peer dependencies, and files configuration
  - Add `exports` field with entries for `.`, `./integrations/vue`, `./integrations/react`, `./integrations/angular`
  - Add `peerDependencies` for `@vitejs/plugin-vue` (>=4.0.0), `vue` (>=3.0.0), `react` (>=18.0.0), `@angular/core` (>=14.0.0)
  - Add `peerDependenciesMeta` marking all peer deps as optional
  - Add `integrations/` to the `files` array
  - _Requirements: 1.1, 1.5, 6.1, 6.2, 6.3, 6.4, 7.1_

- [ ] 2. Implement Vue integration
  - [x] 2.1 Create `integrations/vue.js` with `wccVuePlugin` factory function
    - Import `vue` from `@vitejs/plugin-vue`
    - Accept optional `{ prefix }` option, default to `'wcc-'`
    - Return result of `vue()` with `template.compilerOptions.isCustomElement` set to `tag => tag.startsWith(prefix)`
    - Export `wccVuePlugin` as a named export
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ] 2.2 Write property test for Vue prefix matching (Property 1)
    - Create `lib/integrations.vue.test.js`
    - Mock `@vitejs/plugin-vue` using `vi.mock()`
    - Use fast-check to generate random prefix and tag strings
    - Verify `isCustomElement(tag) === tag.startsWith(prefix)` for all generated inputs
    - Include example tests: plugin returns object with `name`, correct nested structure, named export
    - **Property 1: isCustomElement prefix matching**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6**

- [ ] 3. Implement React integration
  - [x] 3.1 Create `integrations/react.js` with `useWccEvent` hook
    - Import `useRef`, `useEffect` from `react`
    - Create element ref via `useRef(null)`
    - Store latest handler in a separate ref to avoid re-attaching listeners
    - Use `useEffect` keyed on `eventName` to attach/detach event listener on `ref.current`
    - Return the element ref
    - Export `useWccEvent` as a named export
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ] 3.2 Write property tests for React hook lifecycle and dispatch (Properties 2 & 3)
    - Create `lib/integrations.react.test.js`
    - Mock `react` with minimal `useRef`/`useEffect` implementations that track calls
    - Use fast-check to generate random event names and detail values
    - Verify addEventListener/removeEventListener lifecycle (Property 2)
    - Verify handler invocation with correct event detail (Property 3)
    - Include example tests: hook returns ref object, handler ref update doesn't re-attach, named export
    - **Property 2: Event listener lifecycle (attach and cleanup)**
    - **Property 3: Event dispatch invokes handler**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

- [ ] 4. Implement Angular integration
  - [x] 4.1 Create `integrations/angular.js` with `WCC_SCHEMAS` and `WccModule`
    - Import `CUSTOM_ELEMENTS_SCHEMA` from `@angular/core`
    - Export `WCC_SCHEMAS` as `[CUSTOM_ELEMENTS_SCHEMA]`
    - Export `WccModule` class with static `schemas` property
    - Add JSDoc documenting NgModule usage pattern
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 4.2 Write tests for Angular integration
    - Create `lib/integrations.angular.test.js`
    - Mock `@angular/core` with `CUSTOM_ELEMENTS_SCHEMA` constant
    - Verify `WCC_SCHEMAS` equals `[CUSTOM_ELEMENTS_SCHEMA]`
    - Verify `WccModule` is exported as a class
    - Verify both named exports are present
    - **Validates: Requirements 4.1, 4.3, 4.5**

- [x] 5. Checkpoint - Ensure all tests pass
  - Run `yarn vitest --run` and ensure all integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Write decoupling property test (Property 4)
  - [ ] 6.1 Create `lib/integrations.decoupling.test.js`
    - Read all files in `integrations/` directory
    - Read all files in `lib/` directory
    - Parse import/require statements from each file
    - Verify no integration file imports from `lib/` and no lib file imports from `integrations/`
    - Include package.json smoke tests: verify `exports`, `peerDependencies`, `peerDependenciesMeta`, and `files` fields
    - **Property 4: Integration-core decoupling**
    - **Validates: Requirements 5.1, 5.2, 5.4, 1.1, 1.5, 7.1**

- [x] 7. Update README with framework integration documentation
  - Add a "Framework Integrations" section to README.md
  - Document Vue integration usage with `wccVuePlugin()` in `vite.config.js`
  - Document React integration usage with `useWccEvent` hook example
  - Document Angular integration usage with `WCC_SCHEMAS` in component/module schemas
  - Note that each integration requires its respective framework as a peer dependency
  - _Requirements: 2.5, 3.1, 4.2, 6.4, 7.3_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Run `yarn vitest --run` and ensure all tests pass
  - Verify no regressions in existing compiler tests
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- All integration files are plain ESM JavaScript with JSDoc type annotations (no build step)
- Framework peer dependencies are mocked in tests using `vi.mock()` so tests run without installing Vue/React/Angular
