import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const ci = read('.github/workflows/ci.yml')
// A normal branch build must succeed even when its package version is published.
assert.doesNotMatch(ci, /npm\s+publish\b/)
assert.match(ci, /npm pack --ignore-scripts --pack-destination/)
assert.match(ci, /pnpm "verify:\$TARGET"/)
assert.match(ci, /CGO_ENABLED: '0'/)
const node = read('mise.toml').match(/^node = "([^"]+)"/m)[1]
const pnpm = read('mise.toml').match(/^pnpm = "([^"]+)"/m)[1]
assert.match(ci, new RegExp(`version: ${pnpm.replaceAll('.', '\\.')}`))
for (const file of readdirSync(new URL('../.github/workflows/', import.meta.url))) {
  const source = read(`.github/workflows/${file}`)
  for (const [, action] of source.matchAll(/uses:\s*(\S+)/g)) {
    assert.ok(action.startsWith('./') || /^[\w-]+\/[\w-]+@[a-f0-9]{40}$/.test(action), `${file}: action must use a full commit SHA`)
  }
  for (const [, version] of source.matchAll(/node-version:\s*([\d.]+)/g)) assert.equal(version, node, `${file}: Node differs from mise.toml`)
}
for (const file of ['.github/workflows/release.yml', '.github/workflows/recover-npm.yml']) {
  assert.match(read(file), /npm publish \.\/artifact\/\*\.tgz --ignore-scripts --access public --provenance/)
}
console.log('CI checks passed: packaging without publishing, pinned actions, matching Node/pnpm and release provenance.')
