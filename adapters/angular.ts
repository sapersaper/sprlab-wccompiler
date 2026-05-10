/**
 * Angular adapter for WCC Scoped Slots.
 *
 * Exports:
 *   - WccSlotDef: Auxiliary directive for ng-template[slot]
 *   - WccSlotsDirective: Main directive that auto-activates on custom elements
 *   - SlotContext: Interface for template context typing
 *
 * Usage:
 *   import { WccSlotsDirective, WccSlotDef } from '@sprlab/wccompiler/adapters/angular';
 *
 *   @Component({
 *     imports: [WccSlotsDirective, WccSlotDef],
 *     schemas: [CUSTOM_ELEMENTS_SCHEMA],
 *     template: `
 *       <wcc-card>
 *         <ng-template slot="header"><strong>Header</strong></ng-template>
 *         <ng-template slot="stats" let-likes>{{ likes }} likes</ng-template>
 *       </wcc-card>
 *     `
 *   })
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
 * Exclusion selector: lists all standard HTML elements.
 * Custom elements (which MUST contain a hyphen) are not excluded.
 */
const STANDARD_ELEMENTS = 'div,span,p,a,button,input,form,section,article,header,footer,nav,main,ul,ol,li,table,tr,td,th,thead,tbody,tfoot,img,h1,h2,h3,h4,h5,h6,label,select,textarea,option,fieldset,legend,details,summary,dialog,slot,template,canvas,video,audio,source,iframe,pre,code,blockquote,hr,br,strong,em,small,sub,sup,mark,del,ins,figure,figcaption,picture,svg,math,body,html,head,script,style,link,meta,title,base,col,colgroup,caption,abbr,address,area,aside,b,bdi,bdo,cite,data,dd,dfn,dl,dt,i,kbd,map,meter,noscript,output,progress,q,rp,rt,ruby,s,samp,time,u,var,wbr';

/** Build the exclusion selector string */
const EXCLUSION_SELECTOR = STANDARD_ELEMENTS.split(',').map(t => `:not(${t})`).join('');

/**
 * Main directive that auto-activates on custom elements (tags with hyphen).
 * Classifies ng-template[slot] children as named or scoped slots and manages
 * their lifecycle.
 */
@Directive({
  selector: EXCLUSION_SELECTOR,
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
      // Ignore templates with empty slot name
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

    // Props null/undefined: clear the view
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
      // Update existing context
      Object.assign(state.viewRef.context, context);
      state.viewRef.markForCheck();
    } else {
      // Create new view
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

    // Clear previous wrapper content and append new nodes
    state.wrapperEl.innerHTML = '';
    for (const node of state.viewRef.rootNodes) {
      state.wrapperEl.appendChild(node);
    }
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────

  /** Full cleanup on destroy */
  private cleanup(): void {
    // Destroy views, invoke cleanup functions, remove wrappers
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

    // Remove event listeners
    for (const fn of this.eventCleanups) {
      fn();
    }
    this.eventCleanups = [];
  }
}
