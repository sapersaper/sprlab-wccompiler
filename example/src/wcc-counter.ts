// Features: signal, computed, defineProps, defineEmits, @event, {{interpolation}}, CSS scoping
import { defineComponent, defineProps, defineEmits, signal, computed } from 'wcc'

export default defineComponent({
  tag: 'wcc-counter',
  template: './wcc-counter.html',
  styles: './wcc-counter.css',
})

const props = defineProps<{ label: string, initial: number }>({ label: 'Count', initial: 0 })
const emit = defineEmits<{ (e: 'change', value: number): void }>()

const count = signal(0)
const doubled = computed(() => count() * 2)

function increment() {
  count.set(count() + 1)
  emit('change', count())
}

function decrement() {
  count.set(count() - 1)
  emit('change', count())
}
