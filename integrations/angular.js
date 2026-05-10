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
 * That's it — one line of config. WCC components work as native custom elements
 * in Angular without any additional wrapper or helper.
 */

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
