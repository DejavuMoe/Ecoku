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

const icon = (name: string, text: string) => `<span class="sb-icon sb-icon-${name}" aria-hidden="true"></span>${text}`

const versions = [
  'v0.6.3', 'v0.6.2', 'v0.6.1', 'v0.6.0', 'v0.5.7', 'v0.5.6', 'v0.5.5', 'v0.5.4', 'v0.5.3', 'v0.5.2', 'v0.5.1', 'v0.5.0',
  'v0.4.1', 'v0.4.0', 'v0.3.8', 'v0.3.7', 'v0.3.6', 'v0.3.5', 'v0.3.4', 'v0.3.3', 'v0.3.2', 'v0.3.1', 'v0.3.0',
]
const internalVersions = [
  'v0.2.9', 'v0.2.8', 'v0.2.7', 'v0.2.6', 'v0.2.5', 'v0.2.4', 'v0.2.3', 'v0.2.2', 'v0.2.1', 'v0.2.0',
  'v0.1.9', 'v0.1.8', 'v0.1.7', 'v0.1.6', 'v0.1.5', 'v0.1.4', 'v0.1.3', 'v0.1.2', 'v0.1.1', 'v0.1.0',
]

function mainSidebar(p: string, t: SidebarCopy): DefaultTheme.SidebarItem[] {
  return [
    {
      text: icon('start', t.start),
      items: [
        { text: t.introduction, link: `${p}/guide/introduction` },
        { text: t.quickStart, link: `${p}/guide/quick-start` },
      ],
    },
    {
      text: icon('server', t.selfHosting),
      items: [
        { text: t.docker, link: `${p}/self-hosting/docker` },
        { text: t.proxy, link: `${p}/self-hosting/reverse-proxy` },
        { text: t.backup, link: `${p}/self-hosting/backup` },
        { text: t.upgrade, link: `${p}/self-hosting/upgrade` },
        { text: t.twikoo, link: `${p}/self-hosting/twikoo` },
      ],
    },
    {
      text: icon('panel', t.admin),
      items: [
        { text: t.sites, link: `${p}/admin/sites` },
        { text: t.comments, link: `${p}/admin/comments` },
        { text: t.blogger, link: `${p}/admin/blogger` },
        { text: t.notifications, link: `${p}/admin/notifications` },
        { text: t.captcha, link: `${p}/admin/captcha` },
      ],
    },
    {
      text: icon('code', t.integration),
      items: [
        { text: t.html, link: `${p}/integration/html` },
        { text: t.sdk, link: `${p}/integration/sdk` },
        { text: t.hugo, link: `${p}/integration/hugo` },
        { text: t.customCss, link: `${p}/integration/custom-css` },
        { text: t.smoji, link: `${p}/integration/smoji` },
      ],
    },
    {
      text: icon('book', t.reference),
      items: [
        { text: t.concepts, link: `${p}/reference/concepts` },
        { text: t.configuration, link: `${p}/reference/configuration` },
        { text: t.cli, link: `${p}/reference/cli` },
        { text: t.api, link: `${p}/reference/api` },
        { text: t.faq, link: `${p}/reference/faq` },
      ],
    },
  ]
}

function versionSidebar(p: string, t: SidebarCopy): DefaultTheme.SidebarItem[] {
  const link = (v: string) => ({ text: v, link: `${p}/self-hosting/upgrades/${v}` })
  return [
    {
      text: icon('tag', t.releases),
      items: [
        { text: t.upgradeGuide, link: `${p}/self-hosting/upgrade` },
        { text: `${t.versionCurrent}${t.versionLatest}`, link: `${p}/self-hosting/upgrades/${t.versionCurrent}` },
        ...versions.map(link),
      ],
    },
    {
      text: t.internalVersions,
      collapsed: true,
      items: [
        ...internalVersions.map(link),
        { text: t.earlierVersions, link: `${p}/self-hosting/upgrades/earlier` },
      ],
    },
  ]
}

