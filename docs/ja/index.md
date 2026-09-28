---
layout: home
hero:
  name: Ecoku
  text: セルフホストの純テキストコメントシステム
  tagline: 静的ブログと個人サイトのために。Docker コンテナ 1 つ、SQLite ファイル 1 つ。コメントは投稿するとすぐに公開されます。
  image:
    src: /ecoku-hero.png
    alt: Ecoku コメント欄のイメージ
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
  - title: 訪問者の情報を集めない
    details: IP と User-Agent を保存せず、公開 API はメールアドレスを返しません。訪問者の情報はブラウザ内で暗号化され、7 日間だけ保存されます。
    link: /ja/guide/concepts#data
  - title: コンテナ 1 つ、ファイル 1 つ
    details: 1 つの Go プログラムが API、管理画面、埋め込みスクリプトをまとめて提供し、すべてのデータは 1 つの SQLite ファイルに入ります。
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
