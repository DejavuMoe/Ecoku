# Hugo PaperMod への組み込み

Hugo と定番テーマ **PaperMod** を使用した静的ブログでは、単一の partial テンプレートを上書きするだけで Ecoku コメント欄を統合できます。

---

## 1. コメントテンプレートの上書き

PaperMod はサイトルートの `layouts/partials/comments.html`（または `layouts/_partials/comments.html`）を配置することで、既定のコメント欄を上書きできます。

Hugo サイトのルートディレクトリに `layouts/partials/comments.html` を作成します：

```html
{{- $ecoku := site.Params.ecoku -}}
{{- if and $ecoku $ecoku.server_url $ecoku.site_id -}}
{{- $js := $ecoku.js_url | default (printf "%s/client/ecoku-loader.js" $ecoku.server_url) -}}
<div class="ecoku-container" style="margin-top: 2rem;">
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
</div>
{{- end }}
```

Hugo サイト設定ファイル（`hugo.yaml` など）の `params` に以下の設定を追加します：

```yaml
params:
  comments: true
  ecoku:
    server_url: "https://ecoku.example.com"
    site_id: "blog"
    # 任意：カスタムローダーまたはスタイル CDN アドレス
    # js_url: "https://ecoku.example.com/client/ecoku-loader.js"
    # css_url: "https://ecoku.example.com/client/ecoku.css"
```

---

## 2. テンプレート変数の解説

- **`data-page-key`**：Hugo の `.RelPermalink` を使用してサイト内相対パス（例: `/posts/my-first-post/`）を出力し、ドメインやプロトコルの変更に影響されない高い安定性を確保します。
- **`data-page-title`**：`.Title` を使用して記事タイトルを出力し、メールや Telegram 通知で発信元を正確に明示します。
- **`data-theme="auto"`**：コメント欄は PaperMod の `--theme`、`--primary`、`--border` などの色変数を読み取り、ページの `color-scheme` を継承します。そのため `light-dark()` で色を定義したテーマも含め、テーマのライト/ダーク切り替えに追従します。

---

## 3. 記事単位での表示制御

個別の記事 Markdown の Front Matter で `comments` プロパティを設定し、記事ごとにコメント欄の表示/非表示を制御できます：

```markdown
---
title: "Go 言語のメモリモデルを深く理解する"
date: 2026-08-20
comments: true
---
```

---

## 4. テーマのスタイルに合わせる（任意）

既定スタイルはすでに PaperMod の色変数を読み取ります。テーマがアクセントカラー、角丸、文字サイズの変数も定義している場合は、サイトの CSS（例：`assets/css/extended/comments.css`）で Ecoku の変数に対応付けると、コメント欄がテーマと一緒に変わります：

```css
.ecoku-comments {
  --ecoku-accent: var(--accent);
  --ecoku-radius: var(--radius);
  --ecoku-font-size: 15px;
  --ecoku-font-size-small: 13px;
}
```

変数名はテーマで実際に定義されているものに合わせてください。一覧は[カスタム CSS](./custom-css.md)を参照してください。
