// Move the VitePress docs site to a published ecoku SDK, or check that its pins agree.
//
//   node scripts/pin-docs-sdk.mjs [VERSION]   wait until npm serves the tarball, then rewrite the pins
//   node scripts/pin-docs-sdk.mjs --check     offline: every docs pin names the same version
//   node scripts/pin-docs-sdk.mjs --self-test
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const registry = 'https://registry.npmjs.org/ecoku'
const attempts = 10
const retryDelayMs = 30_000
const V = '(\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?)'
const pins = [
  ['docs/package.json', `^    "ecoku": "${V}"`],
  ['pnpm-workspace.yaml', `^  - ecoku@${V}$`],
  ['pnpm-lock.yaml', `^      ecoku:\\n        specifier: ${V}\\n        version: ${V}$`],
  ['pnpm-lock.yaml', `^  ecoku@${V}:\\n    resolution: \\{integrity: (?<integrity>sha512-[A-Za-z0-9+/]+={0,2})\\}$`],
  ['pnpm-lock.yaml', `^  ecoku@${V}: \\{\\}$`],
  ['docs/integration/sdk.md', `^pnpm add --save-exact ecoku@${V}$`],
  ['docs/en/integration/sdk.md', `^pnpm add --save-exact ecoku@${V}$`],
  ['docs/zh-hant/integration/sdk.md', `^pnpm add --save-exact ecoku@${V}$`],
].map(([path, source]) => ({ path, re: new RegExp(source, 'gm') }))
const paths = [...new Set(pins.map(pin => pin.path))]

// Files are compared with LF endings; write() restores each file's own endings.
function current(files) {
  assert.equal(files['pnpm-lock.yaml'].match(/^  ecoku@/gm)?.length, 2, 'pnpm-lock.yaml: expected one ecoku package and one snapshot')
  const versions = new Set()
  let integrity
  for (const { path, re } of pins) {
    const matches = [...files[path].matchAll(re)]
    assert.equal(matches.length, 1, `${path}: expected exactly one ecoku pin matching ${re.source}`)
    const [, ...groups] = matches[0]
    integrity ??= matches[0].groups?.integrity
    groups.filter(group => group !== matches[0].groups?.integrity).forEach(version => versions.add(version))
  }
  assert.equal(versions.size, 1, `docs SDK pins disagree: ${[...versions].join(', ')}`)
  return { version: [...versions][0], integrity }
}

function rewrite(files, version, integrity) {
  const before = current(files)
  const next = { ...files }
  for (const { path, re } of pins) {
    next[path] = next[path].replace(re, match => match.replaceAll(before.version, version).replace(before.integrity, integrity))
  }
  assert.deepEqual(current(next), { version, integrity })
  return next
}

async function fetchOk(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'ecoku-release-check' } })
  if (!response.ok) throw new Error(`GET ${url}: ${response.status} ${response.statusText}`)
  return response
}

// npm can report the new version before every registry edge serves its tarball,
// so download the tarball itself and compare it with the published integrity.
async function published(version) {
  const meta = await (await fetchOk(registry)).json()
  const tag = version.includes('-') ? 'next' : 'latest'
  assert.equal(meta['dist-tags']?.[tag], version, `npm dist-tag ${tag} is ${meta['dist-tags']?.[tag]}, not ${version}`)
  const dist = meta.versions?.[version]?.dist
  assert.ok(dist?.tarball && dist.integrity?.startsWith('sha512-'), `npm has no sha512 dist for ecoku@${version}`)
  const tarball = Buffer.from(await (await fetchOk(dist.tarball)).arrayBuffer())
  const actual = `sha512-${createHash('sha512').update(tarball).digest('base64')}`
  assert.equal(actual, dist.integrity, `${dist.tarball}: integrity does not match npm metadata`)
  return { integrity: dist.integrity, tarball: dist.tarball, bytes: tarball.length }
}

async function waitForPublished(version) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await published(version)
    } catch (error) {
      if (attempt === attempts) throw error
      console.error(`attempt ${attempt}/${attempts}: ${error.message}; retrying in ${retryDelayMs / 1000}s`)
      await sleep(retryDelayMs)
    }
  }
}

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const readAll = () => Object.fromEntries(paths.map(path => [path, read(path).replaceAll('\r\n', '\n')]))

if (process.argv[2] === '--self-test') {
  const fixture = (version, integrity) => ({
    'docs/package.json': `{\n  "dependencies": {\n    "ecoku": "${version}"\n  }\n}\n`,
    'pnpm-workspace.yaml': `minimumReleaseAgeExclude:\n  - ecoku@${version}\n`,
    'pnpm-lock.yaml': `importers:\n  docs:\n    dependencies:\n      ecoku:\n        specifier: ${version}\n        version: ${version}\npackages:\n  ecoku@${version}:\n    resolution: {integrity: ${integrity}}\n    engines: {node: '>=20'}\nsnapshots:\n  ecoku@${version}: {}\n`,
    ...Object.fromEntries(paths.filter(path => path.endsWith('sdk.md')).map(path => [path, `\`\`\`bash\npnpm add --save-exact ecoku@${version}\n\`\`\`\n`])),
  })
  const old = fixture('1.2.2', 'sha512-b2xk')
  assert.deepEqual(current(old), { version: '1.2.2', integrity: 'sha512-b2xk' })
  assert.deepEqual(rewrite(old, '1.2.3', 'sha512-bmV3+/=='), fixture('1.2.3', 'sha512-bmV3+/=='))
  assert.deepEqual(rewrite(old, '1.3.0-rc.1', 'sha512-cmM='), fixture('1.3.0-rc.1', 'sha512-cmM='))
  for (const [path, edit] of [
    ['docs/package.json', text => text.replace('1.2.2', '1.2.1')],
    ['pnpm-lock.yaml', text => text.replace('version: 1.2.2', 'version: 1.2.1')],
    ['pnpm-lock.yaml', text => text.replace('  ecoku@1.2.2: {}', '  ecoku@1.2.1: {}')],
    ['pnpm-lock.yaml', text => `${text}  ecoku@1.2.1: {}\n`],
    ['pnpm-workspace.yaml', text => `${text}  - ecoku@1.2.2\n`],
    ['docs/en/integration/sdk.md', text => text.replace('ecoku@1.2.2', 'ecoku@latest')],
  ]) {
    assert.throws(() => current({ ...old, [path]: edit(old[path]) }), undefined, path)
  }
  console.log('Docs SDK pin positive and negative checks passed.')
} else if (process.argv[2] === '--check') {
  const { version } = current(readAll())
  console.log(`Docs SDK pins agree: ecoku@${version}`)
} else {
  const version = process.argv[2] ?? read('VERSION').trim()
  assert.match(version, new RegExp(`^${V}$`), `Expected a version without "v", got ${version}`)
  const dist = await waitForPublished(version)
  console.log(`npm serves ${dist.tarball} (${dist.bytes} bytes, ${dist.integrity})`)
  const files = readAll()
  const before = current(files).version
  const next = rewrite(files, version, dist.integrity)
  for (const path of paths) {
    if (next[path] === files[path]) continue
    const crlf = read(path).includes('\r\n')
    writeFileSync(new URL(`../${path}`, import.meta.url), crlf ? next[path].replaceAll('\n', '\r\n') : next[path])
  }
  console.log(`Docs SDK pins moved: ecoku@${before} -> ecoku@${version}`)
  console.log('Next: pnpm install --frozen-lockfile --lockfile-only')
}
