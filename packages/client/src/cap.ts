import type { CaptchaPublicConfig, EcokuLocale, EcokuTheme } from './config'

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
  // Prevent the Widget's legacy decompression fallback from contacting a CDN.
  // Modern supported browsers use DecompressionStream; older browsers fail closed.
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

  static async mount(container: HTMLElement, config: CaptchaPublicConfig, theme: EcokuTheme, locale: EcokuLocale = 'zh-CN'): Promise<CapWidget> {
    await loadCap(config.instanceUrl)
    const element = document.createElement('cap-widget') as CapElement
    element.className = 'ecoku-cap-widget'
    element.setAttribute('required', '')
    element.setAttribute('data-cap-api-endpoint', `${config.instanceUrl.replace(/\/+$/, '')}/${encodeURIComponent(config.sitekey)}/`)
    element.setAttribute('data-cap-disable-haptics', '')
    const copy = locale === 'en'
      ? ['Click to verify', 'Verifying…', 'Verification complete', 'Verification failed. Try again.', 'Troubleshooting', 'Enable WebAssembly to continue', 'Click to verify', 'Verification in progress', 'Human verification passed', 'Complete verification first', 'Verification failed. Try again.']
      : locale === 'zh-Hant'
        ? ['點擊進行真人驗證', '正在驗證…', '驗證已完成', '驗證失敗，請重試', '故障排除', '請啟用 WebAssembly 以完成驗證', '點擊進行真人驗證', '正在進行真人驗證，請稍候', '真人驗證已通過', '請先完成人機驗證', '驗證失敗，請重試']
        : ['点击进行真人验证', '正在验证…', '验证已完成', '验证失败，请重试', '故障排除', '请启用 WebAssembly 以完成验证', '点击进行真人验证', '正在进行真人验证，请稍候', '真人验证已通过', '请先完成人机验证', '验证失败，请重试']
    ;['data-cap-i18n-initial-state', 'data-cap-i18n-verifying-label', 'data-cap-i18n-solved-label', 'data-cap-i18n-error-label', 'data-cap-i18n-troubleshooting-label', 'data-cap-i18n-wasm-disabled', 'data-cap-i18n-verify-aria-label', 'data-cap-i18n-verifying-aria-label', 'data-cap-i18n-verified-aria-label', 'data-cap-i18n-required-label', 'data-cap-i18n-error-aria-label'].forEach((name, index) => element.setAttribute(name, copy[index]))
    element.dataset.ecokuTheme = theme
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
