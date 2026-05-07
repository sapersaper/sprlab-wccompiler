# Requirements Document

## Introduction

Ship optional framework integration helpers as part of the `@sprlab/wccompiler` package. These helpers make it trivial for consumers to use WCC compiled web components inside Vue, React, and Angular projects without needing to know framework-specific custom element configuration.

The integrations are exported as subpath exports from the main package:
- `@sprlab/wccompiler/integrations/vue` — Vite plugin that auto-configures `isCustomElement`
- `@sprlab/wccompiler/integrations/react` — React 18 event helper hook (`useWccEvent`)
- `@sprlab/wccompiler/integrations/angular` — Angular schema helper

These helpers have zero impact on the core compiler — they are purely consumer-side utilities that reduce configuration friction.

## Glossary

- **Integration_Helper**: A standalone JavaScript/TypeScript module exported via subpath exports that provides framework-specific configuration utilities for consuming WCC components.
- **Subpath_Export**: A `package.json` `exports` field entry that maps an import specifier (e.g., `@sprlab/wccompiler/integrations/vue`) to a specific file within the package.
- **Vue_Plugin**: A Vite plugin object returned by `wccVuePlugin()` that configures Vue's template compiler to recognize custom element tags matching a given prefix.
- **isCustomElement**: A Vue compiler option function that tells Vue to treat matching tags as native custom elements rather than Vue components.
- **useWccEvent_Hook**: A React hook that creates a ref, attaches a CustomEvent listener to the referenced DOM element, and cleans up on unmount.
- **WCC_SCHEMAS**: An Angular constant that exports `[CUSTOM_ELEMENTS_SCHEMA]` for use in component or module `schemas` arrays.
- **WccModule**: An Angular NgModule that declares `CUSTOM_ELEMENTS_SCHEMA` for use with the NgModule-based approach.
- **Prefix**: A configurable string (default: `'wcc-'`) used to identify which HTML tags should be treated as custom elements by the Vue integration.
- **Peer_Dependency**: A dependency declared in `peerDependencies` that is not installed automatically — the consumer's project must provide it.

## Requirements

### Requirement 1: Subpath Exports Configuration

**User Story:** As a consumer of `@sprlab/wccompiler`, I want to import framework helpers via clean subpath imports, so that I only load the integration code relevant to my framework.

#### Acceptance Criteria

1. THE package.json SHALL declare subpath exports for `./integrations/vue`, `./integrations/react`, and `./integrations/angular` in the `exports` field.
2. WHEN a consumer imports `@sprlab/wccompiler/integrations/vue`, THE module resolver SHALL resolve to the Vue integration file without errors.
3. WHEN a consumer imports `@sprlab/wccompiler/integrations/react`, THE module resolver SHALL resolve to the React integration file without errors.
4. WHEN a consumer imports `@sprlab/wccompiler/integrations/angular`, THE module resolver SHALL resolve to the Angular integration file without errors.
5. THE package.json SHALL declare `vue`, `react`, and `@angular/core` as optional `peerDependencies` with `peerDependenciesMeta` marking each as optional.
6. WHEN a consumer does not have a framework peer dependency installed, THE unused integration modules SHALL NOT cause installation errors or warnings.

### Requirement 2: Vue Vite Plugin Integration

**User Story:** As a Vue 3 developer using WCC components, I want to import a single Vite plugin that configures `isCustomElement` for all tags matching a prefix, so I don't have to manually configure Vue's compiler options.

#### Acceptance Criteria

1. WHEN `wccVuePlugin()` is called without arguments, THE Vue_Plugin SHALL configure `isCustomElement` to return `true` for tags starting with `'wcc-'`.
2. WHEN `wccVuePlugin({ prefix: 'my-' })` is called with a custom prefix, THE Vue_Plugin SHALL configure `isCustomElement` to return `true` for tags starting with `'my-'`.
3. WHEN a tag does not start with the configured prefix, THE `isCustomElement` function SHALL return `false`.
4. THE Vue_Plugin SHALL return a valid Vite plugin object with a `name` property and the appropriate `vue` compiler options configuration.
5. WHEN the Vue_Plugin is added to a Vite config `plugins` array, THE plugin SHALL integrate with `@vitejs/plugin-vue` to set `template.compilerOptions.isCustomElement`.
6. THE Vue integration file SHALL export `wccVuePlugin` as a named export.

