import type { CaptchaSettings, EmailNotificationSettings, TelegramNotificationSettings } from './types'
import { adminTimeZone } from './timezone.svelte'

export function formatDate(value: string, timeZone = adminTimeZone.value): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '时间未知'
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(parsed)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}/${part('month')}/${part('day')} ${part('hour')}:${part('minute')}`
}

// `YYYY/MM/DD` of the calendar day before `key`, independent of daylight-saving day lengths.
export function previousDayKey(key: string): string {
  const [year, month, day] = key.split('/').map(Number)
  if (!year || !month || !day) return ''
  const previous = new Date(Date.UTC(year, month - 1, day - 1))
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${previous.getUTCFullYear()}/${pad(previous.getUTCMonth() + 1)}/${pad(previous.getUTCDate())}`
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

export function emptyCaptchaSettings(): CaptchaSettings {
  return {
    provider: 'off',
    turnstile: { sitekey: '', secret: '', secretSet: false },
    cap: { instanceUrl: '', sitekey: '', secret: '', secretSet: false },
    revision: 1,
  }
}

export function cloneCaptchaSettings(value: CaptchaSettings): CaptchaSettings {
  return {
    ...value,
    turnstile: { ...value.turnstile, secret: '' },
    cap: { ...value.cap, secret: '' },
  }
}
