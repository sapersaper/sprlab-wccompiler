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
  inject,
  Attribute,
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
  private classifyAndInitSlots(): void {
    const element = this.el.nativeElement as any;
    const scopedNames: string[] = element.__scopedSlots || [];

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
    const wrapper = document.createElement('div');
    wrapper.setAttribute('slot', slotDef.slotName);
    wrapper.style.display = 'contents';

    const viewRef = this.vcr.createEmbeddedView(slotDef.templateRef);
    for (const node of viewRef.rootNodes) {
      wrapper.appendChild(node);
    }
    hostEl.appendChild(wrapper);

    this.slots.set(slotDef.slotName, {
      type: 'named',
      slotDef,
      viewRef,
      cleanup: null,
      wrapperEl: wrapper,
      context: null,
    });
  }

  // ─── Scoped Slot ────────────────────────────────────────────────────────

  /** Scoped Slot: async registration + reactive rendering */
  private async initScopedSlot(slotDef: WccSlotDef): Promise<void> {
    const hostEl = this.el.nativeElement;
    const tagName = hostEl.tagName.toLowerCase();

    // Wait for the custom element to be defined
    await customElements.whenDefined(tagName);
    if (this.destroyed) return;

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
      Object.assign(state.viewRef.context, context);
      state.viewRef.markForCheck();
    } else {
      state.viewRef = this.vcr.createEmbeddedView(state.slotDef.templateRef, context);
      this.insertView(slotName, state);
    }

    this.cdr.markForCheck();
  }

  // ─── DOM Insertion ──────────────────────────────────────────────────────

  /** Inserts view root nodes into the custom element's DOM via a wrapper div */
  private insertView(slotName: string, state: SlotState): void {
    if (!state.viewRef) return;
    const hostEl = this.el.nativeElement;

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
      if (state.wrapperEl && state.wrapperEl.parentNode) {
        state.wrapperEl.parentNode.removeChild(state.wrapperEl);
      }
    }
    this.slots.clear();

    for (const fn of this.eventCleanups) {
      fn();
    }
    this.eventCleanups = [];
  }
}
