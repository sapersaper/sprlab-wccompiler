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
import { TemplateRef, QueryList, AfterContentInit, OnDestroy, OnInit, EventEmitter } from '@angular/core';
import * as i0 from "@angular/core";
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
    readonly templateRef: TemplateRef<any>;
    readonly slotName: string;
    constructor(name: string | null);
    static ɵfac: i0.ɵɵFactoryDeclaration<WccSlotDef, [{ attribute: "slot"; }]>;
    static ɵdir: i0.ɵɵDirectiveDeclaration<WccSlotDef, "ng-template[slot]", never, {}, {}, never, never, true, never>;
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
    /** Scoped Slot: registration + reactive rendering */
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
    /**
     * Inserts view root nodes into the custom element's DOM.
     *
     * Strategy:
     * 1. Look for a [data-slot="slotName"] element inside the component (non-Shadow DOM)
     *    → clear its content and insert the rendered nodes there
     * 2. Fallback: append a wrapper <div slot="slotName"> to the host (Shadow DOM / native slots)
     */
    private insertView;
    /** Full cleanup on destroy */
    private cleanup;
    static ɵfac: i0.ɵɵFactoryDeclaration<WccSlotsDirective, never>;
    static ɵdir: i0.ɵɵDirectiveDeclaration<WccSlotsDirective, "[wccSlots]", never, {}, {}, ["slotDefs"], never, true, never>;
}
/**
 * Directive that bridges WCC custom element events to Angular output bindings.
 *
 * Problem: Angular's `(event-name)="handler($event)"` works on custom elements,
 * but `$event` is the raw CustomEvent. The developer must write `$event.detail`
 * to get the payload. This is verbose and error-prone.
 *
 * Solution: This directive listens for CustomEvents on the host element and
 * re-emits them as Angular outputs with `$event = event.detail`.
 *
 * Usage:
 *   <wcc-counter wccEvent="count-changed" (wccEmit)="onCount($event)"></wcc-counter>
 *
 * Or for multiple events, use WccEvents (plural) with a comma-separated list:
 *   <wcc-counter wccEvents="count-changed, value-changed"
 *     (countChanged)="onCount($event)"
 *     (valueChanged)="onValue($event)">
 *   </wcc-counter>
 *
 * The event name is converted from kebab-case to camelCase for the output:
 *   'count-changed' → (countChanged)
 *   'value-changed' → (valueChanged)
 *   'change' → (change)
 */
/**
 * Single-event directive: listens for one CustomEvent and emits its detail.
 *
 * Usage:
 *   <wcc-counter wccEvent="count-changed" (wccEmit)="handler($event)"></wcc-counter>
 */
export declare class WccEvent implements OnInit, OnDestroy {
    wccEvent: string;
    wccEmit: EventEmitter<any>;
    private el;
    private listener;
    ngOnInit(): void;
    ngOnDestroy(): void;
    static ɵfac: i0.ɵɵFactoryDeclaration<WccEvent, never>;
    static ɵdir: i0.ɵɵDirectiveDeclaration<WccEvent, "[wccEvent]", never, { "wccEvent": { "alias": "wccEvent"; "required": false; }; }, { "wccEmit": "wccEmit"; }, never, never, true, never>;
}
/**
 * Event bridging directive: allows using camelCase event bindings on WCC elements.
 *
 * Without this directive, Angular devs must use kebab-case event names:
 *   <wcc-counter (count-changed)="onCount($event.detail)"></wcc-counter>
 *
 * With this directive, they can use camelCase (more Angular-idiomatic):
 *   <wcc-counter wccEvents (countChanged)="onCount($event.detail)"></wcc-counter>
 *
 * The directive listens for kebab-case CustomEvents from the WCC component
 * and re-dispatches them with camelCase names so Angular's event binding picks them up.
 *
 * Event name conversion:
 *   'count-changed' → dispatches 'countChanged'
 *   'value-changed' → dispatches 'valueChanged'
 *   'change' → dispatches 'change' (no conversion needed)
 *
 * Event discovery:
 *   - Auto: reads `static __events` from the WCC component class (set by codegen)
 *   - Manual: pass an explicit array via [wccEvents]="['count-changed', 'value-changed']"
 *
 * Note: $event is still the CustomEvent — use $event.detail to get the payload.
 * This is consistent with how Angular handles all DOM events.
 */
export declare class WccEvents implements OnInit, OnDestroy {
    /** Optional explicit list of kebab-case event names to bridge */
    wccEvents: string[] | '';
    private el;
    private listeners;
    ngOnInit(): void;
    private setupEvents;
    ngOnDestroy(): void;
    static ɵfac: i0.ɵɵFactoryDeclaration<WccEvents, never>;
    static ɵdir: i0.ɵɵDirectiveDeclaration<WccEvents, "[wccEvents]", never, { "wccEvents": { "alias": "wccEvents"; "required": false; }; }, {}, never, never, true, never>;
}
