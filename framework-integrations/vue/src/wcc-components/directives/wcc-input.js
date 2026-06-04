// Generated from: wcc-input.wcc (wcCompiler)
if (!document.getElementById('__css_WccInput')) {
  const __css_WccInput = document.createElement('style');
  __css_WccInput.id = '__css_WccInput';
  __css_WccInput.textContent = `
wcc-input .wcc-input{
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin: 8px 0;
}
wcc-input .wcc-input input{
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}
wcc-input .wcc-input span{
  font-family: monospace;
  padding: 4px 8px;
  background: #f5f5f5;
  border-radius: 4px;
  min-width: 60px;
}
`;
  document.head.appendChild(__css_WccInput);
}

const __t_WccInput = document.createElement('template');
__t_WccInput.innerHTML = `
<div class="wcc-input">
  <input>
  <span></span>
</div>
`;

class WccInput extends HTMLElement {
  static get observedAttributes() { return ['placeholder', 'value']; }

  static __meta = { tag: 'wcc-input', props: [{ name: 'placeholder', default: 'Type here...' }], events: [], models: ['value'], slots: [] };

  constructor() {
    super();
    const self = this;
    this._state = new Proxy(
      { placeholder: 'Type here...', value: '' },
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
    const __root = this.__ssr ? this : __t_WccInput.content.cloneNode(true);
    this.__text_value_0 = __root.childNodes[1].childNodes[3];
    this.__model_value_0 = __root.childNodes[1].childNodes[1];
    this.__attr_placeholder_0 = __root.childNodes[1].childNodes[1];
    if (!this.__ssr) { this.innerHTML = ''; }
    if (!this.__ssr) { this.appendChild(__root); }
    this.__ac = new AbortController();

    if (this.__model_value_0) this.__model_value_0.addEventListener('input', (e) => { this._modelSet_value(e.target.value) }, { signal: this.__ac.signal });
    this.__invalidate('*');
  }

  __invalidate(key) {
    switch(key) {
      case 'value':
        if (this.__connected) {
          this.__text_value_0.textContent = this._state.value ?? '';
          this.__model_value_0.value = this._state.value ?? '';
        }
        break;
      case 'placeholder':
        if (this.__connected) {
          { const __v = this._state.placeholder;
            if (__v || __v === '') { this.__attr_placeholder_0.setAttribute('placeholder', __v); }
            else { this.__attr_placeholder_0.removeAttribute('placeholder'); } }
        }
        break;
      case '*':
        this.__text_value_0.textContent = this._state.value ?? '';
        this.__model_value_0.value = this._state.value ?? '';
        { const __v = this._state.placeholder;
          if (__v || __v === '') { this.__attr_placeholder_0.setAttribute('placeholder', __v); }
          else { this.__attr_placeholder_0.removeAttribute('placeholder'); } }
        break;
    }
  }

  disconnectedCallback() {
    this.__connected = false;
    this.__ac.abort();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'placeholder') {
      this._state.placeholder = newVal ?? 'Type here...';
    }
    if (name === 'value') this._state.value = newVal ?? '';
  }

  get placeholder() { return this._state.placeholder; }
  set placeholder(val) { this._state.placeholder = val; this.setAttribute('placeholder', String(val)); }

  get value() { return this._state.value; }
  set value(val) { this._state.value = val; this.setAttribute('value', String(val)); }

  _modelSet_value(newVal) {
    const oldVal = this._state.value;
    this._state.value = newVal;
    this.dispatchEvent(new CustomEvent('wcc:model', {
      detail: { prop: 'value', value: newVal, oldValue: oldVal },
      bubbles: true,
      composed: true
    }));
    this.dispatchEvent(new CustomEvent('value-changed', { detail: newVal, bubbles: true }));
  }

  // --- Model wrapper methods ---
  _value(val) {
    if (arguments.length === 0) {
      return this._state.value;
    } else {
      this._modelSet_value(val);
    }
  }

}

if (!customElements.get('wcc-input')) customElements.define('wcc-input', WccInput);

export default WccInput;