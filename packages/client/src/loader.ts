import { setupEcokuLoader } from './loader-core'

const currentScript = document.currentScript
const loaderURL = currentScript instanceof HTMLScriptElement ? currentScript.src : ''
const start = () => setupEcokuLoader(document, window, loaderURL)

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true })
} else {
  start()
}
