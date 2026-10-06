import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

// Exercise the workflow's actual verifier with in-memory GitHub responses.
// No API, credentials, checkout, package scripts or publication is involved.
const workflow = readFileSync(new URL('../.github/workflows/recover-npm.yml', import.meta.url), 'utf8').replaceAll('\r\n', '\n')
const body = workflow.match(/node --input-type=module <<'JS'\n([\s\S]+?)\n\s+JS/)[1]
  .split('\n').filter(line => !line.trimStart().startsWith('import ')).join('\n')
const sha = 'a'.repeat(40)
const tagSHA = 'b'.repeat(40)
const fixture = {
  'source-ref': { object: { type: 'commit', sha } },
  'source-run': { repository: { full_name: 'example/ecoku' }, path: '.github/workflows/release.yml', event: 'push', status: 'completed', head_branch: 'v0.3.5', head_sha: sha },
  'source-jobs': { jobs: ['check', 'verify / client', 'verify / admin', 'verify / docs', 'verify / server', 'manifest'].map(name => ({ name, conclusion: 'success' })) },
}
function verify(data, tagObject = { type: 'commit', sha }) {
  let output = ''
  runInNewContext(body, {
    assert,
    process: { env: { RUNNER_TEMP: '/fixture', GITHUB_REPOSITORY: 'example/ecoku', TAG: 'v0.3.5', GITHUB_OUTPUT: '/output' } },
    readFileSync: path => JSON.stringify(data[path.replace('/fixture/', '').replace('.json', '')]),
    execFileSync: (command, args) => {
      assert.equal(command, 'gh')
      assert.deepEqual(Array.from(args), ['api', `repos/example/ecoku/git/tags/${tagSHA}`])
      return JSON.stringify({ object: tagObject })
    },
    appendFileSync: (path, text) => { assert.equal(path, '/output'); output += text },
  }, { timeout: 1000 })
  assert.equal(output, `sha=${sha}\n`)
}
verify(fixture)
const annotated = structuredClone(fixture)
annotated['source-ref'].object = { type: 'tag', sha: tagSHA }
verify(annotated)
assert.throws(() => verify(annotated, { type: 'tag', sha: tagSHA }), /Tag did not resolve/)
for (const [key, value] of Object.entries({ path: 'untrusted.yml', event: 'workflow_dispatch', status: 'in_progress', head_branch: 'master', head_sha: tagSHA, repository: { full_name: 'other/ecoku' } })) {
  const data = structuredClone(fixture)
  data['source-run'][key] = value
  assert.throws(() => verify(data), key)
}
for (const type of ['tree', 'blob']) {
  const data = structuredClone(fixture)
  data['source-ref'].object.type = type
  assert.throws(() => verify(data))
}
for (let index = 0; index < fixture['source-jobs'].jobs.length; index++) {
  const data = structuredClone(fixture)
  data['source-jobs'].jobs[index].conclusion = 'failure'
  assert.throws(() => verify(data))
}
console.log('Recovery checks passed: immutable tag resolution and original release provenance.')
