// Generated from: component.wcc (wcCompiler)
let __currentEffect = null;
let __batchDepth = 0;
const __pendingEffects = new Set();

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
  const run = () => {
    if (!_active) return;
    try {
      if (typeof _cleanup === 'function') _cleanup();
      const prev = __currentEffect;
      __currentEffect = run;
      _cleanup = fn();
      __currentEffect = prev;
    } catch (e) {
      console.error('[wcc] Effect error:', e);
      _active = false;
    }
  };
  run();
  return () => { _active = false; if (typeof _cleanup === 'function') _cleanup(); };
}

const __t_TestMinimal = document.createElement('template');
__t_TestMinimal.innerHTML = `
<!-- each -->
`;

class TestMinimal extends HTMLElement {
  static __meta = { tag: 'test-minimal', props: [], events: [], models: [], slots: [] };

  constructor() {
    super();
    this._data = __signal([
  { show: true, items: ['a', 'b'] },
  { show: false, items: ['c', 'd'] }
]);
  }

  connectedCallback() {
    if (this.__connected) return;
    this.__connected = true;
    const __root = __t_TestMinimal.content.cloneNode(true);
    this.__for0_tpl = document.createElement('template');
    this.__for0_tpl.innerHTML = `<div>
  <!-- if -->
</div>`;
    this.__for0_anchor = __root.childNodes[1];
    this.__for0_nodes = [];
    this.innerHTML = '';
    this.appendChild(__root);
    this.__ac = new AbortController();
    this.__disposers = [];

    this.__disposers.push(__effect(() => {
      const __source = this._data();

      const __iter = typeof __source === 'number'
        ? Array.from({ length: __source }, (_, i) => i + 1)
        : (__source || []);

      const __oldMap = this.__for0_keyMap || new Map();
      const __newMap = new Map();
      const __newNodes = [];

      __iter.forEach((item, __idx) => {
        const __key =  item ;
        if (__oldMap.has(__key)) {
          const oldNode = __oldMap.get(__key);
          oldNode.remove();
          const node = this.__for0_tpl.content.cloneNode(true).firstChild;
          const __if0_t0 = document.createElement('template');
          __if0_t0.innerHTML = `<div>
    <!-- each -->
  </div>`;
          const __if0_anchor = node.childNodes[1];
          let __if0_branch = null;
          if (item.show) { __if0_branch = 0; }
          if (__if0_branch !== null) {
            const __if0_tpl = [__if0_t0][__if0_branch];
            const __if0_clone = __if0_tpl.content.cloneNode(true);
            const __if0_node = __if0_clone.firstChild;
            __if0_anchor.parentNode.insertBefore(__if0_node, __if0_anchor);
            const __for0_tpl = document.createElement('template');
            __for0_tpl.innerHTML = `<div></div>`;
            const __for0_anchor = __if0_node.childNodes[1].childNodes[1];
            const __for0_source = item.items;
            const __for0_iter = typeof __for0_source === 'number'
              ? Array.from({ length: __for0_source }, (_, i) => i + 1)
              : (__for0_source || []);
            __for0_iter.forEach((sub, __idx) => {
              const clone = __for0_tpl.content.cloneNode(true);
              const innerNode = clone.firstChild;
              innerNode.textContent =  sub  ?? '';
              __for0_anchor.parentNode.insertBefore(innerNode, __for0_anchor);
            });
          }
          __newMap.set(__key, node);
          __newNodes.push(node);
          __oldMap.delete(__key);
        } else {
          const clone = this.__for0_tpl.content.cloneNode(true);
          const node = clone.firstChild;
          const __if0_t0 = document.createElement('template');
          __if0_t0.innerHTML = `<div>
    <!-- each -->
  </div>`;
          const __if0_anchor = node.childNodes[1];
          let __if0_branch = null;
          if (item.show) { __if0_branch = 0; }
          if (__if0_branch !== null) {
            const __if0_tpl = [__if0_t0][__if0_branch];
            const __if0_clone = __if0_tpl.content.cloneNode(true);
            const __if0_node = __if0_clone.firstChild;
            __if0_anchor.parentNode.insertBefore(__if0_node, __if0_anchor);
            const __for0_tpl = document.createElement('template');
            __for0_tpl.innerHTML = `<div></div>`;
            const __for0_anchor = __if0_node.childNodes[1].childNodes[1];
            const __for0_source = item.items;
            const __for0_iter = typeof __for0_source === 'number'
              ? Array.from({ length: __for0_source }, (_, i) => i + 1)
              : (__for0_source || []);
            __for0_iter.forEach((sub, __idx) => {
              const clone = __for0_tpl.content.cloneNode(true);
              const innerNode = clone.firstChild;
              innerNode.textContent =  sub  ?? '';
              __for0_anchor.parentNode.insertBefore(innerNode, __for0_anchor);
            });
          }
          __newMap.set(__key, node);
          __newNodes.push(node);
        }
      });

      // Remove nodes no longer in the list
      for (const n of __oldMap.values()) n.remove();

      // Reorder: insert all nodes in correct order before anchor
      for (const n of __newNodes) { this.__for0_anchor.parentNode.insertBefore(n, this.__for0_anchor); customElements.upgrade(n); }

      this.__for0_nodes = __newNodes;
      this.__for0_keyMap = __newMap;
    }));
  }

  disconnectedCallback() {
    this.__connected = false;
    this.__ac.abort();
    this.__disposers.forEach(d => d());
  }

}

if (!customElements.get('test-minimal')) customElements.define('test-minimal', TestMinimal);

export default TestMinimal;