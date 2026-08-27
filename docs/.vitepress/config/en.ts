import { defineConfig } from 'vitepress'
import { nav, sidebar, type SidebarCopy } from './shared'

const copy: SidebarCopy = {
  guide: 'Guide',
  selfHosting: 'Self-hosting',
  integration: 'Integration',
  introduction: 'Introduction',
  features: 'Features',
  docker: 'Docker',
  proxy: 'Reverse proxy',
  admin: 'Admin setup',
  backup: 'Backup & restore',
  upgrade: 'Upgrade',
  twikoo: 'Twikoo import',
  faq: 'FAQ',
  html: 'Plain HTML',
  hugo: 'Hugo PaperMod',
  customCss: 'Custom CSS',
}

export const en = defineConfig({
  title: 'Ecoku',
  description: 'Self-hosted multi-site plain-text comments',
  lang: 'en',
  themeConfig: {
    nav: nav('/en', copy),
    sidebar: sidebar('/en', copy),
    outline: { label: 'On this page', level: [2, 3] },
    lastUpdated: { text: 'Updated' },
    footer: {
      message: 'Released under the MIT License',
      copyright: 'Copyright © 2026 DejavuMoe',
    },
  },
})
