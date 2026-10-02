import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright-core');
// Requires playwright-core and an installed Chromium; run from the repository root.
const out = process.argv[2] || 'tmp/first-login-shots';
await mkdir(out, { recursive: true });
const server = spawn('python3', ['-m', 'http.server', '14311', '--bind', '127.0.0.1', '--directory', fileURLToPath(new URL('../', import.meta.url))], { stdio: 'ignore' });
const base = 'http://127.0.0.1:14311/admin-moderation/first-login-v1.html';
let browser;
try {
  for (let i=0; i<40; i++) {
    try { if ((await fetch(base)).ok) break; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  for (const color of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: color });
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base);
      await page.locator('#login-password').fill('temporary-demo-password');
      await page.locator('#login button').click();
      assert(await page.locator('#setup').isVisible());
      assert.equal(await page.locator('#username').inputValue(), 'admin');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `${out}/first-login-${width}-${color}.png`, fullPage: true });
    }
  }
  await page.locator('#save').click();
  assert.equal(await page.locator(':focus').getAttribute('id'), 'password');
  await page.locator('#password').fill('temporary-demo-password');
  await page.locator('#confirm').fill('temporary-demo-password');
  await page.locator('#save').click();
  assert.match(await page.locator('#setup-error').innerText(), /不同于临时密码/);
  await page.locator('#password').fill('汉'.repeat(25));
  await page.locator('#save').click();
  assert.match(await page.locator('#setup-error').innerText(), /72/);
  await page.locator('#password').fill('new-demonstration-password');
  await page.locator('#save').click();
  assert.match(await page.locator('#setup-error').innerText(), /不一致/);
  await page.locator('summary').click();
  await page.locator('#scenario').selectOption('offline');
  await page.locator('#password').fill('new-demonstration-password');
  await page.locator('#confirm').fill('new-demonstration-password');
  await page.locator('#save').click();
  assert(await page.locator('#password').isDisabled());
  await page.waitForFunction(() => !document.getElementById('save').disabled);
  assert.match(await page.locator('#setup-error').innerText(), /保存失败/);
  assert.equal(await page.locator('#password').inputValue(), 'new-demonstration-password');
  await page.screenshot({ path: `${out}/first-login-failure.png`, fullPage: true });
  await page.locator('#scenario').selectOption('expired');
  await page.locator('#password').fill('new-demonstration-password');
  await page.locator('#confirm').fill('new-demonstration-password');
  await page.locator('#save').click();
  await page.locator('#login').waitFor({ state:'visible' });
  assert.match(await page.locator('#login-error').innerText(), /已过期/);
  assert.equal(await page.locator('#password').inputValue(), '');
  await page.locator('#scenario').selectOption('setup');
  await page.locator('#username').fill('owner');
  await page.locator('#password').fill('new-demonstration-password');
  await page.locator('#confirm').fill('new-demonstration-password');
  await page.locator('#confirm').press('Enter');
  await page.locator('#done').waitFor({ state:'visible' });
  assert.equal(await page.locator('#password').inputValue(), '');
  assert.equal(await page.locator('#done a').getAttribute('href'), 'index-v15.html#sites-create');
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  assert.deepEqual(errors, []);
  await writeFile(`${out}/result.json`, JSON.stringify({ widths:[1440,390,320], colors:['light','dark'], interactions:'passed', errors }, null, 2));
  console.log('First-login prototype: six layouts, validation, loading, failure, expiry, keyboard submit and no browser storage passed.');
} finally {
  await browser?.close(); server.kill();
}
