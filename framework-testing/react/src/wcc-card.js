/**
 * WCC Card component with named slot support.
 * Supports: default slot, header slot, footer slot.
 */
class WccCard extends HTMLElement {
  connectedCallback() {
    // Defer to allow framework to project children
    queueMicrotask(() => this._render())
  }

  _render() {
    const slotMap = {}
    const defaultSlotNodes = []

    for (const child of Array.from(this.childNodes)) {
      if (child.nodeType === 1 && child.getAttribute('slot')) {
        const slotName = child.getAttribute('slot')
        child.removeAttribute('slot')
        slotMap[slotName] = child.innerHTML || child.textContent
      } else if (child.nodeType === 1 || (child.nodeType === 3 && child.textContent.trim())) {
        defaultSlotNodes.push(child)
      }
    }

    const header = slotMap.header || '<em>default header</em>'
    const footer = slotMap.footer || '<em>default footer</em>'
    const defaultContent = defaultSlotNodes.map(n => n.outerHTML || n.textContent).join('')

    this.innerHTML = `
      <div class="card">
        <div class="card-header">${header}</div>
        <div class="card-body">${defaultContent || '<em>no body</em>'}</div>
        <div class="card-footer">${footer}</div>
      </div>
    `
  }
}

customElements.define('wcc-card', WccCard)
