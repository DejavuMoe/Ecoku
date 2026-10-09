# Hugo PaperMod

[PaperMod](https://github.com/adityatelange/hugo-PaperMod) 主題預留了評論區範本，覆寫一個 partial 檔案就能接入 Ecoku。儲存庫的 `examples/hugo-papermod/` 目錄中有完整範例。

## 1. 新增評論範本

在 Hugo 網站中建立 `layouts/_partials/comments.html`（Hugo 0.146 之前的版本使用 `layouts/partials/comments.html`）：

```html
{{- $ecoku := site.Params.ecoku -}}
{{- if and $ecoku $ecoku.server_url $ecoku.site_id -}}
{{- $js := $ecoku.js_url | default (printf "%s/client/ecoku-loader.js" $ecoku.server_url) -}}
<section
    id="ecoku-comments"
    class="ecoku-shell"
    data-ecoku-comments
    aria-label="評論區"
    aria-busy="false"
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
        <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新載入評論</button>
    </div>
    <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="{{ $js }}" defer></script>
{{- else -}}
<section class="ecoku-shell" aria-label="評論區">
    <p class="ecoku-loader-status" role="status">評論服務尚未設定。</p>
</section>
{{- end -}}
```

範本以 `.RelPermalink` 作為頁面 key（例如 `/posts/my-first-post/`），以 `.Title` 作為文章標題。沒有填寫 `server_url` 或 `site_id` 時，會顯示「評論服務尚未設定。」，方便發現設定遺漏。

## 2. 新增網站設定

在 `hugo.yaml` 中加入：

```yaml
params:
  comments: true
  ecoku:
    # 結尾不要加 /
    server_url: "https://ecoku.example.com"
    site_id: "blog"
    # 選填：使用自行託管的載入器，預設為 {server_url}/client/ecoku-loader.js
    # js_url: "https://cdn.example.com/ecoku-loader.js"
    # 選填：取代預設樣式，見「自訂樣式」
    # css_url: "https://ecoku.example.com/client/ecoku.unstyled.css"
```

`params.comments: true` 會為所有文章開啟評論區。某篇文章不需要評論時，在它的 front matter 中寫 `comments: false`：

```yaml
---
title: "關於本站"
comments: false
---
```

## 3. 登記來源

在 Ecoku 後台為這個站點新增允許來源，例如 `https://blog.example.com`。在本機執行 `hugo server` 預覽時，把 `http://localhost:1313` 也加進去。

## 外觀

預設樣式會讀取 PaperMod 的顏色變數（`--theme`、`--entry`、`--primary`、`--secondary`、`--content`、`--border`），並跟隨主題的明暗切換，通常不需要額外設定。

想進一步統一圓角、字級或強調色，可以在 `assets/css/extended/` 下新增一個 CSS 檔案，PaperMod 會自動把它打包進網站樣式：

```css
.ecoku-comments {
  --ecoku-radius: 8px;
  --ecoku-font-size: 16px;
  --ecoku-accent: #b4532a;
}
```

所有可用的變數見[自訂樣式](./custom-css#variables)。

範例目錄中的 `assets/css/extended/ecoku.css` 只為外層元素、載入失敗的提示和重試按鈕設定樣式，不影響評論區本身，可以視需要複製。
