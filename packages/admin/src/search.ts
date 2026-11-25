// Comment search, as the server reads it: words split on any space, the first eight distinct
// words all have to match, and "#123" means comment 123. SQLite folds only ASCII letters, so
// the marks shown for a find fold the same letters and no others.

export const COMMENT_SEARCH_MAX = 100
const COMMENT_SEARCH_TERMS = 8

export interface CommentSearchTerms {
  words: string[]
  ids: Set<number>
}

export interface HighlightSegment {
  text: string
  hit: boolean
}

const asciiLower = (value: string) => value.replace(/[A-Z]/g, (letter) => letter.toLowerCase())

/** The query sent to the server: spaces collapsed, ends trimmed, at most 100 characters. */
export function normalizeCommentSearch(raw: string): string {
  return Array.from(raw.replace(/\s+/g, ' ').trim()).slice(0, COMMENT_SEARCH_MAX).join('').trim()
}

export function commentSearchTerms(query: string): CommentSearchTerms {
  const words: string[] = []
  const ids = new Set<number>()
  const seen = new Set<string>()
  for (const term of query.split(/\s+/)) {
    if (!term) continue
    const key = asciiLower(term)
    if (seen.has(key)) continue
    seen.add(key)
    const id = /^#(\d+)$/.exec(term)
    if (id) ids.add(Number(id[1]))
    else words.push(key)
    if (seen.size === COMMENT_SEARCH_TERMS) break
  }
  return { words, ids }
}

/** Splits text into plain and found parts; overlapping finds merge into one. */
export function highlightSegments(text: string, words: readonly string[]): HighlightSegment[] {
  if (!text) return []
  if (!words.length) return [{ text, hit: false }]
  const lower = asciiLower(text)
  const found: [number, number][] = []
  for (const word of words) {
    for (let at = lower.indexOf(word); at !== -1; at = lower.indexOf(word, at + word.length)) found.push([at, at + word.length])
  }
  if (!found.length) return [{ text, hit: false }]
  found.sort((a, b) => a[0] - b[0])
  const spans: [number, number][] = [found[0]!]
  for (const [start, end] of found.slice(1)) {
    const last = spans[spans.length - 1]!
    if (start <= last[1]) last[1] = Math.max(last[1], end)
    else spans.push([start, end])
  }
  const segments: HighlightSegment[] = []
  let at = 0
  for (const [start, end] of spans) {
    if (start > at) segments.push({ text: text.slice(at, start), hit: false })
    segments.push({ text: text.slice(start, end), hit: true })
    at = end
  }
  if (at < text.length) segments.push({ text: text.slice(at), hit: false })
  return segments
}
