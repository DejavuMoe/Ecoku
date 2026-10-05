import { defineConfig } from 'vitepress'
import { nav, sidebar, type SidebarCopy, type NavCopy } from './shared'

const copy: SidebarCopy & NavCopy = {
  guide: 'Guide',
  selfHosting: 'Self-hosting',
  integration: 'Integration',
  reference: 'Reference',
  introduction: 'Introduction',
  features: 'Features',
  concepts: 'How It Works',
  docker: 'Docker Deployment',
  proxy: 'Reverse Proxy',
  admin: 'Admin Console',
  notifications: 'Notifications',
  captcha: 'CAPTCHA',
  backup: 'Backup & Restore',
  upgrade: 'Upgrading',
  twikoo: 'Migrating from Twikoo',
  faq: 'FAQ',
  html: 'HTML Embed',
  sdk: 'JavaScript SDK',
  hugo: 'Hugo PaperMod',
  customCss: 'Custom Styles',
  smoji: 'Smoji Stickers',
  configuration: 'Configuration',
  cli: 'Command Line',
  api: 'REST API',
  internalVersions: 'Internal test archive (do not use)',
  earlierVersions: 'Earlier release candidates',
  versionCurrent: 'v0.3.5',
  versionLatest: ' (latest)',
}

export const en = defineConfig({
  title: 'Ecoku',
  description: 'Self-hosted comments for multiple sites.',
  lang: 'en',
  themeConfig: {
    nav: nav('/en', copy),
    sidebar: sidebar('/en', copy),
    outline: { label: 'On this page', level: [2, 3] },
    lastUpdated: { text: 'Updated' },
    footer: {
      copyright: 'Copyright © 2026 DejavuMoe',
    },
  },
})
