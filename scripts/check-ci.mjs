import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n')
const ci = read('.github/workflows/ci.yml')
assert.match(ci, /^on:\n  push:\n    branches: \[master\]\n  pull_request:\n    branches: \[master\]\n  workflow_call:\n\n/m)
assert.match(ci, /target: \[client, admin, docs\]/)

function checkSecurity(source) {
  // Exact standalone steps prevent filters, ignored errors and success masking.
  assert.match(source, /^      - name: Audit JavaScript dependencies\n        if: matrix.target == 'client'\n        run: pnpm audit --audit-level=high\n(?=      - )/m)
  assert.match(source, /^      - name: Check Go vulnerabilities\n        run: go run golang\.org\/x\/vuln\/cmd\/govulncheck@v\d+\.\d+\.\d+ \.\/\.\.\.\n(?=      - )/m)
  assert.match(source, /^      - run: pnpm install --frozen-lockfile --prefer-offline\n      - name: Install SDK test browser\n        if: matrix.target == 'client'\n        run: pnpm -C packages\/client exec playwright install --with-deps chromium\n(?=      - name: Verify SDK browser behavior\n)/m)
  assert.match(source, /^      - name: Verify SDK browser behavior\n        if: matrix.target == 'client'\n        run: pnpm -C packages\/client run test:browser\n(?=      - )/m)
  assert.doesNotMatch(source, /^\s+continue-on-error:/m, 'CI failures must block release')
  assert.doesNotMatch(source, /^    if:/m, 'Required CI jobs must not be conditional')
}
checkSecurity(ci)
// Exercise the guards in memory; never run scanners or alter workflow fixtures.
for (const [before, after] of [
  ['--audit-level=high', '--audit-level=critical'],
  ['--audit-level=high', '--audit-level=high --ignore-registry-errors'],
  ['--audit-level=high', '--audit-level=high --prod'],
  ['--audit-level=high', '--audit-level=high || true'],
  ["if: matrix.target == 'client'", 'if: false'],
  [/govulncheck@v[\d.]+/, 'govulncheck@latest'],
  [' ./...\n', ' -json ./...\n'],
  ['playwright install --with-deps chromium', 'playwright install chromium'],
  ['run test:browser\n', 'run test:browser || true\n'],
  ['  server:\n', '  server:\n    continue-on-error: true\n'],
  ['  server:\n', '  server:\n    if: false\n'],
]) assert.throws(() => checkSecurity(ci.replace(before, after)))

const release = read('.github/workflows/release.yml')
assert.match(release, /^  verify:\n    needs: check\n    uses: \.\/\.github\/workflows\/ci\.yml\n\n/m)
for (const job of ['image', 'npm']) {
  assert.match(release, new RegExp(`^  ${job}:\\n    needs: \\[check, verify\\]\\n`, 'm'))
}
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
console.log('CI checks passed: security gates, release reuse, packaging without publishing, pinned actions, matching Node/pnpm and release provenance.')
