import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('CapWidget self-hosted loading', () => {
  beforeEach(() => {
    vi.resetModules()
    document.head.replaceChildren()
    document.body.replaceChildren()
  })

  it('loads Widget/WASM from the configured instance, applies nonce and uses the official element contract', async () => {
    class FakeCapElement extends HTMLElement {
      token: string | null = null
      async solve() {
        this.token = 'cap-token'
        this.dispatchEvent(new CustomEvent('solve', { detail: { token: this.token } }))
        return { success: true, token: this.token }
      }
      reset() { this.token = null; this.dispatchEvent(new CustomEvent('reset')) }
    }
    const host = window as Window & { CAP_SCRIPT_NONCE?: string; CAP_CUSTOM_WASM_URL?: string; CAP_PAKO_URL?: string }
    host.CAP_SCRIPT_NONCE = 'test-nonce'
    const append = vi.spyOn(document.head, 'append').mockImplementation((...nodes) => {
      const script = nodes[0] as HTMLScriptElement
      expect(script.src).toBe('https://cap.example.test/assets/widget.js')
      expect(script.nonce).toBe('test-nonce')
      if (!customElements.get('cap-widget')) customElements.define('cap-widget', FakeCapElement)
      script.onload?.(new Event('load'))
      return document.head
    })
    const { CapWidget } = await import('./cap')
    const container = document.createElement('div')
    const widget = await CapWidget.mount(container, { provider: 'cap', instanceUrl: 'https://cap.example.test', sitekey: 'site-key' })
    const element = container.querySelector('cap-widget') as HTMLElement
    expect(append).toHaveBeenCalledTimes(1)
    expect(host.CAP_CUSTOM_WASM_URL).toBe('https://cap.example.test/assets/cap_wasm_bg.wasm')
    expect(host.CAP_PAKO_URL).toBe('https://cap.example.test/assets/pako_inflate.min.js')
    expect(element.className).toBe('admin-cap-widget')
    expect(element.getAttribute('data-cap-api-endpoint')).toBe('https://cap.example.test/site-key/')
    expect(element.getAttribute('data-cap-i18n-solved-label')).toBe('验证已完成')
    expect(await widget.waitForToken()).toBe('cap-token')
    widget.reset()
    expect(widget.token()).toBe('')
  })
})