export function sidebar(prefix: string, t: SidebarCopy): DefaultTheme.Sidebar {
  return {
    [`${prefix}/self-hosting/upgrades/`]: versionSidebar(prefix, t),
    [`${prefix}/`]: mainSidebar(prefix, t),
  }
}

export function nav(prefix: string, t: NavCopy): DefaultTheme.NavItem[] {
  return [
    { text: t.guide, link: `${prefix}/guide/introduction`, activeMatch: `^${prefix}/(guide/|self-hosting/(?!upgrades/)|admin/)` },
    { text: t.integration, link: `${prefix}/integration/html`, activeMatch: `^${prefix}/integration/` },
    { text: t.reference, link: `${prefix}/reference/configuration`, activeMatch: `^${prefix}/reference/` },
    {
      text: t.versionCurrent,
      activeMatch: `^${prefix}/self-hosting/upgrades/`,
      items: [
        { text: t.releaseNotes, link: `${prefix}/self-hosting/upgrades/${t.versionCurrent}` },
        { text: t.upgradeGuide, link: `${prefix}/self-hosting/upgrade` },
        { text: 'GitHub Releases', link: 'https://github.com/DejavuMoe/Ecoku/releases' },
      ],
    },
  ]
}

export interface NavCopy {
  guide: string
  integration: string
  reference: string
  versionCurrent: string
  releaseNotes: string
  upgradeGuide: string
}

export interface SidebarCopy extends NavCopy {
  start: string
  introduction: string
  quickStart: string
  selfHosting: string
  docker: string
  proxy: string
  backup: string
  upgrade: string
  twikoo: string
  admin: string
  sites: string
  comments: string
  blogger: string
  notifications: string
  captcha: string
  html: string
  sdk: string
  hugo: string
  customCss: string
  smoji: string
  concepts: string
  configuration: string
  cli: string
  api: string
  faq: string
  releases: string
  internalVersions: string
  earlierVersions: string
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
    ['meta', { name: 'theme-color', content: '#ffffff', media: '(prefers-color-scheme: light)' }],
    ['meta', { name: 'theme-color', content: '#0e0e11', media: '(prefers-color-scheme: dark)' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:site_name', content: 'Ecoku' }],
  ] satisfies HeadConfig[],
  markdown: {
    theme: {
      light: {
        name: 'ecoku-light',
        settings: [
          { settings: { foreground: '#24242b', background: '#f7f7f8' } },
          { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#6b6e73' } },
          { scope: ['string', 'constant.other'], settings: { foreground: '#2f7a4f' } },
          { scope: ['keyword', 'storage', 'entity.name.tag'], settings: { foreground: '#b13f26' } },
          { scope: ['entity.other.attribute-name', 'support.type.property-name', 'variable'], settings: { foreground: '#3b5bb5' } },
        ],
      },
      dark: {
        name: 'ecoku-dark',
        settings: [
          { settings: { foreground: '#dcdce2', background: '#141418' } },
          { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#979aa0' } },
          { scope: ['string', 'constant.other'], settings: { foreground: '#8fd1a6' } },
          { scope: ['keyword', 'storage', 'entity.name.tag'], settings: { foreground: '#f08a6c' } },
          { scope: ['entity.other.attribute-name', 'support.type.property-name', 'variable'], settings: { foreground: '#8fb0ff' } },
        ],
      },
    },
    // TextMate grammar for ```caddyfile fences (Shiki has no built-in Caddyfile).
    languages: [caddyfileGrammar],
    config(md) {
      inlineSpacing(md)
      // Wrap tables so they can scroll sideways inside a rounded frame.
      md.renderer.rules.table_open = () => '<div class="table-wrap"><table>\n'
      md.renderer.rules.table_close = () => '</table></div>\n'
    },
  },
  themeConfig: {
    logo: { src: '/logo.svg', alt: 'Ecoku' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/DejavuMoe/Ecoku' }],
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
