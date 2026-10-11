import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('EC-05 loader entrypoint', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    delete (window as Window & { Ecoku?: unknown }).Ecoku
    document.body.innerHTML = `
      <section data-ecoku-comments data-server-url="https://api.example.test"
        data-site-id="blog" data-page-key="/post/">
        <div data-ecoku-loader><span data-ecoku-status></span>
          <button data-ecoku-retry></button></div>
        <div data-ecoku-mount></div>
      </section>`
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it.each(['loading', 'interactive'] as const)('keeps the asset location when the document is %s', async (readyState) => {
    const script = document.createElement('script')
    script.src = 'https://assets.example.test/sdk/ecoku-loader.js'
    vi.spyOn(document, 'readyState', 'get').mockReturnValue(readyState)
    const currentScript = vi.spyOn(document, 'currentScript', 'get').mockReturnValue(script)
    // Observe insertion without fetching the fixture hostname.
    const append = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node)

    await import('./loader')
    if (readyState === 'loading') {
      expect(append).not.toHaveBeenCalled()
      currentScript.mockReturnValue(null)
      document.dispatchEvent(new Event('DOMContentLoaded'))
    }

    expect(append).toHaveBeenCalledOnce()
    expect((append.mock.calls[0][0] as HTMLScriptElement).src)
      .toBe('https://assets.example.test/sdk/ecoku.umd.js')
  })
})
