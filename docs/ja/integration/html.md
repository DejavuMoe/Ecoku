# 汎用 HTML

各ページに専用コンテナと安定した page key。`pageKey` はサイト内相対パス。絶対 URL や query は不可。

```html
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://comments.example.com"
  data-site-id="blog"
  data-page-key="/posts/example/"
  data-page-title="Example post"
  data-page-size="10"
  data-theme="auto"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新加载评论</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://comments.example.com/client/ecoku-loader.js" defer></script>
```

ローダーは `data-ecoku-*` を必須とします。正規 id は `ecoku-comments` と `ecoku-mount`。旧 `#tcomment` はまだ動きますが新規では使わない。

読み込み中コピーは出しません。失敗時だけ状態と再試行。未設定サイトは「评论服务尚未配置。」

管理者トークンや management key を埋め込まない。検証設定は公開 `formConfig` で届きます。

## スタイル

既定では SDK が注入。`data-css-url` で注入を止めます。`/client/ecoku.css`、構造のみの `/client/ecoku.unstyled.css`、`none`（完全自前）。任意の `data-js-url` でローダー差し替え。

上のコードが完全な例です。コピーしてサイト設定を置き換えてください。ホスト CSP は [FAQ](/ja/self-hosting/faq#ホスト-csp)。
