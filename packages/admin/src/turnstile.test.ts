import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function stubTurnstile(ready = vi.fn()) {
  const render = vi.fn(() => 'widget-1')
  const api = {
    render,
    reset: vi.fn(),
    remove: vi.fn(),
    getResponse: () => '',
    execute: vi.fn(),
    ready,
  }
  vi.stubGlobal('turnstile', api)
  return api
}

describe('TurnstileWidget script loading', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    document.head.replaceChildren()
    Reflect.deleteProperty(window, 'turnstile')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(window, 'turnstile')
  })

  it('injects api.js without async/defer and does not call ready()', async () => {
    const ready = vi.fn()
    const { TurnstileWidget } = await import('./turnstile')
    const append = vi.spyOn(document.head, 'append').mockImplementation((...nodes) => {
      const script = nodes[0] as HTMLScriptElement
      expect(script.src).toContain('/turnstile/v0/api.js?render=explicit')
      expect(script.src).toContain(new URL(SCRIPT_URL).hostname)
      expect(script.async).toBe(false)
      expect(script.defer).toBe(false)
      stubTurnstile(ready)
      script.dispatchEvent(new Event('load'))
      script.onload?.(new Event('load'))
      return document.head
    })
    await TurnstileWidget.mount(document.createElement('div'), 'public-sitekey')
    expect(append).toHaveBeenCalled()
    expect(ready).not.toHaveBeenCalled()
  })

  it('still mounts when a leftover ready() implementation throws', async () => {
    const ready = vi.fn(() => {
      throw new Error('Remove async/defer from the Turnstile api.js script tag before using turnstile.ready().')
    })
    const { TurnstileWidget } = await import('./turnstile')
    vi.spyOn(document.head, 'append').mockImplementation((...nodes) => {
      const script = nodes[0] as HTMLScriptElement
      stubTurnstile(ready)
      script.onload?.(new Event('load'))
      return document.head
    })
    const widget = await TurnstileWidget.mount(document.createElement('div'), 'public-sitekey')
    expect(widget.token()).toBe('')
    expect(ready).not.toHaveBeenCalled()
  })
})
