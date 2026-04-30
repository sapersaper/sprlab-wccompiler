// Features: TypeScript with generics, interfaces, type annotations,
// defineProps<T>, defineEmits<T>, signal<T>, computed<T>
import { defineComponent, defineProps, defineEmits, signal, computed, templateBindings } from 'wcc'

interface CounterState {
  current: number
  previous: number
}

export default defineComponent({
  tag: 'wcc-typescript',
  template: './wcc-typescript.html',
  styles: './wcc-typescript.css',
})

const props = defineProps<{ title: string, count: number }>({ title: 'Demo', count: 0 })
const emit = defineEmits<{ (e: 'update', value: number): void }>()

const history = signal<CounterState[]>([])
const doubled = computed<number>(() => props.count * 2)
const lastChange = computed<string>(() => {
  const h = history()
  if (h.length === 0) return 'none'
  const last = h[h.length - 1]
  return last.previous + ' → ' + last.current
})

function handleUpdate(): void {
  const prev: number = props.count
  emit('update', doubled())
  history.set(history().concat([{ current: props.count, previous: prev }]))
}

templateBindings({ doubled, lastChange, handleUpdate })
