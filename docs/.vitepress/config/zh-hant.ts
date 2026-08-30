import { defineConfig } from 'vitepress'
import { nav, sidebar, type SidebarCopy } from './shared'

const copy: SidebarCopy = {
  guide: '指南',
  selfHosting: '自託管',
  integration: '接入',
  introduction: '簡介',
  features: '特性',
  docker: 'Docker 部署',
  proxy: '反向代理',
  admin: '後台設定',
  backup: '備份與還原',
  upgrade: '升級',
  twikoo: 'Twikoo 匯入',
  faq: '常見問題',
  html: '通用 HTML',
  hugo: 'Hugo PaperMod',
  customCss: '自訂 CSS',
}

export const zhHant = defineConfig({
  title: 'Ecoku',
  description: '自託管、多站點的純文字評論系統。Docker 部署，資料存 SQLite，送出後立即公開。',
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
    footer: {
      message: '以 MIT License 發布',
      copyright: 'Copyright © 2026 DejavuMoe',
    },
  },
})
