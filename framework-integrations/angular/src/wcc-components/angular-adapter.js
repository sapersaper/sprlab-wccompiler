/**
 * Angular adapter for WCC Scoped Slots and Event Binding.
 *
 * Exports:
 *   - WccSlotDef: Auxiliary directive for ng-template[slot]
 *   - WccSlotsDirective: Main directive activated via [wccSlots] attribute
 *   - WccEvent: Single-event directive (wccEvent="name" + wccEmit output)
 *   - WccEvents: Multi-event bridging directive (kebab-case → camelCase)
 *   - WccModel: Two-way binding bridge for [(prop)] banana-box syntax
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
import { Directive, TemplateRef, ElementRef, ViewContainerRef, ChangeDetectorRef, ContentChildren, Output, EventEmitter, inject, Attribute, Input, } from '@angular/core';
import * as i0 from "@angular/core";
// ─── WccSlotDef — Auxiliary Directive ───────────────────────────────────────
/**
 * Auxiliary directive that marks an ng-template as slot content.
 * Captures the TemplateRef and the slot name from the HTML 'slot' attribute.
 *
 * Usage:
 *   <ng-template slot="header">...</ng-template>
 *   <ng-template slot="stats" let-likes>{{likes}}</ng-template>
 */
export class WccSlotDef {
    templateRef = inject(TemplateRef);
    slotName;
    constructor(name) {
        this.slotName = name || '';
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.21", ngImport: i0, type: WccSlotDef, deps: [{ token: 'slot', attribute: true }], target: i0.ɵɵFactoryTarget.Directive });
    static ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "14.0.0", version: "19.2.21", type: WccSlotDef, isStandalone: true, selector: "ng-template[slot]", ngImport: i0 });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.21", ngImport: i0, type: WccSlotDef, decorators: [{
            type: Directive,
            args: [{
                    selector: 'ng-template[slot]',
                    standalone: true,
                }]
        }], ctorParameters: () => [{ type: undefined, decorators: [{
                    type: Attribute,
                    args: ['slot']
                }] }] });
// ─── WccSlotsDirective — Main Directive ─────────────────────────────────────
/**
 * Main directive that activates on elements with the [wccSlots] attribute.
 * Classifies ng-template[slot] children as named or scoped slots and manages
 * their lifecycle.
 *
 * Uses a simple attribute selector `[wccSlots]` instead of a dynamic exclusion
 * selector, because Angular AOT cannot evaluate computed selector expressions.
 */
