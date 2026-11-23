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
      'identity-store.ts',
      'loader-core.ts',
      'smoji.ts',
      'captcha.ts',
      'cap.ts',
      'turnstile.ts',
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
    expect(styles).toContain('width: 3ch')
    expect(styles).toContain('white-space: nowrap')
    expect(styles).not.toContain('max-width: 16px')
  })

  it('keeps default tokens overridable and lets auto inherit the host colour scheme', () => {
    // A literal `new URL('…', import.meta.url)` is rewritten by Vite into an asset URL.
    const styleName = 'style.css'
    const styles = readFileSync(fileURLToPath(new URL(styleName, import.meta.url)), 'utf8')
    const block = (selector: string): string => {
      const start = styles.indexOf(`${selector} {`)
      return start < 0 ? '' : styles.slice(start, styles.indexOf('}', start) + 1)
    }
    const defaults = block(':where(.ecoku-comments)')
    expect(defaults).toContain('--ecoku-theme: var(--theme,')
    for (const token of ['--ecoku-accent', '--ecoku-danger', '--ecoku-focus', '--ecoku-radius', '--ecoku-radius-sm', '--ecoku-shadow', '--ecoku-font-mono', '--ecoku-font-size', '--ecoku-font-size-small', '--ecoku-font-size-title']) {
      expect(defaults).toContain(`${token}:`)
    }
    expect(defaults).not.toContain('color-scheme')
    expect(block(':where(.ecoku-comments[data-theme="light"])')).toContain('color-scheme: light')
    expect(block(':where(.ecoku-comments[data-theme="dark"])')).toContain('color-scheme: dark')
    expect(styles).not.toMatch(/^\.ecoku-comments(\[data-theme[^\]]*\])?\s*\{[^}]*--ecoku-[a-z-]+\s*:/m)
    expect(styles).toMatch(/:where\(\.ecoku-comments\) :is\(button, input, textarea\)/)
    expect(block('.ecoku-blogger-badge')).toContain('var(--ecoku-accent)')
  })

  it('draws reply tree connectors from levels two to four only', () => {
    const styleName = 'style.css'
    const styles = readFileSync(fileURLToPath(new URL(styleName, import.meta.url)), 'utf8')
    const defaults = styles.slice(styles.indexOf(':where(.ecoku-comments) {'), styles.indexOf('}', styles.indexOf(':where(.ecoku-comments) {')))
    for (const token of ['--ecoku-thread-indent', '--ecoku-thread-line', '--ecoku-thread-line-width', '--ecoku-thread-x', '--ecoku-thread-gap', '--ecoku-thread-radius']) {
      expect(defaults).toContain(`${token}:`)
    }
    const levels = '.ecoku-children > .ecoku-comment-node:is([data-depth="2"], [data-depth="3"], [data-depth="4"])'
    // lastIndexOf skips the shared `::before, ::after` rule and finds each own block.
    const rule = (selector: string): string => {
      const start = styles.lastIndexOf(`${selector} {`)
      return start < 0 ? '' : styles.slice(start, styles.indexOf('}', start))
    }
    const elbow = rule(`${levels}::before`)
    const trunk = rule(`${levels}:not(:last-child)::after`)
    expect(elbow).toContain('border-end-start-radius: var(--ecoku-thread-radius)')
    expect(elbow).toContain('border-bottom:')
    // The trunk only continues while a later sibling follows.
    expect(trunk).toContain('top: 0')
    expect(trunk).toContain('bottom: 0')
    expect(styles).not.toContain('--ecoku-guide-offset')
    expect(styles).not.toMatch(/data-depth="5"/)
    expect(styles).toContain('calc(var(--ecoku-depth, 0) * var(--ecoku-thread-indent))')
  })
})
