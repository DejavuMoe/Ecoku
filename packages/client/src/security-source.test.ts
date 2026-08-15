import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('browser runtime privacy boundary', () => {
  it('contains no third-party IP, management credential, forwarding, avatar, or unsafe HTML hooks', () => {
    const runtimeFiles = [
      'comment.ts',
      'config.ts',
      'fetch.ts',
      'ecoku.ts',
      'messages.ts',
      'style.css',
      'util.ts',
    ]
    const runtimeSource = runtimeFiles
      .map((name) => readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8'))
      .join('\n')
    for (const forbidden of [
      /myip\.ipip\.net/i,
      /ipip\.net/i,
      /EcokuSite/,
      /management_?key/i,
      /Authorization/,
      /X-Forwarded-For/i,
      /innerHTML/,
      /avatar/i,
    ]) {
      expect(runtimeSource).not.toMatch(forbidden)
    }
    expect(runtimeSource).not.toContain('正在加载评论')
  })

  it('keeps dividers on root threads only and inherits the host typography contract', () => {
    const styleName = 'style.css'
    const styles = readFileSync(fileURLToPath(new URL(styleName, import.meta.url)), 'utf8')
    expect(styles).toMatch(/\.ecoku-thread-list\s*>\s*\.ecoku-comment-node\s*\{[^}]*border-bottom:/s)
    expect(styles).not.toMatch(/\.ecoku-comment-row\s*\{[^}]*border-bottom:/s)
    expect(styles).toMatch(/font-family:\s*inherit/)
    expect(styles).toContain('var(--theme,')
    expect(styles).toMatch(/\.ecoku-comments \.ecoku-textarea/)
    expect(styles).toMatch(/\.ecoku-comments \.ecoku-collapse-button/)
    expect(styles).toContain('max-width: 16px')
  })
})
