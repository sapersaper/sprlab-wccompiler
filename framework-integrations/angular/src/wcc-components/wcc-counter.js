// Generated from: wcc-counter.wcc (wcCompiler)
if (!document.getElementById('__css_WccCounter')) {
  const __css_WccCounter = document.createElement('style');
  __css_WccCounter.id = '__css_WccCounter';
  __css_WccCounter.textContent = `
wcc-counter .counter{
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
wcc-counter button{
  cursor: pointer;
  padding: 4px 8px;
}
`;
  document.head.appendChild(__css_WccCounter);
}

const __t_WccCounter = document.createElement('template');
__t_WccCounter.innerHTML = `
<div class="counter">
  <span><span></span>: <span></span></span>
  <button>+</button>
</div>
`;

class WccCounter extends HTMLElement {
  static get observedAttributes() { return ['label', 'count']; }

  static __meta = { tag: 'wcc-counter', props: [{ name: 'label', default: 'Clicks' }], events: ['count-changed'], models: ['count'], slots: [] };

  constructor() {
    super();
    const self = this;
    this._state = new Proxy(
      { label: 'Clicks', count: 0 },
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
    const __root = this.__ssr ? this : __t_WccCounter.content.cloneNode(true);
    this.__text_props_label_0 = __root.childNodes[1].childNodes[1].childNodes[0];
    this.__text_count_1 = __root.childNodes[1].childNodes[1].childNodes[2];
    this.__evt_click_increment_0 = __root.childNodes[1].childNodes[3];
    if (!this.__ssr) { this.innerHTML = ''; }
    if (!this.__ssr) { this.appendChild(__root); }
    this.__ac = new AbortController();

    if (this.__evt_click_increment_0) this.__evt_click_increment_0.addEventListener('click', this._increment.bind(this), { signal: this.__ac.signal });
    this.__invalidate('*');
  }

  __invalidate(key) {
    switch(key) {
      case 'label':
        if (this.__connected) {
          this.__text_props_label_0.textContent = this._state.label ?? '';
        }
        break;
      case 'count':
        if (this.__connected) {
          this.__text_count_1.textContent = this._state.count ?? '';
        }
        break;
      case '*':
        this.__text_props_label_0.textContent = this._state.label ?? '';
        this.__text_count_1.textContent = this._state.count ?? '';
        break;
    }
  }

  disconnectedCallback() {
    this.__connected = false;
    this.__ac.abort();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'label') this._state.label = newVal ?? 'Clicks';
    if (name === 'count') this._state.count = newVal != null ? Number(newVal) : 0;
  }

  get label() { return this._state.label; }
  set label(val) { this._state.label = val; this.setAttribute('label', String(val)); }

  get count() { return this._state.count; }
  set count(val) { this._state.count = val; this.setAttribute('count', String(val)); }

  _emit(name, detail) {
    const evt = { detail, bubbles: true, composed: true };
    this.dispatchEvent(new CustomEvent(name, evt));
    const lower = name.replace(/-/g, '').toLowerCase();
    if (lower !== name) this.dispatchEvent(new CustomEvent(lower, evt));
  }

  _modelSet_count(newVal) {
    const oldVal = this._state.count;
    this._state.count = newVal;
    this.dispatchEvent(new CustomEvent('wcc:model', {
      detail: { prop: 'count', value: newVal, oldValue: oldVal },
      bubbles: true,
      composed: true
    }));
    this.dispatchEvent(new CustomEvent('count-changed', { detail: newVal, bubbles: true }));
    this.dispatchEvent(new CustomEvent('countChange', { detail: newVal, bubbles: true }));
  }

  // --- Model wrapper methods ---
  _count(val) {
    if (arguments.length === 0) {
      return this._state.count;
    } else {
      this._modelSet_count(val);
    }
  }

  _increment() {
    this._modelSet_count(this._state.count + 1)
      this._emit('count-changed', this._state.count)
  }

}

if (!customElements.get('wcc-counter')) customElements.define('wcc-counter', WccCounter);

export default WccCounter;