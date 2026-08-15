export type EcokuTheme = 'auto' | 'light' | 'dark'

export interface CommentFormConfig {
  emailRequired: boolean
  websiteRequired: boolean
  placeholder: string
  defaultSort: 'oldest' | 'newest'
  lengthLimit: number
  emptyMessage: string
  bloggerBadge: string
  turnstileSitekey: string
}

export const DEFAULT_COMMENT_FORM_CONFIG: Readonly<CommentFormConfig> = Object.freeze({
  emailRequired: true,
  websiteRequired: false,
  placeholder: '写下评论（仅支持纯文本）',
  defaultSort: 'newest',
  lengthLimit: 1000,
  emptyMessage: '还没有评论\n成为第一个留下评论的人。',
  bloggerBadge: '[博主]',
  turnstileSitekey: '',
})

export interface EcokuConfig {
  container: string | HTMLElement
  siteId: string
  pageKey: string
  pageTitle?: string
  serverURL?: string
  /** @deprecated Use serverURL. */
  apiBaseUrl?: string
  pageSize?: number
  theme?: EcokuTheme
  /** When set, skip injecting the default stylesheet. Use `none` to skip without loading a file. */
  cssURL?: string
}

export interface ResolvedEcokuConfig {
  container: HTMLElement
  siteId: string
  pageKey: string
  pageTitle: string
  serverURL: string
  pageSize: number
  theme: EcokuTheme
  cssURL: string
}

const SITE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/
const MAX_PAGE_KEY_LENGTH = 512
const MAX_PAGE_TITLE_LENGTH = 200
const MAX_PAGE_SIZE = 100

const countCodePoints = (value: string) => Array.from(value).length

export function normalizePageKey(value: string): string {
  const pageKey = value.trim()
  if (!pageKey || countCodePoints(pageKey) > MAX_PAGE_KEY_LENGTH) {
    throw new TypeError('Ecoku: pageKey must contain between 1 and 512 characters.')
  }
  return pageKey
}

function resolveContainer(target: EcokuConfig['container']): HTMLElement {
  if (typeof target === 'string') {
    const selector = target.trim()
    if (!selector) {
      throw new TypeError('Ecoku: container selector cannot be empty.')
    }
    const element = document.querySelector(selector)
    if (!(element instanceof HTMLElement)) {
      throw new TypeError(`Ecoku: container ${selector} was not found.`)
    }
    return element
  }
  if (!(target instanceof HTMLElement)) {
    throw new TypeError('Ecoku: container must be an HTMLElement or a selector for one.')
  }
  return target
}

function normalizeServerURL(value: string): string {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new TypeError('Ecoku: serverURL must be an absolute http or https URL.')
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new TypeError('Ecoku: serverURL must be an absolute http or https URL without credentials.')
  }
  if (parsed.search || parsed.hash) {
    throw new TypeError('Ecoku: serverURL cannot contain a query string or fragment.')
  }
  parsed.pathname = `${parsed.pathname.replace(/\/+$/, '')}/`
  return parsed.toString()
}

export function normalizeCssURL(value?: string): string {
  const cssURL = (value || '').trim()
  if (!cssURL) return ''
  if (cssURL === 'none' || cssURL === '-') return 'none'
  if (cssURL.startsWith('/')) {
    if (cssURL.includes('\\') || cssURL.includes('://')) {
      throw new TypeError('Ecoku: cssURL path must be a root-relative http(s) stylesheet location.')
    }
    return cssURL
  }
  let parsed: URL
  try {
    parsed = new URL(cssURL)
  } catch {
    throw new TypeError('Ecoku: cssURL must be an absolute http or https URL, a root-relative path, or none.')
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new TypeError('Ecoku: cssURL must be an absolute http or https URL without credentials.')
  }
  return parsed.toString()
}

export function resolveConfig(options: EcokuConfig): ResolvedEcokuConfig {
  if (!options || typeof options !== 'object') {
    throw new TypeError('Ecoku: configuration is required.')
  }
  const siteId = options.siteId?.trim()
  if (!SITE_ID_PATTERN.test(siteId)) {
    throw new TypeError('Ecoku: siteId is invalid.')
  }

  const preferredServerURL = options.serverURL?.trim()
  const legacyServerURL = options.apiBaseUrl?.trim()
  if (!preferredServerURL && !legacyServerURL) {
    throw new TypeError('Ecoku: serverURL is required.')
  }
  if (preferredServerURL && legacyServerURL) {
    const preferred = normalizeServerURL(preferredServerURL)
    const legacy = normalizeServerURL(legacyServerURL)
    if (preferred !== legacy) {
      throw new TypeError('Ecoku: serverURL and deprecated apiBaseUrl cannot point to different servers.')
    }
  }

  const pageSize = options.pageSize ?? 10
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new TypeError('Ecoku: pageSize must be an integer between 1 and 100.')
  }
  const theme = options.theme ?? 'auto'
  if (!['auto', 'light', 'dark'].includes(theme)) {
    throw new TypeError('Ecoku: theme must be auto, light, or dark.')
  }

  return {
    container: resolveContainer(options.container),
    siteId,
    pageKey: normalizePageKey(options.pageKey),
    pageTitle: (options.pageTitle || '').trim().slice(0, MAX_PAGE_TITLE_LENGTH),
    serverURL: normalizeServerURL(preferredServerURL || legacyServerURL || ''),
    pageSize,
    theme,
    cssURL: normalizeCssURL(options.cssURL),
  }
}
