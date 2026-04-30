// Features: if/else-if/else, show, :class, :style, signal, computed
import { defineComponent, signal, computed } from 'wcc'

export default defineComponent({
  tag: 'wcc-conditional',
  template: './wcc-conditional.html',
  styles: './wcc-conditional.css',
})

const STATUSES = ['active', 'pending', 'inactive']

const status = signal('active')
const showDetails = signal(true)
const name = signal('User')

const textColor = computed(() =>
  status() === 'active' ? '#155724' : status() === 'pending' ? '#856404' : '#721c24'
)

function activate() {
  status.set('active')
}

function cycle() {
  const current = status()
  if (current === 'active') {
    status.set('pending')
  } else if (current === 'pending') {
    status.set('inactive')
  } else {
    status.set('active')
  }
}

function toggleDetails() {
  showDetails.set(!showDetails())
}
