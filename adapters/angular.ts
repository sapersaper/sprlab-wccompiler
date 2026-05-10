/**
 * Angular adapter for WCC Scoped Slots and Event Binding.
 *
 * Exports:
 *   - WccSlotDef: Auxiliary directive for ng-template[slot]
 *   - WccSlotsDirective: Main directive activated via [wccSlots] attribute
 *   - WccEvent: Single-event directive (wccEvent="name" + wccEmit output)
 *   - WccEvents: Multi-event bridging directive (kebab-case → camelCase)
 *   - SlotContext: Interface for template context typing
 *
 * Usage:
 *   import { WccSlotsDirective, WccSlotDef, WccEvent, WccEvents } from '@sprlab/wccompiler/adapters/angular';
 *
 *   @Component({
 *     imports: [WccSlotsDirective, WccSlotDef, WccEvent, WccEvents],
 *     schemas: [CUSTOM_ELEMENTS_SCHEMA],
 *     template: `
 *       <wcc-card wccSlots>
 *         <ng-template slot="header"><strong>Header</strong></ng-template>
 *         <ng-template slot="stats" let-likes>{{ likes }} likes</ng-template>
 *       </wcc-card>
 *
 *       <!-- Event binding option 1: single event with unwrapped detail -->
 *       <wcc-counter wccEvent="count-changed" (wccEmit)="onCount($event)"></wcc-counter>
 *
 *       <!-- Event binding option 2: camelCase event names -->
 *       <wcc-counter wccEvents (countChanged)="onCount($event.detail)"></wcc-counter>
 *
 *       <!-- Event binding option 3: standard Angular (always works) -->
 *       <wcc-counter (count-changed)="onCount($event.detail)"></wcc-counter>
 *     `
 *   })
 *
 * Note: Add the `wccSlots` attribute to any WCC element that uses slots.
 * This is required because Angular AOT cannot evaluate dynamic selectors.
 *
 * @module @sprlab/wccompiler/adapters/angular
 */

import {
  Directive,
  TemplateRef,
  ElementRef,
  ViewContainerRef,
  ChangeDetectorRef,
  ContentChildren,
  QueryList,
  EmbeddedViewRef,
  AfterContentInit,
  OnDestroy,
  OnInit,
  Output,
  EventEmitter,
  inject,
  Attribute,
  Input,
} from '@angular/core';

// ─── Interfaces ─────────────────────────────────────────────────────────────

/** Context object passed to createEmbeddedView for scoped slots */
export interface SlotContext {
  $implicit: any;
  [key: string]: any;
}

type SlotType = 'named' | 'scoped';

interface SlotState {
  type: SlotType;
  slotDef: WccSlotDef;
  viewRef: EmbeddedViewRef<SlotContext> | null;
  cleanup: (() => void) | null;
  wrapperEl: HTMLElement | null;
  context: SlotContext | null;
}

// ─── WccSlotDef — Auxiliary Directive ───────────────────────────────────────

/**
 * Auxiliary directive that marks an ng-template as slot content.
 * Captures the TemplateRef and the slot name from the HTML 'slot' attribute.
 *
 * Usage:
 *   <ng-template slot="header">...</ng-template>
 *   <ng-template slot="stats" let-likes>{{likes}}</ng-template>
 */
@Directive({
  selector: 'ng-template[slot]',
  standalone: true,
})
export class WccSlotDef {
  public readonly templateRef = inject<TemplateRef<any>>(TemplateRef);
  public readonly slotName: string;

  constructor(@Attribute('slot') name: string | null) {
    this.slotName = name || '';
  }
}

// ─── WccSlotsDirective — Main Directive ─────────────────────────────────────

/**
 * Main directive that activates on elements with the [wccSlots] attribute.
 * Classifies ng-template[slot] children as named or scoped slots and manages
 * their lifecycle.
 *
 * Uses a simple attribute selector `[wccSlots]` instead of a dynamic exclusion
 * selector, because Angular AOT cannot evaluate computed selector expressions.
 */
@Directive({
  selector: '[wccSlots]',
  standalone: true,
})
export class WccSlotsDirective implements AfterContentInit, OnDestroy {
  @ContentChildren(WccSlotDef) slotDefs!: QueryList<WccSlotDef>;

  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private vcr = inject(ViewContainerRef);
  private cdr = inject(ChangeDetectorRef);

  private slots = new Map<string, SlotState>();
  private eventCleanups: (() => void)[] = [];
  private destroyed = false;

  ngAfterContentInit(): void {
    // Runtime guard: only proceed for custom elements (tag name contains hyphen)
    if (!this.el.nativeElement.tagName.toLowerCase().includes('-')) return;

    this.classifyAndInitSlots();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.cleanup();
  }

  // ─── Classification ─────────────────────────────────────────────────────

