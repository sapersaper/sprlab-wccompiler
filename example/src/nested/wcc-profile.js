import { defineComponent, defineProps, signal } from 'wcc'

export default defineComponent({
  tag: 'wcc-profile',
  template: './wcc-profile.html',
  styles: './wcc-profile.css',
})

const props = defineProps({ name: 'Anonymous', role: 'user' })
const clicks = signal(0)

function greet() {
  clicks.set(clicks() + 1)
}
