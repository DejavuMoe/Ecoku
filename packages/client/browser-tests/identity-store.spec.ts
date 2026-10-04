import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { createServer, type ViteDevServer } from 'vite'
import type { StoredVisitorIdentity } from '../src/identity-store'

const clientRoot = fileURLToPath(new URL('..', import.meta.url))
const moduleURL = '/src/identity-store.ts'
const serverURL = 'https://comments.example/'
const identity = { username: 'Browser guest', email: 'guest@example.com', url: 'https://guest.example/' }
const savedAt = Date.UTC(2026, 0, 1)
const sevenDays = 7 * 24 * 60 * 60 * 1000
let server: ViteDevServer | undefined
let origin: string

test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: clientRoot,
    server: { host: '127.0.0.1', port: 0, hmr: false },
    // Do not scan the demo HTML or its main.ts for dependency optimization.
    optimizeDeps: { noDiscovery: true, include: [] },
    logLevel: 'error',
  })
  await server.listen()
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('Vite did not bind a loopback port')
  origin = `http://127.0.0.1:${address.port}`
})

test.afterAll(async () => {
  await server?.close()
})

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => {
    const url = route.request().url()
    if (url === `${origin}/`) {
      return route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html><head><title>Identity storage</title></head><body></body></html>',
      })
    }
    return new URL(url).origin === origin ? route.continue() : route.abort()
  })
  await page.clock.setFixedTime(savedAt)
  await page.goto(`${origin}/`)
})

function save(page: Page, siteId = 'site-a', value: StoredVisitorIdentity = identity) {
  return page.evaluate(async ({ moduleURL, serverURL, siteId, value }) => {
    const { saveVisitorIdentity } = await import(moduleURL)
    return saveVisitorIdentity(serverURL, siteId, value) as Promise<boolean>
  }, { moduleURL, serverURL, siteId, value })
}

function load(page: Page, siteId = 'site-a') {
  return page.evaluate(async ({ moduleURL, serverURL, siteId }) => {
    const { loadVisitorIdentity } = await import(moduleURL)
    return loadVisitorIdentity(serverURL, siteId) as Promise<StoredVisitorIdentity | null>
  }, { moduleURL, serverURL, siteId })
}

// Inspect a single saved scope through real IndexedDB and decrypt with its persisted key.
function inspectStorage(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ecoku-client-identity-v1')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    let rows
    try {
      const transaction = database.transaction('identity', 'readonly')
      const request = transaction.objectStore('identity').getAll()
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      })
      rows = request.result
    } finally {
      database.close()
    }
    const keys = rows.filter(row => row.id.startsWith('key:'))
    const values = rows.filter(row => row.id.startsWith('value:'))
    const key: CryptoKey = keys[0].key
    const value = values[0]
    let exportError: string | null = null
    try {
      await crypto.subtle.exportKey('raw', key)
    } catch (error) {
      exportError = (error as DOMException).name
    }
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: value.iv }, key, value.ciphertext)
    return {
      keyCount: keys.length,
      valueCount: values.length,
      keyIsCryptoKey: key instanceof CryptoKey,
      extractable: key.extractable,
      algorithm: key.algorithm,
      exportError,
      fields: Object.keys(value).sort(),
      iv: Array.from(new Uint8Array(value.iv)),
      ciphertext: Array.from(new Uint8Array(value.ciphertext)),
      savedAt: value.savedAt,
      expiresAt: value.expiresAt,
      decrypted: JSON.parse(new TextDecoder().decode(plaintext)),
    }
  })
}

