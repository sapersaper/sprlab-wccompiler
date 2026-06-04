// Generated from: wcc-conditional.wcc (wcCompiler)
if (!document.getElementById('__css_WccConditional')) {
  const __css_WccConditional = document.createElement('style');
  __css_WccConditional.id = '__css_WccConditional';
  __css_WccConditional.textContent = `
wcc-conditional .conditional{
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin: 8px 0;
}
wcc-conditional .conditional p{
  margin: 0;
  font-weight: bold;
}
`;
  document.head.appendChild(__css_WccConditional);
}

const __t_WccConditional = document.createElement('template');
__t_WccConditional.innerHTML = `
<div class="conditional">
  <!-- if -->
  
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

class WccConditional extends HTMLElement {
  static get observedAttributes() { return ['visible']; }

  static __meta = { tag: 'wcc-conditional', props: [{ name: 'visible', default: true }], events: [], models: [], slots: [] };

  constructor() {
    super();
    const self = this;
    this._state = new Proxy(
      { visible: true },
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
    const __root = this.__ssr ? this : __t_WccConditional.content.cloneNode(true);
    if (!this.__ssr) {
      this.__if0_t0 = document.createElement('template');
      this.__if0_t0.innerHTML = `<p>Visible</p>`;
      this.__if0_t1 = document.createElement('template');
      this.__if0_t1.innerHTML = `<p>Hidden</p>`;
      this.__if0_anchor = findAnchor(__root, 'if', 0);
      this.__if0_current = null;
      this.__if0_active = undefined;
    }
    if (!this.__ssr) { this.innerHTML = ''; }
    if (!this.__ssr) { this.appendChild(__root); }
    this.__ac = new AbortController();

    this.__invalidate('*');
  }

  __renderIf_0() {
    let __branch = null;
    if (this._state.visible) { __branch = 0; }
    else { __branch = 1; }
    if (__branch === this.__if0_active) return;
    if (this.__if0_current) { this.__if0_current.remove(); this.__if0_current = null; }
    if (__branch !== null) {
      const tpl = [this.__if0_t0, this.__if0_t1][__branch];
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
      case 'visible':
        if (this.__connected) {
          this.__renderIf_0();
        }
        break;
      case '*':
        this.__renderIf_0();
        break;
    }
  }

  disconnectedCallback() {
    this.__connected = false;
    this.__ac.abort();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'visible') this._state.visible = newVal !== null && newVal !== 'false';
  }

  get visible() { return this._state.visible; }
  set visible(val) { this._state.visible = val; this.setAttribute('visible', String(val)); }

}

if (!customElements.get('wcc-conditional')) customElements.define('wcc-conditional', WccConditional);

export default WccConditional;