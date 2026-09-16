import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadSmojiManifest, renderSmojiContent, smojiMarker } from './smoji'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('Smoji manifest and marker handling', () => {
  it('normalizes same-origin relative item URLs and omits credentials', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      version: 1,
      packs: [{ id: 'demo', label: '示例', items: [{ id: 'wave', label: '挥手', src: './packs/wave.webp' }] }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const manifest = await loadSmojiManifest('https://static.example.test/smoji.json')
    expect(manifest.packs[0].items[0].src).toBe('https://static.example.test/packs/wave.webp')
    expect(fetchMock).toHaveBeenCalledWith('https://static.example.test/smoji.json', expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer' }))
    expect(smojiMarker(manifest.packs[0].items[0])).toBe('![smoji:挥手](https://static.example.test/packs/wave.webp)')
  })

  it('rejects cross-origin images and renders only same-origin markers as DOM images', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      version: 1,
      packs: [{ id: 'demo', label: '示例', items: [{ id: 'bad', label: '坏', src: 'https://tracker.example/bad.webp' }] }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })))
    await expect(loadSmojiManifest('https://static.example.test/smoji.json')).rejects.toThrow('invalid-manifest')

    const target = document.createElement('p')
    renderSmojiContent(target, '前 ![smoji:挥手](https://static.example.test/wave.webp) 后', true, 'https://static.example.test/smoji.json')
    expect(target.querySelector('img')?.getAttribute('alt')).toBe('[表情：挥手]')
    expect(target.textContent).toBe('前  后')
    const disabled = document.createElement('p')
    renderSmojiContent(disabled, '![smoji:挥手](https://static.example.test/wave.webp)', false, '')
    expect(disabled.querySelector('img')).toBeNull()
    expect(disabled.textContent).toContain('![smoji:挥手]')
  })

  it('rejects executable or presentation fields outside the v1 contract', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      version: 1,
      packs: [{ id: 'demo', label: '示例', style: 'display:none', items: [{ id: 'wave', label: '挥手', src: './wave.webp' }] }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })))
    await expect(loadSmojiManifest('https://static.example.test/smoji.json')).rejects.toThrow('invalid-manifest')
  })
})

describe('compact Smoji compatibility', () => {

  it('expands compact templates and preserves explicit src for custom groups', async () => {
    const value = { version: 1, base: 'https://static.example.test/{pack}/{id}.webp', packs: [
      { id: 'cats', label: '猫', items: [{ id: 'wave', label: '挥手' }, { id: 'other', label: '动图', src: './original/other.gif' }] },
    ] }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })))
    const manifest = await loadSmojiManifest('https://static.example.test/smoji.json')
    expect(manifest.packs[0]!.items.map(i => i.src)).toEqual(['https://static.example.test/cats/wave.webp', 'https://static.example.test/original/other.gif'])
    for (const base of ['https://other.example/{pack}/{id}.webp', './{pack}/{unknown}.webp', './{pack}/{id}.webp?token=x']) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ...value, base }), { headers: { 'content-type': 'application/json' } })))
      await expect(loadSmojiManifest('https://static.example.test/smoji.json')).rejects.toThrow('invalid-manifest')
    }
  })

})

describe('Smoji loading budgets', () => {
  it('accepts 6000 items, including 600 in one pack, and rejects overflow', async () => {
    const value = { version: 1, base: './{pack}/{id}.webp', packs: Array.from({ length: 10 }, (_, p) => ({
      id: `p${p}`, label: '表情', items: Array.from({ length: 600 }, (_, i) => ({ id: `i${i}`, label: '表情' })),
    })) }
    const url = 'https://static.example.test/smoji.json'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })))
    expect((await loadSmojiManifest(url)).packs[0].items).toHaveLength(600)
    value.packs.push({ id: 'extra', label: '表情', items: [{ id: 'x', label: '表情' }] })
    await expect(loadSmojiManifest(url)).rejects.toThrow('invalid-manifest')
  })

  it('aborts while the response body is still downloading', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async (_url, init: RequestInit) => ({
      ok: true, headers: new Headers({ 'content-type': 'application/json' }),
      text: () => new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))),
    })))
    const pending = expect(loadSmojiManifest('https://static.example.test/smoji.json')).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(8000)
    await pending
  })

  it('bounds the actual UTF-8 stream even without content-length', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('啊'.repeat(350000), { headers: { 'content-type': 'application/json' } })))
    await expect(loadSmojiManifest('https://static.example.test/smoji.json')).rejects.toThrow('manifest-too-large')
  })
})

it('round trips parentheses with default ports for explicit and compact images', async () => {
  for (const entry of [{ src: './face(1).png' }, {}]) {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ version: 1, base: './{pack}/{id}(1).png', packs: [{ id: 'demo', label: '包', items: [{ id: 'face', label: '笑', ...entry }] }] }), { headers: { 'content-type': 'application/json' } })))
    const manifest = await loadSmojiManifest('https://static.example.test:443/smoji.json')
    const marker = smojiMarker(manifest.packs[0].items[0])
    expect(marker).toContain('%281%29.png)')
    const target = document.createElement('div')
    renderSmojiContent(target, marker, true, 'https://static.example.test/smoji.json')
    expect(target.querySelectorAll('img')).toHaveLength(1)
  }
})

it('rejects empty query and fragment delimiters in both manifest formats', async () => {
  for (const suffix of ['?', '#']) {
    for (const compact of [false, true]) {
      const value = { version: 1, ...(compact ? { base: `./{pack}/{id}.png${suffix}` } : {}), packs: [{ id: 'demo', label: '包', items: [{ id: 'face', label: '笑', ...(!compact ? { src: `./face.png${suffix}` } : {}) }] }] }
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })))
      await expect(loadSmojiManifest('https://static.example.test/smoji.json')).rejects.toThrow('invalid-manifest')
    }
  }
})
