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
    document.body.innerHTML = `
      <section data-ecoku-comments data-server-url="https://ecoku.example"
        data-site-id="blog" data-page-key="/posts/test/" data-page-title="测试"
        data-page-size="12" data-theme="dark" aria-busy="false">
        <div data-ecoku-loader><span data-ecoku-status></span>
          <button data-ecoku-retry type="button" hidden></button></div>
        <div id="ecoku-mount" data-ecoku-mount></div>
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

  it('starts loading immediately without waiting for intersection', async () => {
    class IdleIntersectionObserver implements IntersectionObserver {
      readonly root = null
      readonly rootMargin = '0px'
      readonly scrollMargin = '0px'
      readonly thresholds = [0]
      disconnect(): void {}
      observe(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return []
      }
      unobserve(): void {}
    }
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: IdleIntersectionObserver,
    })
    document.body.innerHTML = `
      <section data-ecoku-comments data-server-url="https://ecoku.example"
        data-site-id="blog" data-page-key="/posts/eager/">
        <div data-ecoku-loader><span data-ecoku-status>评论区将在滚动到附近时加载。</span>
          <button data-ecoku-retry type="button" hidden></button></div>
        <div data-ecoku-mount></div>
      </section>`
    const init = vi.fn().mockResolvedValue(undefined)
    const Constructor = vi.fn(function (this: { init: typeof init }) {
      this.init = init
    })
    ;(window as Window & { Ecoku?: unknown }).Ecoku = Constructor

    setupEcokuLoader(document, window, 'https://ecoku.example/client/ecoku-loader.js')
    await vi.waitFor(() => expect(init).toHaveBeenCalledOnce())
    expect(document.querySelector('[data-ecoku-status]')?.textContent).toBe('正在加载评论…')
  })

  it('still initializes legacy Twikoo-era class names until hosts migrate', async () => {
    document.body.innerHTML = `
      <section data-ecoku-comments data-server-url="https://ecoku.example"
        data-site-id="blog" data-page-key="/posts/legacy/">
        <div class="comment-loader"><span class="comment-status"></span>
          <button class="comment-retry" type="button" hidden></button></div>
        <div id="tcomment"></div>
      </section>`
    const init = vi.fn().mockResolvedValue(undefined)
    const Constructor = vi.fn(function (this: { init: typeof init }) {
      this.init = init
    })
    ;(window as Window & { Ecoku?: unknown }).Ecoku = Constructor

    setupEcokuLoader(document, window, 'https://ecoku.example/client/ecoku-loader.js')
    await vi.waitFor(() => expect(init).toHaveBeenCalledOnce())
    expect(Constructor).toHaveBeenCalledWith(expect.objectContaining({
      pageKey: '/posts/legacy/',
    }))
  })
})
