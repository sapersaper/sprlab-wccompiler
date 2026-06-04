/**
 * WCC ↔ Angular TemplateRef Bridge
 *
 * Bridges Angular TemplateRef property bindings on WCC custom elements
 * to WCC slot content. Use the provideWccBridge() provider in your
 * Angular app's bootstrapApplication() call.
 *
 * @module @sprlab/wccompiler/integrations/angular-adapter
 *
 * @example main.ts
 * import { provideWccBridge } from './wcc-components/angular-adapter'
 * bootstrapApplication(AppComponent, {
 *   providers: [provideWccBridge(), ...]
 * })
 */
import { APP_INITIALIZER } from '@angular/core'

function initWccTemplateBridge() {
  const processed = new WeakSet()
  const pending = new Set()

  function isTemplateRef(v) {
    return v && typeof v === 'object' && typeof v.createEmbeddedView === 'function'
  }

  function slotName(prop) {
    return prop.replace(/^render/, '').replace(/Template$/, '').replace(/^./, c => c.toLowerCase())
  }

  function process(el) {
    if (processed.has(el) || pending.has(el) || !el.tagName) return
    if (!el.tagName.toLowerCase().includes('-')) return
    pending.add(el)
    queueMicrotask(() => {
      pending.delete(el)
      if (processed.has(el)) return
      processed.add(el)
      const tag = el.tagName.toLowerCase()
      customElements.whenDefined(tag).then(() => {
        const ctor = customElements.get(tag)
        const scoped = el.__scopedSlots || (ctor && ctor.__scopedSlots) || []
        const keys = Object.getOwnPropertyNames(el).filter(k => !k.startsWith('_') && !k.startsWith('__'))
        for (const k of keys) {
          const v = el[k]
          if (!isTemplateRef(v)) continue
          const sn = slotName(k)
          if (scoped.includes(sn)) {
            const p = '__WT_' + Date.now() + '_'
            const ctx = { $implicit: p+'IM', item: p+'IT', index: p+'IX', [sn]: p+'SL' }
            const view = v.createEmbeddedView(ctx)
            view.detectChanges?.()
            const c = document.createElement('div')
            view.rootNodes.forEach(n => c.appendChild(n.cloneNode(true)))
            let h = c.innerHTML
            h = h.replaceAll(p+'IM', `{%${sn}%}`).replaceAll(p+'IT', '{%item%}').replaceAll(p+'IX', '{%index%}').replaceAll(p+'SL', `{%${sn}%}`)
            el['__slotTpl_' + sn] = h
            if (el._state && el._state.items) { const it = el._state.items; el._state.items = null; el._state.items = it }
            view.destroy()
          } else {
            const wrapper = document.createElement('div')
            wrapper.setAttribute('slot', sn); wrapper.style.display = 'contents'
            const view = v.createEmbeddedView({})
            view.rootNodes.forEach(n => wrapper.appendChild(n.cloneNode(true)))
            view.destroy()
            el.appendChild(wrapper)
          }
        }
      })
    })
  }

  document.querySelectorAll('*').forEach(process)
  new MutationObserver(ms => {
    for (const m of ms) for (const n of m.addedNodes) {
      if (n.nodeType === 1) { process(n); n.querySelectorAll('*').forEach(process) }
    }
  }).observe(document.body || document.documentElement, { childList: true, subtree: true })

  // Event bridge: WCC emits kebab-case (e.g., 'count-changed') but Angular's
  // (countChange) syntax expects camelCase. Re-dispatch kebab events as camelCase.
  document.addEventListener('count-changed', e => {
    e.target.dispatchEvent(new CustomEvent('countChange', { detail: e.detail, bubbles: true }))
  }, true)
  document.addEventListener('value-changed', e => {
    e.target.dispatchEvent(new CustomEvent('valueChange', { detail: e.detail, bubbles: true }))
  }, true)
}

export function provideWccBridge() {
  return {
    provide: APP_INITIALIZER,
    useFactory: () => {
      initWccTemplateBridge()
      return () => {}
    },
    multi: true
  }
}
