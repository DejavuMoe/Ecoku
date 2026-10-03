import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type DefaultTheme, type HeadConfig } from 'vitepress'
import { inlineSpacing } from '../inline-spacing'

const caddyfileGrammar = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../caddyfile.tmLanguage.json'), 'utf8'),
)

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
        { text: t.notifications, link: `${p}/self-hosting/notifications` },
        { text: t.captcha, link: `${p}/self-hosting/captcha` },
        { text: t.backup, link: `${p}/self-hosting/backup` },
        {
          text: t.upgrade,
          link: `${p}/self-hosting/upgrade`,
          collapsed: true,
          items: [
            { text: `${t.versionCurrent}${t.versionLatest}`, link: `${p}/self-hosting/upgrades/v0.3.1` },
            { text: 'v0.3.0', link: `${p}/self-hosting/upgrades/v0.3.0` },
            {
              text: t.internalVersions,
              collapsed: true,
              items: [
                { text: 'v0.2.9', link: `${p}/self-hosting/upgrades/v0.2.9` },
                { text: 'v0.2.8', link: `${p}/self-hosting/upgrades/v0.2.8` },
                { text: 'v0.2.7', link: `${p}/self-hosting/upgrades/v0.2.7` },
                { text: 'v0.2.6', link: `${p}/self-hosting/upgrades/v0.2.6` },
                { text: 'v0.2.5', link: `${p}/self-hosting/upgrades/v0.2.5` },
                { text: 'v0.2.4', link: `${p}/self-hosting/upgrades/v0.2.4` },
                { text: 'v0.2.3', link: `${p}/self-hosting/upgrades/v0.2.3` },
                { text: 'v0.2.2', link: `${p}/self-hosting/upgrades/v0.2.2` },
                { text: 'v0.2.1', link: `${p}/self-hosting/upgrades/v0.2.1` },
                { text: 'v0.2.0', link: `${p}/self-hosting/upgrades/v0.2.0` },
                { text: 'v0.1.9', link: `${p}/self-hosting/upgrades/v0.1.9` },
                { text: 'v0.1.8', link: `${p}/self-hosting/upgrades/v0.1.8` },
                { text: 'v0.1.7', link: `${p}/self-hosting/upgrades/v0.1.7` },
                { text: 'v0.1.6', link: `${p}/self-hosting/upgrades/v0.1.6` },
                { text: 'v0.1.5', link: `${p}/self-hosting/upgrades/v0.1.5` },
                { text: 'v0.1.4', link: `${p}/self-hosting/upgrades/v0.1.4` },
                { text: 'v0.1.3', link: `${p}/self-hosting/upgrades/v0.1.3` },
                { text: 'v0.1.2', link: `${p}/self-hosting/upgrades/v0.1.2` },
                { text: 'v0.1.1', link: `${p}/self-hosting/upgrades/v0.1.1` },
                { text: 'v0.1.0', link: `${p}/self-hosting/upgrades/v0.1.0` },
                { text: t.earlierVersions, link: `${p}/self-hosting/upgrades/earlier` },
              ],
            },
          ],
        },
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
        { text: t.configuration, link: `${p}/reference/configuration` },
        { text: t.cli, link: `${p}/reference/cli` },
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
      link: `${prefix}/reference/configuration`,
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
  notifications: string
  captcha: string
  backup: string
  upgrade: string
  twikoo: string
  faq: string
  html: string
  sdk: string
  hugo: string
  customCss: string
  smoji: string
  configuration: string
  cli: string
  api: string
  internalVersions: string
  earlierVersions: string
  versionCurrent: string
  versionLatest: string
}

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
    ['script', {}, `(() => {
      if (location.pathname !== '/' && location.pathname !== '') return
      const languages = navigator.languages?.length ? navigator.languages : [navigator.language]
      const language = languages.find(Boolean)?.toLowerCase() || ''
      const target = language.startsWith('zh-hant') || language.startsWith('zh-tw') || language.startsWith('zh-hk')
        ? '/zh-hant/'
        : language.startsWith('zh')
          ? '/'
          : '/en/'
      if (target !== location.pathname) location.replace(target)
    })()`],
    ['meta', { name: 'theme-color', content: '#f7f4ee', media: '(prefers-color-scheme: light)' }],
    ['meta', { name: 'theme-color', content: '#1a1816', media: '(prefers-color-scheme: dark)' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:site_name', content: 'Ecoku' }],
  ] satisfies HeadConfig[],
  markdown: {
    theme: {
      light: {
        name: 'ecoku-light',
        settings: [
          { settings: { foreground: '#35312b', background: '#ece7de' } },
          { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#6b655b' } },
          { scope: ['string', 'constant.other'], settings: { foreground: '#3d6a4e' } },
          { scope: ['keyword', 'storage', 'entity.name.tag'], settings: { foreground: '#9a4733' } },
        ],
      },
      dark: {
        name: 'ecoku-dark',
        settings: [
          { settings: { foreground: '#d3ccbf', background: '#2a2723' } },
          { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#a29a8c' } },
          { scope: ['string', 'constant.other'], settings: { foreground: '#9cc3a8' } },
          { scope: ['keyword', 'storage', 'entity.name.tag'], settings: { foreground: '#d57c64' } },
        ],
      },
    },
    // TextMate grammar for ```caddyfile fences (Shiki has no built-in Caddyfile).
    languages: [caddyfileGrammar],
    config(md) {
      inlineSpacing(md)
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
        translations: zhSearch,
        locales: {
          'zh-hant': { translations: zhHantSearch },
          en: { translations: enSearch },
        },
      },
    },
  },
})
