/**
 * WCC List component with scoped slot support.
 * Exposes reactive props (item, index) to the consumer template.
 */
class WccList extends HTMLElement {
  connectedCallback() {
    if (this.__connected) return
    this.__connected = true
    // Defer to allow framework to project children
    queueMicrotask(() => this._init())
  }

  _init() {
    const slotMap = {}

    for (const child of Array.from(this.childNodes)) {
      if (child.nodeType === 1 && child.getAttribute('slot')) {
        const slotName = child.getAttribute('slot')
        const propsExpr = child.getAttribute('slot-props') || ''
        child.removeAttribute('slot')
        child.removeAttribute('slot-props')
        slotMap[slotName] = { content: propsExpr ? child.innerHTML : child.outerHTML, propsExpr }
      }
    }

    // Store scoped slot template
    this.__slotTpl_item = slotMap.item?.content || '<li>{%item%}</li>'

    // Sample data
    this._items = ['Apple', 'Banana', 'Cherry']

    this.innerHTML = '<ul class="wcc-list"></ul>'
    this._renderItems()
  }

  _renderItems() {
    const ul = this.querySelector('ul')
    if (!ul) return

    const replaceProps = (template, props) => {
      let html = template
      for (const [k, v] of Object.entries(props)) {
        // Match both {{prop}} and {%prop%} patterns
        html = html.replace(
          new RegExp('(?:\\{\\{|\\{%)\\s*' + k + '(\\(\\))?\\s*(?:\\}\\}|%\\})', 'g'),
          v ?? ''
        )
      }
      return html
    }

    ul.innerHTML = this._items.map((item, index) => {
      return replaceProps(this.__slotTpl_item, { item, index: String(index) })
    }).join('')
  }

  setItems(items) {
    this._items = items
    this._renderItems()
  }

  addItem(item) {
    this._items.push(item)
    this._renderItems()
  }
}

customElements.define('wcc-list', WccList)
