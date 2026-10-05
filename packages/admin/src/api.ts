import type {
  AdminSession,
  CommentMutation,
  CommentPage,
  CommentReview,
  CommentStatus,
  CaptchaPublicConfig,
  EcokuLocale,
  CaptchaSettings,
  EmailNotificationSettings,
  NotificationSettings,
  SiteSummary,
  SiteWrite,
  TelegramNotificationSettings,
  LoginConfig,
} from './types'

interface ResponseEnvelope<T> {
  code: number
  message: string
  data?: T
}

export class ApiError extends Error {
  readonly status: number
  readonly errorCode: string

  constructor(status: number, message: string, errorCode = '') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errorCode = errorCode
  }
}

const safeErrorCodes = new Set([
  'validation_failed',
  'timeout',
  'authentication_failed',
  'tls_failed',
  'delivery_failed',
])

function responseErrorCode(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const value = (data as Record<string, unknown>).error_code
  return typeof value === 'string' && safeErrorCodes.has(value) ? value : ''
}

let sessionGeneration = 0
const activeRequests = new Set<AbortController>()
export function cancelAdminRequests() {
  ++sessionGeneration
  for (const controller of activeRequests) controller.abort()
}

function mapSession(raw: Record<string, unknown>): AdminSession {
  const expiresAt = text(raw.expires_at)
  if (!expiresAt || !Number.isFinite(Date.parse(expiresAt))) throw new ApiError(500, 'invalid-session')
  const session: AdminSession = { expiresAt, expiresIn: number(raw.expires_in), requiresPasswordChange: raw.requires_password_change === true }
  const username = text(raw.username).trim()
  if (username) session.username = username
  return session
}

async function request<T>(path: string, init: RequestInit = {}, allowEmpty = false): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')
  // Public bootstrap configuration must survive an unauthenticated session check.
  const sessionBound = path !== '/api/admin/login-config'
  const generation = sessionGeneration
  const controller = new AbortController()
  if (sessionBound) activeRequests.add(controller)
  const abort = () => controller.abort(init.signal?.reason)
  if (init.signal?.aborted) abort()
  else init.signal?.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), 30000)
  try {
    const response = await fetch(path, { ...init, headers, signal: controller.signal, credentials: 'same-origin' })
    let envelope: ResponseEnvelope<T>
    try {
      envelope = (await response.json()) as ResponseEnvelope<T>
    } catch (error) {
      if (controller.signal.aborted) throw error
      throw new ApiError(response.ok ? 500 : response.status, 'invalid-response')
    }
    if (sessionBound && generation !== sessionGeneration) throw new DOMException('Session ended', 'AbortError')
    if (!response.ok) throw new ApiError(response.status, envelope.message || 'request-failed', responseErrorCode(envelope.data))
    if (envelope.data === undefined && !allowEmpty) throw new ApiError(500, 'missing-response-data')
    return envelope.data as T
  } catch (error) {
    if (init.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError')
    if (controller.signal.aborted) throw new ApiError(0, 'timeout', 'timeout')
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    if (error instanceof ApiError) throw error
    throw new ApiError(0, 'network')
  } finally {
    activeRequests.delete(controller)
    clearTimeout(timeout)
    init.signal?.removeEventListener('abort', abort)
  }
}

const text = (value: unknown) => typeof value === 'string' ? value : ''
const number = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback
const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

