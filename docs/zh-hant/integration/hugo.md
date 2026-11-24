# Hugo PaperMod

[PaperMod](https://github.com/adityatelange/hugo-PaperMod) 主題給評論區留了一個 partial 範本，覆寫它就能接入 Ecoku。完整範例在倉庫的 `examples/hugo-papermod/` 目錄。

<div class="steps">

### 新增評論範本

在 Hugo 站點中建立 `layouts/_partials/comments.html`（Hugo 0.146 之前的版本使用 `layouts/partials/comments.html`）：

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

頁面 key 用 `.RelPermalink`（如 `/posts/my-first-post/`），標題用 `.Title`。忘了設定 `server_url` 或 `site_id` 時，頁面上會顯示「評論服務尚未設定。」。

### 新增站點設定

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

`params.comments: true` 給所有文章開啟評論區。個別文章不要評論時，在它的 front matter 裡寫 `comments: false`：

```yaml
---
title: "關於本站"
comments: false
---
```

### 登記來源

在 Ecoku 後台給這個站點加上允許來源，如 `https://blog.example.com`。本機用 `hugo server` 預覽時，把 `http://localhost:1313` 也加上。

`.RelPermalink` 包含 `baseURL` 裡的子目錄。例如 `baseURL: https://example.com/blog/` 會產生 `/blog/posts/…`，這時 Ecoku 的站點 URL 填 `https://example.com`，見 [站點 URL 與頁面路徑](../admin/sites#site-url)。

</div>

## 外觀

Ecoku 的預設樣式直接讀取 PaperMod 的顏色變數（`--theme`、`--entry`、`--primary`、`--secondary`、`--content`、`--border`），明暗切換也會跟著變，一般不用另外設定。

想調整圓角、字級或強調色，在 `assets/css/extended/` 下新建一個 CSS 檔案，PaperMod 會自動打包它：

```css
.ecoku-comments {
  --ecoku-radius: 8px;
  --ecoku-font-size: 16px;
  --ecoku-accent: #b4532a;
}
```

所有可用變數見 [自訂樣式](./custom-css#variables)。

範例目錄裡的 `assets/css/extended/ecoku.css` 只給外層元素、載入失敗提示和重試按鈕加了樣式，可以視需要複製。
