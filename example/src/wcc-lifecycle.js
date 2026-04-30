// Features: onMount, onDestroy, templateRef, signal, defineProps
import { defineComponent, defineProps, signal, onMount, onDestroy, templateRef } from 'wcc'

export default defineComponent({
  tag: 'wcc-lifecycle',
  template: './wcc-lifecycle.html',
  styles: './wcc-lifecycle.css',
})

const props = defineProps({ name: 'World' })

const status = signal('mounted')
const elapsed = signal(0)
const internalName = signal('')
const timerId = signal(0)

const nameInput = templateRef('nameInput')

onMount(() => {
  nameInput.value.focus()
  timerId.set(setInterval(() => { elapsed.set(elapsed() + 1) }, 1000))
})

onDestroy(() => {
  clearInterval(timerId())
})

function reset() {
  elapsed.set(0)
}
