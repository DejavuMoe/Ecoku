import type { CaptchaPublicConfig } from './types'

interface CapSolveResult { success?: boolean; token?: string }
interface CapElement extends HTMLElement {
  token?: string | null
  solve(): Promise<CapSolveResult | undefined>
  reset(): void
}

interface CapWindow extends Window {
  CAP_CUSTOM_WASM_URL?: string
  CAP_PAKO_URL?: string
  CAP_CSS_NONCE?: string
  CAP_SCRIPT_NONCE?: string
}

const scriptPromises = new Map<string, Promise<void>>()

function assetURL(instanceUrl: string, path: string): string {
  return new URL(path.replace(/^\/+/, ''), `${instanceUrl.replace(/\/+$/, '')}/`).toString()
}

function loadCap(instanceUrl: string): Promise<void> {
  const scriptURL = assetURL(instanceUrl, 'assets/widget.js')
  const host = window as CapWindow
  host.CAP_CUSTOM_WASM_URL = assetURL(instanceUrl, 'assets/cap_wasm_bg.wasm')
  host.CAP_PAKO_URL = assetURL(instanceUrl, 'assets/pako_inflate.min.js')
  if (customElements.get('cap-widget')) return Promise.resolve()
  const existing = scriptPromises.get(scriptURL)
  if (existing) return existing
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = scriptURL
    script.async = false
    script.referrerPolicy = 'no-referrer'
    const nonce = host.CAP_SCRIPT_NONCE || host.CAP_CSS_NONCE
    if (nonce) script.nonce = nonce
    script.onload = () => {
      if (!customElements.get('cap-widget')) {
        scriptPromises.delete(scriptURL)
        reject(new Error('Cap Widget missing'))
        return
      }
      resolve()
    }
    script.onerror = () => {
      scriptPromises.delete(scriptURL)
      reject(new Error('Cap Widget failed to load'))
    }
    document.head.append(script)
  })
  scriptPromises.set(scriptURL, promise)
  return promise
}

export class CapWidget {
  private current = ''
  private readonly element: CapElement

  private constructor(element: CapElement) {
    this.element = element
    element.addEventListener('solve', (event) => {
      const token = (event as CustomEvent<{ token?: unknown }>).detail?.token
      this.current = typeof token === 'string' ? token : ''
    })
    element.addEventListener('error', () => { this.current = '' })
    element.addEventListener('reset', () => { this.current = '' })
  }

  static async mount(container: HTMLElement, config: CaptchaPublicConfig): Promise<CapWidget> {
    await loadCap(config.instanceUrl)
    const element = document.createElement('cap-widget') as CapElement
    element.className = 'admin-cap-widget'
    element.setAttribute('required', '')
    element.setAttribute('data-cap-api-endpoint', `${config.instanceUrl.replace(/\/+$/, '')}/${encodeURIComponent(config.sitekey)}/`)
    element.setAttribute('data-cap-disable-haptics', '')
    element.setAttribute('data-cap-i18n-initial-state', '点击进行真人验证')
    element.setAttribute('data-cap-i18n-verifying-label', '正在验证…')
    element.setAttribute('data-cap-i18n-solved-label', '验证已完成')
    element.setAttribute('data-cap-i18n-error-label', '验证失败，请重试')
    element.setAttribute('data-cap-i18n-troubleshooting-label', '故障排除')
    element.setAttribute('data-cap-i18n-wasm-disabled', '请启用 WebAssembly 以完成验证')
    element.setAttribute('data-cap-i18n-verify-aria-label', '点击进行真人验证')
    element.setAttribute('data-cap-i18n-verifying-aria-label', '正在进行真人验证，请稍候')
    element.setAttribute('data-cap-i18n-verified-aria-label', '真人验证已通过')
    element.setAttribute('data-cap-i18n-required-label', '请先完成人机验证')
    element.setAttribute('data-cap-i18n-error-aria-label', '验证失败，请重试')
    const widget = new CapWidget(element)
    container.replaceChildren(element)
    return widget
  }

  token(): string {
    return this.current || this.element.token || ''
  }

  async waitForToken(timeoutMs = 30_000): Promise<string> {
    const existing = this.token()
    if (existing) return existing
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const result = await Promise.race([
        this.element.solve(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs) }),
      ])
      const token = result?.token || this.token()
      this.current = typeof token === 'string' ? token : ''
      return this.current
    } finally {
      if (timer !== undefined) clearTimeout(timer)
    }
  }

  reset(): void {
    this.current = ''
    try { this.element.reset() } catch { /* ignore */ }
  }

  remove(): void {
    this.current = ''
    this.element.remove()
  }
}
