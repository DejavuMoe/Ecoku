import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'

const packageRoot = new URL('../', import.meta.url)
const metadata = JSON.parse(await readFile(new URL('package.json', packageRoot), 'utf8'))

assert.equal(metadata.name, 'ecoku')
const releaseVersion = (await readFile(new URL('../../VERSION', packageRoot), 'utf8')).trim()
assert.equal(metadata.version, releaseVersion, 'SDK version must match the release version')
assert.deepEqual(metadata.files, ['dist', 'README.md', 'CHANGELOG.md', 'LICENSE'])
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

const [packed] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  cwd: fileURLToPath(packageRoot), encoding: 'utf8', shell: process.platform === 'win32',
}))
assert.equal(packed.name, metadata.name)
assert.equal(packed.version, metadata.version)
for (const { path } of packed.files) {
  assert.ok(path.startsWith('dist/') || ['package.json', 'README.md', 'CHANGELOG.md', 'LICENSE'].includes(path), `Unexpected package file: ${path}`)
}
for (const path of ['package.json', 'README.md', 'CHANGELOG.md', 'LICENSE', 'dist/ecoku.es.js', 'dist/ecoku.cjs', 'dist/ecoku.d.ts', 'dist/ecoku.umd.js', 'dist/ecoku-loader.js', 'dist/ecoku.css', 'dist/ecoku.unstyled.css']) {
  assert.ok(packed.files.some(file => file.path === path), `Missing package file: ${path}`)
}

process.stdout.write('ESM, UMD, CommonJS, and type declaration package contracts passed.\n')
