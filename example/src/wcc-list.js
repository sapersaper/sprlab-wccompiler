// Features: each directive, :key, @event in loop, signal
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'wcc-list',
  template: './wcc-list.html',
  styles: './wcc-list.css',
})

const title = signal('My List')
const items = signal([
  { id: 1, name: 'Learn wcCompiler' },
  { id: 2, name: 'Build components' },
  { id: 3, name: 'Ship it' },
])
const nextId = signal(4)
const newItemName = signal('')

function removeItem(event) {
  const li = event.target.closest('li')
  const id = Number(li.dataset.id)
  items.set(items().filter(i => i.id !== id))
}

function addItem() {
  const name = newItemName()
  if (!name) return
  items.set(items().concat([{ id: nextId(), name: name }]))
  nextId.set(nextId() + 1)
  newItemName.set('')
}
