/**
 * Angular adapter for WCC (defineModel + Scoped Slots).
 *
 * This module provides Angular integration for WCC components:
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * SCOPED SLOTS (Native Angular Syntax)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * For native Angular scoped slot support, use the TypeScript directives:
 *
 *   import { WccSlotsDirective, WccSlotDef } from '@sprlab/wccompiler/adapters/angular';
 *
 * Setup:
 *   @Component({
 *     imports: [WccSlotsDirective, WccSlotDef],
 *     schemas: [CUSTOM_ELEMENTS_SCHEMA],
 *     template: `...`
 *   })
 *
 * The directives auto-activate on custom elements (tags with hyphen).
 * No [wccSlots] attribute is needed on the host element.
 *
 * Slot declaration uses ng-template[slot] syntax:
 *
 *   <!-- Named slot (static content, no let-*) -->
 *   <wcc-card>
 *     <ng-template slot="header"><strong>My Header</strong></ng-template>
 *   </wcc-card>
 *
 *   <!-- Scoped slot (reactive data via let-*) -->
 *   <wcc-card>
 *     <ng-template slot="stats" let-likes>{{ likes }} likes</ng-template>
 *   </wcc-card>
 *
 *   <!-- Multiple props in scoped slot -->
 *   <wcc-card>
 *     <ng-template slot="details" let-data let-likes="likes" let-total="total">
 *       {{ likes }}/{{ total }}
 *     </ng-template>
 *   </wcc-card>
 *
 * How it works:
 *   - WccSlotDef captures the TemplateRef and slot name from the 'slot' attribute
 *   - WccSlotsDirective classifies slots as named or scoped using __scopedSlots
 *   - Named slots render immediately into <div slot="name" style="display:contents">
 *   - Scoped slots register a renderer via element.registerSlotRenderer()
 *   - When slot props change, the renderer updates the Angular EmbeddedView
 *   - Compatible with OnPush change detection strategy
 *
 * The directive source is in adapters/angular.ts (TypeScript with Angular decorators).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * BACKWARD COMPATIBILITY: slot-template-* (Token Replacement)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * The legacy slot-template-* attribute approach continues to work without
 * importing the directives:
 *
 *   <wcc-list>
 *     <div slot-template-item="<li>{%item%}</li>"></div>
 *   </wcc-list>
 *
 * When WccSlotsDirective IS imported, ng-template[slot] takes priority over
 * slot-template-* for the same slot name. Slots not covered by ng-template
 * continue using the token replacement path.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * defineModel (Two-Way Binding)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * The WCC component already emits `propNameChange` directly from _modelSet,
 * so Angular's [(prop)] banana-box syntax works WITHOUT this adapter.
 *
 * This file is kept for:
 * 1. Documentation of the Angular integration approach
 * 2. The ControlValueAccessor guide for ngModel support
 *
 * Setup (Angular):
 *   // No adapter import needed for [(prop)]! Just use CUSTOM_ELEMENTS_SCHEMA:
 *   import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core'
 *   @Component({ schemas: [CUSTOM_ELEMENTS_SCHEMA] })
 *
 * Usage:
 *   <wcc-input [(value)]="text"></wcc-input>
 *   <wcc-counter [(count)]="myCount"></wcc-counter>
 *
 * How it works:
 *   Angular's [(prop)] expands to [prop]="value" (propChange)="value = $event.detail"
 *   WCC _modelSet emits propNameChange CustomEvent with detail=newValue
 *   Angular picks it up automatically — no adapter needed.
 *
 * @module @sprlab/wccompiler/adapters/angular
 */

// ── ControlValueAccessor for ngModel/ReactiveForms ──────────────────
// Angular's ngModel requires a ControlValueAccessor to bridge form controls.
// Copy this into your Angular project as a .ts file:
//
// ```ts
// import { Directive, ElementRef, forwardRef, HostListener } from '@angular/core';
// import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
//
// @Directive({
//   selector: '[wccModel]',
//   providers: [{
//     provide: NG_VALUE_ACCESSOR,
//     useExisting: forwardRef(() => WccValueAccessor),
//     multi: true
//   }]
// })
// export class WccValueAccessor implements ControlValueAccessor {
//   private onChange: (value: any) => void = () => {};
//   private onTouched: () => void = () => {};
//
//   constructor(private el: ElementRef<HTMLElement>) {}
//
//   writeValue(value: any): void {
//     if (value != null) {
//       this.el.nativeElement.setAttribute('value', String(value));
//     } else {
//       this.el.nativeElement.removeAttribute('value');
//     }
//   }
//
//   registerOnChange(fn: (value: any) => void): void {
//     this.onChange = fn;
//   }
//
//   registerOnTouched(fn: () => void): void {
//     this.onTouched = fn;
//   }
//
//   @HostListener('wcc:model', ['$event'])
//   onModelChange(event: CustomEvent): void {
//     if (event.detail && event.detail.prop === 'value') {
//       this.onChange(event.detail.value);
//     }
//   }
//
//   @HostListener('blur')
//   onBlur(): void {
//     this.onTouched();
//   }
// }
// ```
