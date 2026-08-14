export type CommentStatus = 'published' | 'deleted'
export type MainView = 'comments' | 'sites' | 'notifications'
export type EmailEncryption = 'tls' | 'starttls' | 'none'

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
  revision: number
  createdAt: string
  updatedAt: string
}

export type SiteWrite = Omit<SiteSummary, 'createdAt' | 'updatedAt'>

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
  token: string
  tokenType: 'Bearer'
  expiresAt: string
  expiresIn: number
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