export class WccSlotsDirective {
    slotDefs;
    el = inject(ElementRef);
    vcr = inject(ViewContainerRef);
    cdr = inject(ChangeDetectorRef);
    slots = new Map();
    eventCleanups = [];
    destroyed = false;
    ngAfterContentInit() {
        // Runtime guard: only proceed for custom elements (tag name contains hyphen)
        if (!this.el.nativeElement.tagName.toLowerCase().includes('-'))
            return;
        // Normalize Angular-style slot attributes: slot-header → slot="header"
        this.normalizeSlotAttributes();
        this.classifyAndInitSlots();
    }
    ngOnDestroy() {
        this.destroyed = true;
        this.cleanup();
    }
    // ─── Slot Attribute Normalization ───────────────────────────────────────
    /**
     * Normalizes Angular-style slot attributes to standard HTML slot attributes.
     * Converts: <div slot-header> → <div slot="header">
     *
     * This enables the Angular ng-content select pattern:
     *   <wcc-card wccSlots>
     *     <nav slot-header>Title</nav>
     *     <span slot-footer>Footer</span>
     *   </wcc-card>
     *
     * Skips reserved prefixes: slot-props, slot-template-*
     */
    normalizeSlotAttributes() {
        const hostEl = this.el.nativeElement;
        for (const child of Array.from(hostEl.children)) {
            for (const attr of Array.from(child.attributes)) {
                if (attr.name.startsWith('slot-') &&
                    !attr.value &&
                    attr.name !== 'slot-props' &&
                    !attr.name.startsWith('slot-template-')) {
                    const slotName = attr.name.slice(5); // "slot-header" → "header"
                    child.removeAttribute(attr.name);
                    child.setAttribute('slot', slotName);
                }
            }
        }
    }
    // ─── Classification ─────────────────────────────────────────────────────
    /** Classifies slots using __scopedSlots from the host element and initializes them */
    async classifyAndInitSlots() {
        const hostEl = this.el.nativeElement;
        const tagName = hostEl.tagName.toLowerCase();
        // Wait for the custom element to be defined (ensures the class is upgraded)
        await customElements.whenDefined(tagName);
        if (this.destroyed)
            return;
        const element = hostEl;
        // Read from instance getter or static property
        const scopedNames = element.__scopedSlots
            || (element.constructor && element.constructor.__scopedSlots)
            || [];
        for (const slotDef of this.slotDefs) {
            if (!slotDef.slotName)
                continue;
            if (scopedNames.includes(slotDef.slotName)) {
                this.initScopedSlot(slotDef);
            }
            else {
                this.initNamedSlot(slotDef);
            }
        }
    }
    // ─── Named Slot ─────────────────────────────────────────────────────────
    /** Named Slot: immediate static rendering */
    initNamedSlot(slotDef) {
        const hostEl = this.el.nativeElement;
        // Strategy 1: Find [data-slot] container inside the component's internal DOM
        const dataSlotEl = hostEl.querySelector(`[data-slot="${slotDef.slotName}"]`);
        let wrapper;
        if (dataSlotEl) {
            // Use the data-slot element directly — clear fallback content and insert rendered nodes
            wrapper = dataSlotEl;
            wrapper.innerHTML = '';
        }
        else {
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
    /**
     * Scoped Slot: token-based approach for per-item slots inside each loops.
     *
     * Angular cannot synchronously render EmbeddedView HTML for per-item content.
     * Instead, we bypass registerSlotRenderer entirely and use the WCC component's
     * built-in __slotTpl_[name] token replacement mechanism:
     *
     * 1. Read the slot prop names from the ng-template's let- attributes
     * 2. Render the template ONCE with unique placeholders for slot props
     * 3. Let Angular resolve its own interpolations ({{ angularVar }})
     * 4. Replace placeholders with {%prop%} tokens
     * 5. Set __slotTpl_[name] on the host element
     * 6. The WCC component's per-item renderer replaces {%prop%} with actual values
     *
     * The key: we DON'T use registerSlotRenderer. We set __slotTpl directly,
     * which the WCC component checks during __renderEach_N.
     */
    initScopedSlot(slotDef) {
        const hostEl = this.el.nativeElement;
        const state = {
            type: 'scoped',
            slotDef,
            viewRef: null,
            cleanup: null,
            wrapperEl: null,
            context: null,
        };
        this.slots.set(slotDef.slotName, state);

        const element = hostEl;

        // Determine slot prop names from __meta or by inspecting the WCC component
        // The WCC component knows its slot props — we need to know which {{ }} are props vs Angular vars
        this.setupTokenTemplate(slotDef, state, element);
    }

    /**
     * Creates a tokenized template for per-item scoped slots.
     * Renders the Angular template once with placeholders for slot props,
     * then replaces those placeholders with {%prop%} tokens.
     */
    async setupTokenTemplate(slotDef, state, element) {
        const hostEl = this.el.nativeElement;
        const tagName = hostEl.tagName.toLowerCase();

        // Wait for custom element to be defined
        await customElements.whenDefined(tagName);
        if (this.destroyed) return;

        // Get slot prop names from the WCC component
        // The component's __renderEach uses these as {%prop%} token names
        const ctor = customElements.get(tagName);
        // We don't have direct access to slot prop names from __meta,
        // but we can infer them from the template's let- vars.
        // Strategy: use unique placeholder values, render once, then find and replace.

        // Build context with unique placeholders for each let- variable
        // We use the TemplateRef to detect how many context vars are needed
        const placeholderPrefix = `__WCC_TOKEN_${Date.now()}_`;
        const placeholders = new Map();
        let implicitPlaceholder = null;

        // Read let- vars from template element (stored by Angular in the template definition)
        // Since we can't directly access let- attributes after compilation,
        // we try a different approach: render with known placeholder values
        // and detect which parts of the output contain them.

        // Heuristic: typical slot props are the slot name itself (item) and 'index'
        // We generate placeholders for common patterns
        const commonProps = [slotDef.slotName, 'index', 'item', 'i', 'idx'];
        const context = { $implicit: `${placeholderPrefix}IMPLICIT__` };
        for (const prop of commonProps) {
            context[prop] = `${placeholderPrefix}${prop.toUpperCase()}__`;
            placeholders.set(`${placeholderPrefix}${prop.toUpperCase()}__`, prop);
        }
        placeholders.set(`${placeholderPrefix}IMPLICIT__`, slotDef.slotName);

        // Create ONE EmbeddedView with placeholders
        state.viewRef = this.vcr.createEmbeddedView(slotDef.templateRef, context);

        // Wait for Angular to render (need a tick for interpolation resolution)
        await new Promise(resolve => {
            this.cdr.detectChanges();
            requestAnimationFrame(() => {
                if (this.destroyed) { resolve(); return; }
                state.viewRef.detectChanges();
                this.cdr.detectChanges();

                // Extract HTML from the rendered view
                const container = document.createElement('div');
                for (const node of state.viewRef.rootNodes) {
                    container.appendChild(node.cloneNode(true));
                }
                let html = container.innerHTML;

                // Replace placeholders with {%prop%} tokens
                for (const [placeholder, propName] of placeholders) {
                    html = html.replaceAll(placeholder, `{%${propName}%}`);
                }

                // Set the tokenized template on the WCC component
                element[`__slotTpl_${slotDef.slotName}`] = html;

                // Trigger a re-render of the list to use the new template
                // The WCC component will pick up __slotTpl_item on next render
                if (element._state && element._state.items) {
                    // Force invalidation to re-render with the template
                    const items = element._state.items;
                    element._state.items = null;
                    element._state.items = items;
                }

                // Cleanup the view
                state.viewRef.destroy();
                state.viewRef = null;

                resolve();
            });
        });
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
    buildContext(props) {
        const keys = Object.keys(props);
        if (keys.length === 0) {
            return { $implicit: undefined };
        }
        // $implicit is always the first prop value — this maps to `let-varName` (no ="value")
        // Named props are available via `let-varName="propName"` syntax
        return { $implicit: props[keys[0]], ...props };
    }
    // ─── Render Slot ────────────────────────────────────────────────────────
    /** Creates or updates the EmbeddedView of a scoped slot */
    renderSlot(slotName, props) {
        const state = this.slots.get(slotName);
        if (!state || this.destroyed)
            return;
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
        }
        else {
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
    insertView(slotName, state) {
        if (!state.viewRef)
            return;
        const hostEl = this.el.nativeElement;
        // Strategy 1: Find [data-slot] container inside the component's internal DOM
        const dataSlotEl = hostEl.querySelector(`[data-slot="${slotName}"]`);
        if (dataSlotEl) {
            // Use the data-slot element as the wrapper (no extra div needed)
            state.wrapperEl = dataSlotEl;
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
    cleanup() {
        for (const [, state] of this.slots) {
            if (state.viewRef) {
                state.viewRef.destroy();
            }
            if (state.cleanup) {
                state.cleanup();
            }
            if (state.wrapperEl) {
                if (state.wrapperEl.hasAttribute('data-slot')) {
                    state.wrapperEl.innerHTML = '';
                }
                else if (state.wrapperEl.parentNode) {
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
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.21", ngImport: i0, type: WccSlotsDirective, deps: [], target: i0.ɵɵFactoryTarget.Directive });
    static ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "14.0.0", version: "19.2.21", type: WccSlotsDirective, isStandalone: true, selector: "[wccSlots]", queries: [{ propertyName: "slotDefs", predicate: WccSlotDef }], ngImport: i0 });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.21", ngImport: i0, type: WccSlotsDirective, decorators: [{
            type: Directive,
            args: [{
                    selector: '[wccSlots]',
                    standalone: true,
                }]
        }], propDecorators: { slotDefs: [{
                type: ContentChildren,
                args: [WccSlotDef]
            }] } });
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
export class WccEvent {
    wccEvent = '';
    wccEmit = new EventEmitter();
    el = inject(ElementRef);
    listener = null;
    ngOnInit() {
        if (!this.wccEvent)
            return;
        this.listener = (e) => {
            this.wccEmit.emit(e.detail);
        };
        this.el.nativeElement.addEventListener(this.wccEvent, this.listener);
    }
    ngOnDestroy() {
        if (this.listener && this.wccEvent) {
            this.el.nativeElement.removeEventListener(this.wccEvent, this.listener);
        }
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.21", ngImport: i0, type: WccEvent, deps: [], target: i0.ɵɵFactoryTarget.Directive });
    static ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "14.0.0", version: "19.2.21", type: WccEvent, isStandalone: true, selector: "[wccEvent]", inputs: { wccEvent: "wccEvent" }, outputs: { wccEmit: "wccEmit" }, ngImport: i0 });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.21", ngImport: i0, type: WccEvent, decorators: [{
            type: Directive,
            args: [{
                    selector: '[wccEvent]',
                    standalone: true,
                }]
        }], propDecorators: { wccEvent: [{
                type: Input
            }], wccEmit: [{
                type: Output
            }] } });
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
export class WccEvents {
    /** Optional explicit list of kebab-case event names to bridge */
    wccEvents = '';
    el = inject(ElementRef);
    listeners = [];
    ngOnInit() {
        const hostEl = this.el.nativeElement;
        const tagName = hostEl.tagName.toLowerCase();
        if (!tagName.includes('-'))
            return;
        this.setupEvents(hostEl, tagName);
    }
    async setupEvents(hostEl, tagName) {
        let eventNames;
        if (Array.isArray(this.wccEvents) && this.wccEvents.length > 0) {
            eventNames = this.wccEvents;
        }
        else {
            // Auto-discover from component metadata
            await customElements.whenDefined(tagName);
            const ctor = customElements.get(tagName);
            eventNames = ctor?.__events || [];
        }
        if (eventNames.length === 0)
            return;
        for (const eventName of eventNames) {
            // Only bridge events that have hyphens (already camelCase events don't need bridging)
            if (!eventName.includes('-'))
                continue;
            const camelName = eventName.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            const listener = (e) => {
                // Re-dispatch with camelCase name — Angular's (camelName) binding will catch it
                hostEl.dispatchEvent(new CustomEvent(camelName, {
                    detail: e.detail,
                    bubbles: false,
                    cancelable: false,
                }));
            };
            hostEl.addEventListener(eventName, listener);
            this.listeners.push([eventName, listener]);
        }
    }
    ngOnDestroy() {
        const hostEl = this.el.nativeElement;
        for (const [name, listener] of this.listeners) {
            hostEl.removeEventListener(name, listener);
        }
        this.listeners = [];
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.21", ngImport: i0, type: WccEvents, deps: [], target: i0.ɵɵFactoryTarget.Directive });
    static ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "14.0.0", version: "19.2.21", type: WccEvents, isStandalone: true, selector: "[wccEvents]", inputs: { wccEvents: "wccEvents" }, ngImport: i0 });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.21", ngImport: i0, type: WccEvents, decorators: [{
            type: Directive,
            args: [{
                    selector: '[wccEvents]',
                    standalone: true,
                }]
        }], propDecorators: { wccEvents: [{
                type: Input
            }] } });
