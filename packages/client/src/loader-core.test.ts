import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveEcokuSDKURL, setupEcokuLoader } from './loader-core'

describe('Ecoku hosted loader', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    delete (window as Window & { Ecoku?: unknown }).Ecoku
  })

  it('resolves the UMD asset next to the hosted loader', () => {
    expect(resolveEcokuSDKURL(
      'https://ecoku.example/client/ecoku-loader.js',
      'https://ignored.example',
    )).toBe('https://ecoku.example/client/ecoku.umd.js')
  })

  it('initializes every declared comment mount without embedding credentials', async () => {
    class ImmediateIntersectionObserver implements IntersectionObserver {
      readonly root = null
      readonly rootMargin = '0px'
      readonly scrollMargin = '0px'
      readonly thresholds = [0]
      private readonly callback: IntersectionObserverCallback

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
      }

      disconnect(): void {}

      observe(target: Element): void {
        this.callback([
          { isIntersecting: true, target } as IntersectionObserverEntry,
        ], this)
      }

      takeRecords(): IntersectionObserverEntry[] {
        return []
      }

      unobserve(): void {}
    }
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: ImmediateIntersectionObserver,
    })
    document.body.innerHTML = `
      <section data-ecoku-comments data-server-url="https://ecoku.example"
        data-site-id="blog" data-page-key="/posts/test/" data-page-title="测试"
        data-page-size="12" data-theme="dark" aria-busy="false">
        <div class="comment-loader"><span class="comment-status"></span>
          <button class="comment-retry" type="button" hidden></button></div>
        <div data-ecoku-mount></div>
      </section>`
    const init = vi.fn().mockResolvedValue(undefined)
    const Constructor = vi.fn(function (this: { init: typeof init }) {
      this.init = init
    })
    ;(window as Window & { Ecoku?: unknown }).Ecoku = Constructor

    setupEcokuLoader(document, window, 'https://ecoku.example/client/ecoku-loader.js')
    await vi.waitFor(() => expect(init).toHaveBeenCalledOnce())

    expect(Constructor).toHaveBeenCalledWith(expect.objectContaining({
      serverURL: 'https://ecoku.example',
      siteId: 'blog',
      pageKey: '/posts/test/',
      pageTitle: '测试',
      pageSize: 12,
      theme: 'dark',
    }))
    expect(document.querySelector('[data-ecoku-comments]')?.getAttribute('aria-busy')).toBe('false')
  })
})
