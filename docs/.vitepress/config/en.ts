import { defineConfig } from 'vitepress'
import { GITEA, nav, sidebar, type SidebarCopy } from './shared'

const copy: SidebarCopy = {
  guide: 'Guide',
  selfHosting: 'Self-hosting',
  integration: 'Integration',
  upgrades: 'Upgrades',
  introduction: 'Introduction',
  features: 'Features',
  docker: 'Docker',
  proxy: 'Reverse proxy',
  admin: 'Admin setup',
  backup: 'Backup & restore',
  upgrade: 'Upgrade procedure',
  twikoo: 'Twikoo import',
  faq: 'FAQ',
  html: 'Plain HTML',
  hugo: 'Hugo PaperMod',
  contribute: 'Contribute',
  localDev: 'Local development',
}

export const en = defineConfig({
  title: 'Ecoku',
  description: 'A self-hosted, multi-site plain-text comment system',
  lang: 'en',
  themeConfig: {
    nav: nav('/en', copy),
    sidebar: sidebar('/en', copy),
    outline: { label: 'On this page', level: [2, 3] },
    lastUpdated: { text: 'Updated' },
    editLink: {
      pattern: `${GITEA}/_edit/master/docs/:path`,
      text: 'Edit this page on Git',
    },
    footer: {
      message: 'Released under the MIT License',
      copyright: 'Copyright © 2026 DejavuMoe',
    },
  },
})
