import { flushSync, mount, tick, unmount, type Component } from 'svelte'
import { setImmediate } from 'node:timers'

// Keep the existing DOM-level regression assertions while mounting real Svelte components.
class DOMNode<T extends Element = HTMLElement> {
  readonly element: T
  constructor(element: T) { this.element = element }
  get<E extends Element = HTMLElement>(selector: string): DOMNode<E> {
    const element = this.element.querySelector<E>(selector)
    if (!element) throw new Error(`Missing element: ${selector}`)
    return new DOMNode(element)
  }
  find<E extends Element = HTMLElement>(selector: string) {
    const element = this.element.querySelector<E>(selector)
    return Object.assign(element ? new DOMNode(element) : {}, { exists: () => Boolean(element) }) as DOMNode<E> & { exists(): boolean }
  }
  findAll(selector: string) { return [...this.element.querySelectorAll<HTMLElement>(selector)].map(element => new DOMNode(element)) }
  text() { return this.element.textContent?.trim() ?? '' }
  html() { return this.element.innerHTML }
  attributes(name: string) { return this.element.getAttribute(name) ?? undefined }
  classes() { return [...this.element.classList] }
  async trigger(type: string, init: KeyboardEventInit = {}) {
    const EventType = type.startsWith('key') ? KeyboardEvent : Event
    this.element.dispatchEvent(new EventType(type, { bubbles: true, cancelable: true, ...init }))
    await tick()
  }
  async setValue(value: string | boolean) {
    const input = this.element as unknown as HTMLInputElement
    if (input.type === 'radio' || input.type === 'checkbox') input.checked = Boolean(value)
    else input.value = String(value)
    await this.trigger('input')
    await this.trigger('change')
  }
}

const cleanups = new Set<() => void>()
export function cleanup() { for (const stop of cleanups) stop() }
export const flushPromises = () => new Promise<void>(resolve => setImmediate(resolve))

export function render<Props extends Record<string, unknown>, Exports extends Record<string, unknown>>(
  component: Component<Props, Exports>,
  options: { props?: Props; context?: Map<string, unknown>; attachTo?: HTMLElement } = {},
) {
  const target = document.createElement('div')
  ;(options.attachTo ?? document.body).append(target)
  const props = $state(options.props ?? {} as Props)
  const instance = mount(component, { target, props, context: options.context })
  flushSync()
  const stop = () => { void unmount(instance); target.remove(); cleanups.delete(stop) }
  cleanups.add(stop)
  return Object.assign(new DOMNode(target), {
    instance,
    props,
    unmount: stop,
    async setProps(next: Partial<Props>) { Object.assign(props, next); await tick() },
  })
}
