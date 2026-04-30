// Features: model (text, number, checkbox, radio, select, textarea), signal, computed
import { defineComponent, signal, computed } from 'wcc'

export default defineComponent({
  tag: 'wcc-form',
  template: './wcc-form.html',
  styles: './wcc-form.css',
})

const name = signal('')
const age = signal(0)
const agree = signal(false)
const color = signal('red')
const country = signal('ar')
const bio = signal('')

const summary = computed(() => name() + ' | ' + age() + ' yrs | ' + color())