// ─── WccModel — Two-way Binding Bridge (OPTIONAL) ───────────────────────────
/**
 * Optional directive for Angular's [(prop)] banana-box syntax on WCC elements.
 *
 * NOTE: As of WCC v0.11+, the compiled component emits `propChange` directly,
 * so [(prop)] works zero-config without this directive. This directive is kept
 * as an alternative that uses the structured wcc:model event instead.
 *
 * Angular's [(prop)] expands to:
 *   [prop]="value" (propChange)="value = $event.detail"
 *
 * The component already emits `propChange` natively, so this works out of the box.
 * This directive provides an alternative path via wcc:model for advanced use cases
 * (e.g., when you need access to oldValue or want to handle multiple models centrally).
 *
 * Usage (optional):
 *   <wcc-input wccModel [(value)]="text"></wcc-input>
 */
export class WccModel {
    /** Optional explicit list of model prop names to bridge */
    wccModel = '';
    el = inject(ElementRef);
    listener = null;
    ngOnInit() {
        const hostEl = this.el.nativeElement;
        const tagName = hostEl.tagName.toLowerCase();
        if (!tagName.includes('-'))
            return;
        this.setupModelBridge(hostEl, tagName);
    }
    async setupModelBridge(hostEl, tagName) {
        // Determine which model props to bridge
        let modelNames;
        if (Array.isArray(this.wccModel) && this.wccModel.length > 0) {
            modelNames = this.wccModel;
        }
        else {
            // Auto-discover from component metadata
            await customElements.whenDefined(tagName);
            const ctor = customElements.get(tagName);
            modelNames = ctor?.__meta?.models || [];
        }
        if (modelNames.length === 0)
            return;
        const modelSet = new Set(modelNames);
        // Listen for wcc:model and re-dispatch as propChange
        this.listener = (e) => {
            const detail = e.detail;
            if (!detail || !modelSet.has(detail.prop))
                return;
            // Dispatch propChange (Angular banana-box convention)
            hostEl.dispatchEvent(new CustomEvent(`${detail.prop}Change`, {
                detail: detail.value,
                bubbles: false,
                cancelable: false,
            }));
        };
        hostEl.addEventListener('wcc:model', this.listener);
    }
    ngOnDestroy() {
        if (this.listener) {
            this.el.nativeElement.removeEventListener('wcc:model', this.listener);
            this.listener = null;
        }
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.21", ngImport: i0, type: WccModel, deps: [], target: i0.ɵɵFactoryTarget.Directive });
    static ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "14.0.0", version: "19.2.21", type: WccModel, isStandalone: true, selector: "[wccModel]", inputs: { wccModel: "wccModel" }, ngImport: i0 });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.21", ngImport: i0, type: WccModel, decorators: [{
            type: Directive,
            args: [{
                    selector: '[wccModel]',
                    standalone: true,
                }]
        }], propDecorators: { wccModel: [{
                type: Input
            }] } });
