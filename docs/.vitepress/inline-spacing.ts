import type { MarkdownRenderer } from 'vitepress'

// Add real ASCII spaces between formatted spans and surrounding prose.
// Work on parsed tokens so URLs, code, escapes and Markdown delimiters stay intact.
export function inlineSpacing(md: MarkdownRenderer) {
  const starts = new Set(['link_open', 'strong_open', 'em_open', 's_open', 'code_inline', 'image'])
  const ends = new Set(['link_close', 'strong_close', 'em_close', 's_close', 'code_inline', 'image'])
  md.core.ruler.after('linkify', 'ecoku-inline-spacing', state => {
    for (const block of state.tokens) {
      if (block.type !== 'inline' || !block.children) continue
      const tokens = block.children.filter(token => token.type !== 'text' || token.content !== '')
      const spaced = []
      for (let i = 0; i < tokens.length; i++) {
        const current = tokens[i]
        const previous = tokens[i - 1]
        const afterSpan = previous && ends.has(previous.type)
        const beforeSpan = starts.has(current.type)
        if ((afterSpan && beforeSpan)
          || (afterSpan && current.type === 'text' && /^\S/u.test(current.content))
          || (beforeSpan && previous?.type === 'text' && /\S$/u.test(previous.content))) {
          const space = new state.Token('text', '', 0)
          space.content = ' '
          spaced.push(space)
        }
        spaced.push(current)
      }
      block.children = spaced
    }
  })
}
