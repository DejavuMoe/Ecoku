export const codePointLength = (value: string): number => Array.from(value).length

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName)
  if (className) element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

export function safeHTTPURL(value: string): URL | null {
  if (!value || codePointLength(value) > 2048) return null
  try {
    const parsed = new URL(value)
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || !parsed.host) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function isEmailForClient(value: string): boolean {
  if (!value || codePointLength(value) > 254 || /\s/.test(value)) return false
  const separator = value.lastIndexOf('@')
  return separator > 0 && separator < value.length - 1
}

export const DEFAULT_DISPLAY_TIME_ZONE = 'Asia/Shanghai'

export function resolveTimeZone(value?: string): string {
  const timeZone = (value || '').trim() || DEFAULT_DISPLAY_TIME_ZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return timeZone
  } catch {
    return DEFAULT_DISPLAY_TIME_ZONE
  }
}

export function utcOffsetLabel(timeZone: string, date = new Date()): string {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value || 'UTC'
  return name.replace(/^GMT/, 'UTC')
}

export function formatTimeZoneTitle(timeZone: string, date = new Date()): string {
  const resolved = resolveTimeZone(timeZone)
  return `${resolved} ${utcOffsetLabel(resolved, date)}`
}

export function formatCommentTime(value?: string, timeZone = DEFAULT_DISPLAY_TIME_ZONE): string {
  if (!value) return '时间未知'
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return '时间未知'
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: resolveTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(timestamp)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
