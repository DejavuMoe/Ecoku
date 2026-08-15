import type {
  AdminSession,
  CommentMutation,
  CommentPage,
  CommentReview,
  CommentStatus,
  EmailNotificationSettings,
  NotificationSettings,
  SiteSummary,
  SiteWrite,
  TelegramNotificationSettings,
  TurnstileSettings,
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

async function request<T>(path: string, init: RequestInit = {}, token = '', allowEmpty = false): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let response: Response
  try {
    response = await fetch(path, { ...init, headers, credentials: 'same-origin' })
  } catch {
    throw new ApiError(0, 'network')
  }
  let envelope: ResponseEnvelope<T>
  try {
    envelope = (await response.json()) as ResponseEnvelope<T>
  } catch {
    throw new ApiError(response.ok ? 500 : response.status, 'invalid-response')
  }
  if (!response.ok) throw new ApiError(response.status, envelope.message || 'request-failed', responseErrorCode(envelope.data))
  if (envelope.data === undefined && !allowEmpty) throw new ApiError(500, 'missing-response-data')
  return envelope.data as T
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

function mapTurnstile(value: unknown): TurnstileSettings {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    enabled: raw.enabled === true,
    sitekey: text(raw.sitekey),
    secret: '',
    secretSet: raw.secret_set === true,
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

function turnstilePayload(settings: TurnstileSettings) {
  return {
    enabled: settings.enabled,
    sitekey: settings.sitekey,
    secret: settings.secret,
    revision: settings.revision,
  }
}

export const adminApi = {
  async getLoginConfig(signal?: AbortSignal): Promise<{ turnstileSitekey: string }> {
    const raw = await request<Record<string, unknown>>('/api/admin/login-config', { method: 'GET', signal })
    return { turnstileSitekey: text(raw.turnstileSitekey) }
  },

  async login(username: string, password: string, turnstileToken = '', signal?: AbortSignal): Promise<AdminSession> {
    const raw = await request<Record<string, unknown>>('/api/admin/login', { method: 'POST', body: JSON.stringify({ username, password, turnstileToken }), signal })
    const token = text(raw.token)
    const expiresAt = text(raw.expires_at)
    if (!token || !expiresAt || raw.token_type !== 'Bearer') throw new ApiError(500, 'invalid-session')
    return { token, tokenType: 'Bearer', expiresAt, expiresIn: number(raw.expires_in) }
  },

  async listSites(token: string, signal?: AbortSignal): Promise<SiteSummary[]> {
    const raw = await request<{ data?: unknown[] }>('/api/admin/sites', { method: 'GET', signal }, token)
    return (raw.data ?? []).map(mapSite).filter((site): site is SiteSummary => site !== null)
  },

  async createSite(token: string, site: SiteWrite): Promise<SiteSummary> {
    const raw = await request<Record<string, unknown>>('/api/admin/sites', { method: 'POST', body: JSON.stringify(sitePayload(site)) }, token)
    const mapped = mapSite(raw.site)
    if (!mapped) throw new ApiError(500, 'invalid-site')
    return mapped
  },

  async updateSite(token: string, site: SiteWrite): Promise<SiteSummary> {
    const raw = await request<Record<string, unknown>>(`/api/admin/sites/${encodeURIComponent(site.id)}`, { method: 'PUT', body: JSON.stringify(sitePayload(site)) }, token)
    const mapped = mapSite(raw.site)
    if (!mapped) throw new ApiError(500, 'invalid-site')
    return mapped
  },

  async listComments(token: string, siteId: string, status: CommentStatus, page: number, pageSize: number, sort: 'oldest' | 'newest', signal?: AbortSignal): Promise<CommentPage> {
    const query = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize), sort })
    const raw = await request<Record<string, unknown>>(`/api/admin/sites/${encodeURIComponent(siteId)}/comments?${query}`, { method: 'GET', signal }, token)
    const rows = Array.isArray(raw.data) ? raw.data : []
    const rawCounts = raw.counts && typeof raw.counts === 'object' ? raw.counts as Record<string, unknown> : {}
    return {
      data: rows.map(mapComment).filter((comment): comment is CommentReview => comment !== null),
      counts: { published: number(rawCounts.published), deleted: number(rawCounts.deleted) },
      total: number(raw.total), page: number(raw.page, page), pageSize: number(raw.pageSize, pageSize), pageCount: number(raw.pageCount),
    }
  },

  async getComment(token: string, siteId: string, commentId: number, signal?: AbortSignal): Promise<CommentReview> {
    const raw = await request<unknown>(`/api/admin/sites/${encodeURIComponent(siteId)}/comments/${commentId}`, { method: 'GET', signal }, token)
    const comment = mapComment(raw)
    if (!comment) throw new ApiError(500, 'invalid-comment')
    return comment
  },

  async tombstone(token: string, siteId: string, commentId: number): Promise<CommentMutation> {
    const raw = await request<Record<string, unknown>>(`/api/admin/sites/${encodeURIComponent(siteId)}/comments/${commentId}`, { method: 'DELETE' }, token)
    const comment = mapComment(raw.comment)
    if (!comment) throw new ApiError(500, 'invalid-comment')
    return { comment, unchanged: raw.unchanged === true }
  },

  async permanentlyDelete(token: string, siteId: string, commentId: number): Promise<void> {
    await request(`/api/admin/sites/${encodeURIComponent(siteId)}/comments/${commentId}/permanent`, { method: 'DELETE' }, token)
  },

  async getNotifications(token: string): Promise<NotificationSettings> {
    const raw = await request<Record<string, unknown>>('/api/admin/notifications', { method: 'GET' }, token)
    return { email: mapEmail(raw.email), telegram: mapTelegram(raw.telegram) }
  },

  async saveEmail(token: string, settings: EmailNotificationSettings): Promise<EmailNotificationSettings> {
    const raw = await request<Record<string, unknown>>('/api/admin/notifications/email', { method: 'PUT', body: JSON.stringify(emailPayload(settings)) }, token)
    return mapEmail(raw.email)
  },

  async testEmail(token: string, settings: EmailNotificationSettings): Promise<void> {
    await request('/api/admin/notifications/email/test', { method: 'POST', body: JSON.stringify(emailPayload(settings)) }, token, true)
  },

  async saveTelegram(token: string, settings: TelegramNotificationSettings): Promise<TelegramNotificationSettings> {
    const raw = await request<Record<string, unknown>>('/api/admin/notifications/telegram', { method: 'PUT', body: JSON.stringify(telegramPayload(settings)) }, token)
    return mapTelegram(raw.telegram)
  },

  async testTelegram(token: string, settings: TelegramNotificationSettings): Promise<void> {
    await request('/api/admin/notifications/telegram/test', { method: 'POST', body: JSON.stringify(telegramPayload(settings)) }, token, true)
  },

  async getTurnstile(token: string): Promise<TurnstileSettings> {
    const raw = await request<unknown>('/api/admin/turnstile', { method: 'GET' }, token)
    return mapTurnstile(raw)
  },

  async saveTurnstile(token: string, settings: TurnstileSettings): Promise<TurnstileSettings> {
    const raw = await request<unknown>('/api/admin/turnstile', { method: 'PUT', body: JSON.stringify(turnstilePayload(settings)) }, token)
    return mapTurnstile(raw)
  },
}

