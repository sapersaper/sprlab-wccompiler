/**
 * Angular adapter for WCC defineModel — enables [(propName)] two-way binding.
 *
 * Import this ONCE in your Angular app's main.ts:
 *   import '@sprlab/wccompiler/adapters/angular'
 *
 * What it does:
 * 1. Translates wcc:model events → propNameChange (enables [(prop)] syntax)
 * 2. Uses queueMicrotask to defer event emission outside Angular's render cycle
 *    (prevents NG0600: "Writing to signals is not allowed while Angular renders")
 *
 * Usage:
 *   <!-- In Angular template (with CUSTOM_ELEMENTS_SCHEMA) -->
 *   <wcc-input [(value)]="text"></wcc-input>
 *   <wcc-counter [(count)]="myCount"></wcc-counter>
 *
 * For ngModel support, you need a ControlValueAccessor.
 * See the exported WccValueAccessor class below.
 *
 * @module @sprlab/wccompiler/adapters/angular
 */

// ── Document-level adapter: wcc:model → propNameChange ──────────────
// Angular's [(prop)] syntax listens for `propChange` events.
// Uses queueMicrotask to defer the re-dispatch outside Angular's synchronous
// render cycle, preventing NG0600 errors when Angular is mid-render.

if (typeof document !== 'undefined') {
  document.addEventListener('wcc:model', (e) => {
    const { prop, value } = e.detail;
    const target = e.target;

    // Defer to next microtask to avoid NG0600
    // (Angular doesn't allow signal writes during render)
    queueMicrotask(() => {
      target.dispatchEvent(new CustomEvent(`${prop}Change`, {
        detail: value,
        bubbles: true
      }));
    });
  });
}

// ── ControlValueAccessor for ngModel/ReactiveForms ──────────────────
// Angular's ngModel requires a ControlValueAccessor to bridge form controls.
// Since this is a JS file (not TypeScript with decorators), we export the
// implementation as a guide. Users need to create a TypeScript directive.
//
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
//     // Parent → Child: set attribute
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
//
// Usage with ngModel:
//   <wcc-input wccModel [(ngModel)]="text"></wcc-input>
//
// Usage with Reactive Forms:
//   <wcc-input wccModel [formControl]="myControl"></wcc-input>
