// Generated from: wcc-toggle.wcc (wcCompiler)
if (!document.getElementById('__css_WccToggle')) {
  const __css_WccToggle = document.createElement('style');
  __css_WccToggle.id = '__css_WccToggle';
  __css_WccToggle.textContent = `
wcc-toggle .toggle{
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin: 8px 0;
}
wcc-toggle .toggle p{
  margin: 0;
}
`;
  document.head.appendChild(__css_WccToggle);
}

const __t_WccToggle = document.createElement('template');
__t_WccToggle.innerHTML = `
<div class="toggle">
  <p>This content is toggled via show directive</p>
</div>
`;

class WccToggle extends HTMLElement {
  static get observedAttributes() { return ['show']; }

  static __meta = { tag: 'wcc-toggle', props: [{ name: 'show', default: true }], events: [], models: [], slots: [] };

  constructor() {
    super();
    const self = this;
    this._state = new Proxy(
      { show: true },
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
    const __root = this.__ssr ? this : __t_WccToggle.content.cloneNode(true);
    this.__show_0 = __root.childNodes[1].childNodes[1];
    if (!this.__ssr) { this.innerHTML = ''; }
    if (!this.__ssr) { this.appendChild(__root); }
    this.__ac = new AbortController();

    this.__invalidate('*');
  }

  __invalidate(key) {
    switch(key) {
      case 'show':
        if (this.__connected) {
          this.__show_0.style.display = (this._state.show) ? '' : 'none';
        }
        break;
      case '*':
        this.__show_0.style.display = (this._state.show) ? '' : 'none';
        break;
    }
  }

  disconnectedCallback() {
    this.__connected = false;
    this.__ac.abort();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'show') this._state.show = newVal !== null && newVal !== 'false';
  }

  get show() { return this._state.show; }
  set show(val) { this._state.show = val; this.setAttribute('show', String(val)); }

}

if (!customElements.get('wcc-toggle')) customElements.define('wcc-toggle', WccToggle);

export default WccToggle;