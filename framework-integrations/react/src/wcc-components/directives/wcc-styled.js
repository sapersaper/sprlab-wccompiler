// Generated from: wcc-styled.wcc (wcCompiler)
if (!document.getElementById('__css_WccStyled')) {
  const __css_WccStyled = document.createElement('style');
  __css_WccStyled.id = '__css_WccStyled';
  __css_WccStyled.textContent = `
wcc-styled .styled{
  padding: 12px 16px;
  border-radius: 6px;
  margin: 8px 0;
  font-weight: bold;
  transition: all 0.2s;
}
wcc-styled .styled.primary{
  border: 2px solid #4a90d9;
  background: #e8f0fe;
}
wcc-styled .styled.secondary{
  border: 2px solid #888;
  background: #f5f5f5;
}
wcc-styled .styled p{
  margin: 4px 0;
}
`;
  document.head.appendChild(__css_WccStyled);
}

const __t_WccStyled = document.createElement('template');
__t_WccStyled.innerHTML = `
<div class="styled">
  <p>Styled component</p>
  <p>Variant: <span></span>, Color: <span></span></p>
</div>
`;

class WccStyled extends HTMLElement {
  static get observedAttributes() { return ['variant', 'color']; }

  static __meta = { tag: 'wcc-styled', props: [{ name: 'variant', default: 'primary' }, { name: 'color', default: '#333' }], events: [], models: [], slots: [] };

  constructor() {
    super();
    const self = this;
    this._state = new Proxy(
      { variant: 'primary', color: '#333' },
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
    const __root = this.__ssr ? this : __t_WccStyled.content.cloneNode(true);
    this.__text_props_variant_0 = __root.childNodes[1].childNodes[3].childNodes[1];
    this.__text_props_color_1 = __root.childNodes[1].childNodes[3].childNodes[3];
    this.__attr_class_0 = __root.childNodes[1];
    this.__attr_style_1 = this.__attr_class_0;
    if (!this.__ssr) { this.innerHTML = ''; }
    if (!this.__ssr) { this.appendChild(__root); }
    this.__ac = new AbortController();

    this.__invalidate('*');
  }

  __invalidate(key) {
    switch(key) {
      case 'variant':
        if (this.__connected) {
          this.__text_props_variant_0.textContent = this._state.variant ?? '';
          this.__attr_class_0.className = 'styled ' + this._state.variant;
        }
        break;
      case 'color':
        if (this.__connected) {
          this.__text_props_color_1.textContent = this._state.color ?? '';
          this.__attr_style_1.style.cssText = 'color: ' + this._state.color;
        }
        break;
      case '*':
        this.__text_props_variant_0.textContent = this._state.variant ?? '';
        this.__attr_class_0.className = 'styled ' + this._state.variant;
        this.__text_props_color_1.textContent = this._state.color ?? '';
        this.__attr_style_1.style.cssText = 'color: ' + this._state.color;
        break;
    }
  }

  disconnectedCallback() {
    this.__connected = false;
    this.__ac.abort();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'variant') this._state.variant = newVal ?? 'primary';
    if (name === 'color') this._state.color = newVal ?? '#333';
  }

  get variant() { return this._state.variant; }
  set variant(val) { this._state.variant = val; this.setAttribute('variant', String(val)); }

  get color() { return this._state.color; }
  set color(val) { this._state.color = val; this.setAttribute('color', String(val)); }

}

if (!customElements.get('wcc-styled')) customElements.define('wcc-styled', WccStyled);

export default WccStyled;