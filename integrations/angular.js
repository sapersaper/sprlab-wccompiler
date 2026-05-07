/**
 * Angular schema helper for WCC custom elements.
 * Provides CUSTOM_ELEMENTS_SCHEMA configuration for Angular modules/components.
 *
 * @module @sprlab/wccompiler/integrations/angular
 */

import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core'

/**
 * Schema array for Angular components/modules that use WCC custom elements.
 * Use in @Component({ schemas: WCC_SCHEMAS }) or @NgModule({ schemas: WCC_SCHEMAS })
 *
 * @type {Array<import('@angular/core').SchemaMetadata>}
 */
export const WCC_SCHEMAS = [CUSTOM_ELEMENTS_SCHEMA]

/**
 * NgModule-compatible class that declares CUSTOM_ELEMENTS_SCHEMA.
 * Import this in your NgModule's imports array.
 *
 * Usage:
 * @NgModule({ imports: [WccModule] })
 * export class AppModule {}
 *
 * Note: For standalone components (Angular 17+), use WCC_SCHEMAS directly:
 * @Component({ schemas: WCC_SCHEMAS })
 */
export class WccModule {
  static schemas = WCC_SCHEMAS
}
