/**
 * Angular adapter for WCC custom elements.
 *
 * @module @sprlab/wccompiler/adapters/angular
 *
 * ANGULAR INTEGRATION:
 *
 * The adapter ships as TypeScript source (adapters/angular.ts) because Angular
 * AOT requires directives to be compiled within the consuming project's scope.
 * The package.json "exports" map points directly to the .ts file, which Angular's
 * esbuild-based `application` builder (Angular 17+) handles natively.
 *
 * SETUP:
 *
 * 1. Install the package:
 *    npm install @sprlab/wccompiler
 *
 * 2. Add a tsconfig path mapping (tsconfig.json):
 *    {
 *      "compilerOptions": {
 *        "paths": {
 *          "@sprlab/wccompiler/adapters/angular": ["node_modules/@sprlab/wccompiler/adapters/angular.ts"]
 *        }
 *      }
 *    }
 *
 * 3. Import in your component:
 *    import { WccSlotsDirective, WccSlotDef } from '@sprlab/wccompiler/adapters/angular';
 *
 *    @Component({
 *      imports: [WccSlotsDirective, WccSlotDef],
 *      schemas: [CUSTOM_ELEMENTS_SCHEMA],
 *      template: `
 *        <wcc-card wccSlots>
 *          <ng-template slot="header"><strong>Title</strong></ng-template>
 *          <ng-template slot="stats" let-likes>⭐ {{likes}} stars!</ng-template>
 *        </wcc-card>
 *      `
 *    })
 *
 * HOW IT WORKS:
 *
 * - WccSlotDef: Captures ng-template[slot] elements and their slot names
 * - WccSlotsDirective: Activated via [wccSlots] attribute on the host element
 *   - Classifies slots as "named" or "scoped" using the component's __scopedSlots metadata
 *   - Named slots: rendered immediately into the component's [data-slot] container
 *   - Scoped slots: registered via registerSlotRenderer() for reactive updates
 *
 * REQUIREMENTS:
 * - Angular 17+ with the `application` builder (esbuild-based)
 * - The [wccSlots] attribute must be added to WCC elements that use slots
 *
 * NOTE: This .js file is documentation only. The actual source is adapters/angular.ts.
 */