function mapSite(value: unknown): SiteSummary | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const id = text(raw.id)
  const defaultSort = raw.default_sort === 'oldest' ? 'oldest' : 'newest'
  if (!id) return null
  return {
    id,
    siteUrl: text(raw.site_url),
    name: text(raw.name),
    allowedOrigins: strings(raw.allowed_origins),
    defaultSort,
    emailRequired: raw.email_required === true,
    websiteRequired: raw.website_required === true,
    placeholder: text(raw.placeholder),
    commentLimit: number(raw.comment_limit, 1000),
    emptyMessage: text(raw.empty_message),
    smojiEnabled: raw.smoji_enabled === true,
    smojiManifestUrl: text(raw.smoji_manifest_url),
    smojiImageOrigin: text(raw.smoji_image_origin),
    i18n: raw.i18n === 'en' || raw.i18n === 'zh-Hant' ? raw.i18n : 'zh-CN',
    bloggerNickname: text(raw.blogger_nickname),
    bloggerEmail: text(raw.blogger_email),
    bloggerBadge: text(raw.blogger_badge),
    bloggerPassphraseSet: raw.blogger_passphrase_set === true,
    revision: number(raw.revision),
    createdAt: text(raw.created_at),
    updatedAt: text(raw.updated_at),
  }
}

function mapComment(value: unknown): CommentReview | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const id = number(raw.id)
  const siteId = text(raw.site_id)
  const mark = text(raw.mark)
  if (!id || !siteId || !mark) return null
  const status = raw.status === 'deleted' ? 'deleted' : 'published'
  const comment: CommentReview = {
    id, siteId, mark, pageTitle: text(raw.page_title),
    parent: number(raw.parent), status,
    deleted: raw.deleted === true,
    hasChildren: raw.has_children === true,
    username: text(raw.username), content: text(raw.content),
    createdAt: text(raw.created_at), updatedAt: text(raw.updated_at),
  }
  if (typeof raw.email === 'string' && raw.email) comment.email = raw.email
  if (typeof raw.url === 'string' && raw.url) comment.url = raw.url
  return comment
}

function sitePayload(site: SiteWrite) {
  const payload: Record<string, unknown> = {
    id: site.id,
    site_url: site.siteUrl,
    name: site.name,
    allowed_origins: site.allowedOrigins,
    default_sort: site.defaultSort,
    email_required: site.emailRequired,
    website_required: site.websiteRequired,
    placeholder: site.placeholder,
    comment_limit: site.commentLimit,
    empty_message: site.emptyMessage,
    smoji_enabled: site.smojiEnabled,
    smoji_manifest_url: site.smojiManifestUrl,
    smoji_image_origin: site.smojiImageOrigin,
    i18n: site.i18n,
    blogger_nickname: site.bloggerNickname,
    blogger_email: site.bloggerEmail,
    blogger_badge: site.bloggerBadge,
    revision: site.revision,
  }
  const passphrase = site.bloggerPassphrase?.trim()
  if (passphrase) payload.blogger_passphrase = passphrase
  return payload
}

function emailPayload(settings: EmailNotificationSettings) {
  return {
    enabled: settings.enabled, host: settings.host, port: settings.port,
    encryption: settings.encryption, username: settings.username,
    password: settings.password, from_address: settings.fromAddress,
    recipients: settings.recipients,
    revision: settings.revision,
  }
}

function telegramPayload(settings: TelegramNotificationSettings) {
  return {
    enabled: settings.enabled, token: settings.token, targets: settings.targets,
    revision: settings.revision,
  }
}

function mapEmail(value: unknown): EmailNotificationSettings {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    enabled: raw.enabled === true, host: text(raw.host), port: number(raw.port),
    encryption: raw.encryption === 'starttls' ? 'starttls' : 'tls',
    username: text(raw.username), password: '', passwordSet: raw.password_set === true,
    fromAddress: text(raw.from_address), recipients: strings(raw.recipients),
    revision: number(raw.revision, 1),
  }
}

function mapCaptchaPublic(value: unknown, legacyTurnstileSitekey = ''): CaptchaPublicConfig {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  if (value === undefined && legacyTurnstileSitekey) return { provider: 'turnstile', sitekey: legacyTurnstileSitekey, instanceUrl: '' }
  const provider = raw.provider
  const sitekey = text(raw.sitekey)
  const instanceUrl = text(raw.instanceUrl)
  if (provider !== 'off' && provider !== 'turnstile' && provider !== 'cap') throw new ApiError(500, 'invalid-login-config')
  if (provider !== 'off' && (!sitekey || (provider === 'cap' && !instanceUrl))) throw new ApiError(500, 'invalid-login-config')
  return { provider, sitekey, instanceUrl }
}

