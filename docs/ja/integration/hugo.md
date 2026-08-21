# Hugo PaperMod

```yaml
params:
  comments: true
  ecoku:
    server_url: "https://comments.example.com"
    site_id: "blog"
    # js_url: "https://cdn.example.com/ecoku-loader.js"
    # css_url: "https://comments.example.com/client/ecoku.unstyled.css"
```

`examples/hugo-papermod/layouts/_partials/comments.html` を、実際に使う comments partial へマージ。本番は `.RelPermalink` を page key、`.Title` をタイトルにし、Hugo の文脈エスケープを維持。

公開前：通常記事、コメント無し頁、深い返信、ルートページ送り、モバイル、返信メール、未登録 Origin の CORS 拒否、再読み込み後 7 日の身元復元。サイトデータを消すと身元も消えます。

イメージ同梱ローダーは現行プロトコル（Cap 含む）に追従します。古い SDK を固定しているサイトは、Cap を選ぶ前に更新してください。
