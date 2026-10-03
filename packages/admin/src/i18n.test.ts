import { afterEach, expect, it, vi } from 'vitest'
import { installAdminTranslations, refreshAdminTranslations, setAdminLocale } from './i18n'

afterEach(() => { setAdminLocale('zh-CN'); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('does not rewrite translated text on repeated observer scans', () => {
  // Drive scans explicitly so a regression cannot starve the test event loop.
  vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} })
  const root = document.createElement('div')
  root.textContent = '评论'
  const writes = vi.spyOn(root.firstChild!, 'textContent', 'set')
  setAdminLocale('en')
  const stop = installAdminTranslations(root)
  try {
    expect(root.textContent).toBe('Comments')
    refreshAdminTranslations()
    refreshAdminTranslations()
    expect(writes).toHaveBeenCalledTimes(1)
  } finally { stop() }
})
