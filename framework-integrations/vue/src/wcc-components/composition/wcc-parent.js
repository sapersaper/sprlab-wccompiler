// Generated from: wcc-parent.wcc (wcCompiler)
if (!document.getElementById('__css_WccParent')) {
  const __css_WccParent = document.createElement('style');
  __css_WccParent.id = '__css_WccParent';
  __css_WccParent.textContent = `
wcc-parent .parent{
  padding: 12px;
  border: 2px solid #6c5ce7;
  border-radius: 8px;
  margin: 8px 0;
  background: #f8f7ff;
}
wcc-parent .parent-label{
  margin: 0 0 8px 0;
  font-weight: bold;
  color: #6c5ce7;
}
wcc-parent .parent-btn{
  margin-top: 8px;
  padding: 4px 12px;
  cursor: pointer;
  border: 1px solid #6c5ce7;
  border-radius: 4px;
  background: #6c5ce7;
  color: white;
}
`;
  document.head.appendChild(__css_WccParent);
}

const __t_WccParent = document.createElement('template');
__t_WccParent.innerHTML = `
<div class="parent">
  <p class="parent-label"><span></span>: <span></span></p>
  <wcc-counter></wcc-counter>
  <button class="parent-btn">Parent +</button>
</div>
`;

class WccParent extends HTMLElement {
  static get observedAttributes() { return ['initial-count', 'label']; }

  static __meta = { tag: 'wcc-parent', props: [{ name: 'initialCount', default: 0 }, { name: 'label', default: 'Count' }], events: ['count-changed'], models: [], slots: [] };

  constructor() {
    super();
    const self = this;
    this._state = new Proxy(
      { initialCount: 0, label: 'Count', count: props.initialCount },
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
    const __root = this.__ssr ? this : __t_WccParent.content.cloneNode(true);
    this.__text_props_label_0 = __root.childNodes[1].childNodes[1].childNodes[0];
    this.__text_count_1 = __root.childNodes[1].childNodes[1].childNodes[2];
    this.__evt_count_changed_onCountChanged_0 = __root.childNodes[1].childNodes[3];
    this.__evt_click_increment_1 = __root.childNodes[1].childNodes[5];
    this.__attr_count_0 = __root.childNodes[1].childNodes[3];
    this.__attr_label_1 = this.__attr_count_0;
    if (!this.__ssr) { this.innerHTML = ''; }
    if (!this.__ssr) { this.appendChild(__root); }
    this.__ac = new AbortController();

    if (this.__evt_count_changed_onCountChanged_0) this.__evt_count_changed_onCountChanged_0.addEventListener('count-changed', this._onCountChanged.bind(this), { signal: this.__ac.signal });
    if (this.__evt_click_increment_1) this.__evt_click_increment_1.addEventListener('click', this._increment.bind(this), { signal: this.__ac.signal });
    this.__invalidate('*');
  }

  __invalidate(key) {
    switch(key) {
      case 'label':
        if (this.__connected) {
          this.__text_props_label_0.textContent = this._state.label ?? '';
          { const __v = this._state.label;
            if (__v || __v === '') { this.__attr_label_1.setAttribute('label', __v); }
            else { this.__attr_label_1.removeAttribute('label'); } }
        }
        break;
      case 'count':
        if (this.__connected) {
          this.__text_count_1.textContent = this._state.count ?? '';
          { const __v = this._state.count;
            if (__v || __v === '') { this.__attr_count_0.setAttribute('count', __v); }
            else { this.__attr_count_0.removeAttribute('count'); } }
        }
        break;
      case '*':
        this.__text_props_label_0.textContent = this._state.label ?? '';
        { const __v = this._state.label;
          if (__v || __v === '') { this.__attr_label_1.setAttribute('label', __v); }
          else { this.__attr_label_1.removeAttribute('label'); } }
        this.__text_count_1.textContent = this._state.count ?? '';
        { const __v = this._state.count;
          if (__v || __v === '') { this.__attr_count_0.setAttribute('count', __v); }
          else { this.__attr_count_0.removeAttribute('count'); } }
        break;
    }
  }

  disconnectedCallback() {
    this.__connected = false;
    this.__ac.abort();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'initial-count') this._state.initialCount = newVal != null ? Number(newVal) : 0;
    if (name === 'label') this._state.label = newVal ?? 'Count';
  }

  get initialCount() { return this._state.initialCount; }
  set initialCount(val) { this._state.initialCount = val; this.setAttribute('initial-count', String(val)); }

  get label() { return this._state.label; }
  set label(val) { this._state.label = val; this.setAttribute('label', String(val)); }

  _emit(name, detail) {
    const evt = { detail, bubbles: true, composed: true };
    this.dispatchEvent(new CustomEvent(name, evt));
    const lower = name.replace(/-/g, '').toLowerCase();
    if (lower !== name) this.dispatchEvent(new CustomEvent(lower, evt));
  }

  _onCountChanged(e) {
    const newVal = e.detail
      this._state.count = newVal
      this._emit('count-changed', newVal)
  }

  _increment() {
    const newVal = this._state.count + 1
      this._state.count = newVal
      this._emit('count-changed', newVal)
  }

}

if (!customElements.get('wcc-parent')) customElements.define('wcc-parent', WccParent);

export default WccParent;