// Generated from: wcc-dualmodel.wcc (wcCompiler)
if (!document.getElementById('__css_WccDualmodel')) {
  const __css_WccDualmodel = document.createElement('style');
  __css_WccDualmodel.id = '__css_WccDualmodel';
  __css_WccDualmodel.textContent = `
wcc-dualmodel .dualmodel{
  display: inline-flex;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: monospace;
}
`;
  document.head.appendChild(__css_WccDualmodel);
}

const __t_WccDualmodel = document.createElement('template');
__t_WccDualmodel.innerHTML = `
<div class="dualmodel">
  <span class="first"></span>
  <span class="sep">|</span>
  <span class="second"></span>
</div>
`;

class WccDualmodel extends HTMLElement {
  static get observedAttributes() { return ['first', 'second']; }

  static __meta = { tag: 'wcc-dualmodel', props: [], events: [], models: ['first', 'second'], slots: [] };

  constructor() {
    super();
    const self = this;
    this._state = new Proxy(
      { first: '', second: '' },
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
    const __root = this.__ssr ? this : __t_WccDualmodel.content.cloneNode(true);
    this.__text_first_0 = __root.childNodes[1].childNodes[1];
    this.__text_second_1 = __root.childNodes[1].childNodes[5];
    if (!this.__ssr) { this.innerHTML = ''; }
    if (!this.__ssr) { this.appendChild(__root); }
    this.__ac = new AbortController();

    this.__invalidate('*');
  }

  __invalidate(key) {
    switch(key) {
      case 'first':
        if (this.__connected) {
          this.__text_first_0.textContent = this._state.first ?? '';
        }
        break;
      case 'second':
        if (this.__connected) {
          this.__text_second_1.textContent = this._state.second ?? '';
        }
        break;
      case '*':
        this.__text_first_0.textContent = this._state.first ?? '';
        this.__text_second_1.textContent = this._state.second ?? '';
        break;
    }
  }

  disconnectedCallback() {
    this.__connected = false;
    this.__ac.abort();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'first') this._state.first = newVal ?? '';
    if (name === 'second') this._state.second = newVal ?? '';
  }

  get first() { return this._state.first; }
  set first(val) { this._state.first = val; this.setAttribute('first', String(val)); }

  get second() { return this._state.second; }
  set second(val) { this._state.second = val; this.setAttribute('second', String(val)); }

  _modelSet_first(newVal) {
    const oldVal = this._state.first;
    this._state.first = newVal;
    this.dispatchEvent(new CustomEvent('wcc:model', {
      detail: { prop: 'first', value: newVal, oldValue: oldVal },
      bubbles: true,
      composed: true
    }));
    this.dispatchEvent(new CustomEvent('first-changed', { detail: newVal, bubbles: true }));
  }

  _modelSet_second(newVal) {
    const oldVal = this._state.second;
    this._state.second = newVal;
    this.dispatchEvent(new CustomEvent('wcc:model', {
      detail: { prop: 'second', value: newVal, oldValue: oldVal },
      bubbles: true,
      composed: true
    }));
    this.dispatchEvent(new CustomEvent('second-changed', { detail: newVal, bubbles: true }));
  }

  // --- Model wrapper methods ---
  _first(val) {
    if (arguments.length === 0) {
      return this._state.first;
    } else {
      this._modelSet_first(val);
    }
  }

  _second(val) {
    if (arguments.length === 0) {
      return this._state.second;
    } else {
      this._modelSet_second(val);
    }
  }

}

if (!customElements.get('wcc-dualmodel')) customElements.define('wcc-dualmodel', WccDualmodel);

export default WccDualmodel;