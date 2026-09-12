import { defineConfig } from 'vitepress'
import { nav, sidebar, type NavCopy, type SidebarCopy } from './shared'

const copy: SidebarCopy & NavCopy = {
  guide: '指南',
  selfHosting: '自托管',
  integration: '接入',
  reference: '参考',
  introduction: '简介与架构',
  features: '特性全览',
  concepts: '核心机制',
  docker: 'Docker 部署',
  proxy: '反向代理',
  admin: '后台配置',
  configuration: '配置字典',
  backup: '备份与恢复',
  upgrade: '升级与迁移',
  twikoo: 'Twikoo 导入',
  faq: '常见问题与排错',
  html: '通用 HTML',
  sdk: 'JavaScript SDK',
  hugo: 'Hugo PaperMod',
  customCss: '自定义 CSS',
  smoji: 'Smoji 表情包',
  api: 'REST API',
  earlierVersions: '更早版本 (v0.0.x)',
  versionLatest: ' (最新)',
}

export const zh = defineConfig({
  title: 'Ecoku',
  description: '自托管、多站点的纯文本评论系统。Docker 部署，数据存 SQLite，提交后立即公开。',
  lang: 'zh-Hans',
  markdown: {
    container: {
      tipLabel: '提示',
      warningLabel: '注意',
      dangerLabel: '警告',
      infoLabel: '说明',
      detailsLabel: '详细信息',
    },
  },
  themeConfig: {
    nav: nav('', copy),
    sidebar: sidebar('', copy),
    outline: { label: '本页目录', level: [2, 3] },
    lastUpdated: { text: '更新于' },
    docFooter: { prev: '上一页', next: '下一页' },
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色',
    darkModeSwitchTitle: '切换到深色',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部',
    langMenuLabel: '更换语言',
    skipToContentLabel: '跳到正文',
    footer: {
      copyright: 'Copyright © 2026 DejavuMoe',
    },
  },
})
