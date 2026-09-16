export interface SmojiItem { id: string; label: string; src: string }
export interface SmojiPack { id: string; label: string; items: SmojiItem[] }
export interface SmojiManifest { version: 1; packs: SmojiPack[] }

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const MARKER_PATTERN = /!\[smoji:([^\]\r\n]+)\]\((https?:\/\/[^()\s]+)\)/g

export async function loadSmojiManifest(manifestUrl: string, signal?: AbortSignal): Promise<SmojiManifest> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  const abort = (): void => controller.abort()
  if (signal?.aborted) controller.abort()
  else signal?.addEventListener('abort', abort, { once: true })
  try {
    const response = await fetch(manifestUrl, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    })

    if (!response.ok) throw new Error('manifest-request-failed')
    const media = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
    if (media !== 'application/json' && !media?.endsWith('+json')) {
      throw new Error('invalid-manifest')
    }

    const declaredLength = Number(response.headers.get('content-length') || 0)
    if (declaredLength > 1024 * 1024) {
      throw new Error('manifest-too-large')
    }

    let text = ''
    if (response.body) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let bytes = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          bytes += value.byteLength
          if (bytes > 1024 * 1024) {
            controller.abort()
            throw new Error('manifest-too-large')
          }
          text += decoder.decode(value, { stream: true })
        }
        text += decoder.decode()
      } finally {
        reader.releaseLock()
      }
    } else {
      text = await response.text()
    }
    if (text.length > 1024 * 1024 || new TextEncoder().encode(text).length > 1024 * 1024) throw new Error('manifest-too-large')

    let value: unknown
    try {
      value = JSON.parse(text) as unknown
    } catch {
      throw new Error('invalid-manifest')
    }

    return normalizeManifest(value, manifestUrl)
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

function normalizeManifest(value: unknown, manifestUrl: string): SmojiManifest {
  if (!value || typeof value !== 'object') throw new Error('invalid-manifest')
  const raw = value as Record<string, unknown>
  if (!hasExactKeys(raw, 'base' in raw ? ['version', 'base', 'packs'] : ['version', 'packs']) || raw.version !== 1 || !Array.isArray(raw.packs) || raw.packs.length < 1 || raw.packs.length > 64) throw new Error('invalid-manifest')
  const manifestOrigin = new URL(manifestUrl).origin
  if ('base' in raw) {
    if (typeof raw.base !== 'string' || !raw.base.includes('{pack}') || !raw.base.includes('{id}')) throw new Error('invalid-manifest')
    const sample = raw.base.split('{pack}').join('pack').split('{id}').join('item')
    const base = new URL(sample, manifestUrl)
    if (/[{}]/.test(sample) || base.origin !== manifestOrigin || !['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.href.includes('?') || base.href.includes('#')) throw new Error('invalid-manifest')
  }
  let itemCount = 0
  const packIDs = new Set<string>()
  const packs = raw.packs.map((pack): SmojiPack => {
    if (!pack || typeof pack !== 'object') throw new Error('invalid-manifest')
    const source = pack as Record<string, unknown>
    if (!hasExactKeys(source, ['id', 'label', 'items'])
      || typeof source.id !== 'string' || !ID_PATTERN.test(source.id) || packIDs.has(source.id)
      || !validLabel(source.label)
      || !Array.isArray(source.items) || source.items.length < 1 || source.items.length > 600) throw new Error('invalid-manifest')
    packIDs.add(source.id)
    const itemIDs = new Set<string>()
    const items = source.items.map((item): SmojiItem => {
      if (!item || typeof item !== 'object') throw new Error('invalid-manifest')
      const entry = item as Record<string, unknown>
      if (!hasExactKeys(entry, 'src' in entry ? ['id', 'label', 'src'] : ['id', 'label'])
        || typeof entry.id !== 'string' || !ID_PATTERN.test(entry.id) || itemIDs.has(entry.id)
        || !validLabel(entry.label)
        || ('src' in entry ? typeof entry.src !== 'string' : typeof raw.base !== 'string')) throw new Error('invalid-manifest')
      itemIDs.add(entry.id)
      const path = typeof entry.src === 'string' ? entry.src : (raw.base as string).split('{pack}').join(source.id as string).split('{id}').join(entry.id)
      const src = new URL(path, manifestUrl)
      if (src.origin !== manifestOrigin || !['http:', 'https:'].includes(src.protocol) || src.username || src.password || src.href.includes('?') || src.href.includes('#')) throw new Error('invalid-manifest')
      itemCount += 1
      if (itemCount > 6000) throw new Error('invalid-manifest')
      return { id: entry.id, label: entry.label.trim(), src: src.toString() }
    })
    return { id: source.id, label: source.label.trim(), items }
  })
  return { version: 1, packs }
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const keys = Object.keys(value).sort()
  return keys.length === expected.length && expected.slice().sort().every((key, index) => key === keys[index])
}

function validLabel(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && Array.from(value.trim()).length <= 40 && !/[\]\u0000-\u001f\u007f-\u009f]/.test(value)
}

export function smojiMarker(item: SmojiItem): string {
  return `![smoji:${item.label}](${item.src.replace(/\(/g, '%28').replace(/\)/g, '%29')})`
}

export function renderSmojiContent(target: HTMLElement, content: string, enabled: boolean, manifestUrl: string): void {
  if (!enabled) {
    target.textContent = content
    return
  }
  const origin = new URL(manifestUrl).origin
  let cursor = 0
  for (const match of content.matchAll(MARKER_PATTERN)) {
    if (match.index === undefined) continue
    target.append(document.createTextNode(content.slice(cursor, match.index)))
    try {
      const source = new URL(match[2])
      if (source.origin !== origin || source.username || source.password || source.href.includes('?') || source.href.includes('#')) throw new Error()
      const image = document.createElement('img')
      image.className = 'ecoku-smoji-inline'
      image.src = source.toString()
      image.alt = `[表情：${match[1]}]`
      image.loading = 'lazy'
      image.decoding = 'async'
      image.referrerPolicy = 'no-referrer'
      target.append(image)
    } catch {
      target.append(document.createTextNode(match[0]))
    }
    cursor = match.index + match[0].length
  }
  target.append(document.createTextNode(content.slice(cursor)))
}