  /** Classifies slots using __scopedSlots from the host element and initializes them */
  private async classifyAndInitSlots(): Promise<void> {
    const hostEl = this.el.nativeElement;
    const tagName = hostEl.tagName.toLowerCase();

    // Wait for the custom element to be defined (ensures the class is upgraded)
    await customElements.whenDefined(tagName);
    if (this.destroyed) return;

    const element = hostEl as any;
    // Read from instance getter or static property
    const scopedNames: string[] = element.__scopedSlots
      || (element.constructor && element.constructor.__scopedSlots)
      || [];

    for (const slotDef of this.slotDefs) {
      if (!slotDef.slotName) continue;

      if (scopedNames.includes(slotDef.slotName)) {
        this.initScopedSlot(slotDef);
      } else {
        this.initNamedSlot(slotDef);
      }
    }
  }

  // ─── Named Slot ─────────────────────────────────────────────────────────

  /** Named Slot: immediate static rendering */
  private initNamedSlot(slotDef: WccSlotDef): void {
    const hostEl = this.el.nativeElement;

    // Strategy 1: Find [data-slot] container inside the component's internal DOM
    const dataSlotEl = hostEl.querySelector(`[data-slot="${slotDef.slotName}"]`);
    let wrapper: HTMLElement;

    if (dataSlotEl) {
      // Use the data-slot element directly — clear fallback content and insert rendered nodes
      wrapper = dataSlotEl as HTMLElement;
      wrapper.innerHTML = '';
    } else {
      // Strategy 2: Fallback for Shadow DOM / native <slot> elements
      wrapper = document.createElement('div');
      wrapper.setAttribute('slot', slotDef.slotName);
      wrapper.style.display = 'contents';
      hostEl.appendChild(wrapper);
    }

    const viewRef = this.vcr.createEmbeddedView(slotDef.templateRef);
    for (const node of viewRef.rootNodes) {
      wrapper.appendChild(node);
    }

    this.slots.set(slotDef.slotName, {
      type: 'named',
      slotDef,
      viewRef,
      cleanup: null,
      wrapperEl: wrapper,
      context: null,
    });

    this.cdr.detectChanges();
  }

  // ─── Scoped Slot ────────────────────────────────────────────────────────

  /** Scoped Slot: registration + reactive rendering */
  private initScopedSlot(slotDef: WccSlotDef): void {
    const hostEl = this.el.nativeElement;

    const state: SlotState = {
      type: 'scoped',
      slotDef,
      viewRef: null,
      cleanup: null,
      wrapperEl: null,
      context: null,
    };
    this.slots.set(slotDef.slotName, state);

    // Register renderer
    const element = hostEl as any;
    if (typeof element.registerSlotRenderer === 'function') {
      state.cleanup = element.registerSlotRenderer(
        slotDef.slotName,
        (props: Record<string, any>) => this.renderSlot(slotDef.slotName, props)
      );
    } else {
      // Fallback: listen for wcc:slot-update event
      const handler = (e: CustomEvent) => {
        if (e.detail?.slot === slotDef.slotName) {
          this.renderSlot(slotDef.slotName, e.detail.props);
        }
      };
      hostEl.addEventListener('wcc:slot-update', handler as EventListener);
      this.eventCleanups.push(() =>
        hostEl.removeEventListener('wcc:slot-update', handler as EventListener)
      );
    }
  }

  // ─── Context Construction ───────────────────────────────────────────────

  /**
   * Builds the Angular context for createEmbeddedView.
   *
   * Rules:
   * - 0 props: $implicit = undefined
   * - 1 prop: $implicit = that single value, plus the named prop key
   * - N props (N > 1): $implicit = full props object, plus all named props
   */
  buildContext(props: Record<string, any>): SlotContext {
    const keys = Object.keys(props);
    if (keys.length === 0) {
      return { $implicit: undefined };
    }
    if (keys.length === 1) {
      return { $implicit: props[keys[0]], ...props };
    }
    return { $implicit: props, ...props };
  }

  // ─── Render Slot ────────────────────────────────────────────────────────

  /** Creates or updates the EmbeddedView of a scoped slot */
  private renderSlot(slotName: string, props: Record<string, any> | null): void {
    const state = this.slots.get(slotName);
    if (!state || this.destroyed) return;

    if (props == null) {
      if (state.viewRef) {
        state.viewRef.destroy();
        state.viewRef = null;
      }
      return;
    }

    const context = this.buildContext(props);
    state.context = context;

    if (state.viewRef) {
      // Update existing view context
      Object.assign(state.viewRef.context, context);
      state.viewRef.markForCheck();
      // Re-insert nodes to reflect updated content (Angular doesn't auto-update DOM for detached views)
      if (state.wrapperEl) {
        state.wrapperEl.innerHTML = '';
        for (const node of state.viewRef.rootNodes) {
          state.wrapperEl.appendChild(node);
        }
      }
    } else {
      state.viewRef = this.vcr.createEmbeddedView(state.slotDef.templateRef, context);
      this.insertView(slotName, state);
    }

    this.cdr.detectChanges();
  }

