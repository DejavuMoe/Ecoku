import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const numeric = '(0|[1-9][0-9]*)'
const identifier = '(0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)'
const releaseTag = new RegExp(`^v${numeric}\\.${numeric}\\.${numeric}(-${identifier}(\\.${identifier})*)?$`)

function releaseNotes(version, changelog) {
  assert.match(`v${version}`, releaseTag)
  const sections = changelog.replaceAll('\r\n', '\n').split(/^## /m)
    .filter(section => section.startsWith(`[${version}] - `))
  assert.equal(sections.length, 1, 'Expected exactly one release changelog heading')
  const notes = sections[0].slice(sections[0].indexOf('\n') + 1).split(/^\[Unreleased\]:/m)[0].trim()
  assert.ok(notes && !notes.startsWith(`[${version}]`), 'Empty release notes')
  return `- 镜像：\`ghcr.io/dejavumoe/ecoku:v${version}\`\n- npm SDK：\`ecoku@${version}\`\n\n${notes}\n`
}

function validate(tag, version, root, client, compose, changelog, clientReadme, clientChangelog) {
  assert.match(tag, releaseTag, 'Expected vMAJOR.MINOR.PATCH or a SemVer prerelease')
  assert.equal(tag, `v${version}`, 'Tag must match VERSION')
  assert.equal(root.version, version, 'Workspace version must match VERSION')
  assert.equal(client.version, version, 'SDK version must match VERSION')
  assert.equal(client.name, 'ecoku')
  assert.notEqual(client.private, true, 'SDK must be publishable')
  assert.ok(compose.split(/\r?\n/).includes(`    image: "ghcr.io/dejavumoe/ecoku:${tag}"`), 'Compose must pin the GHCR release image')
  assert.ok(!compose.includes('ECOKU_VERSION'), 'Compose must not interpolate the image version')
  releaseNotes(version, changelog)
  assert.ok(clientReadme.includes(`Install version ${version}:`), 'SDK README version must match VERSION')
  assert.ok(clientReadme.split(/\r?\n/).includes(`npm install --save-exact ecoku@${version}`), 'SDK README install command must pin VERSION')
  assert.ok(clientChangelog.includes(`## ${version} - `), 'Missing SDK changelog heading')
}

if (process.argv[2] === '--self-test') {
  const fixture = version => [
    `v${version}`, version, { version }, { name: 'ecoku', version },
    `    image: "ghcr.io/dejavumoe/ecoku:v${version}"`, `## [${version}] - 2026-01-01\n\n### 修复\n\n- Example fix.`,
    `Install version ${version}:\n\nnpm install --save-exact ecoku@${version}`, `## ${version} - 2026-01-01`,
  ]
  for (const version of ['1.2.3', '0.3.0-rc.1', '1.0.0-0']) validate(...fixture(version))
  for (const version of ['01.2.3', '1.2', '1.2.3-01', '1.2.3-', '1.2.3+x', '1.2.3-rc..1']) {
    assert.throws(() => validate(...fixture(version)))
  }
  for (const [index, value] of [
    [0, 'v1.2.4'], [2, { version: '9.0.0' }], [3, { name: 'ecoku', version: '0.1.0' }],
    [3, { name: 'wrong', version: '1.2.3' }],
    [4, '    image: "ghcr.io/dejavumoe/ecoku:latest"'],
    [4, '    image: "git.via.moe/dejavu/ecoku:v1.2.3"'], [5, '## [Unreleased]'],
    [5, '## [1.2.3] - 2026-01-01\n\n'],
    [5, '## [1.2.3] - 2026-01-01\n- First\n## [1.2.3] - 2026-01-01\n- Duplicate'],
    [6, 'Install version 0.3.8:\n\nnpm install --save-exact ecoku@1.2.3'],
    [6, 'Install version 1.2.3:\n\nnpm install --save-exact ecoku@0.3.8'],
    [7, '## 0.3.8 - 2026-01-01'],
  ]) {
    const args = fixture('1.2.3')
    args[index] = value
    assert.throws(() => validate(...args))
  }
  const history = '# Changelog\r\n\r\n## [Unreleased]\r\n- Future\r\n\r\n## [1.2.3] - 2026-01-01\r\n\r\n### 变更\r\n\r\n- 构建时文档使用已发布的 `ecoku@1.2.2`。\r\n\r\n## [1.2.2] - 2025-12-01\r\n- Previous\r\n\r\n[Unreleased]: https://example.com/compare\r\n'
  const notes = releaseNotes('1.2.3', history)
  assert.ok(notes.startsWith('- 镜像：`ghcr.io/dejavumoe/ecoku:v1.2.3`\n- npm SDK：`ecoku@1.2.3`\n'))
  assert.ok(notes.includes('构建时文档使用已发布的 `ecoku@1.2.2`'))
  assert.doesNotMatch(notes, /Future|Previous|\[Unreleased\]:/)
  assert.doesNotMatch(releaseNotes('1.2.2', history), /\[Unreleased\]:/)
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
    read('compose.yaml'), read('CHANGELOG.md'),
    read('packages/client/README.md'), read('packages/client/CHANGELOG.md'))
  if (process.argv[3] === '--notes') process.stdout.write(releaseNotes(version, read('CHANGELOG.md')))
  else console.log(`Release metadata valid: v${version}`)
}
