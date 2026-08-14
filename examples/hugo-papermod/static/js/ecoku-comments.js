(() => {
  const setup = () => {
    const shell = document.getElementById('ecoku-comment-shell')
    const mount = document.getElementById('tcomment')
    const loader = shell && shell.querySelector('.comment-loader')
    const status = shell && shell.querySelector('.comment-status')
    const retry = shell && shell.querySelector('.comment-retry')
    if (!shell || !mount || !loader || !status || !retry || shell.dataset.ecokuReady === 'true') return

    shell.dataset.ecokuReady = 'true'
    let loading = false
    let loaded = false
    let timeoutId

    const showFailure = (message) => {
      window.clearTimeout(timeoutId)
      loading = false
      shell.setAttribute('aria-busy', 'false')
      loader.hidden = false
      status.textContent = message
      retry.hidden = false
    }

    const initialize = async () => {
      if (typeof window.Ecoku !== 'function') throw new Error('Ecoku browser client is unavailable')
      const comments = new window.Ecoku({
        container: mount,
        serverURL: shell.dataset.serverUrl,
        siteId: shell.dataset.siteId,
        pageKey: shell.dataset.pageKey,
        pageTitle: shell.dataset.pageTitle,
        pageSize: 10,
        theme: 'auto'
      })
      await comments.init()
      window.clearTimeout(timeoutId)
      loading = false
      loaded = true
      shell.setAttribute('aria-busy', 'false')
      loader.hidden = true
    }

    const loadEcoku = () => {
      if (loading || loaded) return
      loading = true
      retry.hidden = true
      status.textContent = '正在加载评论…'
      shell.setAttribute('aria-busy', 'true')

      const existing = document.querySelector('script[data-ecoku-loader]')
      if (existing && typeof window.Ecoku === 'function') {
        initialize().catch(() => showFailure('评论服务初始化失败，请稍后重试。'))
        return
      }

      const script = existing || document.createElement('script')
      const sdkVersion = shell.dataset.sdkVersion
      script.src = `/vendor/ecoku.umd.js${sdkVersion ? `?v=${encodeURIComponent(sdkVersion)}` : ''}`
      script.async = true
      script.dataset.ecokuLoader = ''
      script.addEventListener('load', () => {
        initialize().catch(() => showFailure('评论服务初始化失败，请稍后重试。'))
      }, { once: true })
      script.addEventListener('error', () => {
        script.remove()
        showFailure('评论脚本加载失败，请检查网络后重试。')
      }, { once: true })
      if (!existing) document.body.appendChild(script)

      timeoutId = window.setTimeout(() => {
        showFailure('评论服务响应超时，请稍后重试。')
      }, 12000)
    }

    retry.addEventListener('click', loadEcoku)
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          loadEcoku()
        }
      }, { rootMargin: '400px' })
      observer.observe(shell)
    } else {
      loadEcoku()
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true })
  else setup()
})()
