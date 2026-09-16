import {
  DEFAULT_CAPTCHA_CONFIG,
  DEFAULT_COMMENT_FORM_CONFIG,
  type CaptchaPublicConfig,
  type CommentFormConfig,
  type ResolvedEcokuConfig,
} from './config'
import { isAbortError, resolveTimeZone } from './util'

export type CommentSort = 'oldest' | 'newest'

export interface CommentData {
  id: number
  username: string
  url?: string
  content: string
  mark: string
  site_id: string
  parent: number
  deleted: boolean
  isBlogger: boolean
  created_at?: string
  updated_at?: string
}

export interface CommentDraft {
  username: string
  email?: string
  url?: string
  content: string
  parent?: number
  captchaToken?: string
}

export interface CommentSubmission extends CommentDraft {
  mark: string
  pageTitle: string
  siteId: string
}

export interface CommentSubmitResponse {
  code: number
  message: string
  data: { id: number; isBlogger: boolean }
}

export interface CommentPage {
  comments: CommentData[]
  rootTotal: number
  commentTotal: number
  page: number
  pageSize: number
  pageCount: number
  formConfig: CommentFormConfig
  timeZone: string
}

interface ResponseEnvelope<T> {
  code: number
  message: string
  data: T
}

interface RawCommentListPayload {
  data?: unknown
  total?: unknown
  commentTotal?: unknown
  page?: unknown
  pageSize?: unknown
  pageCount?: unknown
  formConfig?: unknown
  timeZone?: unknown
}

export class EcokuRequestError extends Error {
  readonly status: number
  readonly kind: 'http' | 'network' | 'timeout' | 'invalid-response'

  constructor(status: number, kind: EcokuRequestError['kind'], message = '') {
    super(message || `Ecoku request failed (${status || kind})`)
    this.name = 'EcokuRequestError'
    this.status = status
    this.kind = kind
  }
}

function asNonNegativeInteger(value: unknown, fallback: number): number {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : fallback
}

function asPositiveInteger(value: unknown, fallback: number): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback
}

function normalizeFormConfig(value: unknown): CommentFormConfig {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const placeholder = typeof raw.placeholder === 'string' ? raw.placeholder.trim() : ''
  const defaultSort = raw.defaultSort === 'oldest' ? 'oldest' : 'newest'
  const lengthLimit = Number.isInteger(raw.lengthLimit) && Number(raw.lengthLimit) >= 1 && Number(raw.lengthLimit) <= 10000
    ? Number(raw.lengthLimit) : DEFAULT_COMMENT_FORM_CONFIG.lengthLimit
  const emptyMessage = typeof raw.emptyMessage === 'string' && raw.emptyMessage.trim()
    ? raw.emptyMessage.trim() : DEFAULT_COMMENT_FORM_CONFIG.emptyMessage
  let bloggerBadge = DEFAULT_COMMENT_FORM_CONFIG.bloggerBadge
  if (typeof raw.bloggerBadge === 'string') {
    const trimmed = raw.bloggerBadge.trim()
    if (trimmed === '') bloggerBadge = ''
    else if (Array.from(trimmed).length <= 16 && !/[\r\n]/.test(trimmed)) bloggerBadge = trimmed
  }
  let turnstileSitekey = ''
  if (typeof raw.turnstileSitekey === 'string') {
    const trimmed = raw.turnstileSitekey.trim()
    if (trimmed && Array.from(trimmed).length <= 255 && !/[\r\n]/.test(trimmed)) turnstileSitekey = trimmed
  }
  const captcha = normalizeCaptchaConfig(raw.captcha, turnstileSitekey)
  const smoji = normalizeSmojiConfig(raw.smoji)
  return {
    emailRequired: typeof raw.emailRequired === 'boolean'
      ? raw.emailRequired
      : DEFAULT_COMMENT_FORM_CONFIG.emailRequired,
    websiteRequired: typeof raw.websiteRequired === 'boolean'
      ? raw.websiteRequired
      : DEFAULT_COMMENT_FORM_CONFIG.websiteRequired,
    placeholder: placeholder && Array.from(placeholder).length <= 80
      ? placeholder
      : DEFAULT_COMMENT_FORM_CONFIG.placeholder,
    defaultSort,
    lengthLimit,
    emptyMessage,
    bloggerBadge,
    turnstileSitekey,
    bloggerProofEnabled: raw.bloggerProofEnabled === true,
    captcha,
    smoji,
  }
}