function mapCaptcha(value: unknown): CaptchaSettings {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const rawTurnstile = raw.turnstile && typeof raw.turnstile === 'object' ? raw.turnstile as Record<string, unknown> : {}
  const rawCap = raw.cap && typeof raw.cap === 'object' ? raw.cap as Record<string, unknown> : {}
  return {
    provider: raw.provider === 'turnstile' || raw.provider === 'cap' ? raw.provider : 'off',
    turnstile: {
      sitekey: text(rawTurnstile.sitekey),
      secret: '',
      secretSet: rawTurnstile.secret_set === true,
    },
    cap: {
      instanceUrl: text(rawCap.instance_url),
      sitekey: text(rawCap.sitekey),
      secret: '',
      secretSet: rawCap.secret_set === true,
    },
    revision: number(raw.revision, 1),
  }
}

function mapTelegram(value: unknown): TelegramNotificationSettings {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    enabled: raw.enabled === true, token: '', tokenSet: raw.token_set === true,
    targets: strings(raw.targets),
    revision: number(raw.revision, 1),
  }
}

function captchaPayload(settings: CaptchaSettings) {
  return {
    provider: settings.provider,
    turnstile: {
      sitekey: settings.turnstile.sitekey,
      secret: settings.turnstile.secret,
    },
    cap: {
      instance_url: settings.cap.instanceUrl,
      sitekey: settings.cap.sitekey,
      secret: settings.cap.secret,
    },
    revision: settings.revision,
  }
}

