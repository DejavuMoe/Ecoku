---
layout: home
hero:
  name: Ecoku
  text: セルフホストのプレーンテキストコメント
  tagline: Docker で導入し、データは SQLite に保存。1 インスタンスで複数サイト。投稿はその場で公開されます。
  image:
    src: /ecoku-hero.png
    alt: Ecoku の図
  actions:
    - theme: brand
      text: Docker で導入
      link: /ja/self-hosting/docker
    - theme: alt
      text: 機能
      link: /ja/guide/features
features:
  - title: 投稿即公開
    details: 審査キューはありません。返信はそのコメントの直下。ネストに上限はありません。
  - title: 公開 API に非公開フィールドなし
    details: メール、IP、UA は返しません。訪問者の身元は IndexedDB に 7 日間だけ暗号化保存します。
  - title: コンテナ 1 つ
    details: イメージタグを固定し、データはホスト側に置きます。管理画面とコメント SDK は同一オリジンです。
  - title: メールと Telegram
    details: SMTP または Telegram の任意通知。ブロガーはパスフレーズで身元を証明できます。
---
