// Item lists: allowed origins, notification recipients and Telegram targets are edited one input per item.
// Messages are Chinese sources; the admin translation layer renders them in the console language.

export type ListKind = 'origin' | 'email' | 'telegram'

export interface ItemIssue {
  text: string
  // A corrected value the administrator can apply with one click.
  fix?: string
  // Soft issues are notes, not errors: the value is still accepted.
  soft?: boolean
}

export const MAX_SITE_ORIGINS = 32

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LOOPBACK = /^(localhost|127\.0\.0\.1)$/

function parseURL(value: string): URL | null {
  try { return new URL(value) } catch { return null }
}

// Mirrors server/config.NormalizeOrigin: http or https, a host, no credentials, path, query or fragment.
function originIssue(value: string): ItemIssue | null {
  const url = parseURL(value)
  if (!url || !['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    const guess = parseURL(`https://${value}`)
    if (guess && (guess.hostname.includes('.') || guess.hostname === 'localhost')) {
      const scheme = LOOPBACK.test(guess.hostname) ? 'http' : 'https'
      return { text: guess.pathname === '/' && !guess.search && !guess.hash ? '缺少协议' : '缺少协议，且不能含路径', fix: `${scheme}://${guess.host}` }
    }
    return { text: '需要完整来源，例如 https://blog.example.com' }
  }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || /[?#]/.test(value)) {
    return { text: '只填来源，不含路径', fix: url.origin }
  }
  return null
}

function emailIssue(value: string): ItemIssue | null {
  return EMAIL.test(value) && value.length <= 254 ? null : { text: '邮箱格式无效' }
}

// Mirrors server/notifications: digits with an optional minus sign, at most 32 characters.
function telegramIssue(value: string): ItemIssue | null {
  if (value.startsWith('@')) return { text: '不支持 @用户名，请填写数字 ID' }
  return /^-?\d+$/.test(value) && value.length <= 32 ? null : { text: '只能填写数字 ID，可带负号' }
}

export function itemIssue(kind: ListKind, raw: string): ItemIssue | null {
  const value = raw.trim()
  if (!value) return null
  if (kind === 'origin') return originIssue(value)
  return kind === 'email' ? emailIssue(value) : telegramIssue(value)
}

// The value the server stores, used to spot duplicates and to build the saved list.
function itemKey(kind: ListKind, value: string): string {
  return kind === 'origin' ? new URL(value).origin : value
}

// The issue for one item in context: its own problem, or a note that an earlier item already has it.
export function rowIssue(kind: ListKind, values: readonly string[], index: number): ItemIssue | null {
  const value = values[index]?.trim() ?? ''
  if (!value) return null
  const issue = itemIssue(kind, value)
  if (issue) return issue
  const key = itemKey(kind, value)
  const first = values.findIndex((other) => other.trim() !== '' && !itemIssue(kind, other) && itemKey(kind, other.trim()) === key)
  return first > -1 && first < index ? { text: `与第 ${first + 1} 项重复，保存时合并`, soft: true } : null
}

export function invalidItemCount(kind: ListKind, values: readonly string[]): number {
  return values.filter((value) => itemIssue(kind, value)).length
}

// The list to save: trimmed, normalized and without duplicates. Call only after invalidItemCount is zero.
export function normalizeItems(kind: ListKind, values: readonly string[]): string[] {
  const items = values.map((value) => value.trim()).filter(Boolean).map((value) => itemKey(kind, value))
  return [...new Set(items)]
}

// One pasted block may hold several items: one per line, or separated by commas, semicolons or spaces.
export function splitPasted(text: string): string[] {
  return text.split(/[\s,，;；]+/).filter(Boolean)
}
