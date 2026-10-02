export type AdminSmojiToken =
  | { type: 'text'; value: string }
  | { type: 'image'; label: string; src: string }

const MARKER_PATTERN = /!\[smoji:([^\]\r\n]+)\]\((https?:\/\/[^()\s]+)\)/g

export function normalizeSmojiImageOrigin(value: string): string {
  if (!value.trim()) return ''
  const url = new URL(value.trim())
  const loopback = url.hostname === 'localhost' || /^127\.\d+\.\d+\.\d+$/.test(url.hostname) || url.hostname === '[::1]'
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
    || url.username || url.password || url.href.includes('?') || url.href.includes('#') || url.hostname.includes('*')
    || url.pathname !== '/') throw new Error('invalid-image-origin')
  return url.origin
}

export function tokenizeAdminSmoji(content: string, enabled: boolean, manifestUrl: string, imageOrigin = ''): AdminSmojiToken[] {
  if (!enabled || !manifestUrl) return [{ type: 'text', value: content }]
  let origin = ''
  try {
    const url = new URL(imageOrigin ? normalizeSmojiImageOrigin(imageOrigin) : manifestUrl)
    const loopback = url.hostname === 'localhost' || /^127\.\d+\.\d+\.\d+$/.test(url.hostname) || url.hostname === '[::1]'
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
      || url.username || url.password || url.href.includes('?') || url.href.includes('#') || url.hostname.includes('*')
      || (imageOrigin && url.pathname !== '/')) throw new Error()
    origin = url.origin
  } catch {
    return [{ type: 'text', value: content }]
  }
  const tokens: AdminSmojiToken[] = []
  let cursor = 0
  for (const match of content.matchAll(MARKER_PATTERN)) {
    if (match.index === undefined) continue
    if (match.index > cursor) tokens.push({ type: 'text', value: content.slice(cursor, match.index) })
    try {
      const source = new URL(match[2])
      if (source.origin !== origin || source.username || source.password || source.href.includes('?') || source.href.includes('#')) throw new Error()
      tokens.push({ type: 'image', label: match[1], src: source.toString() })
    } catch {
      tokens.push({ type: 'text', value: match[0] })
    }
    cursor = match.index + match[0].length
  }
  if (cursor < content.length) tokens.push({ type: 'text', value: content.slice(cursor) })
  return tokens.length ? tokens : [{ type: 'text', value: content }]
}

// One-line previews, such as a quoted parent, read each emoji the body would render as its label.
export function smojiPlainText(content: string, enabled: boolean, manifestUrl: string, imageOrigin = ''): string {
  return tokenizeAdminSmoji(content, enabled, manifestUrl, imageOrigin).map((token) => token.type === 'image' ? `[表情：${token.label}]` : token.value).join('')
}
