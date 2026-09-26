# Hugo PaperMod 接入

在基於 Hugo 與知名主題 **PaperMod** 的靜態部落格中，整合 Ecoku 評論區僅需修改一個 partial 範本檔案。

---

## 1. 覆蓋評論範本

PaperMod 支援在站點根目錄下透過 `layouts/partials/comments.html`（或 `layouts/_partials/comments.html`）覆蓋預設評論部分。

在您的 Hugo 站點根目錄下建立 `layouts/partials/comments.html`：

```html
{{- $ecoku := site.Params.ecoku -}}
{{- if and $ecoku $ecoku.server_url $ecoku.site_id -}}
{{- $js := $ecoku.js_url | default (printf "%s/client/ecoku-loader.js" $ecoku.server_url) -}}
<div class="ecoku-container" style="margin-top: 2rem;">
  <section
    id="ecoku-comments"
    class="ecoku-shell"
    data-ecoku-comments
    aria-label="評論區"
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
</div>
{{- end }}
```

並在 Hugo 站點設定檔（如 `hugo.yaml`）的 `params` 中加入配置：

```yaml
params:
  comments: true
  ecoku:
    server_url: "https://ecoku.example.com"
    site_id: "blog"
    # 可選：自訂載入器或樣式 CDN 位址
    # js_url: "https://ecoku.example.com/client/ecoku-loader.js"
    # css_url: "https://ecoku.example.com/client/ecoku.css"
```

---

## 2. 核心變數解析

- **`data-page-key`**：頁面 key 使用 Hugo 的 `.RelPermalink` 輸出站內相對路徑（例如 `/posts/my-first-post/`），具備極高的唯一性與穩定性。
- **`data-page-title`**：頁面標題使用 `.Title` 輸出目前文章標題，供郵件和 Telegram 通知精準標識討論來源。
- **`data-theme="auto"`**：評論區讀取 PaperMod 的 `--theme`、`--primary`、`--border` 等顏色變數，並繼承頁面的 `color-scheme`，因此會跟隨主題的日間/夜間切換，包括用 `light-dark()` 定義顏色的主題。

---

## 3. 文章級開關控制

在具體文章的 Markdown Front Matter 中，可透過 `comments` 欄位按需開啟或關閉該篇的評論區：

```markdown
---
title: "深入理解 Go 語言記憶體模型"
date: 2026-08-20
comments: true
---
```

---

## 4. 對齊主題樣式（選用）

預設樣式已經讀取 PaperMod 的顏色變數。如果主題還定義了強調色、圓角或字級變數，可以在站點 CSS（例如 `assets/css/extended/comments.css`）中對應到 Ecoku，評論區會隨主題一起變化：

```css
.ecoku-comments {
  --ecoku-accent: var(--accent);
  --ecoku-radius: var(--radius);
  --ecoku-font-size: 15px;
  --ecoku-font-size-small: 13px;
}
```

變數名稱以主題實際定義為準，完整清單見[自訂 CSS](./custom-css.md)。
