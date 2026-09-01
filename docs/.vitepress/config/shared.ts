import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type DefaultTheme, type HeadConfig } from 'vitepress'

const caddyfileGrammar = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../caddyfile.tmLanguage.json'), 'utf8'),
)

export const shared = defineConfig({
  title: 'Ecoku',
  lastUpdated: true,
  cleanUrls: true,
  ignoreDeadLinks: [
    /^https?:\/\/([a-zA-Z0-9_-]+\.)?example\.com/,
    /^https?:\/\/localhost/,
    /^https?:\/\/127\.0\.0\.1/,
  ],
  srcExclude: ['**/internal/**', '**/progress/**', '**/contribute/**'],
  head: [
    ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    ['meta', { name: 'theme-color', content: '#0f766e' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:site_name', content: 'Ecoku' }],
  ] satisfies HeadConfig[],
  markdown: {
    // TextMate grammar for ```caddyfile fences (Shiki has no built-in Caddyfile).
    languages: [caddyfileGrammar],
    config(md) {
      const defaultFence = md.renderer.rules.fence!
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        const info = token.info.trim()
        if (info === 'mermaid') {
          const rawCode = token.content.trim()
          const encodedCode = encodeURIComponent(rawCode)
          return `<div class="mermaid" data-code="${encodedCode}" v-pre>${md.utils.escapeHtml(rawCode)}</div>`
        }
        return defaultFence(tokens, idx, options, env, self)
      }
    },
  },
  themeConfig: {
    logo: { src: '/logo.svg', alt: 'Ecoku' },
    outline: [2, 3],
    search: {
      provider: 'local',
      options: {
        locales: {
          root: { translations: zhSearch },
          'zh-hant': { translations: zhHantSearch },
          en: { translations: enSearch },
          ja: { translations: jaSearch },
        },
      },
    },
  },
})

const zhSearch: DefaultTheme.LocalSearchOptions['translations'] = {
  button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
  modal: {
    displayDetails: '显示详情',
    resetButtonTitle: '清除查询',
    backButtonTitle: '返回',
    noResultsText: '没有相关结果',
    footer: {
      selectText: '选择',
      selectKeyAriaLabel: '回车',
      navigateText: '切换',
      navigateUpKeyAriaLabel: '上箭头',
      navigateDownKeyAriaLabel: '下箭头',
      closeText: '关闭',
      closeKeyAriaLabel: 'Esc',
    },
  },
}

const zhHantSearch: DefaultTheme.LocalSearchOptions['translations'] = {
  button: { buttonText: '搜尋文件', buttonAriaLabel: '搜尋文件' },
  modal: {
    displayDetails: '顯示詳情',
    resetButtonTitle: '清除查詢',
    backButtonTitle: '返回',
    noResultsText: '沒有相關結果',
    footer: {
      selectText: '選擇',
      selectKeyAriaLabel: 'Enter',
      navigateText: '切換',
      navigateUpKeyAriaLabel: '上箭頭',
      navigateDownKeyAriaLabel: '下箭頭',
      closeText: '關閉',
      closeKeyAriaLabel: 'Esc',
    },
  },
}

const enSearch: DefaultTheme.LocalSearchOptions['translations'] = {
  button: { buttonText: 'Search docs', buttonAriaLabel: 'Search docs' },
  modal: {
    displayDetails: 'Display details',
    resetButtonTitle: 'Reset search',
    backButtonTitle: 'Back',
    noResultsText: 'No results',
    footer: {
      selectText: 'to select',
      navigateText: 'to navigate',
      closeText: 'to close',
    },
  },
}

const jaSearch: DefaultTheme.LocalSearchOptions['translations'] = {
  button: { buttonText: 'ドキュメントを検索', buttonAriaLabel: 'ドキュメントを検索' },
  modal: {
    displayDetails: '詳細を表示',
    resetButtonTitle: '検索をクリア',
    backButtonTitle: '戻る',
    noResultsText: '該当する結果はありません',
    footer: {
      selectText: '選択',
      navigateText: '移動',
      closeText: '閉じる',
    },
  },
}

export function sidebar(prefix: string, t: SidebarCopy): DefaultTheme.SidebarItem[] {
  const p = prefix
  return [
    {
      text: t.guide,
      items: [
        { text: t.introduction, link: `${p}/guide/introduction` },
        { text: t.features, link: `${p}/guide/features` },
        { text: t.concepts, link: `${p}/guide/concepts` },
      ],
    },
    {
      text: t.selfHosting,
      items: [
        { text: t.docker, link: `${p}/self-hosting/docker` },
        { text: t.proxy, link: `${p}/self-hosting/reverse-proxy` },
        { text: t.admin, link: `${p}/self-hosting/admin` },
        { text: t.configuration, link: `${p}/self-hosting/configuration` },
        { text: t.backup, link: `${p}/self-hosting/backup` },
        { text: t.upgrade, link: `${p}/self-hosting/upgrade` },
        { text: t.twikoo, link: `${p}/self-hosting/twikoo` },
        { text: t.faq, link: `${p}/self-hosting/faq` },
      ],
    },
    {
      text: t.integration,
      items: [
        { text: t.html, link: `${p}/integration/html` },
        { text: t.sdk, link: `${p}/integration/sdk` },
        { text: t.hugo, link: `${p}/integration/hugo` },
        { text: t.customCss, link: `${p}/integration/custom-css` },
        { text: t.smoji, link: `${p}/integration/smoji` },
      ],
    },
    {
      text: t.reference,
      items: [
        { text: t.api, link: `${p}/reference/api` },
      ],
    },
  ]
}

export function nav(prefix: string, t: NavCopy): DefaultTheme.NavItem[] {
  return [
    { text: t.guide, link: `${prefix}/guide/introduction`, activeMatch: `${prefix}/guide/` },
    {
      text: t.selfHosting,
      link: `${prefix}/self-hosting/docker`,
      activeMatch: `${prefix}/self-hosting/`,
    },
    {
      text: t.integration,
      link: `${prefix}/integration/html`,
      activeMatch: `${prefix}/integration/`,
    },
    {
      text: t.reference,
      link: `${prefix}/reference/api`,
      activeMatch: `${prefix}/reference/`,
    },
  ]
}

export interface NavCopy {
  guide: string
  selfHosting: string
  integration: string
  reference: string
}

export interface SidebarCopy extends NavCopy {
  introduction: string
  features: string
  concepts: string
  docker: string
  proxy: string
  admin: string
  configuration: string
  backup: string
  upgrade: string
  twikoo: string
  faq: string
  html: string
  sdk: string
  hugo: string
  customCss: string
  smoji: string
  api: string
}
