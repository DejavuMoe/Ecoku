const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileAPI {
  render(container: HTMLElement, options: Record<string, unknown>): string
  reset(widgetId: string): void
  remove(widgetId: string): void
  getResponse(widgetId: string): string
  execute(widgetId: string): void
  ready?(callback: () => void): void
}

type TurnstileHost = Window & { turnstile?: TurnstileAPI }

let scriptPromise: Promise<TurnstileAPI> | null = null

function api(): TurnstileAPI | undefined {
  return (window as TurnstileHost).turnstile
}

function loadTurnstile(): Promise<TurnstileAPI> {
  const existing = api()
  if (existing) return Promise.resolve(existing)
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SCRIPT_URL
      script.async = true
      script.onload = () => {
        const loaded = api()
        if (!loaded) {
          reject(new Error('Turnstile API missing'))
          return
        }
        if (typeof loaded.ready === 'function') loaded.ready(() => resolve(loaded))
        else resolve(loaded)
      }
      script.onerror = () => reject(new Error('Turnstile script failed'))
      document.head.append(script)
    })
  }
  return scriptPromise
}

export class TurnstileWidget {
  private id = ''
  private current = ''
  private waiters: Array<(token: string) => void> = []
  private readonly host: TurnstileAPI

  constructor(host: TurnstileAPI) {
    this.host = host
  }

  static async mount(container: HTMLElement, sitekey: string): Promise<TurnstileWidget> {
    const host = await loadTurnstile()
    const widget = new TurnstileWidget(host)
    widget.id = host.render(container, {
      sitekey,
      theme: 'auto',
      size: 'flexible',
      appearance: 'interaction-only',
      callback: (token: string) => widget.complete(token),
      'error-callback': () => { widget.current = '' },
      'expired-callback': () => { widget.current = '' },
    })
    return widget
  }

  token(): string {
    return this.current || this.host.getResponse(this.id) || ''
  }

  async waitForToken(timeoutMs = 12_000): Promise<string> {
    const existing = this.token()
    if (existing) return existing
    try { this.host.execute(this.id) } catch { /* managed widgets may not expose execute */ }
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('timeout')), timeoutMs)
      this.waiters.push((token) => {
        window.clearTimeout(timer)
        resolve(token)
      })
    })
  }

  reset(): void {
    this.current = ''
    try { this.host.reset(this.id) } catch { /* ignore */ }
  }

  remove(): void {
    this.current = ''
    this.waiters = []
    try { this.host.remove(this.id) } catch { /* ignore */ }
  }

  private complete(token: string): void {
    this.current = token
    const waiters = this.waiters
    this.waiters = []
    for (const waiter of waiters) waiter(token)
  }
}
