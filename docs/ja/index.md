---
layout: home
hero:
  name: Ecoku
  text: セルフホストで、複数サイトの文字の対話を
  tagline: ブログと個人サイトのためのコメントシステム。訪問者登録は不要で、投稿はすぐ公開され、データは自分で管理できます。
  image:
    src: /logo.svg
    alt: Ecoku のロゴ
  actions:
    - theme: brand
      text: デプロイを始める
      link: /ja/self-hosting/docker
    - theme: alt
      text: Ecoku について
      link: /ja/guide/introduction
    - theme: alt
      text: コメント欄を埋め込む
      link: /ja/integration/html

features:
  - title: 投稿するとすぐに公開
    details: 審査キューはありません。返信は返信先のコメントの下に展開され、削除しても墓標が残るので議論の文脈が途切れません。
    link: /ja/guide/concepts#threads
  - title: 訪問者の IP を保存しない
    details: コメントには名前、本文、入力したメールアドレスや URL を保存します。公開 API はメールを返さず、IP と User-Agent は保存しません。ブラウザーは情報を暗号化して 7 日間記憶できます。
    link: /ja/guide/concepts#data
  - title: 1 つのコンテナで運用
    details: Go プログラムが API、管理画面、埋め込み資産を提供します。業務データは SQLite、キーは別ファイルに保存します。データディレクトリ全体と設定をバックアップします。
    link: /ja/guide/introduction#components
  - title: マルチサイト
    details: 1 つのインスタンスで複数のサイトを扱えます。サイトごとに許可オリジン、コメント設定、ブロガー情報を個別に持ちます。
    link: /ja/self-hosting/admin#sites
  - title: 通知と CAPTCHA
    details: 新しいコメントをメールまたは Telegram でブロガーに通知します。スパム対策として Cloudflare Turnstile またはセルフホストの Cap を選べます。
    link: /ja/self-hosting/notifications
  - title: HTML を貼るだけで導入
    details: Hugo、Hexo、Astro などあらゆる静的サイトで使え、Vue や React のシングルページアプリにも対応します。見た目は CSS 変数で調整できます。
    link: /ja/integration/html
---
