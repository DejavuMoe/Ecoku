# HTML 接入

在文章範本裡加一段 HTML 和一個腳本，就能在任何靜態網站上顯示評論區。腳本 `ecoku-loader.js` 由你的 Ecoku 實例提供，它讀取 HTML 上的屬性，再載入評論元件。

開始前，先在後台 [登記站點](../admin/sites)，並把部落格的來源加進允許來源。

## 接入程式碼

把下面的程式碼放在文章範本裡評論區該出現的位置：

```html
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://ecoku.example.com"
  data-site-id="blog"
  data-page-key="/posts/hello-world/"
  data-page-title="你好，世界"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新載入評論</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://ecoku.example.com/client/ecoku-loader.js" defer></script>
```

需要替換的是：

- `data-server-url` 和 `<script src>` 裡的位址：你的 Ecoku 位址；
- `data-site-id`：後台登記的站點 ID；
- `data-page-key` 和 `data-page-title`：用範本變數輸出目前文章的路徑和標題，寫法見 [下文](#page-key)。

四個帶 `data-ecoku-*` 的子元素都要保留。`data-ecoku-mount` 是評論區出現的位置，另外三個用來在載入失敗時顯示錯誤和「重新載入評論」按鈕。按鈕文字可以修改。

## 屬性

| 屬性 | 必填 | 說明 |
| --- | :---: | --- |
| `data-server-url` | 是 | Ecoku 的位址，`http://` 或 `https://` 開頭 |
| `data-site-id` | 是 | 站點 ID |
| `data-page-key` | 是 | 頁面 key：站內路徑，最長 512 個字元，不帶 `?` 或 `#` |
| `data-page-title` | 否 | 文章標題，用於通知，最長 200 個字元 |
| `data-page-size` | 否 | 每頁根評論數，1～100，預設 10 |
| `data-theme` | 否 | `auto`（預設）、`light` 或 `dark`，見 [明暗模式](./custom-css#theme) |
| `data-css-url` | 否 | 替換預設樣式，見 [自訂樣式](./custom-css) |
| `data-i18n` | 否 | 評論區語言：`zh-CN`、`zh-Hant` 或 `en`，覆寫後台站點設定 |

## 頁面 key 怎麼寫 {#page-key}

頁面 key 決定評論屬於哪篇文章，[定下來就不要再改](../reference/concepts#page-key)。通常用文章的站內路徑：

::: v-pre
| 產生器 | `data-page-key` |
| --- | --- |
| Hugo | `{{ .RelPermalink }}` |
| Hexo | `<%- url_for(page.path) %>` |
| Jekyll | `{{ page.url }}` |
| Astro | `{Astro.url.pathname}` |
| VitePress | 用 [SDK](./sdk#vitepress) 接入，傳入 `useRoute().path` |
:::

寫好後在瀏覽器裡檢視產生的 HTML，確認輸出的是 `/posts/hello-world/` 這樣穩定的路徑，而不是完整 URL。

Hugo PaperMod 主題有現成的範本，見 [Hugo PaperMod](./hugo)。

## 載入過程

1. 頁面解析完後，載入器讀取外層元素上的屬性。缺少必填屬性或 `data-ecoku-*` 子元素時，它什麼也不做，頁面上不出現任何內容。
2. 載入器從自己所在的目錄載入 `ecoku.umd.js`，同時請求第一頁評論。
3. 腳本載入失敗、初始化失敗或超過 12 秒時，顯示錯誤訊息和「重新載入評論」按鈕。
4. 評論區出現後，如果評論介面出錯（來源沒登記、觸發限流、網路中斷），評論區自己顯示「評論暫時無法使用」和重試按鈕。

載入器只處理啟動時已經在頁面上的外層元素。單頁應用程式切換文章時，用 [SDK](./sdk) 管理評論區。

一個頁面上可以放多個外層元素，每個用不同的 `id` 和掛載元素，`data-css-url` 要相同。

## 部落格頁面的 CSP

部落格設定了內容安全政策（CSP）時，需要放行：

- `script-src` 和 `connect-src`：Ecoku 的來源，如 `https://ecoku.example.com`；
- 預設樣式以 `<style>` 元素注入。不允許內嵌樣式時，把 `data-css-url` 設為 `https://ecoku.example.com/client/ecoku.css`，並在 `style-src` 裡放行這個來源；
- 啟用了人機驗證：見 [部落格頁面的 CSP](../admin/captcha#csp)；
- 啟用了 Smoji：`connect-src` 放行清單來源，`img-src` 放行圖片來源。

## 自行託管載入器

可以把 `ecoku-loader.js` 放到自己的 CDN 上，只改 `<script src>`。載入器從同一目錄載入 `ecoku.umd.js`，所以兩個檔案要放在一起，升級 Ecoku 時一起更新。

## 不用載入器

想自己控制初始化時機的話，直接引入 UMD 檔案：

```html
<link rel="stylesheet" href="https://ecoku.example.com/client/ecoku.css">
<div id="ecoku-mount"></div>
<script src="https://ecoku.example.com/client/ecoku.umd.js"></script>
<script>
  const comments = new Ecoku({
    container: '#ecoku-mount',
    serverURL: 'https://ecoku.example.com',
    siteId: 'blog',
    pageKey: '/posts/hello-world/',
    pageTitle: '你好，世界',
    cssURL: 'https://ecoku.example.com/client/ecoku.css',
  })
  comments.init().catch(console.error)
</script>
```

UMD 檔案註冊全域變數 `Ecoku`。這裡用 `<link>` 引入樣式，並透過 `cssURL` 告訴 SDK 不必再注入；去掉這兩處，SDK 會自己注入預設樣式。設定項見 [JavaScript SDK](./sdk)。
