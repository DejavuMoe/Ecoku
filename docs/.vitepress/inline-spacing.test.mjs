import assert from 'node:assert/strict'
import { createMarkdownRenderer, disposeMdItInstance } from 'vitepress'
import { inlineSpacing } from './inline-spacing.ts'

const md = await createMarkdownRenderer(process.cwd(), { config: inlineSpacing })
try {
  const render = source => md.render(source)
  assert.match(render('按[配置](./configuration)**完成**后*重启*。'), /按 <a[^>]*>配置<\/a> <strong>完成<\/strong> 后 <em>重启<\/em> 。/)
  assert.match(render('用`a_b*`命令和~~旧值~~结束。'), /用 <code>a_b\*<\/code> 命令和 <s>旧值<\/s> 结束。/)
  assert.match(render('**外层*内层*文字**'), /<strong>外层 <em>内层<\/em> 文字<\/strong>/)
  assert.match(render('**已加空格** 正文'), /<strong>已加空格<\/strong> 正文/)
  assert.doesNotMatch(render('**开头**'), /<p> | <\/p>/)
  assert.match(render('[名称](https://example.com/a_b?q=x&y=z)'), /href="https:\/\/example.com\/a_b\?q=x&amp;y=z"/)
  assert.match(render('文字\\*星号\\*结束'), /文字\*星号\*结束/)
  assert.match(render('使用SQLite保存7天，“繁體SDK”也是如此。'), /使用 SQLite 保存 7 天，「繁體 SDK」也是如此。/)
  assert.match(render('`中文SDK“原样”`'), /<code>中文SDK“原样”<\/code>/)
  assert.match(md.render('日本語SDK', { relativePath: 'ja/guide/test.md' }), /日本語SDK/)
  assert.match(md.render('繁體SDK', { relativePath: 'zh-hant/guide/test.md' }), /繁體 SDK/)
  assert.match(render('[中文SDK](https://example.com/中文SDK)'), />中文 SDK<\/a>/)
  assert.match(render('<https://example.com/中文SDK>'), />https:\/\/example.com\/中文SDK<\/a>/)
  assert.match(render('https://example.com/中文SDK'), />https:\/\/example.com\/中文SDK<\/a>/)
  assert.match(render('![图](./logo.svg)'), /src="\.\/logo.svg" alt="图"/)
  assert.match(render('前[配置][ref]后\n\n[ref]: https://example.com/a_b'), /前 <a[^>]*href="https:\/\/example.com\/a_b"[^>]*>配置<\/a> 后/)
  assert.match(render('前<https://example.com>后'), /前 <a[^>]*>https:\/\/example.com<\/a> 后/)
  assert.match(render('## **配置** {#settings}'), /id="settings"/)
  assert.match(render('| 字段 | 用途 |\n| --- | --- |\n| 值`port` | 按[配置](./configuration)填写 |'), /值 <code>port<\/code>/)
  const input = '```text\n按[配置](./configuration)**完成**后*重启*\n```'
  assert.equal(md.parse(input, {})[0].content, '按[配置](./configuration)**完成**后*重启*\n')
  console.log('Inline spacing: links, emphasis, nesting, code, escapes, images and existing spaces passed.')
} finally { disposeMdItInstance() }