function normalizeSmojiConfig(value: unknown): CommentFormConfig['smoji'] {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  if (raw.enabled !== true || typeof raw.manifestUrl !== 'string') return { enabled: false, manifestUrl: '' }
  try {
    const manifest = new URL(raw.manifestUrl.trim())
    const loopback = manifest.hostname === 'localhost' || /^127\.\d+\.\d+\.\d+$/.test(manifest.hostname) || manifest.hostname === '[::1]'
    if ((manifest.protocol !== 'https:' && !(manifest.protocol === 'http:' && loopback))
      || manifest.username || manifest.password || manifest.href.includes('?') || manifest.href.includes('#')) throw new Error()
    return { enabled: true, manifestUrl: manifest.toString() }
  } catch {
    return { enabled: false, manifestUrl: '' }
  }
}

function normalizeCaptchaConfig(value: unknown, legacyTurnstileSitekey: string): CaptchaPublicConfig {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const provider = raw.provider === 'turnstile' || raw.provider === 'cap' ? raw.provider : 'off'
  const sitekey = typeof raw.sitekey === 'string' ? raw.sitekey.trim() : ''
  if (!sitekey || Array.from(sitekey).length > 255 || /[\r\n]/.test(sitekey)) {
    return legacyTurnstileSitekey
      ? { provider: 'turnstile', sitekey: legacyTurnstileSitekey, instanceUrl: '' }
      : { ...DEFAULT_CAPTCHA_CONFIG }
  }
  if (provider === 'turnstile') return { provider, sitekey, instanceUrl: '' }
  if (provider === 'cap' && typeof raw.instanceUrl === 'string') {
    try {
      const instance = new URL(raw.instanceUrl.trim())
      if (instance.protocol === 'https:' && !instance.username && !instance.password && !instance.search && !instance.hash) {
        instance.pathname = instance.pathname.replace(/\/+$/, '')
        return { provider, sitekey, instanceUrl: instance.toString().replace(/\/$/, '') }
      }
    } catch { /* invalid public config fails closed */ }
  }
  return { ...DEFAULT_CAPTCHA_CONFIG }
}

function normalizeParent(value: unknown): number | null {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return Number.isInteger(parsed) && Number(parsed) >= 0 ? Number(parsed) : null
}

function normalizeComment(value: unknown, config: ResolvedEcokuConfig): CommentData | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (!Number.isInteger(raw.id) || Number(raw.id) <= 0) return null
  if (typeof raw.site_id === 'string' && raw.site_id !== config.siteId) return null
  if (typeof raw.mark === 'string' && raw.mark !== config.pageKey) return null
  const parent = normalizeParent(raw.parent)
  if (parent === null) return null
  const deleted = raw.deleted === true
  if (!deleted && (typeof raw.username !== 'string' || typeof raw.content !== 'string')) return null

  return {
    id: Number(raw.id),
    username: deleted ? '' : String(raw.username || ''),
    url: !deleted && typeof raw.url === 'string' ? raw.url : undefined,
    content: deleted ? '' : String(raw.content || ''),
    mark: typeof raw.mark === 'string' ? raw.mark : config.pageKey,
    site_id: typeof raw.site_id === 'string' ? raw.site_id : config.siteId,
    parent,
    deleted,
    isBlogger: !deleted && raw.isBlogger === true,
    created_at: typeof raw.created_at === 'string' ? raw.created_at : undefined,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : undefined,
  }
}

