export type AdminSmojiToken =
  | { type: 'text'; value: string }
  | { type: 'image'; label: string; src: string }

const MARKER_PATTERN = /!\[smoji:([^\]\r\n]+)\]\((https?:\/\/[^()\s]+)\)/g

export function tokenizeAdminSmoji(content: string, enabled: boolean, manifestUrl: string): AdminSmojiToken[] {
  if (!enabled || !manifestUrl) return [{ type: 'text', value: content }]
  let origin = ''
  try {
    origin = new URL(manifestUrl).origin
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
      if (source.origin !== origin) throw new Error()
      tokens.push({ type: 'image', label: match[1], src: source.toString() })
    } catch {
      tokens.push({ type: 'text', value: match[0] })
    }
    cursor = match.index + match[0].length
  }
  if (cursor < content.length) tokens.push({ type: 'text', value: content.slice(cursor) })
  return tokens.length ? tokens : [{ type: 'text', value: content }]
}
