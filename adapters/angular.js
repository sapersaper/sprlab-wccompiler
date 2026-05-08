/**
 * Angular adapter for WCC defineModel (OPTIONAL).
 *
 * The WCC component already emits `propNameChange` directly from _modelSet,
 * so Angular's [(prop)] banana-box syntax works WITHOUT this adapter.
 *
 * This file is kept for:
 * 1. Documentation of the Angular integration approach
 * 2. The ControlValueAccessor guide for ngModel support
 *
 * Setup (Angular):
 *   // No adapter import needed! Just use CUSTOM_ELEMENTS_SCHEMA:
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
