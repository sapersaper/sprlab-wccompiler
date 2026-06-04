// Generated from: wcc-card.wcc (wcCompiler)
if (!document.getElementById('__css_WccCard')) {
  const __css_WccCard = document.createElement('style');
  __css_WccCard.id = '__css_WccCard';
  __css_WccCard.textContent = `
wcc-card .card{
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  margin: 8px 0;
}
wcc-card .card-header{
  background: #f5f5f5;
  padding: 12px 16px;
  border-bottom: 1px solid #ddd;
  font-weight: bold;
}
wcc-card .card-body{
  padding: 16px;
}
wcc-card .card-footer{
  background: #f5f5f5;
  padding: 12px 16px;
  border-top: 1px solid #ddd;
  font-size: 0.9em;
  color: #666;
}
`;
  document.head.appendChild(__css_WccCard);
}

const __t_WccCard = document.createElement('template');
__t_WccCard.innerHTML = `
<div class="card">
  <div class="card-header">
    <span data-slot="header"><em>default header</em></span>
  </div>
  <div class="card-body">
    <span data-slot="default"><em>no body</em></span>
  </div>
  <div class="card-footer">
    <span data-slot="footer"><em>default footer</em></span>
  </div>
</div>
`;

class WccCard extends HTMLElement {
  static __meta = { tag: 'wcc-card', props: [], events: [], models: [], slots: ['header', 'footer'] };

  constructor() {
    super();
  }

  connectedCallback() {
    if (this.__connected) return;
    this.__connected = true;
    const __slotMap = {};
    const __defaultSlotNodes = [];
    const __templatesToRemove = [];
    for (const child of Array.from(this.childNodes)) {
      if (child.nodeName === 'TEMPLATE') {
        let handled = false;
        for (const attr of child.attributes) {
          if (attr.name.startsWith('#')) {
            const slotName = attr.name.slice(1);
            __slotMap[slotName] = { content: child.innerHTML, propsExpr: attr.value };
            handled = true;
          } else if (attr.name === "slot") {
            const slotName = attr.value;
            const propsExpr = child.getAttribute('slot-props') || '';
            child.removeAttribute('slot-props');
            __slotMap[slotName] = { content: child.innerHTML, propsExpr };
            handled = true;
          }
        }
        if (handled) __templatesToRemove.push(child);
      } else if (child.nodeType === 1 && child.getAttribute('slot')) {
        const slotName = child.getAttribute('slot');
        const propsExpr = child.getAttribute('slot-props') || '';
        child.removeAttribute('slot');
        child.removeAttribute('slot-props');
        __slotMap[slotName] = { content: propsExpr ? child.innerHTML : child.outerHTML, propsExpr };
      } else if (child.nodeType === 1) {
        __defaultSlotNodes.push(child);
      } else if (child.nodeType === 3 && child.textContent.trim()) {
        __defaultSlotNodes.push(child);
      }
    }
    for (const tpl of __templatesToRemove) {
      if (tpl.parentNode) tpl.parentNode.removeChild(tpl);
    }
    const __root = this.__ssr ? this : __t_WccCard.content.cloneNode(true);
    this.__slot_header_0 = __root.childNodes[1].childNodes[1].childNodes[1];
    this.__slot_default_1 = __root.childNodes[1].childNodes[3].childNodes[1];
    this.__slot_footer_2 = __root.childNodes[1].childNodes[5].childNodes[1];
    if (!this.__ssr) { this.innerHTML = ''; }
    if (!this.__ssr) { this.appendChild(__root); }
    if (__slotMap['header']) { this.__slot_header_0.innerHTML = __slotMap['header'].content; }
    if (__defaultSlotNodes.length) {
      const __dsn = __defaultSlotNodes;
      queueMicrotask(() => {
        this.__slot_default_1.textContent = '';
        __dsn.forEach(n => this.__slot_default_1.appendChild(n));
      });
    }
    if (__slotMap['footer']) { this.__slot_footer_2.innerHTML = __slotMap['footer'].content; }
    if (Object.keys(__slotMap).length === 0 && __defaultSlotNodes.length === 0) {
      const __renderedRoot = this.firstElementChild;
      queueMicrotask(() => {
        const __sm = {};
        const __dn = [];
        for (const child of Array.from(this.childNodes)) {
          if (child === __renderedRoot) continue;
          if (child.nodeType === 3 && !child.textContent.trim()) continue;
          if (child.nodeName === 'TEMPLATE') {
            for (const attr of child.attributes) {
              if (attr.name.startsWith('#')) {
                __sm[attr.name.slice(1)] = { content: child.innerHTML, propsExpr: attr.value };
              }
            }
          } else if (child.nodeType === 1 && child.getAttribute('slot')) {
            const sn = child.getAttribute('slot');
            const pe = child.getAttribute('slot-props') || '';
            child.removeAttribute('slot');
            child.removeAttribute('slot-props');
            __sm[sn] = { content: pe ? child.innerHTML : child.outerHTML, propsExpr: pe };
            child.remove();
          } else if (child.nodeType === 1) {
            __dn.push(child);
          } else if (child.nodeType === 3 && child.textContent.trim()) {
            __dn.push(child);
          }
        }
        if (Object.keys(__sm).length > 0 || __dn.length > 0) {
          if (__sm['header']) { this.__slot_header_0.innerHTML = __sm['header'].content; }
          if (__dn.length) { this.__slot_default_1.textContent = ''; __dn.forEach(n => this.__slot_default_1.appendChild(n)); }
          if (__sm['footer']) { this.__slot_footer_2.innerHTML = __sm['footer'].content; }
        }
      });
    }
    this.__ac = new AbortController();

  }

  disconnectedCallback() {
    this.__connected = false;
    this.__ac.abort();
  }

}

if (!customElements.get('wcc-card')) customElements.define('wcc-card', WccCard);

export default WccCard;