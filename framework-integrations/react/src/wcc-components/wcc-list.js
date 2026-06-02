// Generated from: wcc-list.wcc (wcCompiler)
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

class WccList extends HTMLElement {
  static __meta = { tag: 'wcc-list', props: [], events: [], models: [], slots: [] };

  constructor() {
    super();
    this.__show_elements = {};
    const self = this;
    this._state = new Proxy(
      { items: ['Apple', 'Banana', 'Cherry'] },
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
    const __slotMap = {};
    const __defaultSlotNodes = [];
    const __templatesToRemove = [];
    for (const child of Array.from(this.childNodes)) {
      if (child.nodeName === 'TEMPLATE') {
        let handled = false;
        for (const attr of child.attributes) {
          if (attr.name.startsWith('#')) {
            const slotName = attr.name.slice(1);
            __slotMap[slotName] = { content: child.innerHTML, propsExpr: attr.value };
            handled = true;
          } else if (attr.name === "slot") {
            const slotName = attr.value;
            const propsExpr = child.getAttribute('slot-props') || '';
            child.removeAttribute('slot-props');
            __slotMap[slotName] = { content: child.innerHTML, propsExpr };
            handled = true;
          }
        }
        if (handled) __templatesToRemove.push(child);
      } else if (child.nodeType === 1 && child.getAttribute('slot')) {
        const slotName = child.getAttribute('slot');
        const propsExpr = child.getAttribute('slot-props') || '';
        child.removeAttribute('slot');
        child.removeAttribute('slot-props');
        __slotMap[slotName] = { content: propsExpr ? child.innerHTML : child.outerHTML, propsExpr };
      } else if (child.nodeType === 1) {
        __defaultSlotNodes.push(child);
      } else if (child.nodeType === 3 && child.textContent.trim()) {
        __defaultSlotNodes.push(child);
      }
    }
    for (const tpl of __templatesToRemove) {
      if (tpl.parentNode) tpl.parentNode.removeChild(tpl);
    }
    const __root = this.__ssr ? this : __t_WccList.content.cloneNode(true);
    if (!this.__ssr) {
      this.__for0_tpl = document.createElement('template');
      this.__for0_tpl.innerHTML = `<li>
    <span data-slot="item">{{item}}</span>
  </li>`;
      this.__for0_anchor = findAnchor(__root, 'each', 0);
      this.__for0_nodes = [];
      this.__for0_items = [];
    }
    if (!this.__ssr) { this.innerHTML = ''; }
    if (!this.__ssr) { this.appendChild(__root); }
    for (const [__sn, __sc] of Object.entries(__slotMap)) {
      if (__sc.propsExpr && !this['__slotTpl_' + __sn]) {
        this['__slotTpl_' + __sn] = __sc.content;
      }
    }
    this.__ac = new AbortController();

    this.__invalidate('*');
  }

  __renderEach_0() {
    const __source = this._state.items;
    const __iter = typeof __source === 'number'
      ? Array.from({ length: __source }, (_, i) => i + 1)
      : (__source || []);

    for (const n of this.__for0_nodes) n.remove();
    this.__for0_nodes = [];
    this.__for0_items = [];

    __iter.forEach((item, index) => {
      const clone = this.__for0_tpl.content.cloneNode(true);
      const node = clone.firstChild;
          if (this.__slotTpl_item) {
            let __slotHtml = this.__slotTpl_item;
            __slotHtml = __slotHtml.replace(/{%\s*item\s*%}/g, item);
            __slotHtml = __slotHtml.replace(/{%\s*index\s*%}/g, index);
            const __slotNode = node.querySelector('[data-slot="item"]');
            if (__slotNode) {
              __slotNode.outerHTML = __slotHtml;
            }
          }
      this.__for0_anchor.parentNode.insertBefore(node, this.__for0_anchor);
      customElements.upgrade(node);
      this.__for0_nodes.push(node);
      this.__for0_items.push(item);
    });
  }

  __invalidate(key) {
    switch(key) {
      case 'items':
        this.__renderEach_0();
        break;
      case '*':
        this.__renderEach_0();
        break;
    }
  }

  disconnectedCallback() {
    this.__connected = false;
    this.__ac.abort();
  }

}

if (!customElements.get('wcc-list')) customElements.define('wcc-list', WccList);

export default WccList;