import { defineConfig } from 'vitepress'
import { nav, sidebar, type SidebarCopy, type NavCopy } from './shared'

const copy: SidebarCopy & NavCopy = {
  guide: 'ガイド',
  selfHosting: 'セルフホスト',
  integration: '組み込み',
  reference: 'リファレンス',
  introduction: '概要と構成',
  features: '機能一覧',
  concepts: 'コアコンセプト',
  docker: 'Docker 導入',
  proxy: 'リバースプロキシ',
  admin: '管理画面',
  configuration: '設定リファレンス',
  backup: 'バックアップと復元',
  upgrade: 'アップグレードと移行',
  twikoo: 'Twikoo 取り込み',
  faq: 'よくある質問とトラブル解決',
  html: '汎用 HTML',
  sdk: 'JavaScript SDK',
  hugo: 'Hugo PaperMod',
  customCss: 'カスタム CSS',
  smoji: 'Smoji スタンプ',
  api: 'REST API',
  earlierVersions: '以前のバージョン (v0.0.x)',
  versionLatest: ' (最新)',
}

export const ja = defineConfig({
  title: 'Ecoku',
  description: 'セルフホストのマルチサイト純テキストコメント。Docker で導入し、データは SQLite。投稿はその場で公開。',
  lang: 'ja',
  markdown: {
    container: {
      tipLabel: 'ヒント',
      warningLabel: '注意',
      dangerLabel: '警告',
      infoLabel: '情報',
      detailsLabel: '詳細',
    },
  },
  themeConfig: {
    nav: nav('/ja', copy),
    sidebar: sidebar('/ja', copy),
    outline: { label: 'このページ', level: [2, 3] },
    lastUpdated: { text: '最終更新' },
    docFooter: { prev: '前のページ', next: '次のページ' },
    darkModeSwitchLabel: '外観',
    lightModeSwitchTitle: 'ライトテーマ',
    darkModeSwitchTitle: 'ダークテーマ',
    sidebarMenuLabel: 'メニュー',
    returnToTopLabel: '先頭へ戻る',
    langMenuLabel: '言語を変更',
    skipToContentLabel: '本文へスキップ',
    footer: {
      copyright: 'Copyright © 2026 DejavuMoe',
    },
  },
})
