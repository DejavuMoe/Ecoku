export type CommentStatus = 'published' | 'deleted'
export type MainView = 'comments' | 'sites' | 'notifications' | 'security'
export type EmailEncryption = 'tls' | 'starttls'

export interface SiteSummary {
  id: string
  siteUrl: string
  name: string
  allowedOrigins: string[]
  defaultSort: 'newest' | 'oldest'
  emailRequired: boolean
  websiteRequired: boolean
  placeholder: string
  commentLimit: number
  emptyMessage: string
  smojiEnabled: boolean
  smojiManifestUrl: string
  smojiImageOrigin: string
  bloggerNickname: string
  bloggerEmail: string
  bloggerBadge: string
  bloggerPassphraseSet: boolean
  revision: number
  createdAt: string
  updatedAt: string
}

export type SiteWrite = Omit<SiteSummary, 'createdAt' | 'updatedAt' | 'bloggerPassphraseSet'> & {
  bloggerPassphrase?: string
  bloggerPassphraseSet?: boolean
}

export interface CommentReview {
  id: number
  siteId: string
  mark: string
  pageTitle: string
  parent: number
  status: CommentStatus
  deleted: boolean
  hasChildren: boolean
  username: string
  email?: string
  url?: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface CommentPage {
  data: CommentReview[]
  counts: Record<CommentStatus, number>
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export interface AdminSession {
  expiresAt: string
  expiresIn: number
  requiresPasswordChange: boolean
}

export interface CommentMutation { comment: CommentReview; unchanged: boolean }

export interface EmailNotificationSettings {
  enabled: boolean
  host: string
  port: number
  encryption: EmailEncryption
  username: string
  password: string
  passwordSet: boolean
  fromAddress: string
  recipients: string[]
  revision: number
}

export interface TelegramNotificationSettings {
  enabled: boolean
  token: string
  tokenSet: boolean
  targets: string[]
  revision: number
}

export interface NotificationSettings {
  email: EmailNotificationSettings
  telegram: TelegramNotificationSettings
}

export type CaptchaProvider = 'off' | 'turnstile' | 'cap'

export interface CaptchaPublicConfig {
  provider: CaptchaProvider
  sitekey: string
  instanceUrl: string
}

export interface CaptchaProviderSettings {
  sitekey: string
  secret: string
  secretSet: boolean
}

export interface CapSettings extends CaptchaProviderSettings {
  instanceUrl: string
}

export interface CaptchaSettings {
  provider: CaptchaProvider
  turnstile: CaptchaProviderSettings
  cap: CapSettings
  revision: number
}

export interface LoginConfig {
  captcha: CaptchaPublicConfig
  turnstileSitekey: string
}
