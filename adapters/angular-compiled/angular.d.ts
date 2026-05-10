/**
 * Angular adapter for WCC Scoped Slots.
 *
 * Exports:
 *   - WccSlotDef: Auxiliary directive for ng-template[slot]
 *   - WccSlotsDirective: Main directive activated via [wccSlots] attribute
 *   - SlotContext: Interface for template context typing
 *
 * Usage:
 *   import { WccSlotsDirective, WccSlotDef } from '@sprlab/wccompiler/adapters/angular';
 *
 *   @Component({
 *     imports: [WccSlotsDirective, WccSlotDef],
 *     schemas: [CUSTOM_ELEMENTS_SCHEMA],
 *     template: `
 *       <wcc-card wccSlots>
 *         <ng-template slot="header"><strong>Header</strong></ng-template>
 *         <ng-template slot="stats" let-likes>{{ likes }} likes</ng-template>
 *       </wcc-card>
 *     `
 *   })
 *
 * Note: Add the `wccSlots` attribute to any WCC custom element that uses slots.
 * This is required because Angular AOT cannot evaluate dynamic selectors.
 *
 * @module @sprlab/wccompiler/adapters/angular
 */
import { QueryList, AfterContentInit, OnDestroy } from '@angular/core';
/** Context object passed to createEmbeddedView for scoped slots */
export interface SlotContext {
    $implicit: any;
    [key: string]: any;
}
/**
 * Auxiliary directive that marks an ng-template as slot content.
 * Captures the TemplateRef and the slot name from the HTML 'slot' attribute.
 *
 * Usage:
 *   <ng-template slot="header">...</ng-template>
 *   <ng-template slot="stats" let-likes>{{likes}}</ng-template>
 */
export declare class WccSlotDef {
    readonly templateRef: any;
    readonly slotName: string;
    constructor(name: string | null);
}
/**
 * Main directive that activates on elements with the [wccSlots] attribute.
 * Classifies ng-template[slot] children as named or scoped slots and manages
 * their lifecycle.
 *
 * Uses a simple attribute selector `[wccSlots]` instead of a dynamic exclusion
 * selector, because Angular AOT cannot evaluate computed selector expressions.
 */
export declare class WccSlotsDirective implements AfterContentInit, OnDestroy {
    slotDefs: QueryList<WccSlotDef>;
    private el;
    private vcr;
    private cdr;
    private slots;
    private eventCleanups;
    private destroyed;
    ngAfterContentInit(): void;
    ngOnDestroy(): void;
    /** Classifies slots using __scopedSlots from the host element and initializes them */
    private classifyAndInitSlots;
    /** Named Slot: immediate static rendering */
    private initNamedSlot;
    /** Scoped Slot: async registration + reactive rendering */
    private initScopedSlot;
    /**
     * Builds the Angular context for createEmbeddedView.
     *
     * Rules:
     * - 0 props: $implicit = undefined
     * - 1 prop: $implicit = that single value, plus the named prop key
     * - N props (N > 1): $implicit = full props object, plus all named props
     */
    buildContext(props: Record<string, any>): SlotContext;
    /** Creates or updates the EmbeddedView of a scoped slot */
    private renderSlot;
    /** Inserts view root nodes into the custom element's DOM via a wrapper div */
    private insertView;
    /** Full cleanup on destroy */
    private cleanup;
}
