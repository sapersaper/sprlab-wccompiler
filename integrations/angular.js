/**
 * Angular integration guide for WCC custom elements.
 *
 * @module @sprlab/wccompiler/integrations/angular
 *
 * Setup requires two steps:
 *
 * 1. Import the adapter in main.ts (enables [(prop)] two-way binding):
 *    ```ts
 *    import '@sprlab/wccompiler/adapters/angular'
 *    ```
 *
 * 2. Add CUSTOM_ELEMENTS_SCHEMA to your component/module:
 *
 * @example Standalone component (Angular 17+)
 * ```ts
 * import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
 *
 * @Component({
 *   selector: 'app-root',
 *   schemas: [CUSTOM_ELEMENTS_SCHEMA],
 *   template: `
 *     <!-- Simple one-way binding -->
 *     <wcc-counter [count]="myCount"></wcc-counter>
 *
 *     <!-- Two-way binding with [(prop)] -->
 *     <wcc-input [(value)]="text"></wcc-input>
 *   `
 * })
 * export class AppComponent {
 *   text = '';
 *   myCount = 0;
 * }
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
 * @example Two-way binding with [(prop)]
 * The WccModel directive translates wcc:model events to Angular's propChange convention.
 * Angular's banana-in-a-box [(prop)] expands to:
 *   [prop]="value" (propChange)="value = $event.detail"
 *
 * So when the WCC component emits wcc:model with { prop: 'value', value: 'new' },
 * the WccModel directive re-dispatches as 'valueChange' CustomEvent, which Angular picks up.
 *
 * @example ngModel support (requires ControlValueAccessor)
 * For ngModel/ReactiveForms, see the WccValueAccessor guide in:
 *   @sprlab/wccompiler/adapters/angular
 *
 * That file contains a copy-paste TypeScript directive implementation.
 */

/**
 * Configuration instructions for Angular projects using WCC components.
 * This is a documentation-only export — Angular's AOT compiler requires
 * CUSTOM_ELEMENTS_SCHEMA to be imported directly from @angular/core.
 *
 * @type {{ schema: string, standalone: string, ngModule: string, adapter: string }}
 */
export const WCC_ANGULAR_CONFIG = {
  schema: "import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core'",
  standalone: "@Component({ schemas: [CUSTOM_ELEMENTS_SCHEMA] })",
  ngModule: "@NgModule({ schemas: [CUSTOM_ELEMENTS_SCHEMA] })",
  adapter: "import '@sprlab/wccompiler/adapters/angular' // in main.ts",
}
