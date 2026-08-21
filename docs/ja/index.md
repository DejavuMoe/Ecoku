---
layout: home
hero:
  name: Ecoku
  text: セルフホストのプレーンテキストコメント
  tagline: マルチサイト、SQLite、Docker Compose。投稿はその場で公開。公開 API にメールや訪問者の痕跡は出しません。
  image:
    src: /ecoku-hero.png
    alt: コメントスレッドとセルフホストデータをつなぐ Ecoku のイラスト
  actions:
    - theme: brand
      text: Docker で導入
      link: /ja/self-hosting/docker
    - theme: alt
      text: 機能
      link: /ja/guide/features
features:
  - title: 投稿即公開
    details: 審査キューはありません。返信はそのコメントの直下で完結。スレッド階層に上限はなく、見た目のインデントは 3 段までです。
  - title: 既定で非公開
    details: 公開 DTO にメール、IP、UA、管理フィールドは含めません。訪問者の身元は IndexedDB に 7 日間だけ暗号化保存します。
  - title: コンテナ 1 つ
    details: 正確なイメージタグ、SQLite のその場マイグレーション、ホスト側リバースプロキシで HTTPS。管理画面とコメント SDK は同一オリジンです。
  - title: 重複しない通知
    details: SMTP（TLS/STARTTLS）と Telegram。ブロガーはパスフレーズで証明。配送は固定マトリクスに従い、管理画面に判定表は出しません。
---
