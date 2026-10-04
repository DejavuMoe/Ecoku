// @vitest-environment node
import { webcrypto } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { loadVisitorIdentity, saveVisitorIdentity } from './identity-store'

const serverURL = 'https://comments.example/'
const identity = { username: 'Guest', email: 'guest@example.com', url: '' }

afterEach(() => vi.unstubAllGlobals())

it('ignores identity storage when IndexedDB is unavailable', async () => {
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('indexedDB', undefined)
  await expect(loadVisitorIdentity(serverURL, 'site-a')).resolves.toBeNull()
  await expect(saveVisitorIdentity(serverURL, 'site-a', identity)).resolves.toBe(false)
})

it('does not open IndexedDB without Web Crypto', async () => {
  const open = vi.fn()
  vi.stubGlobal('indexedDB', { open })
  vi.stubGlobal('crypto', undefined)
  await expect(loadVisitorIdentity(serverURL, 'site-a')).resolves.toBeNull()
  await expect(saveVisitorIdentity(serverURL, 'site-a', identity)).resolves.toBe(false)
  expect(open).not.toHaveBeenCalled()
})

it('ignores a denied IndexedDB open without rejecting either operation', async () => {
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('indexedDB', {
    open: () => { throw new DOMException('Storage access denied', 'SecurityError') },
  })
  await expect(loadVisitorIdentity(serverURL, 'site-a')).resolves.toBeNull()
  await expect(saveVisitorIdentity(serverURL, 'site-a', identity)).resolves.toBe(false)
})
