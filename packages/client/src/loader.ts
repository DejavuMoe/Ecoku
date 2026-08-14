import { setupEcokuLoader } from './loader-core'

const start = () => {
  const currentScript = document.currentScript
  const loaderURL = currentScript instanceof HTMLScriptElement ? currentScript.src : ''
  setupEcokuLoader(document, window, loaderURL)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true })
} else {
  start()
}
