# 通用 HTML

每個頁面放一個評論容器。`data-page-key` 是目前頁的穩定站內相對路徑：

- 靜態站在範本裡插入目前頁的 path / permalink。
- 手寫 HTML 時為每頁提供唯一且穩定的相對路徑。

範例中的 `/posts/example/` 是渲染後的 key，不是所有頁面都要照抄。不要用完整 URL 或帶 query / fragment 的位址。

## 屬性

| 屬性 | 必填 | 說明 |
| --- | --- | --- |
| `data-server-url` | 是 | 評論服務的絕對 `http(s)` 位址 |
| `data-site-id` | 是 | 管理端建立的站點 ID |
| `data-page-key` | 是 | 站內相對路徑，1–512 字元 |
| `data-page-title` | 否 | ≤200 字元 |
| `data-page-size` | 否 | 根評論每頁條數，1–100，預設 10 |
| `data-theme` | 否 | `auto` / `light` / `dark` |
| `data-css-url` | 否 | 見 [自訂 CSS](/zh-hant/integration/custom-css) |

## Loader 範例

```html
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://comments.example.com"
  data-site-id="blog"
  data-page-key="/posts/example/"
  data-page-title="範例文章"
  data-page-size="10"
  data-theme="auto"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新載入評論</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://comments.example.com/client/ecoku-loader.js" defer></script>
```

載入器讀取上述屬性，載入 SDK 並初始化；失敗時顯示狀態與重試。載入過程中不額外提示文案。未設定必要屬性時載入器會跳過。不要在頁面放入管理員 token 或 management key。

未設定 `data-css-url` 時，SDK **內嵌**預設評論區樣式（不會自動請求 `/client/ecoku.css`）。自訂樣式見 [自訂 CSS](/zh-hant/integration/custom-css)。

## 不使用 loader

自行載入 UMD 與 CSS 時傳入 `cssURL: 'none'`，避免 SDK 再注入預設樣式：

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
    pageTitle: '範例文章',
    pageSize: 10,
    theme: 'auto',
    cssURL: 'none'
  })

  comments.init().catch(console.error)
</script>
```

`ecoku.umd.js` 提供全域 `Ecoku`。這種方式沒有 loader 的失敗重試 UI。Hugo 接入見 [Hugo PaperMod](/zh-hant/integration/hugo)。
