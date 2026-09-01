---
layout: home
hero:
  name: Ecoku
  text: セルフホストの純テキストコメント
  tagline: 静的ブログと個人サイトのために設計。極小シングルコンテナ、データは SQLite、投稿はその場で公開。
  image:
    src: /ecoku-hero.png
    alt: Ecoku 概要図
  actions:
    - theme: brand
      text: Docker 導入
      link: /ja/self-hosting/docker
    - theme: alt
      text: コアコンセプト
      link: /ja/guide/concepts
    - theme: alt
      text: 組み込み手順
      link: /ja/integration/html

features:
  - title: 投稿はその場で公開 · 会話を遮らない
    details: 審査キューなし。返信は対象コメントの直下に表示。無制限の階層セマンティクスと最大3段階のインデント。
    link: /ja/guide/concepts#スレッドコメントとページネーションモデル
  - title: 厳格なプライバシー保護
    details: 公開 API からメールや IP、UA を排除。訪問者情報はブラウザの IndexedDB に AES-GCM で暗号化保存（7日間）。
    link: /ja/guide/concepts#訪問者情報の暗号化保存
  - title: シングルコンテナ構成
    details: Go 単一バイナリで API・管理画面 (/admin/)・SDK (/client/) を同時にホスト。単一 SQLite ファイルで WAL 運用。
    link: /ja/guide/introduction#システム構成概要
  - title: 最新のロボット検証
    details: 無効・Cloudflare Turnstile・セルフホスト Cap の 3 状態を切り替え可能。動的 CSP ポリシー対応。
    link: /ja/self-hosting/admin#ボット対策-captcha
  - title: トランザクショナル Outbox 通知
    details: Outbox パターンによる SMTP (TLS/STARTTLS) および Telegram 通知。ブロガー合言葉によるパスワードレス認証。
    link: /ja/guide/concepts#トランザクショナル-outbox-通知
  - title: 軽量かつ柔軟な組み込み
    details: 2KB のスタンドアロン Loader、Hugo PaperMod 対応、完全な CSS Design Tokens、Smoji テキストスタンププロトコル。
    link: /ja/integration/html
---
