import { defineComponent, defineProps } from 'wcc'

export default defineComponent({
  tag: 'wcc-badge',
  template: './wcc-badge.html',
  styles: './wcc-badge.css',
})

const props = defineProps({ label: 'default', color: '#666' })
