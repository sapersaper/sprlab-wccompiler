// Generated from: wcc-list.wcc (wcCompiler)
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

if (!document.getElementById('__css_WccList')) {
  const __css_WccList = document.createElement('style');
  __css_WccList.id = '__css_WccList';
  __css_WccList.textContent = `
wcc-list .wcc-list{
  list-style: none;
  padding: 0;
  margin: 0;
}
wcc-list .wcc-list li{
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
}
wcc-list .wcc-list li:last-child{
  border-bottom: none;
}
`;
  document.head.appendChild(__css_WccList);
}

const __t_WccList = document.createElement('template');
__t_WccList.innerHTML = `
<ul class="wcc-list">
  <!-- each -->
</ul>
`;

class WccList extends HTMLElement {
  static __meta = { tag: 'wcc-list', props: [], events: [], models: [], slots: [] };

  constructor() {
    super();
    this._items = __signal(['Apple', 'Banana', 'Cherry']);
  }

  connectedCallback() {
    if (this.__connected) return;
    this.__connected = true;
    const __root = __t_WccList.content.cloneNode(true);
    this.__for0_tpl = document.createElement('template');
    this.__for0_tpl.innerHTML = `<li>
    <span data-slot="item">{{item}}</span>
  </li>`;
    this.__for0_anchor = __root.childNodes[1].childNodes[1];
    this.__for0_nodes = [];
    this.innerHTML = '';
    this.appendChild(__root);
    this.__ac = new AbortController();
    this.__disposers = [];

    this.__disposers.push(__effect(() => {
      const __source = this._items();

      const __iter = typeof __source === 'number'
        ? Array.from({ length: __source }, (_, i) => i + 1)
        : (__source || []);

      for (const n of this.__for0_nodes) n.remove();
      this.__for0_nodes = [];

      __iter.forEach((item, index) => {
        const clone = this.__for0_tpl.content.cloneNode(true);
        const node = clone.firstChild;
          { const __slotEl = node.childNodes[1];
            const __sp = { 'item': item, 'index': index };
            let __h = __slotEl.innerHTML;
            for (const [k, v] of Object.entries(__sp)) {
              __h = __h.replace(new RegExp('\\{\\{\\s*' + k + '(\\(\\))?\\s*\\}\\}', 'g'), v ?? '');
            }
            __slotEl.innerHTML = __h;
          }
        this.__for0_anchor.parentNode.insertBefore(node, this.__for0_anchor);
        customElements.upgrade(node);
        this.__for0_nodes.push(node);
      });
    }));
  }

  disconnectedCallback() {
    this.__connected = false;
    this.__ac.abort();
    this.__disposers.forEach(d => d());
  }

}

if (!customElements.get('wcc-list')) customElements.define('wcc-list', WccList);

export default WccList;