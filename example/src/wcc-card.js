// Features: slots (named + default + scoped), light DOM, fallback content
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'wcc-card',
  template: './wcc-card.html',
  styles: './wcc-card.css',
})

const likes = signal(0)

function like() {
  likes.set(likes() + 1)
}
