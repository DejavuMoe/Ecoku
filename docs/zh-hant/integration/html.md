# 通用 HTML 與 Loader 接入

Ecoku 提供了僅約 2KB 的極輕量級非同步載入器 `ecoku-loader.js`。透過在 HTML 中宣告 `data-*` 屬性，載入器會自動非同步拉取核心 SDK 與樣式並完成掛載。

---

## 快速接入範例

在頁面的評論區掛載位置插入以下 HTML 結構：

```html
<!-- 評論區容器外殼 -->
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://ecoku.example.com"
  data-site-id="blog"
  data-page-key="/posts/hello-world/"
  data-page-title="你好，世界"
  data-page-size="10"
  data-theme="auto"
>
  <!-- 錯誤狀態與重試按鈕容器 (預設隱藏) -->
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新載入評論</button>
  </div>
  <!-- 實際掛載 DOM -->
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>

<!-- 非同步引入載入器腳本 -->
<script src="https://ecoku.example.com/client/ecoku-loader.js" defer></script>
```

---

## HTML `data-*` 屬性規範

| 屬性名 | 必填 | 類型 | 規範與說明 |
| :--- | :---: | :--- | :--- |
| `data-server-url` | **是** | String | Ecoku 後端服務的絕對 HTTPS 位址（如 `https://ecoku.example.com`）。 |
| `data-site-id` | **是** | String | 在管理後台建立的站點唯一識別碼。 |
| `data-page-key` | **是** | String | 目前頁面的**穩定站內相對路徑**（1～512 字元，如 `/posts/hello-world/`）。嚴禁使用完整 URL 或帶 query/fragment 的參數。 |
| `data-page-title` | 否 | String | 目前頁面的文章標題（最多 200 字元），用於在郵件通知中清晰展示來源。 |
| `data-page-size` | 否 | Number | 根評論每頁筆數（1～100 整數，預設 `10`）。 |
| `data-theme` | 否 | String | 主題模式：`auto`（跟隨系統，預設）、`light`（淺色）、`dark`（深色）。 |
| `data-css-url` | 否 | String | 自訂 CSS 位址。可填絕對 URL、站內相對路徑，或填 `none` 完全停用內建樣式注入。詳見 [自訂 CSS](/zh-hant/integration/custom-css)。 |

---

## 運作機制與優勢

1. **零阻塞極速載入**：`ecoku-loader.js` 體積僅約 2KB，帶有 `defer` 屬性，絕不阻塞部落格首屏渲染。
2. **靜默載入**：載入過程中不顯示任何侵入性的「正在載入…」骨架提示，保持頁面清爽。
3. **網路容錯與重試**：若因網路波動導致核心 SDK 載入逾時（預設 12 秒）或失敗，容器會自動啟動 `.ecoku-loader` 並展示「重新載入」互動按鈕。
4. **自動樣式注入**：未指定 `data-css-url` 時，SDK 初始化後會自動注入經過優化的內嵌完整樣式，無需額外引入外部 `<link rel="stylesheet">`。

---

## 手動引入 UMD（不使用 Loader）

如果您希望透過標準的 `<script>` 標籤手動控制初始化生命週期，可以直接使用 UMD 產物：

```html
<!-- 1. 引入樣式表 -->
<link rel="stylesheet" href="https://ecoku.example.com/client/ecoku.css">

<!-- 2. 掛載容器 -->
<div id="ecoku-mount"></div>

<!-- 3. 引入 UMD 核心腳本 -->
<script src="https://ecoku.example.com/client/ecoku.umd.js"></script>

<!-- 4. 初始化實例 -->
<script>
  const comments = new Ecoku({
    container: '#ecoku-mount',
    serverURL: 'https://ecoku.example.com',
    siteId: 'blog',
    pageKey: window.location.pathname,
    pageTitle: document.title,
    pageSize: 10,
    theme: 'auto',
    cssURL: 'none' // 告知 SDK 樣式已由外部 link 引入，避免重複注入
  })

  comments.init().catch(console.error)
</script>
```
