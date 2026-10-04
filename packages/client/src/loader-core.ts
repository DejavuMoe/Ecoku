import type { EcokuLocale } from './config'

interface EcokuInstance {
  init(): Promise<void>
  destroy(): void
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
    cssURL?: string
    i18n?: EcokuLocale
  }): EcokuInstance
}

interface EcokuWindow extends Window {
  Ecoku?: EcokuConstructor
}

type LoaderFailure = 'init' | 'script' | 'timeout'

// The loader reports failures before the SDK and its catalogs exist, so it carries its own copy.
const FAILURE_MESSAGES: Record<EcokuLocale, Record<LoaderFailure, string>> = {
  'zh-CN': {
    init: '评论服务初始化失败，请稍后重试。',
    script: '评论脚本加载失败，请检查网络后重试。',
    timeout: '评论服务响应超时，请稍后重试。',
  },
  'zh-Hant': {
    init: '評論服務初始化失敗，請稍後重試。',
    script: '評論腳本載入失敗，請檢查網路後重試。',
    timeout: '評論服務回應逾時，請稍後重試。',
  },
  en: {
    init: 'The comment service could not start. Try again later.',
    script: 'The comment script could not be loaded. Check your connection and try again.',
    timeout: 'The comment service did not respond in time. Try again later.',
  },
}

class LoaderFailureError extends Error {
  readonly failure: LoaderFailure

  constructor(failure: LoaderFailure) {
    super(`Ecoku loader: ${failure}`)
    this.failure = failure
  }
}

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
    const cleanup = () => {
      windowRef.clearTimeout(timeout)
      script.removeEventListener('load', onLoad)
      script.removeEventListener('error', onError)
    }
    const fail = (failure: LoaderFailure) => {
      cleanup()
      script.remove()
      sdkPromise = null
      reject(new LoaderFailureError(failure))
    }
    const onLoad = () => {
      if (typeof windowRef.Ecoku !== 'function') {
        fail('script')
        return
      }
      cleanup()
      resolve(windowRef.Ecoku)
    }
    const onError = () => fail('script')
    const timeout = windowRef.setTimeout(() => fail('timeout'), 12000)
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

function parseLocale(value: string | undefined): EcokuLocale | undefined {
  const locale = value?.trim()
  return locale === 'zh-CN' || locale === 'zh-Hant' || locale === 'en' ? locale : undefined
}

// Without data-i18n, failure messages follow the host page language when it is one Ecoku supports.
function pageLocale(documentRef: Document): EcokuLocale {
  const tag = documentRef.documentElement.lang.trim().toLowerCase()
  if (tag === 'en' || tag.startsWith('en-')) return 'en'
  if (/^zh-(hant|tw|hk|mo)(-|$)/.test(tag)) return 'zh-Hant'
  return 'zh-CN'
}

function parseCssURL(value: string | undefined): string | undefined {
  const cssURL = value?.trim()
  return cssURL || undefined
}

function ensureHostStylesheet(documentRef: Document, cssURL: string): void {
  if (cssURL === 'none' || cssURL === '-') return
  if (documentRef.querySelector('link[data-ecoku-css]')) return
  const link = documentRef.createElement('link')
  link.rel = 'stylesheet'
  link.href = cssURL
  link.dataset.ecokuCss = ''
  documentRef.head.appendChild(link)
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
    const i18n = parseLocale(shell.dataset.i18n)
    const failureMessages = FAILURE_MESSAGES[i18n ?? pageLocale(documentRef)]

    let loading = false
    let initialized = false
    let timeoutID = 0
    let attempt = 0
    let comments: EcokuInstance | null = null

    const showFailure = (failure: LoaderFailure) => {
      windowRef.clearTimeout(timeoutID)
      loading = false
      shell.setAttribute('aria-busy', 'false')
      loader.hidden = false
      status.textContent = failureMessages[failure]
      retry.hidden = false
    }

    const initialize = async () => {
      if (loading || initialized) return
      const generation = ++attempt
      loading = true
      retry.hidden = true
      status.textContent = ''
      loader.hidden = true
      shell.setAttribute('aria-busy', 'true')

      try {
        const cssURL = parseCssURL(shell.dataset.cssUrl)
        if (cssURL) ensureHostStylesheet(documentRef, cssURL)
        const Constructor = await loadSDK(
          documentRef,
          windowRef,
          resolveEcokuSDKURL(loaderURL, serverURL),
        )
        if (generation !== attempt) return
        comments = new Constructor({
          container: mount,
          serverURL,
          siteId,
          pageKey,
          pageTitle: shell.dataset.pageTitle?.trim(),
          pageSize: parsePageSize(shell.dataset.pageSize),
          theme: parseTheme(shell.dataset.theme),
          cssURL,
          ...(i18n ? { i18n } : {}),
        })
        timeoutID = windowRef.setTimeout(() => {
          ++attempt
          comments?.destroy()
          comments = null
          showFailure('timeout')
        }, 12000)
        await comments.init()
        if (generation !== attempt) return
        windowRef.clearTimeout(timeoutID)
        loading = false
        initialized = true
        shell.setAttribute('aria-busy', 'false')
        loader.hidden = true
      } catch (error) {
        if (generation !== attempt) return
        comments?.destroy()
        comments = null
        showFailure(error instanceof LoaderFailureError ? error.failure : 'init')
      }
    }

    retry.addEventListener('click', initialize)
    void initialize()
  }
}
