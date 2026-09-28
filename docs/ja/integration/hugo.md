# Hugo PaperMod

[PaperMod](https://github.com/adityatelange/hugo-PaperMod) テーマにはコメント欄用のテンプレートが用意されているので、partial ファイルを 1 つ上書きするだけで Ecoku を組み込めます。リポジトリの `examples/hugo-papermod/` ディレクトリに完全な例があります。

## 1. コメントテンプレートを追加する

Hugo サイトに `layouts/_partials/comments.html` を作成します（Hugo 0.146 より前のバージョンでは `layouts/partials/comments.html` を使います）。

```html
{{- $ecoku := site.Params.ecoku -}}
{{- if and $ecoku $ecoku.server_url $ecoku.site_id -}}
{{- $js := $ecoku.js_url | default (printf "%s/client/ecoku-loader.js" $ecoku.server_url) -}}
<section
    id="ecoku-comments"
    class="ecoku-shell"
    data-ecoku-comments
    aria-label="コメント欄"
    data-server-url="{{ $ecoku.server_url }}"
    data-site-id="{{ $ecoku.site_id }}"
    data-page-key="{{ .RelPermalink }}"
    data-page-title="{{ .Title }}"
    data-page-size="10"
    data-theme="auto"
    {{- with $ecoku.css_url }} data-css-url="{{ . }}"{{ end }}
>
    <div class="ecoku-loader" data-ecoku-loader hidden>
        <p class="ecoku-loader-status" data-ecoku-status></p>
        <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>コメントを再読み込み</button>
    </div>
    <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="{{ $js }}" defer></script>
{{- else -}}
<section class="ecoku-shell" aria-label="コメント欄">
    <p class="ecoku-loader-status" role="status">コメントサービスはまだ設定されていません。</p>
</section>
{{- end -}}
```

このテンプレートは、`.RelPermalink` をページキー（例：`/posts/my-first-post/`）として、`.Title` を記事のタイトルとして使います。`server_url` または `site_id` が設定されていない場合は「コメントサービスはまだ設定されていません。」と表示されるので、設定漏れに気づけます。

## 2. サイトの設定を追加する

`hugo.yaml` に次を追加します。

```yaml
params:
  comments: true
  ecoku:
    # 末尾に / を付けないでください
    server_url: "https://ecoku.example.com"
    site_id: "blog"
    # 任意：自分でホストしたローダーを使います。デフォルトは {server_url}/client/ecoku-loader.js
    # js_url: "https://cdn.example.com/ecoku-loader.js"
    # 任意：デフォルトのスタイルを置き換えます。「カスタムスタイル」を参照
    # css_url: "https://ecoku.example.com/client/ecoku.unstyled.css"
```

`params.comments: true` で、すべての記事のコメント欄が有効になります。コメントが不要な記事では、その front matter に `comments: false` と書きます。

```yaml
---
title: "关于本站"
comments: false
---
```

## 3. オリジンを登録する

Ecoku の管理画面で、このサイトの許可オリジン（例：`https://blog.example.com`）を追加します。ローカルで `hugo server` を実行してプレビューする場合は、`http://localhost:1313` も追加してください。

## 見た目

デフォルトのスタイルは PaperMod の色の変数（`--theme`、`--entry`、`--primary`、`--secondary`、`--content`、`--border`、`--code-bg`）を読み取り、テーマのライト / ダークの切り替えに追従するので、通常は追加の設定は不要です。

角丸、文字サイズ、アクセントカラーをさらに揃えたい場合は、`assets/css/extended/` に CSS ファイルを新しく作成します。PaperMod がサイトのスタイルに自動でまとめてくれます。

```css
.ecoku-comments {
  --ecoku-radius: 8px;
  --ecoku-font-size: 16px;
  --ecoku-accent: #b4532a;
}
```

使えるすべての変数は[カスタムスタイル](./custom-css#variables)を参照してください。

例のディレクトリにある `assets/css/extended/ecoku.css` は、読み込み失敗時のメッセージと再試行ボタンにだけスタイルを付けています。必要に応じてコピーしてください。
