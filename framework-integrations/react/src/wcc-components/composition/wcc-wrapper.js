// Generated from: wcc-wrapper.wcc (wcCompiler)
if (!document.getElementById('__css_WccWrapper')) {
  const __css_WccWrapper = document.createElement('style');
  __css_WccWrapper.id = '__css_WccWrapper';
  __css_WccWrapper.textContent = `
wcc-wrapper .wrapper{
  border: 2px dashed #999;
  border-radius: 8px;
  padding: 12px;
  margin: 8px 0;
}
wcc-wrapper .wrapper h3{
  margin: 0 0 8px 0;
  font-size: 1em;
  color: #555;
}
wcc-wrapper .wrapper-content{
  min-height: 20px;
}
`;
  document.head.appendChild(__css_WccWrapper);
}

const __t_WccWrapper = document.createElement('template');
__t_WccWrapper.innerHTML = `
<div class="wrapper">
  <!-- if -->
  <div class="wrapper-content">
    <span data-slot="default"></span>
  </div>
</div>
`;

function findAnchor(root, type, index) {
  const needle = ' ' + type + ' ';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  let count = 0;
  let node;
  while ((node = walker.nextNode())) {
    if (node.textContent === needle) {
      if (count === index) return node;
      count++;
    }
  }
  return null;
}

class WccWrapper extends HTMLElement {
  static get observedAttributes() { return ['title']; }

  static __meta = { tag: 'wcc-wrapper', props: [{ name: 'title', default: '' }], events: [], models: [], slots: [] };

  constructor() {
    super();
    const self = this;
    this._state = new Proxy(
      { title: '' },
      {
        set(target, key, value) {
          if (target[key] === value) return true;
          target[key] = value;
          self.__invalidate(key);
          return true;
        }
      }
    );
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
    const __root = this.__ssr ? this : __t_WccWrapper.content.cloneNode(true);
    this.__slot_default_0 = __root.childNodes[1].childNodes[3].childNodes[1];
    if (!this.__ssr) {
      this.__if0_t0 = document.createElement('template');
      this.__if0_t0.innerHTML = `<h3></h3>`;
      this.__if0_anchor = findAnchor(__root, 'if', 0);
      this.__if0_current = null;
      this.__if0_active = undefined;
    }
    if (!this.__ssr) { this.innerHTML = ''; }
    if (!this.__ssr) { this.appendChild(__root); }
    if (__defaultSlotNodes.length) { this.__slot_default_0.textContent = ''; __defaultSlotNodes.forEach(n => this.__slot_default_0.appendChild(n.cloneNode(true))); }
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
          if (__dn.length) { this.__slot_default_0.textContent = ''; __dn.forEach(n => this.__slot_default_0.appendChild(n.cloneNode(true))); }
        }
      });
    }
    this.__ac = new AbortController();

    this.__invalidate('*');
  }

  __renderIf_0() {
    let __branch = null;
    if (this._state.title) { __branch = 0; }
    if (__branch === this.__if0_active) return;
    if (this.__if0_current) { this.__if0_current.remove(); this.__if0_current = null; }
    if (__branch !== null) {
      const tpl = [this.__if0_t0][__branch];
      const clone = tpl.content.cloneNode(true);
      const node = clone.firstChild;
      this.__if0_anchor.parentNode.insertBefore(node, this.__if0_anchor);
      customElements.upgrade(node);
      this.__if0_current = node;
    }
    this.__if0_active = __branch;
  }

  __invalidate(key) {
    switch(key) {
      case 'title':
        if (this.__connected) {
          this.__renderIf_0();
          if (this.__if0_current) {
            this.__if0_current.textContent = this._state.title ?? '';
          }
        }
        break;
      case '*':
        this.__renderIf_0();
        if (this.__if0_current) {
          this.__if0_current.textContent = this._state.title ?? '';
        }
        break;
    }
  }

  disconnectedCallback() {
    this.__connected = false;
    this.__ac.abort();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'title') this._state.title = newVal ?? '';
  }

  get title() { return this._state.title; }
  set title(val) { this._state.title = val; this.setAttribute('title', String(val)); }

}

if (!customElements.get('wcc-wrapper')) customElements.define('wcc-wrapper', WccWrapper);

export default WccWrapper;