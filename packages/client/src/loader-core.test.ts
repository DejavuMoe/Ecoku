import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    expect(document.querySelector('[data-ecoku-status]')?.textContent).toBe('')
    expect((document.querySelector('[data-ecoku-loader]') as HTMLElement | null)?.hidden).toBe(true)
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

  it('loads a host stylesheet and skips injecting when data-css-url is set', async () => {
    document.body.innerHTML = `
      <section data-ecoku-comments data-server-url="https://ecoku.example"
        data-site-id="blog" data-page-key="/posts/custom-css/"
        data-css-url="https://cdn.example/ecoku.unstyled.css" aria-busy="false">
        <div data-ecoku-loader hidden><span data-ecoku-status></span>
          <button data-ecoku-retry type="button" hidden></button></div>
        <div data-ecoku-mount></div>
      </section>`
    const init = vi.fn().mockResolvedValue(undefined)
    const Constructor = vi.fn(function (this: { init: typeof init }) {
      this.init = init
    })
    ;(window as Window & { Ecoku?: unknown }).Ecoku = Constructor

    // Assert the link insertion without fetching the placeholder host.
    const append = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => node)
    setupEcokuLoader(document, window, 'https://ecoku.example/client/ecoku-loader.js')
    await vi.waitFor(() => expect(init).toHaveBeenCalledOnce())
    expect(Constructor).toHaveBeenCalledWith(expect.objectContaining({
      cssURL: 'https://cdn.example/ecoku.unstyled.css',
    }))
    expect(append).toHaveBeenCalledOnce()
    const link = append.mock.calls[0][0] as HTMLLinkElement
    expect(link.dataset.ecokuCss).toBe('')
    expect(link?.href).toBe('https://cdn.example/ecoku.unstyled.css')
    expect(link?.rel).toBe('stylesheet')
  })
})

describe('loader retry races', () => {
  afterEach(() => { vi.useRealTimers(); delete (window as Window & { Ecoku?: unknown }).Ecoku })
  const shell = () => {
    document.body.innerHTML = `<section data-ecoku-comments data-server-url="https://ecoku.example" data-site-id="blog" data-page-key="/">
      <div data-ecoku-loader><span data-ecoku-status></span><button data-ecoku-retry hidden></button></div><div data-ecoku-mount></div></section>`
  }
  it('removes a stalled script and ignores its late load after retry', async () => {
    vi.useFakeTimers(); vi.resetModules(); shell()
    delete (window as Window & { Ecoku?: unknown }).Ecoku
    const { setupEcokuLoader: setup } = await import('./loader-core')
    const append = document.body.appendChild.bind(document.body)
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      // Keep the node attached but inert; this test controls load/error timing.
      if (node instanceof HTMLScriptElement) node.type = 'application/json'
      return append(node)
    })
    setup(document, window)
    const oldScript = document.querySelector('script[data-ecoku-sdk]')!
    expect(oldScript).not.toBeNull()
    expect(oldScript.isConnected).toBe(true)
    expect(document.querySelector('[data-ecoku-status]')?.textContent).toBe('')
    await vi.advanceTimersByTimeAsync(12000)
    expect(oldScript.isConnected).toBe(false)
    expect(document.querySelector('[data-ecoku-status]')?.textContent).toBe('评论服务响应超时，请稍后重试。')
    ;(document.querySelector('[data-ecoku-retry]') as HTMLElement).click()
    const newScript = document.querySelector('script[data-ecoku-sdk]')!
    expect(newScript).not.toBeNull()
    expect(newScript).not.toBe(oldScript)
    expect(newScript.isConnected).toBe(true)
    const init = vi.fn().mockResolvedValue(undefined)
    ;(window as Window & { Ecoku?: unknown }).Ecoku = class { init = init; destroy() {} }
    oldScript.dispatchEvent(new Event('load'))
    newScript.dispatchEvent(new Event('load'))
    await vi.advanceTimersByTimeAsync(0)
    expect(init).toHaveBeenCalledOnce()
    expect(document.querySelector('[data-ecoku-comments]')?.getAttribute('aria-busy')).toBe('false')
  })
  it('destroys a timed out instance and ignores its late rejection', async () => {
    vi.useFakeTimers(); shell()
    let rejectOld!: (error: Error) => void
    const destroy = vi.fn()
    let calls = 0
    ;(window as Window & { Ecoku?: unknown }).Ecoku = class {
      destroy = destroy
      init() { return ++calls === 1 ? new Promise<void>((_resolve, reject) => { rejectOld = reject }) : Promise.resolve() }
    }
    setupEcokuLoader(document, window)
    await vi.advanceTimersByTimeAsync(12000)
    expect(destroy).toHaveBeenCalledOnce()
    ;(document.querySelector('[data-ecoku-retry]') as HTMLElement).click()
    await vi.advanceTimersByTimeAsync(0)
    rejectOld(new Error('late'))
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toBe(2)
    expect((document.querySelector('[data-ecoku-loader]') as HTMLElement).hidden).toBe(true)
  })
})
