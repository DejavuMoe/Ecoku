import { defineConfig } from 'vitepress'
import { nav, sidebar, type SidebarCopy, type NavCopy } from './shared'

const copy: SidebarCopy & NavCopy = {
  guide: 'ガイド',
  selfHosting: 'セルフホスト',
  integration: '組み込み',
  reference: 'リファレンス',
  introduction: '概要',
  features: '機能',
  concepts: '仕組み',
  docker: 'Docker で導入',
  proxy: 'リバースプロキシ',
  admin: '管理画面',
  notifications: '通知',
  captcha: 'CAPTCHA',
  backup: 'バックアップと復元',
  upgrade: 'アップグレード',
  twikoo: 'Twikoo からの移行',
  faq: 'よくある質問',
  html: 'HTML で組み込む',
  sdk: 'JavaScript SDK',
  hugo: 'Hugo PaperMod',
  customCss: 'スタイルのカスタマイズ',
  smoji: 'Smoji スタンプ',
  configuration: '設定リファレンス',
  cli: 'コマンドライン',
  api: 'REST API',
  earlierVersions: '以前のリリース候補',
  versionCurrent: 'v0.3.0',
  versionLatest: '（最新）',
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
