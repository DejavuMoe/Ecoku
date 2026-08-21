import { defineConfig } from 'vitepress'
import { GITEA, nav, sidebar, type SidebarCopy } from './shared'

const copy: SidebarCopy = {
  guide: '指南',
  selfHosting: '自託管',
  integration: '接入',
  upgrades: '升級說明',
  introduction: '專案介紹',
  features: '特性',
  docker: 'Docker 部署',
  proxy: '反向代理',
  admin: '後台設定',
  backup: '備份與還原',
  upgrade: '升級流程',
  twikoo: 'Twikoo 匯入',
  faq: '常見問題',
  html: '通用 HTML',
  hugo: 'Hugo PaperMod',
  contribute: '開發',
  localDev: '本機開發',
}

export const zhHant = defineConfig({
  title: 'Ecoku',
  description: '面向自託管場景的多站點純文字評論系統',
  lang: 'zh-Hant',
  markdown: {
    container: {
      tipLabel: '提示',
      warningLabel: '注意',
      dangerLabel: '警告',
      infoLabel: '說明',
      detailsLabel: '詳細資訊',
    },
  },
  themeConfig: {
    nav: nav('/zh-hant', copy),
    sidebar: sidebar('/zh-hant', copy),
    outline: { label: '本頁目錄', level: [2, 3] },
    lastUpdated: { text: '更新於' },
    docFooter: { prev: '上一頁', next: '下一頁' },
    darkModeSwitchLabel: '外觀',
    lightModeSwitchTitle: '切換到淺色',
    darkModeSwitchTitle: '切換到深色',
    sidebarMenuLabel: '選單',
    returnToTopLabel: '回到頂部',
    langMenuLabel: '更換語言',
    skipToContentLabel: '跳到正文',
    editLink: {
      pattern: `${GITEA}/_edit/master/docs/:path`,
      text: '在 Git 上編輯此頁',
    },
    footer: {
      message: '以 MIT License 發布',
      copyright: 'Copyright © 2026 DejavuMoe',
    },
  },
})