### Requirement 3: React Event Hook Integration

**User Story:** As a React 18 developer using WCC components, I want a hook that bridges CustomEvent to React's event system, so I can listen to WCC component events without manual ref management.

#### Acceptance Criteria

1. WHEN `useWccEvent(eventName, handler)` is called, THE useWccEvent_Hook SHALL return a React ref object suitable for attaching to a JSX element.
2. WHEN the ref is attached to a DOM element, THE useWccEvent_Hook SHALL add an event listener for the specified `eventName` on that element.
3. WHEN the component unmounts, THE useWccEvent_Hook SHALL remove the event listener to prevent memory leaks.
4. WHEN the referenced element dispatches a CustomEvent matching `eventName`, THE useWccEvent_Hook SHALL invoke the provided `handler` callback with the event object.
5. WHEN the `handler` callback reference changes between renders, THE useWccEvent_Hook SHALL use the latest handler without re-attaching the listener.
6. THE React integration file SHALL export `useWccEvent` as a named export.

### Requirement 4: Angular Schema Helper Integration

**User Story:** As an Angular developer using WCC components, I want a simple import that provides `CUSTOM_ELEMENTS_SCHEMA` configuration, so Angular doesn't throw errors about unknown elements.

#### Acceptance Criteria

1. THE Angular integration file SHALL export a `WCC_SCHEMAS` constant containing `[CUSTOM_ELEMENTS_SCHEMA]`.
2. WHEN `WCC_SCHEMAS` is added to a component's `schemas` array, THE Angular compiler SHALL accept any custom element tags without errors.
3. THE Angular integration file SHALL export a `WccModule` NgModule class that includes `CUSTOM_ELEMENTS_SCHEMA` in its `schemas` array.
4. WHEN `WccModule` is imported into another NgModule's `imports` array, THE importing module SHALL inherit the custom elements schema configuration.
5. THE Angular integration file SHALL export both `WCC_SCHEMAS` and `WccModule` as named exports.

### Requirement 5: Zero Impact on Core Compiler

**User Story:** As a maintainer of wcCompiler, I want the integration helpers to be completely decoupled from the core compilation pipeline, so that adding or modifying integrations never risks breaking the compiler.

#### Acceptance Criteria

1. THE integration helper files SHALL NOT import any module from the core compiler (`lib/codegen.js`, `lib/compiler.js`, `lib/sfc-parser.js`, or any other `lib/` module).
2. THE integration helper files SHALL NOT be imported by any core compiler module.
3. WHEN the integration files are removed from the package, THE core compiler SHALL continue to function without modification.
4. THE integration helper files SHALL reside in a dedicated `integrations/` directory separate from the `lib/` directory.

### Requirement 6: Peer Dependency Handling

**User Story:** As a consumer using only one framework, I want the package to not force-install other framework dependencies, so my project stays lean.

#### Acceptance Criteria

1. THE package.json SHALL declare `vue` (version `>=3.0.0`) as an optional peer dependency.
2. THE package.json SHALL declare `react` (version `>=18.0.0`) as an optional peer dependency.
3. THE package.json SHALL declare `@angular/core` (version `>=14.0.0`) as an optional peer dependency.
4. WHEN a consumer installs `@sprlab/wccompiler` without any framework installed, THE installation SHALL complete without errors or unmet peer dependency warnings for the framework packages.
5. IF a consumer imports an integration module without the corresponding framework peer dependency installed, THEN THE module SHALL fail with a clear import error from the missing framework package (standard Node.js module resolution behavior).

### Requirement 7: Package Distribution

**User Story:** As a package maintainer, I want the integration files to be included in the published package, so consumers can import them after installing `@sprlab/wccompiler`.

#### Acceptance Criteria

1. THE `files` field in package.json SHALL include the `integrations/` directory so that integration files are published to npm.
2. WHEN the package is published, THE integration files SHALL be present in the published tarball.
3. THE integration files SHALL be single-file modules with no build step required (plain JavaScript or TypeScript with JSDoc types).