export const adminApi = {
  async getLoginConfig(signal?: AbortSignal): Promise<LoginConfig> {
    const raw = await request<Record<string, unknown>>('/api/admin/login-config', { method: 'GET', signal })
    const legacy = text(raw.turnstileSitekey)
    return { captcha: mapCaptchaPublic(raw.captcha, legacy), turnstileSitekey: legacy, locale: raw.locale === 'en' || raw.locale === 'zh-Hant' ? raw.locale as EcokuLocale : 'zh-CN' }
  },

  async login(username: string, password: string, captchaToken = '', signal?: AbortSignal): Promise<AdminSession> {
    const raw = await request<Record<string, unknown>>('/api/admin/login', { method: 'POST', body: JSON.stringify({ username, password, captchaToken }), signal })
    return mapSession(raw)
  },

  async getSession(): Promise<AdminSession> {
    return mapSession(await request<Record<string, unknown>>('/api/admin/session'))
  },

  async initialSetup(username: string, password: string): Promise<AdminSession> {
    const raw = await request<Record<string, unknown>>('/api/admin/initial-setup', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    return mapSession(raw)
  },

  async logout(): Promise<void> {
    await request('/api/admin/logout', { method: 'POST' }, true)
  },

  async listSites(signal?: AbortSignal): Promise<SiteSummary[]> {
    const raw = await request<{ data?: unknown[] }>('/api/admin/sites', { method: 'GET', signal })
    return (raw.data ?? []).map(mapSite).filter((site): site is SiteSummary => site !== null)
  },

  async createSite(site: SiteWrite): Promise<SiteSummary> {
    const raw = await request<Record<string, unknown>>('/api/admin/sites', { method: 'POST', body: JSON.stringify(sitePayload(site)) })
    const mapped = mapSite(raw.site)
    if (!mapped) throw new ApiError(500, 'invalid-site')
    return mapped
  },

  async updateSite(site: SiteWrite): Promise<SiteSummary> {
    const raw = await request<Record<string, unknown>>(`/api/admin/sites/${encodeURIComponent(site.id)}`, { method: 'PUT', body: JSON.stringify(sitePayload(site)) })
    const mapped = mapSite(raw.site)
    if (!mapped) throw new ApiError(500, 'invalid-site')
    return mapped
  },

  async listComments(siteId: string, status: CommentStatus, page: number, pageSize: number, sort: 'oldest' | 'newest', signal?: AbortSignal): Promise<CommentPage> {
    const query = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize), sort })
    const raw = await request<Record<string, unknown>>(`/api/admin/sites/${encodeURIComponent(siteId)}/comments?${query}`, { method: 'GET', signal })
    const rows = Array.isArray(raw.data) ? raw.data : []
    const rawCounts = raw.counts && typeof raw.counts === 'object' ? raw.counts as Record<string, unknown> : {}
    return {
      data: rows.map(mapComment).filter((comment): comment is CommentReview => comment !== null),
      counts: { published: number(rawCounts.published), deleted: number(rawCounts.deleted) },
      total: number(raw.total), page: number(raw.page, page), pageSize: number(raw.pageSize, pageSize), pageCount: number(raw.pageCount),
    }
  },

  async getComment(siteId: string, commentId: number, signal?: AbortSignal): Promise<CommentReview> {
    const raw = await request<unknown>(`/api/admin/sites/${encodeURIComponent(siteId)}/comments/${commentId}`, { method: 'GET', signal })
    const comment = mapComment(raw)
    if (!comment) throw new ApiError(500, 'invalid-comment')
    return comment
  },

  async tombstone(siteId: string, commentId: number): Promise<CommentMutation> {
    const raw = await request<Record<string, unknown>>(`/api/admin/sites/${encodeURIComponent(siteId)}/comments/${commentId}`, { method: 'DELETE' })
    const comment = mapComment(raw.comment)
    if (!comment) throw new ApiError(500, 'invalid-comment')
    return { comment, unchanged: raw.unchanged === true }
  },

  async permanentlyDelete(siteId: string, commentId: number): Promise<void> {
    await request(`/api/admin/sites/${encodeURIComponent(siteId)}/comments/${commentId}/permanent`, { method: 'DELETE' })
  },

  async getNotifications(): Promise<NotificationSettings> {
    const raw = await request<Record<string, unknown>>('/api/admin/notifications', { method: 'GET' })
    return { email: mapEmail(raw.email), telegram: mapTelegram(raw.telegram) }
  },

  async saveEmail(settings: EmailNotificationSettings): Promise<EmailNotificationSettings> {
    const raw = await request<Record<string, unknown>>('/api/admin/notifications/email', { method: 'PUT', body: JSON.stringify(emailPayload(settings)) })
    return mapEmail(raw.email)
  },

  async testEmail(settings: EmailNotificationSettings): Promise<void> {
    await request('/api/admin/notifications/email/test', { method: 'POST', body: JSON.stringify(emailPayload(settings)) }, true)
  },

  async saveTelegram(settings: TelegramNotificationSettings): Promise<TelegramNotificationSettings> {
    const raw = await request<Record<string, unknown>>('/api/admin/notifications/telegram', { method: 'PUT', body: JSON.stringify(telegramPayload(settings)) })
    return mapTelegram(raw.telegram)
  },

  async testTelegram(settings: TelegramNotificationSettings): Promise<void> {
    await request('/api/admin/notifications/telegram/test', { method: 'POST', body: JSON.stringify(telegramPayload(settings)) }, true)
  },

  async getCaptcha(): Promise<CaptchaSettings> {
    const raw = await request<unknown>('/api/admin/captcha', { method: 'GET' })
    return mapCaptcha(raw)
  },

  async saveCaptcha(settings: CaptchaSettings): Promise<CaptchaSettings> {
    const raw = await request<unknown>('/api/admin/captcha', { method: 'PUT', body: JSON.stringify(captchaPayload(settings)) })
    return mapCaptcha(raw)
  },
}
