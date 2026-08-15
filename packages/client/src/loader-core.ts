interface EcokuInstance {
  init(): Promise<void>
}

interface EcokuConstructor {
  new (options: {
    container: HTMLElement
    serverURL: string
    siteId: string
    pageKey: string
    pageTitle?: string
    pageSize?: number
    theme?: 'auto' | 'light' | 'dark'
  }): EcokuInstance
}

interface EcokuWindow extends Window {
  Ecoku?: EcokuConstructor
}

const FAILURE_MESSAGE = '评论服务初始化失败，请稍后重试。'
const SCRIPT_FAILURE_MESSAGE = '评论脚本加载失败，请检查网络后重试。'
const TIMEOUT_MESSAGE = '评论服务响应超时，请稍后重试。'
let sdkPromise: Promise<EcokuConstructor> | null = null

export function resolveEcokuSDKURL(loaderURL: string, serverURL: string): string {
  const base = loaderURL.trim() || `${serverURL.replace(/\/+$/, '')}/client/ecoku-loader.js`
  return new URL('ecoku.umd.js', base).toString()
}

function loadSDK(documentRef: Document, windowRef: EcokuWindow, sdkURL: string): Promise<EcokuConstructor> {
  if (typeof windowRef.Ecoku === 'function') return Promise.resolve(windowRef.Ecoku)
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise<EcokuConstructor>((resolve, reject) => {
    const existing = documentRef.querySelector<HTMLScriptElement>('script[data-ecoku-sdk]')
    const script = existing ?? documentRef.createElement('script')
    const onLoad = () => {
      if (typeof windowRef.Ecoku !== 'function') {
        sdkPromise = null
        reject(new Error('Ecoku browser client is unavailable'))
        return
      }
      resolve(windowRef.Ecoku)
    }
    const onError = () => {
      script.remove()
      sdkPromise = null
      reject(new Error(SCRIPT_FAILURE_MESSAGE))
    }
    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })
    if (!existing) {
      script.src = sdkURL
      script.async = true
      script.dataset.ecokuSdk = ''
      documentRef.body.appendChild(script)
    }
  })
  return sdkPromise
}

function parsePageSize(value: string | undefined): number {
  const parsed = Number(value || '10')
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 100 ? parsed : 10
}

function parseTheme(value: string | undefined): 'auto' | 'light' | 'dark' {
  return value === 'light' || value === 'dark' ? value : 'auto'
}

function queryShellPart<T extends HTMLElement>(shell: HTMLElement, current: string, legacy: string): T | null {
  return shell.querySelector<T>(current) ?? shell.querySelector<T>(legacy)
}

export function setupEcokuLoader(
  documentRef: Document = document,
  windowRef: EcokuWindow = window,
  loaderURL = '',
): void {
  const shells = Array.from(documentRef.querySelectorAll<HTMLElement>('[data-ecoku-comments]'))
  for (const shell of shells) {
    const mount = queryShellPart<HTMLElement>(shell, '[data-ecoku-mount]', '#tcomment')
    const loader = queryShellPart<HTMLElement>(shell, '[data-ecoku-loader]', '.comment-loader')
    const status = queryShellPart<HTMLElement>(shell, '[data-ecoku-status]', '.comment-status')
    const retry = queryShellPart<HTMLButtonElement>(shell, '[data-ecoku-retry]', '.comment-retry')
    const serverURL = shell.dataset.serverUrl?.trim() || ''
    const siteId = shell.dataset.siteId?.trim() || ''
    const pageKey = shell.dataset.pageKey?.trim() || ''
    if (!mount || !loader || !status || !retry || !serverURL || !siteId || !pageKey) continue

    let loading = false
    let initialized = false
    let timeoutID = 0

    const showFailure = (message: string) => {
      windowRef.clearTimeout(timeoutID)
      loading = false
      shell.setAttribute('aria-busy', 'false')
      loader.hidden = false
      status.textContent = message
      retry.hidden = false
    }

    const initialize = async () => {
      if (loading || initialized) return
      loading = true
      retry.hidden = true
      status.textContent = '正在加载评论…'
      shell.setAttribute('aria-busy', 'true')
      timeoutID = windowRef.setTimeout(() => showFailure(TIMEOUT_MESSAGE), 12000)
      try {
        const Constructor = await loadSDK(
          documentRef,
          windowRef,
          resolveEcokuSDKURL(loaderURL, serverURL),
        )
        const comments = new Constructor({
          container: mount,
          serverURL,
          siteId,
          pageKey,
          pageTitle: shell.dataset.pageTitle?.trim(),
          pageSize: parsePageSize(shell.dataset.pageSize),
          theme: parseTheme(shell.dataset.theme),
        })
        await comments.init()
        windowRef.clearTimeout(timeoutID)
        loading = false
        initialized = true
        shell.setAttribute('aria-busy', 'false')
        loader.hidden = true
      } catch (error) {
        showFailure(error instanceof Error && error.message === SCRIPT_FAILURE_MESSAGE
          ? SCRIPT_FAILURE_MESSAGE
          : FAILURE_MESSAGE)
      }
    }

    retry.addEventListener('click', initialize)
    const Observer = (windowRef as EcokuWindow & {
      IntersectionObserver?: typeof IntersectionObserver
    }).IntersectionObserver
    if (typeof Observer === 'function') {
      const observer = new Observer((entries: IntersectionObserverEntry[]) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          void initialize()
        }
      }, { rootMargin: '400px' })
      observer.observe(shell)
    } else {
      void initialize()
    }
  }
}
