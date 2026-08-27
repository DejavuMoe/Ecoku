# 汎用 HTML

各ページにコメント用コンテナを 1 つ置きます。`data-page-key` は現在ページの安定したサイト相対パスです。

- 静的サイトではテンプレートに現在ページの path / permalink を入れます。
- 手書き HTML ではページごとに一意で安定した相対パスを与えます。

例の `/posts/example/` はレンダー後の key であり、全ページで同じ値にする必要はありません。完全な URL や query / fragment 付きのアドレスは使わないでください。

## 属性

| 属性 | 必須 | 説明 |
| --- | --- | --- |
| `data-server-url` | はい | コメントサービスの絶対 `http(s)` URL |
| `data-site-id` | はい | 管理画面で作ったサイト ID |
| `data-page-key` | はい | サイト相対パス、1–512 文字 |
| `data-page-title` | いいえ | ≤200 文字 |
| `data-page-size` | いいえ | ルートコメントの 1 ページ件数、1–100、既定 10 |
| `data-theme` | いいえ | `auto` / `light` / `dark` |
| `data-css-url` | いいえ | [カスタム CSS](/ja/integration/custom-css) を参照 |

## Loader の例

```html
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://comments.example.com"
  data-site-id="blog"
  data-page-key="/posts/example/"
  data-page-title="サンプル記事"
  data-page-size="10"
  data-theme="auto"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>コメントを再読み込み</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://comments.example.com/client/ecoku-loader.js" defer></script>
```

ローダーは上記属性を読み、SDK を読み込んで初期化します。失敗時は状態と再試行を表示します。読み込み中に追加の文言は出しません。必須属性が無い場合はローダーはスキップします。管理者 token や management key をページに置かないでください。

`data-css-url` 未設定時、SDK は既定のコメントスタイルを**インライン**します（`/client/ecoku.css` を自動取得しません）。カスタムは [カスタム CSS](/ja/integration/custom-css)。

## ローダーを使わない場合

UMD と CSS を自分で読むときは `cssURL: 'none'` を渡し、SDK が既定スタイルを再注入しないようにします。

```html
<link rel="stylesheet" href="https://comments.example.com/client/ecoku.css">
<div id="ecoku-mount"></div>

<script src="https://comments.example.com/client/ecoku.umd.js"></script>
<script>
  const comments = new Ecoku({
    container: '#ecoku-mount',
    serverURL: 'https://comments.example.com',
    siteId: 'blog',
    pageKey: '/posts/example/',
    pageTitle: 'サンプル記事',
    pageSize: 10,
    theme: 'auto',
    cssURL: 'none'
  })

  comments.init().catch(console.error)
</script>
```

`ecoku.umd.js` はグローバル `Ecoku` を提供します。この方式にはローダーの失敗再試行 UI はありません。Hugo は [Hugo PaperMod](/ja/integration/hugo) を参照。
