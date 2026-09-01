import DefaultTheme from 'vitepress/theme'
import './custom.css'
import type { Theme } from 'vitepress'

let mermaidPromise: Promise<typeof import('mermaid')> | null = null

function getMermaid() {
  if (!mermaidPromise && typeof window !== 'undefined') {
    mermaidPromise = import('mermaid').then((m) => {
      m.default.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        fontFamily: 'inherit',
      })
      return m
    })
  }
  return mermaidPromise
}

async function renderMermaidDiagrams() {
  if (typeof window === 'undefined') return
  const mermaidModule = await getMermaid()
  if (!mermaidModule) return

  const isDark = document.documentElement.classList.contains('dark')
  mermaidModule.default.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    themeVariables: isDark
      ? {
          darkMode: true,
          background: '#1a1d20',
          primaryColor: '#0f766e',
          primaryTextColor: '#f2ece2',
          lineColor: '#6ee7b7',
        }
      : {
          darkMode: false,
          background: '#faf9f5',
          primaryColor: '#0f766e',
          primaryTextColor: '#141413',
          lineColor: '#0f766e',
        },
    securityLevel: 'loose',
    fontFamily: 'inherit',
  })

  const elements = document.querySelectorAll<HTMLElement>('.mermaid')
  let idCounter = 0

  for (const el of Array.from(elements)) {
    const rawCode = el.getAttribute('data-code')
      ? decodeURIComponent(el.getAttribute('data-code')!)
      : el.textContent?.trim() || ''

    if (!rawCode) continue
    if (!el.getAttribute('data-code')) {
      el.setAttribute('data-code', encodeURIComponent(rawCode))
    }

    const id = `mermaid-svg-${Date.now()}-${++idCounter}`
    try {
      const { svg } = await mermaidModule.default.render(id, rawCode)
      el.innerHTML = svg
    } catch (err) {
      console.warn('Failed to render Mermaid diagram:', err)
    }
  }
}

export default {
  extends: DefaultTheme,
  enhanceApp({ router }) {
    if (typeof window !== 'undefined') {
      router.onAfterRouteChanged = () => {
        setTimeout(renderMermaidDiagrams, 100)
      }

      // Initial page load
      setTimeout(renderMermaidDiagrams, 100)

      // Watch for dark/light mode toggle
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.attributeName === 'class') {
            setTimeout(renderMermaidDiagrams, 50)
            break
          }
        }
      })
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      })
    }
  },
} satisfies Theme

