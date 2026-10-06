import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { createServer, type ViteDevServer } from 'vite'

let server: ViteDevServer
let origin: string

test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    logLevel: 'error',
  })
  await server.listen()
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('Missing loopback listener')
  origin = `http://127.0.0.1:${address.port}`
})

test.afterAll(async () => { await server?.close() })

test('demo URL cannot select an untrusted API and its executable CAPTCHA widget', async ({ page }) => {
  const foreign = 'https://untrusted.example.test'
  const apiOrigins: string[] = []
  const scripts: string[] = []
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin === origin) return route.continue()
    if (url.pathname === '/api/comment/list') {
      apiOrigins.push(url.origin)
      return route.fulfill({
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': origin },
        json: {
          code: 200,
          data: {
            data: [], total: 0, commentTotal: 0, page: 1, pageSize: 3, pageCount: 0,
            formConfig: url.origin === foreign
              ? { captcha: { provider: 'cap', sitekey: 'dummy', instanceUrl: foreign } }
              : { captcha: { provider: 'off' } },
          },
        },
      })
    }
    if (url.origin === foreign && url.pathname === '/assets/widget.js') {
      scripts.push(url.href)
      return route.fulfill({
        contentType: 'application/javascript',
        body: `window.__ecokuAuditSentinel = true;
          customElements.define('cap-widget', class extends HTMLElement {
            solve() { return Promise.resolve({ success: true, token: 'dummy' }) }
            reset() {}
          });`,
      })
    }
    return route.abort()
  })
  await page.goto(`${origin}/?serverURL=${encodeURIComponent(foreign)}`)
  await expect(page).toHaveTitle('Ecoku 评论区本地验收')
  await expect(page.locator('textarea').first()).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect.soft(apiOrigins).toEqual(['http://127.0.0.1:12123'])
  expect.soft(scripts).toEqual([])
  expect.soft(await page.evaluate(() => Reflect.get(window, '__ecokuAuditSentinel'))).toBeUndefined()
  expect(errors).toEqual([])
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
})