  // ─── DOM Insertion ──────────────────────────────────────────────────────

  /**
   * Inserts view root nodes into the custom element's DOM.
   *
   * Strategy:
   * 1. Look for a [data-slot="slotName"] element inside the component (non-Shadow DOM)
   *    → clear its content and insert the rendered nodes there
   * 2. Fallback: append a wrapper <div slot="slotName"> to the host (Shadow DOM / native slots)
   */
  private insertView(slotName: string, state: SlotState): void {
    if (!state.viewRef) return;
    const hostEl = this.el.nativeElement;

    // Strategy 1: Find [data-slot] container inside the component's internal DOM
    const dataSlotEl = hostEl.querySelector(`[data-slot="${slotName}"]`);
    if (dataSlotEl) {
      // Use the data-slot element as the wrapper (no extra div needed)
      state.wrapperEl = dataSlotEl as HTMLElement;
      state.wrapperEl.innerHTML = '';
      for (const node of state.viewRef.rootNodes) {
        state.wrapperEl.appendChild(node);
      }
      return;
    }

    // Strategy 2: Fallback for Shadow DOM / native <slot> elements
    if (!state.wrapperEl) {
      state.wrapperEl = document.createElement('div');
      state.wrapperEl.setAttribute('slot', slotName);
      state.wrapperEl.style.display = 'contents';
      hostEl.appendChild(state.wrapperEl);
    }

    state.wrapperEl.innerHTML = '';
    for (const node of state.viewRef.rootNodes) {
      state.wrapperEl.appendChild(node);
    }
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────

  /** Full cleanup on destroy */
  private cleanup(): void {
    for (const [, state] of this.slots) {
      if (state.viewRef) {
        state.viewRef.destroy();
      }
      if (state.cleanup) {
        state.cleanup();
      }
      if (state.wrapperEl) {
        // If the wrapper is a [data-slot] element (part of the component's internal DOM),
        // just clear its content rather than removing it from the DOM
        if (state.wrapperEl.hasAttribute('data-slot')) {
          state.wrapperEl.innerHTML = '';
        } else if (state.wrapperEl.parentNode) {
          state.wrapperEl.parentNode.removeChild(state.wrapperEl);
        }
      }
    }
    this.slots.clear();

    for (const fn of this.eventCleanups) {
      fn();
    }
    this.eventCleanups = [];
  }
}


// ─── WccEvent — Event Binding Directive ─────────────────────────────────────

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
@Directive({
  selector: '[wccEvent]',
  standalone: true,
})
export class WccEvent implements OnInit, OnDestroy {
  @Input() wccEvent = '';
  @Output() wccEmit = new EventEmitter<any>();

  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private listener: ((e: Event) => void) | null = null;

  ngOnInit(): void {
    if (!this.wccEvent) return;
    this.listener = (e: Event) => {
      this.wccEmit.emit((e as CustomEvent).detail);
    };
    this.el.nativeElement.addEventListener(this.wccEvent, this.listener);
  }

  ngOnDestroy(): void {
    if (this.listener && this.wccEvent) {
      this.el.nativeElement.removeEventListener(this.wccEvent, this.listener);
    }
  }
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
@Directive({
  selector: '[wccEvents]',
  standalone: true,
})
export class WccEvents implements OnInit, OnDestroy {
  /** Optional explicit list of kebab-case event names to bridge */
  @Input() wccEvents: string[] | '' = '';

  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private listeners: Array<[string, (e: Event) => void]> = [];

  ngOnInit(): void {
    const hostEl = this.el.nativeElement;
    const tagName = hostEl.tagName.toLowerCase();
    if (!tagName.includes('-')) return;

    this.setupEvents(hostEl, tagName);
  }

  private async setupEvents(hostEl: HTMLElement, tagName: string): Promise<void> {
    let eventNames: string[];

    if (Array.isArray(this.wccEvents) && this.wccEvents.length > 0) {
      eventNames = this.wccEvents;
    } else {
      // Auto-discover from component metadata
      await customElements.whenDefined(tagName);
      const ctor = customElements.get(tagName) as any;
      eventNames = ctor?.__events || [];
    }

    if (eventNames.length === 0) return;

    for (const eventName of eventNames) {
      // Only bridge events that have hyphens (already camelCase events don't need bridging)
      if (!eventName.includes('-')) continue;

      const camelName = eventName.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());

      const listener = (e: Event) => {
        // Re-dispatch with camelCase name — Angular's (camelName) binding will catch it
        hostEl.dispatchEvent(new CustomEvent(camelName, {
          detail: (e as CustomEvent).detail,
          bubbles: false,
          cancelable: false,
        }));
      };

      hostEl.addEventListener(eventName, listener);
      this.listeners.push([eventName, listener]);
    }
  }

  ngOnDestroy(): void {
    const hostEl = this.el.nativeElement;
    for (const [name, listener] of this.listeners) {
      hostEl.removeEventListener(name, listener);
    }
    this.listeners = [];
  }
}
