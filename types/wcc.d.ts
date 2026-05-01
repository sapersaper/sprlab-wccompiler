declare module 'wcc' {
  interface Signal<T> {
    (): T;
    set(value: T): void;
  }

  export function signal<T>(value: T): Signal<T>;
  export function computed<T>(fn: () => T): () => T;
  export function effect(fn: () => void): void;
  export function defineComponent(options: {
    tag: string;
    template: string;
    styles?: string;
  }): void;

  export function defineProps<T extends Record<string, any>>(defaults?: Partial<T>): T;
  export function defineProps(names: string[]): Record<string, any>;

  export function defineEmits<T>(): T;
  export function defineEmits(names: string[]): (name: string, detail?: any) => void;

  export function templateRef(name: string): { value: HTMLElement | null };

  export function onMount(fn: () => void | Promise<void>): void;
  export function onDestroy(fn: () => void | Promise<void>): void;
  export function templateBindings(bindings: Record<string, any>): void;
}