test('persists encrypted identity across reopen, isolates sites, and expires at exactly seven days', async ({ page }) => {
  expect(await save(page)).toBe(true)
  const first = await inspectStorage(page)
  expect(first).toMatchObject({
    keyCount: 1,
    valueCount: 1,
    keyIsCryptoKey: true,
    extractable: false,
    algorithm: { name: 'AES-GCM', length: 256 },
    exportError: 'InvalidAccessError',
    fields: ['ciphertext', 'expiresAt', 'id', 'iv', 'savedAt', 'scope'],
    savedAt,
    expiresAt: savedAt + sevenDays,
    decrypted: identity,
  })
  expect(first.iv).toHaveLength(12)
  expect(first.ciphertext.length).toBeGreaterThan(new TextEncoder().encode(JSON.stringify(identity)).length)
  expect(new TextDecoder().decode(Uint8Array.from(first.ciphertext))).not.toContain(identity.email)

  await page.reload()
  expect(await load(page)).toEqual(identity)
  expect(await save(page)).toBe(true)
  const second = await inspectStorage(page)
  expect(second.decrypted).toEqual(identity)
  expect(second.iv).not.toEqual(first.iv)
  expect(second.ciphertext).not.toEqual(first.ciphertext)

  const other = { username: 'Other guest', email: 'other@example.com', url: '' }
  expect(await load(page, 'site-b')).toBeNull()
  await page.clock.setFixedTime(savedAt + 1_000)
  expect(await save(page, 'site-b', other)).toBe(true)
  expect(await load(page, 'site-b')).toEqual(other)
  expect(await load(page)).toEqual(identity)
  expect(await load(page, 'missing-site')).toBeNull()

  await page.clock.setFixedTime(savedAt + sevenDays - 1)
  expect(await load(page)).toEqual(identity)
  await page.clock.setFixedTime(savedAt + sevenDays)
  expect(await load(page)).toBeNull()
  expect(await load(page, 'site-b')).toEqual(other)
  await page.clock.setFixedTime(savedAt + sevenDays + 1_000)
  expect(await load(page, 'site-b')).toBeNull()
})

test('concurrent first saves retain one usable key and a decryptable final record', async ({ page }) => {
  const result = await page.evaluate(async ({ moduleURL, serverURL, identity }) => {
    const { saveVisitorIdentity } = await import(moduleURL)
    const subtle = crypto.subtle
    const generateKey = subtle.generateKey
    const descriptor = Object.getOwnPropertyDescriptor(subtle, 'generateKey')
    let generated = 0
    let release!: () => void
    const bothGenerated = new Promise<void>(resolve => { release = resolve })
    Object.defineProperty(subtle, 'generateKey', {
      configurable: true,
      value: async (...args: Parameters<SubtleCrypto['generateKey']>) => {
        const key = await Reflect.apply(generateKey, subtle, args)
        // Both callers must observe a missing key before either can persist one.
        if (++generated === 2) release()
        await bothGenerated
        return key
      },
    })
    try {
      const saved = await Promise.all([
        saveVisitorIdentity(serverURL, 'site-a', identity),
        saveVisitorIdentity(serverURL, 'site-a', identity),
      ])
      return { generated, saved }
    } finally {
      if (descriptor) Object.defineProperty(subtle, 'generateKey', descriptor)
      else Reflect.deleteProperty(subtle, 'generateKey')
    }
  }, { moduleURL, serverURL, identity })
  expect(result).toEqual({ generated: 2, saved: [true, true] })
  expect(await inspectStorage(page)).toMatchObject({
    keyCount: 1,
    valueCount: 1,
    keyIsCryptoKey: true,
    extractable: false,
    decrypted: identity,
  })
  await page.reload()
  expect(await load(page)).toEqual(identity)
})

test('unavailable IndexedDB or WebCrypto returns false/null and recovers when restored', async ({ page }) => {
  expect(await save(page)).toBe(true)
  for (const unavailable of ['indexedDB', 'subtle'] as const) {
    const result = await page.evaluate(async ({ moduleURL, serverURL, identity, unavailable }) => {
      const { saveVisitorIdentity, loadVisitorIdentity } = await import(moduleURL)
      const target = unavailable === 'indexedDB' ? globalThis : crypto
      const descriptor = Object.getOwnPropertyDescriptor(target, unavailable)
      Object.defineProperty(target, unavailable, { configurable: true, value: undefined })
      try {
        return {
          saved: await saveVisitorIdentity(serverURL, 'site-a', identity),
          loaded: await loadVisitorIdentity(serverURL, 'site-a'),
        }
      } finally {
        if (descriptor) Object.defineProperty(target, unavailable, descriptor)
        else Reflect.deleteProperty(target, unavailable)
      }
    }, { moduleURL, serverURL, identity, unavailable })
    expect(result).toEqual({ saved: false, loaded: null })
    expect(await load(page)).toEqual(identity)
  }
  expect(await save(page)).toBe(true)
})
