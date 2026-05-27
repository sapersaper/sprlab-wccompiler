// Generated from: wcc-counter.wcc (wcCompiler)
let __currentEffect = null;
let __batchDepth = 0;
const __pendingEffects = new Set();
let __runningEffect = null;

function __signal(initial) {
  let _value = initial;
  const _subs = new Set();
  return (...args) => {
    if (args.length === 0) {
      if (__currentEffect) _subs.add(__currentEffect);
      return _value;
    }
    const old = _value;
    _value = args[0];
    if (old !== _value) {
      if (__runningEffect) _subs.delete(__runningEffect);
      if (__batchDepth > 0) {
        for (const fn of _subs) __pendingEffects.add(fn);
      } else {
        for (const fn of [..._subs]) fn();
      }
    }
  };
}

function __effect(fn) {
  let _cleanup = null;
  let _active = true;
  let _running = false;
  const run = () => {
    if (!_active || _running) return;
    _running = true;
    const prevRunning = __runningEffect;
    __runningEffect = run;
    try {
      if (typeof _cleanup === 'function') _cleanup();
      const prev = __currentEffect;
      __currentEffect = run;
      _cleanup = fn();
      __currentEffect = prev;
    } catch (e) {
      console.error('[wcc] Effect error:', e);
      _active = false;
    } finally {
      __runningEffect = prevRunning;
      _running = false;
    }
  };
  run();
  return () => { _active = false; if (typeof _cleanup === 'function') _cleanup(); };
}

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
  static get observedAttributes() { return ['label']; }

  static __meta = { tag: 'wcc-counter', props: [{ name: 'label', default: 'Clicks' }], events: ['count-changed'], models: [], slots: [] };

  constructor() {
    super();
    this._s_label = __signal('Clicks');
  }

  connectedCallback() {
    if (this.__connected) return;
    this.__connected = true;
    const __root = __t_WccCounter.content.cloneNode(true);
    this.__text_props_label_0 = __root.childNodes[1].childNodes[1].childNodes[0];
    this.__text_count_1 = __root.childNodes[1].childNodes[1].childNodes[2];
    this.__evt_click_increment_0 = __root.childNodes[1].childNodes[3];
    this.innerHTML = '';
    this.appendChild(__root);
    this.__ac = new AbortController();
    this.__disposers = [];

    this.__disposers.push(__effect(() => {
      this.__text_props_label_0.textContent = this._s_label() ?? '';
    }));
    this.__disposers.push(__effect(() => {
      this.__text_count_1.textContent = count() ?? '';
    }));
    if (this.__evt_click_increment_0) this.__evt_click_increment_0.addEventListener('click', this._increment.bind(this), { signal: this.__ac.signal });
  }

  disconnectedCallback() {
    this.__connected = false;
    this.__ac.abort();
    this.__disposers.forEach(d => d());
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'label') this._s_label(newVal ?? 'Clicks');
  }

  get label() { return this._s_label(); }
  set label(val) { this._s_label(val); this.setAttribute('label', String(val)); }

  _emit(name, detail) {
    const evt = { detail, bubbles: true, composed: true };
    this.dispatchEvent(new CustomEvent(name, evt));
    const lower = name.replace(/-/g, '').toLowerCase();
    if (lower !== name) this.dispatchEvent(new CustomEvent(lower, evt));
  }

  _increment() {
    count.set(count() + 1)
      this._emit('count-changed', count())
  }

}

if (!customElements.get('wcc-counter')) customElements.define('wcc-counter', WccCounter);

export default WccCounter;