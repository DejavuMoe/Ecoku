import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const packageRoot = new URL('../', import.meta.url)
const metadata = JSON.parse(await readFile(new URL('package.json', packageRoot), 'utf8'))

assert.equal(metadata.name, 'ecoku')
assert.equal(metadata.version, '0.1.0')
assert.equal(metadata.type, 'module')
assert.equal(metadata.main, './dist/ecoku.cjs')
assert.equal(metadata.exports['.'].import, './dist/ecoku.es.js')
assert.equal(metadata.exports['.'].require, './dist/ecoku.cjs')
assert.equal(metadata.exports['.'].types, './dist/ecoku.d.ts')

const esm = await import(new URL('dist/ecoku.es.js', packageRoot))
assert.equal(typeof esm.default, 'function', 'ESM default export must be the Ecoku constructor')

const require = createRequire(import.meta.url)
const commonJS = require(fileURLToPath(new URL('dist/ecoku.cjs', packageRoot)))
assert.equal(typeof commonJS, 'function', 'CommonJS export must be the Ecoku constructor')

const umdSource = await readFile(new URL('dist/ecoku.umd.js', packageRoot), 'utf8')
const browserGlobal = { globalThis: {} }
vm.runInNewContext(umdSource, browserGlobal, { filename: 'ecoku.umd.js' })
assert.equal(typeof browserGlobal.globalThis.Ecoku, 'function', 'UMD script must install globalThis.Ecoku')
assert.deepEqual(Object.keys(browserGlobal.globalThis), ['Ecoku'], 'UMD script must expose only the Ecoku library global')

const loaderSource = await readFile(new URL('dist/ecoku-loader.js', packageRoot), 'utf8')
assert.match(loaderSource, /ecoku\.umd\.js/, 'hosted loader must resolve the UMD asset')

for (const path of ['dist/ecoku.es.js', 'dist/ecoku.umd.js', 'dist/ecoku-loader.js', 'dist/ecoku.cjs', 'dist/ecoku.d.ts']) {
  const content = await readFile(new URL(path, packageRoot))
  assert.ok(content.length > 0, `${path} must not be empty`)
}

process.stdout.write('ESM, UMD, CommonJS, and type declaration package contracts passed.\n')
