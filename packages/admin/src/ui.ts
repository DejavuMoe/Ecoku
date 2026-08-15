import type { EmailNotificationSettings, TelegramNotificationSettings, TurnstileSettings } from './types'

export function formatDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '时间未知'
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(parsed)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}/${part('month')}/${part('day')} ${part('hour')}:${part('minute')}`
}

export function safeWebsite(value?: string): string {
  if (!value) return ''
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : ''
  } catch {
    return ''
  }
}

export function emptyEmailSettings(): EmailNotificationSettings {
  return {
    enabled: false,
    host: '',
    port: 0,
    encryption: 'tls',
    username: '',
    password: '',
    passwordSet: false,
    fromAddress: '',
    recipients: [],
    revision: 1,
  }
}

export function emptyTelegramSettings(): TelegramNotificationSettings {
  return {
    enabled: false,
    token: '',
    tokenSet: false,
    targets: [],
    revision: 1,
  }
}

export function cloneEmailSettings(value: EmailNotificationSettings): EmailNotificationSettings {
  return { ...value, recipients: [...value.recipients], password: '' }
}

export function cloneTelegramSettings(value: TelegramNotificationSettings): TelegramNotificationSettings {
  return { ...value, targets: [...value.targets], token: '' }
}

export function emptyTurnstileSettings(): TurnstileSettings {
  return { enabled: false, sitekey: '', secret: '', secretSet: false, revision: 1 }
}

export function cloneTurnstileSettings(value: TurnstileSettings): TurnstileSettings {
  return { ...value, secret: '' }
}
