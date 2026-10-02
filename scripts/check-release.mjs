import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const numeric = '(0|[1-9][0-9]*)'
const identifier = '(0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)'
const releaseTag = new RegExp(`^v${numeric}\\.${numeric}\\.${numeric}(-${identifier}(\\.${identifier})*)?$`)

function validate(tag, version, root, client, compose, changelog) {
  assert.match(tag, releaseTag, 'Expected vMAJOR.MINOR.PATCH or a SemVer prerelease')
  assert.equal(tag, `v${version}`, 'Tag must match VERSION')
  assert.equal(root.version, version, 'Workspace version must match VERSION')
  assert.equal(client.version, version, 'SDK version must match VERSION')
  assert.equal(client.name, 'ecoku')
  assert.notEqual(client.private, true, 'SDK must be publishable')
  assert.ok(compose.split(/\r?\n/).includes(`    image: "git.via.moe/dejavu/ecoku:${tag}"`), 'Compose must pin the Forgejo release image')
  assert.ok(!compose.includes('ECOKU_VERSION'), 'Compose must not interpolate the image version')
  assert.ok(changelog.includes(`## [${version}] - `), 'Missing release changelog heading')
}

if (process.argv[2] === '--self-test') {
  const fixture = version => [
    `v${version}`, version, { version }, { name: 'ecoku', version },
    `    image: "git.via.moe/dejavu/ecoku:v${version}"`, `## [${version}] - 2026-01-01`,
  ]
  for (const version of ['1.2.3', '0.3.0-rc.1', '1.0.0-0']) validate(...fixture(version))
  for (const version of ['01.2.3', '1.2', '1.2.3-01', '1.2.3-', '1.2.3+x', '1.2.3-rc..1']) {
    assert.throws(() => validate(...fixture(version)))
  }
  for (const [index, value] of [
    [0, 'v1.2.4'], [2, { version: '9.0.0' }], [3, { name: 'ecoku', version: '0.1.0' }],
    [3, { name: 'wrong', version: '1.2.3' }],
    [4, '    image: "git.via.moe/dejavu/ecoku:latest"'], [5, '## [Unreleased]'],
  ]) {
    const args = fixture('1.2.3')
    args[index] = value
    assert.throws(() => validate(...args))
  }
  console.log('Release validation positive and negative checks passed.')
} else {
  const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const version = read('VERSION').trim()
  const client = JSON.parse(read('packages/client/package.json'))
  if (process.argv[2] && process.env.GITHUB_REPOSITORY) {
    assert.equal(client.repository.url, `git+https://github.com/${process.env.GITHUB_REPOSITORY}.git`, 'SDK repository must match the publishing repository')
  }
  validate(process.argv[2] ?? `v${version}`, version,
    JSON.parse(read('package.json')), client,
    read('compose.yaml'), read('CHANGELOG.md'))
  console.log(`Release metadata valid: v${version}`)
}
