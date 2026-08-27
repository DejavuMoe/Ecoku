import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadSmojiManifest, renderSmojiContent, smojiMarker } from './smoji'

afterEach(() => vi.unstubAllGlobals())

describe('Smoji manifest and marker handling', () => {
  it('normalizes same-origin relative item URLs and omits credentials', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      version: 1,
      packs: [{ id: 'demo', label: '示例', items: [{ id: 'wave', label: '挥手', src: './packs/wave.webp' }] }],
    }), { status: 200 }))
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
    }), { status: 200 })))
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
    }), { status: 200 })))
    await expect(loadSmojiManifest('https://static.example.test/smoji.json')).rejects.toThrow('invalid-manifest')
  })
})
