import { defineConfig } from 'vitepress'
import { nav, sidebar, type SidebarCopy } from './shared'

const copy: SidebarCopy & NavCopy = {
  guide: 'Guide',
  selfHosting: 'Self-hosting',
  integration: 'Integration',
  reference: 'Reference',
  introduction: 'Introduction & Architecture',
  features: 'Features Overview',
  concepts: 'Core Concepts',
  docker: 'Docker Deployment',
  proxy: 'Reverse Proxy',
  admin: 'Admin Console',
  configuration: 'Configuration Reference',
  backup: 'Backup & Restore',
  upgrade: 'Upgrade & Migrations',
  twikoo: 'Twikoo Migration',
  faq: 'FAQ & Troubleshooting',
  html: 'Plain HTML & Loader',
  sdk: 'JavaScript SDK',
  hugo: 'Hugo PaperMod',
  customCss: 'Custom Styling & Tokens',
  smoji: 'Smoji Stickers',
  api: 'REST API',
  earlierVersions: 'Earlier versions (v0.0.x)',
  versionLatest: ' (Latest)',
}

export const en = defineConfig({
  title: 'Ecoku',
  description: 'Self-hosted multi-site plain-text comments. Deploy with Docker, store data in SQLite, go live on submit.',
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
