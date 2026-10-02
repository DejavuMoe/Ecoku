import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import './custom.css'
import type { Theme } from 'vitepress'
import EcokuComments from './EcokuComments.vue'

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
  const elements = document.querySelectorAll<HTMLElement>('.mermaid')
  if (!elements.length) return
  const mermaidModule = await getMermaid()
  if (!mermaidModule) return

  const isDark = document.documentElement.classList.contains('dark')
  const styles = getComputedStyle(document.documentElement)
  const color = (name: string) => styles.getPropertyValue(name).trim()
  mermaidModule.default.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
      darkMode: isDark,
      background: color('--paper'),
      primaryColor: color('--wash'),
      primaryTextColor: color('--ink'),
      primaryBorderColor: color('--line'),
      secondaryColor: color('--surface'),
      secondaryTextColor: color('--ink'),
      tertiaryColor: color('--surface'),
      tertiaryTextColor: color('--ink'),
      lineColor: color('--muted'),
      textColor: color('--ink'),
      edgeLabelBackground: color('--paper'),
      clusterBkg: color('--surface'),
      clusterBorder: color('--line'),
      fontSize: '13px',
    },
    flowchart: {
      htmlLabels: true,
      curve: 'basis',
      padding: 18,
      nodeSpacing: 36,
      rankSpacing: 40,
      wrappingWidth: 320,
    },
    securityLevel: 'loose',
    fontFamily: 'inherit',
  })

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
  Layout: () => h(DefaultTheme.Layout, null, {
    'doc-after': () => h(EcokuComments),
  }),
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
