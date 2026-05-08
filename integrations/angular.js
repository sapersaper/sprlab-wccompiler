/**
 * Angular integration guide for WCC custom elements.
 *
 * @module @sprlab/wccompiler/integrations/angular
 *
 * Angular's AOT compiler requires schemas to be statically analyzable,
 * so we cannot provide a re-exported schema constant that works at compile time.
 * Instead, use Angular's built-in CUSTOM_ELEMENTS_SCHEMA directly:
 *
 * @example Standalone component (Angular 17+)
 * ```ts
 * import { Component } from '@angular/core';
 * import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
 *
 * @Component({
 *   selector: 'app-root',
 *   schemas: [CUSTOM_ELEMENTS_SCHEMA],
 *   template: `<wcc-counter></wcc-counter>`
 * })
 * export class AppComponent {}
 * ```
 *
 * @example NgModule approach
 * ```ts
 * import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
 *
 * @NgModule({
 *   schemas: [CUSTOM_ELEMENTS_SCHEMA],
 * })
 * export class AppModule {}
 * ```
 *
 * @example Two-way binding with defineModel
 * ```ts
 * // The adapter translates wcc:model events to Angular's propNameChange convention.
 * // Import the integration once in your main.ts or app module:
 * import '@sprlab/wccompiler/integrations/angular'
 *
 * // Then use Angular's banana-in-a-box syntax:
 * // <wcc-input [(value)]="myValue"></wcc-input>
 * ```
 *
 * That's it — one line of config. WCC components work as native custom elements
 * in Angular without any additional wrapper or helper.
 */

// Side-effect: registers document-level wcc:model → propNameChange translation
// This enables [(propName)] two-way binding on WCC components in Angular templates.
import '../adapters/angular.js'

/**
 * Configuration instructions for Angular projects using WCC components.
 * This is a documentation-only export — Angular's AOT compiler requires
 * CUSTOM_ELEMENTS_SCHEMA to be imported directly from @angular/core.
 *
 * @type {{ schema: string, standalone: string, ngModule: string }}
 */
export const WCC_ANGULAR_CONFIG = {
  schema: "import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core'",
  standalone: "@Component({ schemas: [CUSTOM_ELEMENTS_SCHEMA] })",
  ngModule: "@NgModule({ schemas: [CUSTOM_ELEMENTS_SCHEMA] })",
}
