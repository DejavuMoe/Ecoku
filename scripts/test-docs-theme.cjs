// Run against `pnpm docs:dev`; requires playwright-core and an installed Chromium.
// Optional: DOCS_URL, CHROMIUM_EXECUTABLE_PATH and SCREENSHOT_DIR.
const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const { join } = require('node:path')
const { chromium } = require('playwright-core')

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH })
  try {
    for (const system of ['light', 'dark']) {
      const page = await browser.newPage({ colorScheme: system, viewport: { width: 1440, height: 1000 } })
      const errors = []
      let requests = 0
      let pageKey = ''
      page.on('pageerror', error => errors.push(error.message))
      await page.route('https://ecoku-dev.zsh.moe/**', route => {
        assert.equal(route.request().method(), 'GET')
        requests++
        const key = new URL(route.request().url()).searchParams.get('key')
        pageKey = key
        return route.fulfill({ json: { code: 200, message: 'ok', data: {
          data: [{ id: 1, site_id: 'ecoku-docs', mark: key, parent: 0, username: 'Reader', content: 'A comment in the documentation.', deleted: false, created_at: '2026-10-03T00:00:00Z' }],
          total: 1, commentTotal: 1, page: 1, pageSize: 10, pageCount: 1,
          formConfig: { emailRequired: false, websiteRequired: false, placeholder: 'Comment' },
        } } })
      })
      for (const prefix of ['', '/en', '/zh-hant']) {
        await page.goto(`${process.env.DOCS_URL || 'http://127.0.0.1:7621'}${prefix}/integration/sdk`)
        const root = page.locator('.ecoku-doc-comments .ecoku-comments')
        await root.locator('.ecoku-textarea').fill('Keep this draft')
        await root.locator('.ecoku-reply-action').click()
        await root.locator('.ecoku-reply-composer .ecoku-textarea').fill('Keep this reply')
        const original = await root.elementHandle()
        const before = requests
        for (let state = 0; state < 5; state++) {
          if (state === 3) {
            await page.setViewportSize({ width: 390, height: 844 })
          }
          if (state > 0) {
            if (state >= 3) await page.locator('.VPNavBarHamburger').click()
            const selector = state < 3 ? '.VPNavBarAppearance' : '.VPNavScreenAppearance'
            await page.locator(`${selector} .VPSwitchAppearance`).click()
            if (state >= 3) await page.locator('.VPNavBarHamburger').click()
          }
          await page.waitForTimeout(350)
          const colors = await root.evaluate(el => {
            const style = getComputedStyle(el)
            const doc = getComputedStyle(document.documentElement)
            return {
              actual: ['--ecoku-entry', '--ecoku-primary', '--ecoku-secondary', '--ecoku-border'].map(k => style.getPropertyValue(k).trim()),
              expected: ['--surface', '--ink', '--muted', '--line'].map(k => doc.getPropertyValue(k).trim()),
              background: getComputedStyle(el.querySelector('.ecoku-composer')).backgroundColor,
              replyBackground: getComputedStyle(el.querySelector('.ecoku-reply-composer')).backgroundColor,
              dark: document.documentElement.classList.contains('dark'),
            }
          })
          assert.deepEqual(colors.actual, colors.expected)
          assert.equal(colors.background, colors.dark ? 'rgb(33, 31, 28)' : 'rgb(251, 249, 245)')
          assert.equal(colors.replyBackground, colors.background)
          assert.equal(await original.evaluate(el => el === document.querySelector('.ecoku-doc-comments .ecoku-comments')), true)
          assert.equal(await root.locator('.ecoku-textarea').first().inputValue(), 'Keep this draft')
          assert.equal(await root.locator('.ecoku-reply-composer .ecoku-textarea').inputValue(), 'Keep this reply')
          assert.equal(requests, before, 'Theme switching must not reload comments')
          await root.locator('.ecoku-sort-trigger').click()
          assert.equal(await root.locator('.ecoku-sort-menu').evaluate(el => getComputedStyle(el).backgroundColor), colors.background)
          if (process.env.SCREENSHOT_DIR && prefix === '' && system === 'light') {
            mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true })
            await root.screenshot({ path: join(process.env.SCREENSHOT_DIR, `docs-comments-${state < 3 ? 1440 : 390}-${colors.dark ? 'dark' : 'light'}.png`) })
          }
          await root.locator('.ecoku-sort-trigger').click()
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
        await page.setViewportSize({ width: 1440, height: 1000 })
        await original.dispose()
        await page.locator(`.VPSidebar a[href="${prefix}/integration/html"]`).click()
        await page.waitForFunction(() => location.pathname.endsWith('/integration/html'))
        await page.waitForTimeout(350)
        assert.equal(pageKey, `${prefix}/integration/html`)
        assert.equal(await page.locator('.ecoku-status-line').textContent(), '')
      }
      assert.deepEqual(errors, [])
      await page.close()
    }
    console.log('Docs theme and navigation: system preferences, three locales, desktop/mobile toggles, replies, menus, draft retention, mobile width and no article-change notice passed.')
  } finally {
    await browser.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