function apiURL(config: ResolvedEcokuConfig, path: string): URL {
  return new URL(path.replace(/^\/+/, ''), config.serverURL)
}

async function requestJSON<T>(
  url: URL,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<ResponseEnvelope<T>> {
  const controller = new AbortController()
  let timedOut = false
  const abortFromCaller = () => controller.abort()
  if (signal?.aborted) controller.abort()
  else signal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, 10_000)

  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    let raw: unknown
    try {
      raw = await response.json()
    } catch {
      throw new EcokuRequestError(response.status || 500, 'invalid-response')
    }
    if (!raw || typeof raw !== 'object') {
      throw new EcokuRequestError(response.status || 500, 'invalid-response')
    }
    const candidate = raw as Record<string, unknown>
    const code = typeof candidate.code === 'number' ? candidate.code : response.status
    const message = typeof candidate.message === 'string' ? candidate.message : ''
    if (!response.ok || code < 200 || code >= 300) {
      throw new EcokuRequestError(response.status || code || 500, 'http', message)
    }
    return { code, message, data: candidate.data as T }
  } catch (error) {
    if (error instanceof EcokuRequestError) throw error
    if (signal?.aborted || (!timedOut && isAbortError(error))) {
      throw new DOMException('The request was aborted.', 'AbortError')
    }
    throw new EcokuRequestError(0, timedOut ? 'timeout' : 'network')
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abortFromCaller)
  }
}

export async function fetchComments(
  config: ResolvedEcokuConfig,
  page: number,
  sort: CommentSort | undefined,
  signal?: AbortSignal,
): Promise<CommentPage> {
  const url = apiURL(config, 'api/comment/list')
  url.searchParams.set('siteId', config.siteId)
  url.searchParams.set('key', config.pageKey)
  url.searchParams.set('page', String(page))
  url.searchParams.set('pageSize', String(config.pageSize))
  if (sort) url.searchParams.set('sort', sort)
  const envelope = await requestJSON<RawCommentListPayload>(url, { method: 'GET' }, signal)
  const payload = envelope.data && typeof envelope.data === 'object' ? envelope.data : {}
  const rawComments = Array.isArray(payload.data) ? payload.data : []
  const comments = rawComments
    .map((comment) => normalizeComment(comment, config))
    .filter((comment): comment is CommentData => comment !== null)
  return {
    comments,
    rootTotal: asNonNegativeInteger(payload.total, 0),
    commentTotal: asNonNegativeInteger(payload.commentTotal, comments.length),
    page: asPositiveInteger(payload.page, page),
    pageSize: asPositiveInteger(payload.pageSize, config.pageSize),
    pageCount: asNonNegativeInteger(payload.pageCount, 0),
    formConfig: normalizeFormConfig(payload.formConfig),
    timeZone: resolveTimeZone(typeof payload.timeZone === 'string' ? payload.timeZone : ''),
  }
}

export async function submitComment(
  config: ResolvedEcokuConfig,
  draft: CommentDraft,
  signal?: AbortSignal,
): Promise<CommentSubmitResponse> {
  const submission: CommentSubmission = {
    siteId: config.siteId,
    mark: config.pageKey,
    pageTitle: config.pageTitle,
    username: draft.username,
    content: draft.content,
    parent: draft.parent || 0,
  }
  if (draft.email) submission.email = draft.email
  if (draft.url) submission.url = draft.url
  if (draft.captchaToken) submission.captchaToken = draft.captchaToken
  const envelope = await requestJSON<{ id?: unknown; isBlogger?: unknown }>(apiURL(config, 'api/comment/submit'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submission),
  }, signal)
  const id = envelope.data && Number.isInteger(envelope.data.id) ? Number(envelope.data.id) : 0
  if (id <= 0) {
    throw new EcokuRequestError(500, 'invalid-response')
  }
  return {
    code: envelope.code,
    message: envelope.message,
    data: { id, isBlogger: envelope.data?.isBlogger === true },
  }
}
