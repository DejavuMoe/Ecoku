import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const docs = new URL('../', import.meta.url)
let images = 0
for (const file of readdirSync(docs, { recursive: true }).filter(file => file.endsWith('.md') && !/(?:^|[/\\])(?:node_modules|\.vitepress|internal|progress|contribute)(?:[/\\])/.test(file))) {
  const source = readFileSync(new URL(file.replaceAll('\\', '/'), docs), 'utf8')
  assert.doesNotMatch(source, /^```mermaid\b/m, `${file}: use a local SVG; Mermaid is not bundled`)
  for (const [, markup] of source.matchAll(/<figure class="doc-diagram"[^>]*>([\s\S]*?)<\/figure>/g)) {
    const pair = [...markup.matchAll(/<img class="diagram-(light|dark)" src="(\/diagrams\/[^"\s]+\.svg)"[^>]*alt="([^"]+)"/g)]
    assert.deepEqual(pair.map(match => match[1]), ['light', 'dark'], `${file}: both themes need an accessible image`)
    assert.equal(pair[0][3], pair[1][3], `${file}: theme variants describe the same diagram`)
    const svgs = pair.map(([, , src]) => readFileSync(new URL(`public${src}`, docs), 'utf8'))
    assert.equal(svgs[0].match(/viewBox="([^"]+)"/)?.[1], svgs[1].match(/viewBox="([^"]+)"/)?.[1], `${file}: theme switch must preserve dimensions`)
    const labels = svg => [...svg.matchAll(/<span class="(?:nodeLabel|edgeLabel)\s*"[^>]*>([\s\S]*?)<\/span>/g)].map(match => match[1])
    assert.ok(labels(svgs[0]).length > 0, `${file}: SVG must contain diagram labels`)
    assert.deepEqual(labels(svgs[0]), labels(svgs[1]), `${file}: theme variants must preserve labels`)
    for (const svg of svgs) assert.doesNotMatch(svg, /<script\b|(?:href|src)="https?:\/\//, `${file}: diagrams must be self-contained`)
    images += pair.length
  }
}
assert.equal(images, 12, 'Two diagrams in three languages, with light and dark variants')
console.log('Static diagrams: all six pages have consistent, self-contained light/dark SVGs and descriptions.')
